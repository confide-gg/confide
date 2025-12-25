import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authService } from "../core/auth/AuthService";
import { cryptoService } from "../core/crypto/crypto";
import { profileService } from "../features/profiles/profiles";
import { recoveryService } from "../core/auth/RecoveryService";
import { keyService } from "../core/crypto/KeyService";
import { httpClient } from "../core/network/HttpClient";
import { preferenceService } from "../features/settings/preferences";
import { secureKeyStore } from "../core/crypto/SecureKeyStore";
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

interface StoredPrekeys {
  signedPrekey: SignedPrekey;
  oneTimePrekeys: { [key: number]: number[] };
}

async function saveAuthToStorage(user: PublicUser, keys: DecryptedKeys) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user }));
  await secureKeyStore.saveKeys(keys);
}

async function loadAuthFromStorage(): Promise<{ user: PublicUser; keys: DecryptedKeys } | null> {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;

  try {
    const data = JSON.parse(stored);

    if (!data.user) {
      console.error("[Auth] Invalid stored auth data: missing user");
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    const keys = await secureKeyStore.loadKeys();
    if (!keys) {
      console.error("[Auth] No keys found in secure storage");
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    if (keys.kem_secret_key && Array.isArray(keys.kem_secret_key)) {
      if (keys.kem_secret_key.length === 0) {
        console.error(`[Auth] Invalid KEM secret key: empty array`);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        await secureKeyStore.clearKeys();
        return null;
      }
    }

    return { user: data.user, keys };
  } catch (err) {
    console.error("[Auth] Failed to parse stored auth:", err);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

async function savePrekeySecrets(signedPrekey: SignedPrekey, oneTimePrekeys: OneTimePrekey[]) {
  const data: StoredPrekeys = {
    signedPrekey,
    oneTimePrekeys: {},
  };
  for (const otpk of oneTimePrekeys) {
    data.oneTimePrekeys[otpk.prekey_id] = otpk.secret_key;
  }
  await secureKeyStore.savePrekeySecrets(data);
}

async function loadPrekeySecrets(): Promise<StoredPrekeys | null> {
  return secureKeyStore.loadPrekeySecrets<StoredPrekeys>();
}

async function addOneTimePrekeySecrets(newPrekeys: OneTimePrekey[]) {
  const existing = await loadPrekeySecrets();
  if (!existing) return;
  for (const otpk of newPrekeys) {
    existing.oneTimePrekeys[otpk.prekey_id] = otpk.secret_key;
  }
  await secureKeyStore.savePrekeySecrets(existing);
}

export async function getPrekeySecrets(): Promise<StoredPrekeys | null> {
  try {
    return loadPrekeySecrets();
  } catch {
    return null;
  }
}

async function clearAuthStorage() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  await secureKeyStore.clearAll();
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
    const loadAuth = async () => {
      const token = await secureKeyStore.loadAuthToken();
      const savedAuth = await loadAuthFromStorage();

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
        await clearAuthStorage();
        httpClient.setAuthToken(null);
        setState({
          user: null,
          keys: null,
          profile: null,
          preferences: null,
          isLoading: false,
          isAuthenticated: false,
          needsRecoverySetup: false,
        });
      }
    };
    loadAuth();
  }, [fetchProfile, fetchPreferences]);

  const login = async (username: string, password: string) => {
    const response = await authService.login({ username, password });
    await secureKeyStore.saveAuthToken(response.token);
    httpClient.setAuthToken(response.token);

    const decryptedKeys = await cryptoService.decryptKeys(
      password,
      response.user.kem_public_key,
      response.kem_encrypted_private,
      response.user.dsa_public_key,
      response.dsa_encrypted_private,
      response.key_salt
    );

    await saveAuthToStorage(response.user, decryptedKeys);

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
      const storedPrekeys = await loadPrekeySecrets();

      if (count < 20 || !storedPrekeys) {
        const signedPrekey =
          storedPrekeys?.signedPrekey ||
          (await cryptoService.generateSignedPrekey(decryptedKeys.dsa_secret_key));
        const needed = Math.max(0, 100 - count);
        const newPrekeys = needed > 0 ? await cryptoService.generateOneTimePrekeys(needed) : [];

        if (!storedPrekeys) {
          await savePrekeySecrets(signedPrekey, newPrekeys);
        } else if (newPrekeys.length > 0) {
          await addOneTimePrekeySecrets(newPrekeys);
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
    const yieldToMain = () => new Promise((r) => setTimeout(r, 0));

    const encryptedKeys = await cryptoService.generateKeys(password);
    await yieldToMain();

    const response = await authService.register({
      username,
      password,
      kem_public_key: encryptedKeys.kem_public_key,
      kem_encrypted_private: encryptedKeys.kem_encrypted_private,
      dsa_public_key: encryptedKeys.dsa_public_key,
      dsa_encrypted_private: encryptedKeys.dsa_encrypted_private,
      key_salt: encryptedKeys.key_salt,
    });

    await secureKeyStore.saveAuthToken(response.token);
    httpClient.setAuthToken(response.token);
    await yieldToMain();

    const decryptedKeys = await cryptoService.decryptKeys(
      password,
      encryptedKeys.kem_public_key,
      encryptedKeys.kem_encrypted_private,
      encryptedKeys.dsa_public_key,
      encryptedKeys.dsa_encrypted_private,
      encryptedKeys.key_salt
    );
    await yieldToMain();

    if (!decryptedKeys.kem_secret_key || decryptedKeys.kem_secret_key.length === 0) {
      throw new Error(`Invalid KEM secret key generated: empty or missing`);
    }

    const signedPrekey = await cryptoService.generateSignedPrekey(decryptedKeys.dsa_secret_key);
    await yieldToMain();

    const oneTimePrekeys = await cryptoService.generateOneTimePrekeys(100);
    await yieldToMain();

    await savePrekeySecrets(signedPrekey, oneTimePrekeys);

    await keyService.uploadPrekeys({
      signed_prekey_public: signedPrekey.public_key,
      signed_prekey_signature: signedPrekey.signature,
      signed_prekey_id: signedPrekey.prekey_id,
      one_time_prekeys: oneTimePrekeys.map((p) => ({
        prekey_id: p.prekey_id,
        public_key: p.public_key,
      })),
    });

    await saveAuthToStorage(response.user, decryptedKeys);

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
    await clearAuthStorage();
    httpClient.setAuthToken(null);
    setState({
      user: null,
      keys: null,
      profile: null,
      preferences: null,
      isLoading: false,
      isAuthenticated: false,
      needsRecoverySetup: false,
    });
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
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshProfile,
        refreshPreferences,
        checkRecoveryStatus,
        completeRecoverySetup,
      }}
    >
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
