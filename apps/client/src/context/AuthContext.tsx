import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authService } from "../core/auth/AuthService";
import { cryptoService } from "../core/crypto/crypto";
import { profileService } from "../features/profiles/profiles";
import { recoveryService } from "../core/auth/RecoveryService";
import { keyService } from "../core/crypto/KeyService";
import { httpClient } from "../core/network/HttpClient";
import { preferenceService } from "../features/settings/preferences";
import type { PublicUser, LoginResponse } from "../core/auth/types";
import type { DecryptedKeys, SignedPrekey, OneTimePrekey } from "../core/crypto/crypto";
import type { UserProfile } from "../features/profiles/types";
import type { UserPreferences } from "../features/settings/preferences";

interface AuthState {
  user: PublicUser | null;
  keys: DecryptedKeys | null;
  profile: UserProfile | null;
  preferences: UserPreferences | null;
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
  refreshPreferences: () => Promise<void>;
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

    if (!data.user || !data.keys) {
      console.error("[Auth] Invalid stored auth data: missing user or keys");
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

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
    localStorage.removeItem(AUTH_STORAGE_KEY);
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
  const jsonBytes = cryptoService.stringToBytes(JSON.stringify(data));
  const encrypted = await cryptoService.encryptData(userKeys.kem_secret_key, jsonBytes);
  localStorage.setItem(PREKEY_STORAGE_KEY, JSON.stringify(encrypted));
}

async function loadPrekeySecrets(userKeys: DecryptedKeys): Promise<StoredPrekeys | null> {
  const stored = localStorage.getItem(PREKEY_STORAGE_KEY);
  if (!stored) return null;
  try {
    const encrypted = JSON.parse(stored) as number[];
    const decrypted = await cryptoService.decryptData(userKeys.kem_secret_key, encrypted);
    return JSON.parse(cryptoService.bytesToString(decrypted));
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
  const jsonBytes = cryptoService.stringToBytes(JSON.stringify(existing));
  const encrypted = await cryptoService.encryptData(userKeys.kem_secret_key, jsonBytes);
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
    preferences: null,
    isLoading: true,
    isAuthenticated: false,
    needsRecoverySetup: false,
  });

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await profileService.getMyProfile();
      setState((prev) => ({ ...prev, profile }));
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    try {
      const prefs = await preferenceService.getPreferences();
      setState((prev) => ({ ...prev, preferences: prefs }));
    } catch (err) {
      console.error("Failed to fetch preferences:", err);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const savedAuth = loadAuthFromStorage();

    if (token && savedAuth) {
      httpClient.setAuthToken(token);
      setState({
        user: savedAuth.user,
        keys: savedAuth.keys,
        profile: null,
        preferences: null,
        isLoading: false,
        isAuthenticated: true,
        needsRecoverySetup: false,
      });
      fetchProfile();
      fetchPreferences();
    } else {
      clearAuthStorage();
      httpClient.setAuthToken(null);
      setState({ user: null, keys: null, profile: null, preferences: null, isLoading: false, isAuthenticated: false, needsRecoverySetup: false });
    }
  }, [fetchProfile]);

  const login = async (username: string, password: string) => {
    const response = await authService.login({ username, password });
    localStorage.setItem("auth_token", response.token);
    httpClient.setAuthToken(response.token);

    const decryptedKeys = await cryptoService.decryptKeys(
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
      preferences: null,
      isLoading: false,
      isAuthenticated: true,
      needsRecoverySetup: false,
    });
    fetchProfile();
    fetchPreferences();

    try {
      const { count } = await keyService.getPrekeyCount();
      const storedPrekeys = await loadPrekeySecrets(decryptedKeys);

      if (count < 20 || !storedPrekeys) {
        const signedPrekey = storedPrekeys?.signedPrekey || await cryptoService.generateSignedPrekey(decryptedKeys.dsa_secret_key);
        const needed = Math.max(0, 100 - count);
        const newPrekeys = needed > 0 ? await cryptoService.generateOneTimePrekeys(needed) : [];

        if (!storedPrekeys) {
          await savePrekeySecrets(decryptedKeys, signedPrekey, newPrekeys);
        } else if (newPrekeys.length > 0) {
          await addOneTimePrekeySecrets(decryptedKeys, newPrekeys);
        }

        if (newPrekeys.length > 0) {
          await keyService.uploadPrekeys({
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
    const encryptedKeys = await cryptoService.generateKeys(password);

    const response = await authService.register({
      username,
      password,
      kem_public_key: encryptedKeys.kem_public_key,
      kem_encrypted_private: encryptedKeys.kem_encrypted_private,
      dsa_public_key: encryptedKeys.dsa_public_key,
      dsa_encrypted_private: encryptedKeys.dsa_encrypted_private,
      key_salt: encryptedKeys.key_salt,
    });

    localStorage.setItem("auth_token", response.token);
    httpClient.setAuthToken(response.token);

    const decryptedKeys = await cryptoService.decryptKeys(
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
      const testData = cryptoService.stringToBytes("test");
      const testEncrypted = await cryptoService.encryptForRecipient(decryptedKeys.kem_public_key, testData);
      const testDecrypted = await cryptoService.decryptFromSender(decryptedKeys.kem_secret_key, testEncrypted);
      const testResult = cryptoService.bytesToString(testDecrypted);
      if (testResult !== "test") {
        throw new Error("Key pair validation failed: roundtrip test mismatch");
      }
      console.error("[Auth] Key pair validation passed");
    } catch (err) {
      console.error("[Auth] Key pair validation FAILED:", err);
      throw new Error(`Key pair validation failed: ${err}`);
    }

    const signedPrekey = await cryptoService.generateSignedPrekey(decryptedKeys.dsa_secret_key);
    const oneTimePrekeys = await cryptoService.generateOneTimePrekeys(100);

    await savePrekeySecrets(decryptedKeys, signedPrekey, oneTimePrekeys);

    await keyService.uploadPrekeys({
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
      preferences: null,
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
      await authService.logout();
    } catch {
      // ignore
    }
    clearAuthStorage();
    httpClient.setAuthToken(null);
    setState({ user: null, keys: null, profile: null, preferences: null, isLoading: false, isAuthenticated: false, needsRecoverySetup: false });
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

  const refreshPreferences = useCallback(async () => {
    await fetchPreferences();
  }, [fetchPreferences]);

  const checkRecoveryStatus = useCallback(async () => {
    try {
      const status = await recoveryService.getRecoveryStatus();
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
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshProfile, refreshPreferences, checkRecoveryStatus, completeRecoverySetup }}>
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
