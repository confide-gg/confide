import { Store } from '@tauri-apps/plugin-store';
import type { DecryptedKeys } from './crypto';

class SecureKeyStore {
  private store: Store | null = null;

  private async getStore(): Promise<Store> {
    if (!this.store) {
      this.store = await Store.load('secure-keys.json', { autoSave: true });
    }
    return this.store;
  }

  async saveKeys(keys: DecryptedKeys): Promise<void> {
    const store = await this.getStore();
    await store.set('user_keys', keys);
    await store.save();
  }

  async loadKeys(): Promise<DecryptedKeys | null> {
    const store = await this.getStore();
    const keys = await store.get<DecryptedKeys>('user_keys');
    return keys || null;
  }

  async clearKeys(): Promise<void> {
    const store = await this.getStore();
    await store.delete('user_keys');
    await store.save();
  }

  async has(): Promise<boolean> {
    const store = await this.getStore();
    return await store.has('user_keys');
  }
}

export const secureKeyStore = new SecureKeyStore();
