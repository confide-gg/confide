import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { auth, crypto, profiles, recovery, keys, setAuthToken } from "../api";
import type { PublicUser, LoginResponse } from "../api";
import type { DecryptedKeys, SignedPrekey, OneTimePrekey } from "../api/crypto";
import type { UserProfile } from "../types";

interface AuthState {
  user: PublicUser | null;
  keys: DecryptedKeys | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsRecoverySetup: boolean;
}

interface RegisterResult {
  needsRecoverySetup: boolean;
  keys: DecryptedKeys;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<LoginResponse>;
  register: (username: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkRecoveryStatus: () => Promise<boolean>;
  completeRecoverySetup: () => void;
}

const AUTH_STORAGE_KEY = "confide_auth_state";
const PREKEY_STORAGE_KEY = "confide_prekey_secrets";

interface StoredPrekeys {
  signedPrekey: SignedPrekey;
  oneTimePrekeys: { [key: number]: number[] };
}

function saveAuthToStorage(user: PublicUser, keys: DecryptedKeys) {
  const data = { user, keys };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

function loadAuthFromStorage(): { user: PublicUser; keys: DecryptedKeys } | null {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  try {
    const data = JSON.parse(stored);

    if (data.keys?.kem_secret_key && Array.isArray(data.keys.kem_secret_key)) {
      if (data.keys.kem_secret_key.length === 0) {
        console.error(`[Auth] Invalid KEM secret key: empty array`);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
    }

    return data;
  } catch (err) {
    console.error("[Auth] Failed to parse stored auth:", err);
    return null;
  }
}

async function savePrekeySecrets(userKeys: DecryptedKeys, signedPrekey: SignedPrekey, oneTimePrekeys: OneTimePrekey[]) {
  const data: StoredPrekeys = {
    signedPrekey,
    oneTimePrekeys: {},
  };
  for (const otpk of oneTimePrekeys) {
    data.oneTimePrekeys[otpk.prekey_id] = otpk.secret_key;
  }
  const jsonBytes = crypto.stringToBytes(JSON.stringify(data));
  const encrypted = await crypto.encryptData(userKeys.kem_secret_key, jsonBytes);
  localStorage.setItem(PREKEY_STORAGE_KEY, JSON.stringify(encrypted));
}

async function loadPrekeySecrets(userKeys: DecryptedKeys): Promise<StoredPrekeys | null> {
  const stored = localStorage.getItem(PREKEY_STORAGE_KEY);
  if (!stored) return null;
  try {
    const encrypted = JSON.parse(stored) as number[];
    const decrypted = await crypto.decryptData(userKeys.kem_secret_key, encrypted);
    return JSON.parse(crypto.bytesToString(decrypted));
  } catch {
    return null;
  }
}

async function addOneTimePrekeySecrets(userKeys: DecryptedKeys, newPrekeys: OneTimePrekey[]) {
  const existing = await loadPrekeySecrets(userKeys);
  if (!existing) return;
  for (const otpk of newPrekeys) {
    existing.oneTimePrekeys[otpk.prekey_id] = otpk.secret_key;
  }
  const jsonBytes = crypto.stringToBytes(JSON.stringify(existing));
  const encrypted = await crypto.encryptData(userKeys.kem_secret_key, jsonBytes);
  localStorage.setItem(PREKEY_STORAGE_KEY, JSON.stringify(encrypted));
}

export function getPrekeySecrets(): Promise<StoredPrekeys | null> {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return Promise.resolve(null);
  try {
    const auth = JSON.parse(stored) as { keys: DecryptedKeys };
    return loadPrekeySecrets(auth.keys);
  } catch {
    return Promise.resolve(null);
  }
}

function clearAuthStorage() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem("auth_token");
  localStorage.removeItem(PREKEY_STORAGE_KEY);
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    keys: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
    needsRecoverySetup: false,
  });

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await profiles.getMyProfile();
      setState((prev) => ({ ...prev, profile }));
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const savedAuth = loadAuthFromStorage();

    if (token && savedAuth) {
      setAuthToken(token);
      setState({
        user: savedAuth.user,
        keys: savedAuth.keys,
        profile: null,
        isLoading: false,
        isAuthenticated: true,
        needsRecoverySetup: false,
      });
      fetchProfile();
    } else {
      clearAuthStorage();
      setAuthToken(null);
      setState({ user: null, keys: null, profile: null, isLoading: false, isAuthenticated: false, needsRecoverySetup: false });
    }
  }, [fetchProfile]);

  const login = async (username: string, password: string) => {
    const response = await auth.login({ username, password });
    localStorage.setItem("auth_token", response.token);
    setAuthToken(response.token);

    const decryptedKeys = await crypto.decryptKeys(
      password,
      response.user.kem_public_key,
      response.kem_encrypted_private,
      response.user.dsa_public_key,
      response.dsa_encrypted_private,
      response.key_salt
    );

    saveAuthToStorage(response.user, decryptedKeys);

    setState({
      user: response.user,
      keys: decryptedKeys,
      profile: null,
      isLoading: false,
      isAuthenticated: true,
      needsRecoverySetup: false,
    });
    fetchProfile();

    try {
      const { count } = await keys.getPrekeyCount();
      const storedPrekeys = await loadPrekeySecrets(decryptedKeys);

      if (count < 20 || !storedPrekeys) {
        const signedPrekey = storedPrekeys?.signedPrekey || await crypto.generateSignedPrekey(decryptedKeys.dsa_secret_key);
        const needed = Math.max(0, 100 - count);
        const newPrekeys = needed > 0 ? await crypto.generateOneTimePrekeys(needed) : [];

        if (!storedPrekeys) {
          await savePrekeySecrets(decryptedKeys, signedPrekey, newPrekeys);
        } else if (newPrekeys.length > 0) {
          await addOneTimePrekeySecrets(decryptedKeys, newPrekeys);
        }

        if (newPrekeys.length > 0) {
          await keys.uploadPrekeys({
            signed_prekey_public: signedPrekey.public_key,
            signed_prekey_signature: signedPrekey.signature,
            signed_prekey_id: signedPrekey.prekey_id,
            one_time_prekeys: newPrekeys.map((p) => ({
              prekey_id: p.prekey_id,
              public_key: p.public_key,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Failed to check/replenish prekeys:", err);
    }

    return response;
  };

  const register = async (username: string, password: string): Promise<RegisterResult> => {
    const encryptedKeys = await crypto.generateKeys(password);

    const response = await auth.register({
      username,
      password,
      kem_public_key: encryptedKeys.kem_public_key,
      kem_encrypted_private: encryptedKeys.kem_encrypted_private,
      dsa_public_key: encryptedKeys.dsa_public_key,
      dsa_encrypted_private: encryptedKeys.dsa_encrypted_private,
      key_salt: encryptedKeys.key_salt,
    });

    localStorage.setItem("auth_token", response.token);
    setAuthToken(response.token);

    const decryptedKeys = await crypto.decryptKeys(
      password,
      encryptedKeys.kem_public_key,
      encryptedKeys.kem_encrypted_private,
      encryptedKeys.dsa_public_key,
      encryptedKeys.dsa_encrypted_private,
      encryptedKeys.key_salt
    );

    if (!decryptedKeys.kem_secret_key || decryptedKeys.kem_secret_key.length === 0) {
      throw new Error(`Invalid KEM secret key generated: empty or missing`);
    }

    try {
      const testData = crypto.stringToBytes("test");
      const testEncrypted = await crypto.encryptForRecipient(decryptedKeys.kem_public_key, testData);
      const testDecrypted = await crypto.decryptFromSender(decryptedKeys.kem_secret_key, testEncrypted);
      const testResult = crypto.bytesToString(testDecrypted);
      if (testResult !== "test") {
        throw new Error("Key pair validation failed: roundtrip test mismatch");
      }
      console.error("[Auth] Key pair validation passed");
    } catch (err) {
      console.error("[Auth] Key pair validation FAILED:", err);
      throw new Error(`Key pair validation failed: ${err}`);
    }

    const signedPrekey = await crypto.generateSignedPrekey(decryptedKeys.dsa_secret_key);
    const oneTimePrekeys = await crypto.generateOneTimePrekeys(100);

    await savePrekeySecrets(decryptedKeys, signedPrekey, oneTimePrekeys);

    await keys.uploadPrekeys({
      signed_prekey_public: signedPrekey.public_key,
      signed_prekey_signature: signedPrekey.signature,
      signed_prekey_id: signedPrekey.prekey_id,
      one_time_prekeys: oneTimePrekeys.map((p) => ({
        prekey_id: p.prekey_id,
        public_key: p.public_key,
      })),
    });

    saveAuthToStorage(response.user, decryptedKeys);

    setState({
      user: response.user,
      keys: decryptedKeys,
      profile: null,
      isLoading: false,
      isAuthenticated: true,
      needsRecoverySetup: true,
    });

    fetchProfile();

    return {
      needsRecoverySetup: true,
      keys: decryptedKeys,
    };
  };

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      // ignore
    }
    clearAuthStorage();
    setAuthToken(null);
    setState({ user: null, keys: null, profile: null, isLoading: false, isAuthenticated: false, needsRecoverySetup: false });
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [logout]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const checkRecoveryStatus = useCallback(async () => {
    try {
      const status = await recovery.getRecoveryStatus();
      setState((prev) => ({ ...prev, needsRecoverySetup: !status.recovery_setup_completed }));
      return status.recovery_setup_completed;
    } catch {
      return false;
    }
  }, []);

  const completeRecoverySetup = useCallback(() => {
    setState((prev) => ({ ...prev, needsRecoverySetup: false }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshProfile, checkRecoveryStatus, completeRecoverySetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
