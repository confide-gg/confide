import { Store } from "@tauri-apps/plugin-store";
import type { DecryptedKeys } from "./crypto";

class SecureKeyStore {
  private store: Store | null = null;

  private async getStore(): Promise<Store> {
    if (!this.store) {
      this.store = await Store.load("secure-keys.json", { defaults: {}, autoSave: true });
    }
    return this.store;
  }

  async saveKeys(keys: DecryptedKeys): Promise<void> {
    const store = await this.getStore();
    await store.set("user_keys", keys);
    await store.save();
  }

  async loadKeys(): Promise<DecryptedKeys | null> {
    const store = await this.getStore();
    const keys = await store.get<DecryptedKeys>("user_keys");
    return keys || null;
  }

  async clearKeys(): Promise<void> {
    const store = await this.getStore();
    await store.delete("user_keys");
    await store.save();
  }

  async has(): Promise<boolean> {
    const store = await this.getStore();
    return await store.has("user_keys");
  }

  async saveAuthToken(token: string): Promise<void> {
    const store = await this.getStore();
    await store.set("auth_token", token);
    await store.save();
  }

  async loadAuthToken(): Promise<string | null> {
    const store = await this.getStore();
    const token = await store.get<string>("auth_token");
    return token || null;
  }

  async clearAuthToken(): Promise<void> {
    const store = await this.getStore();
    await store.delete("auth_token");
    await store.save();
  }

  async hasAuthToken(): Promise<boolean> {
    const store = await this.getStore();
    return await store.has("auth_token");
  }

  async savePrekeySecrets(data: unknown): Promise<void> {
    const store = await this.getStore();
    await store.set("prekey_secrets", data);
    await store.save();
  }

  async loadPrekeySecrets<T>(): Promise<T | null> {
    const store = await this.getStore();
    const data = await store.get<T>("prekey_secrets");
    return data || null;
  }

  async clearPrekeySecrets(): Promise<void> {
    const store = await this.getStore();
    await store.delete("prekey_secrets");
    await store.save();
  }

  async clearAll(): Promise<void> {
    const store = await this.getStore();
    await store.delete("user_keys");
    await store.delete("auth_token");
    await store.delete("prekey_secrets");
    await store.save();
  }
}

export const secureKeyStore = new SecureKeyStore();
