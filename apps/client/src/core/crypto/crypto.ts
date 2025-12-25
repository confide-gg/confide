import { invoke } from "@tauri-apps/api/core";

export interface EncryptedKeys {
  kem_public_key: number[];
  kem_encrypted_private: number[];
  dsa_public_key: number[];
  dsa_encrypted_private: number[];
  key_salt: number[];
}

export interface DecryptedKeys {
  kem_public_key: number[];
  kem_secret_key: number[];
  dsa_public_key: number[];
  dsa_secret_key: number[];
}

export interface RecoveryKeyData {
  recovery_key: number[];
  recovery_kem_encrypted_private: number[];
  recovery_dsa_encrypted_private: number[];
  recovery_key_salt: number[];
}

export interface ReEncryptedKeys {
  encrypted_keys: EncryptedKeys;
  recovery_data: RecoveryKeyData;
}

export interface SignedPrekey {
  prekey_id: number;
  public_key: number[];
  secret_key: number[];
  signature: number[];
}

export interface OneTimePrekey {
  prekey_id: number;
  public_key: number[];
  secret_key: number[];
}

export interface MessageHeader {
  sender_ratchet_public: number[];
  ratchet_ciphertext: number[] | null;
  previous_chain_length: number;
  message_number: number;
}

export interface EncryptedRatchetMessage {
  header: MessageHeader;
  ciphertext: number[];
}

export interface InitialSessionResult {
  state: number[];
  key_bundle: number[];
}

export interface RatchetEncryptResult {
  message: EncryptedRatchetMessage;
  new_state: number[];
  message_key: number[];
}

export interface RatchetDecryptResult {
  plaintext: number[];
  new_state: number[];
}

export interface EncryptGroupMessageResult {
  ciphertext: number[];
  chain_id: number;
  iteration: number;
  new_state: number[];
}

class CryptoService {
  public async generateKeys(password: string): Promise<EncryptedKeys> {
    return invoke<EncryptedKeys>("generate_keys", { password });
  }

  public async decryptKeys(
    password: string,
    kemPublicKey: number[],
    kemEncryptedPrivate: number[],
    dsaPublicKey: number[],
    dsaEncryptedPrivate: number[],
    keySalt: number[]
  ): Promise<DecryptedKeys> {
    return invoke<DecryptedKeys>("decrypt_keys", {
      password,
      kemPublicKey,
      kemEncryptedPrivate,
      dsaPublicKey,
      dsaEncryptedPrivate,
      keySalt,
    });
  }

  public async encryptData(kemSecretKey: number[], data: number[]): Promise<number[]> {
    return invoke<number[]>("encrypt_data", { kemSecretKey, data });
  }

  public async decryptData(kemSecretKey: number[], encrypted: number[]): Promise<number[]> {
    return invoke<number[]>("decrypt_data", { kemSecretKey, encrypted });
  }

  public async generateConversationKey(): Promise<number[]> {
    return invoke<number[]>("generate_conversation_key");
  }

  public async encryptForRecipient(
    recipientPublicKey: number[],
    data: number[]
  ): Promise<number[]> {
    return invoke<number[]>("encrypt_for_recipient", { recipientPublicKey, data });
  }

  public async decryptFromSender(mySecretKey: number[], encrypted: number[]): Promise<number[]> {
    return invoke<number[]>("decrypt_from_sender", { mySecretKey, encrypted });
  }

  public async encryptWithKey(key: number[], data: number[]): Promise<number[]> {
    return invoke<number[]>("encrypt_with_key", { key, data });
  }

  public async decryptWithKey(key: number[], encrypted: number[]): Promise<number[]> {
    return invoke<number[]>("decrypt_with_key", { key, encrypted });
  }

  public async dsaSign(secretKey: number[], message: number[]): Promise<number[]> {
    return invoke<number[]>("dsa_sign", { secretKey, message });
  }

  public async dsaVerify(
    publicKey: number[],
    message: number[],
    signature: number[]
  ): Promise<boolean> {
    return invoke<boolean>("dsa_verify", { publicKey, message, signature });
  }

  public stringToBytes(str: string): number[] {
    return Array.from(new TextEncoder().encode(str));
  }

  public bytesToString(bytes: number[]): string {
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  public async generateRecoveryKey(): Promise<number[]> {
    return invoke<number[]>("generate_recovery_key");
  }

  public async encryptKeysWithRecovery(
    recoveryKey: number[],
    kemSecretKey: number[],
    dsaSecretKey: number[]
  ): Promise<RecoveryKeyData> {
    return invoke<RecoveryKeyData>("encrypt_keys_with_recovery", {
      recoveryKey,
      kemSecretKey,
      dsaSecretKey,
    });
  }

  public async decryptKeysWithRecovery(
    recoveryKey: number[],
    kemEncryptedPrivate: number[],
    dsaEncryptedPrivate: number[],
    recoveryKeySalt: number[]
  ): Promise<DecryptedKeys> {
    return invoke<DecryptedKeys>("decrypt_keys_with_recovery", {
      recoveryKey,
      kemEncryptedPrivate,
      dsaEncryptedPrivate,
      recoveryKeySalt,
    });
  }

  public async reEncryptKeysForNewPassword(
    password: string,
    recoveryKey: number[],
    kemPublicKey: number[],
    kemSecretKey: number[],
    dsaPublicKey: number[],
    dsaSecretKey: number[]
  ): Promise<ReEncryptedKeys> {
    return invoke<ReEncryptedKeys>("re_encrypt_keys_for_new_password", {
      password,
      recoveryKey,
      kemPublicKey,
      kemSecretKey,
      dsaPublicKey,
      dsaSecretKey,
    });
  }

  public bytesToHex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  public hexToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  public async generateSignedPrekey(dsaSecretKey: number[]): Promise<SignedPrekey> {
    return invoke<SignedPrekey>("generate_signed_prekey", { dsaSecretKey });
  }

  public async generateOneTimePrekeys(count: number): Promise<OneTimePrekey[]> {
    return invoke<OneTimePrekey[]>("generate_one_time_prekeys", { count });
  }

  public async createInitialRatchetSession(
    ourIdentitySecret: number[],
    theirIdentityPublic: number[],
    theirSignedPrekeyPublic: number[],
    theirOneTimePrekeyPublic: number[] | null
  ): Promise<InitialSessionResult> {
    return invoke<InitialSessionResult>("create_initial_ratchet_session", {
      ourIdentitySecret,
      theirIdentityPublic,
      theirSignedPrekeyPublic,
      theirOneTimePrekeyPublic,
    });
  }

  public async acceptRatchetSession(
    ourIdentitySecret: number[],
    ourSignedPrekeySecret: number[],
    ourOneTimePrekeySecret: number[] | null,
    keyBundle: number[]
  ): Promise<number[]> {
    return invoke<number[]>("accept_ratchet_session", {
      ourIdentitySecret,
      ourSignedPrekeySecret,
      ourOneTimePrekeySecret,
      keyBundle,
    });
  }

  public async ratchetEncrypt(
    stateBytes: number[],
    plaintext: number[]
  ): Promise<RatchetEncryptResult> {
    return invoke<RatchetEncryptResult>("ratchet_encrypt", { stateBytes, plaintext });
  }

  public async ratchetDecrypt(
    stateBytes: number[],
    message: EncryptedRatchetMessage
  ): Promise<RatchetDecryptResult> {
    return invoke<RatchetDecryptResult>("ratchet_decrypt", { stateBytes, message });
  }

  public async generateSafetyNumber(
    ourIdentityKey: number[],
    theirIdentityKey: number[]
  ): Promise<string> {
    return invoke<string>("generate_safety_number", { ourIdentityKey, theirIdentityKey });
  }

  public async decryptWithMessageKey(
    messageKey: number[],
    ciphertext: number[]
  ): Promise<number[]> {
    return invoke<number[]>("decrypt_with_message_key", { messageKey, ciphertext });
  }

  public async createSenderKeyState(): Promise<number[]> {
    return invoke<number[]>("create_sender_key_state");
  }

  public async encryptGroupMessage(
    stateBytes: number[],
    plaintext: number[]
  ): Promise<EncryptGroupMessageResult> {
    return invoke<EncryptGroupMessageResult>("encrypt_group_message", { stateBytes, plaintext });
  }

  public async decryptGroupMessage(
    stateBytes: number[],
    targetChainId: number,
    targetIteration: number,
    ciphertext: number[]
  ): Promise<number[]> {
    return invoke<number[]>("decrypt_group_message", {
      stateBytes,
      targetChainId,
      targetIteration,
      ciphertext,
    });
  }

  public async updateSenderKeyStateAfterDecrypt(
    stateBytes: number[],
    targetIteration: number
  ): Promise<number[]> {
    return invoke<number[]>("update_sender_key_state_after_decrypt", {
      stateBytes,
      targetIteration,
    });
  }

  public async generateChannelKey(): Promise<number[]> {
    return invoke<number[]>("generate_channel_key");
  }

  public async encryptWithChannelKey(channelKey: number[], plaintext: number[]): Promise<number[]> {
    return invoke<number[]>("encrypt_with_channel_key", { channelKey, plaintext });
  }

  public async decryptWithChannelKey(
    channelKey: number[],
    ciphertext: number[]
  ): Promise<number[]> {
    return invoke<number[]>("decrypt_with_channel_key", { channelKey, ciphertext });
  }
}

export const cryptoService = new CryptoService();
