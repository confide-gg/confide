use confide_sdk::crypto::{
    self, DecryptedKeys as SdkDecryptedKeys, DsaKeyPair, EncryptedKeys as SdkEncryptedKeys,
    EncryptedMessage, MessageHeader, OneTimePrekey as SdkOneTimePrekey, RatchetState,
    RecoveryKeyData as SdkRecoveryKeyData, SignedPrekey as SdkSignedPrekey,
};
use confide_sdk::SdkError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Crypto error: {0}")]
    Crypto(String),
}

impl From<SdkError> for CryptoError {
    fn from(e: SdkError) -> Self {
        CryptoError::Crypto(e.to_string())
    }
}

impl serde::Serialize for CryptoError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, CryptoError>;

#[derive(serde::Serialize)]
pub struct EncryptedKeys {
    pub kem_public_key: Vec<u8>,
    pub kem_encrypted_private: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
    pub dsa_encrypted_private: Vec<u8>,
    pub key_salt: Vec<u8>,
}

impl From<SdkEncryptedKeys> for EncryptedKeys {
    fn from(k: SdkEncryptedKeys) -> Self {
        Self {
            kem_public_key: k.kem_public_key,
            kem_encrypted_private: k.kem_encrypted_private,
            dsa_public_key: k.dsa_public_key,
            dsa_encrypted_private: k.dsa_encrypted_private,
            key_salt: k.key_salt,
        }
    }
}

#[derive(serde::Serialize)]
pub struct DecryptedKeys {
    pub kem_public_key: Vec<u8>,
    pub kem_secret_key: Vec<u8>,
    pub dsa_public_key: Vec<u8>,
    pub dsa_secret_key: Vec<u8>,
}

impl From<SdkDecryptedKeys> for DecryptedKeys {
    fn from(k: SdkDecryptedKeys) -> Self {
        let (kem_public_key, kem_secret_key, dsa_public_key, dsa_secret_key) = k.into_parts();
        Self {
            kem_public_key,
            kem_secret_key,
            dsa_public_key,
            dsa_secret_key,
        }
    }
}

#[derive(serde::Serialize)]
pub struct RecoveryKeyData {
    pub recovery_key: Vec<u8>,
    pub recovery_kem_encrypted_private: Vec<u8>,
    pub recovery_dsa_encrypted_private: Vec<u8>,
    pub recovery_key_salt: Vec<u8>,
}

impl From<SdkRecoveryKeyData> for RecoveryKeyData {
    fn from(k: SdkRecoveryKeyData) -> Self {
        let (
            recovery_key,
            recovery_kem_encrypted_private,
            recovery_dsa_encrypted_private,
            recovery_key_salt,
        ) = k.into_parts();
        Self {
            recovery_key,
            recovery_kem_encrypted_private,
            recovery_dsa_encrypted_private,
            recovery_key_salt,
        }
    }
}

#[derive(serde::Serialize)]
pub struct SignedPrekey {
    pub prekey_id: i32,
    pub public_key: Vec<u8>,
    pub secret_key: Vec<u8>,
    pub signature: Vec<u8>,
}

impl From<SdkSignedPrekey> for SignedPrekey {
    fn from(k: SdkSignedPrekey) -> Self {
        let (prekey_id, public_key, secret_key, signature) = k.into_parts();
        Self {
            prekey_id,
            public_key,
            secret_key,
            signature,
        }
    }
}

#[derive(serde::Serialize)]
pub struct OneTimePrekey {
    pub prekey_id: i32,
    pub public_key: Vec<u8>,
    pub secret_key: Vec<u8>,
}

impl From<SdkOneTimePrekey> for OneTimePrekey {
    fn from(k: SdkOneTimePrekey) -> Self {
        let (prekey_id, public_key, secret_key) = k.into_parts();
        Self {
            prekey_id,
            public_key,
            secret_key,
        }
    }
}

#[derive(serde::Serialize)]
pub struct EncryptGroupMessageResult {
    pub ciphertext: Vec<u8>,
    pub chain_id: i32,
    pub iteration: i32,
    pub new_state: Vec<u8>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct EncryptedRatchetMessage {
    pub header: RatchetMessageHeader,
    pub ciphertext: Vec<u8>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct RatchetMessageHeader {
    pub sender_ratchet_public: Vec<u8>,
    pub ratchet_ciphertext: Option<Vec<u8>>,
    pub previous_chain_length: u32,
    pub message_number: u32,
}

#[derive(serde::Serialize)]
pub struct InitialSessionResult {
    pub state: Vec<u8>,
    pub key_bundle: Vec<u8>,
}

#[derive(serde::Serialize)]
pub struct RatchetEncryptResult {
    pub message: EncryptedRatchetMessage,
    pub new_state: Vec<u8>,
    pub message_key: Vec<u8>,
}

#[derive(serde::Serialize)]
pub struct RatchetDecryptResult {
    pub plaintext: Vec<u8>,
    pub new_state: Vec<u8>,
}

pub fn generate_and_encrypt_keys(password: &str) -> Result<EncryptedKeys> {
    crypto::generate_and_encrypt_keys(password)
        .map(|k| k.into())
        .map_err(|e| e.into())
}

pub fn decrypt_keys(
    password: &str,
    kem_public_key: &[u8],
    kem_encrypted_private: &[u8],
    dsa_public_key: &[u8],
    dsa_encrypted_private: &[u8],
    key_salt: &[u8],
) -> Result<DecryptedKeys> {
    crypto::decrypt_keys(
        password,
        kem_public_key,
        kem_encrypted_private,
        dsa_public_key,
        dsa_encrypted_private,
        key_salt,
    )
    .map(|k| k.into())
    .map_err(|e| e.into())
}

pub fn encrypt_data(kem_secret_key: &[u8], data: &[u8]) -> Result<Vec<u8>> {
    crypto::encrypt_data(kem_secret_key, data).map_err(|e| e.into())
}

pub fn decrypt_data(kem_secret_key: &[u8], encrypted: &[u8]) -> Result<Vec<u8>> {
    crypto::decrypt_data(kem_secret_key, encrypted).map_err(|e| e.into())
}

pub fn generate_conversation_key() -> Vec<u8> {
    crypto::generate_conversation_key()
}

pub fn encrypt_for_recipient(recipient_public_key: &[u8], data: &[u8]) -> Result<Vec<u8>> {
    crypto::encrypt_for_recipient(recipient_public_key, data).map_err(|e| e.into())
}

pub fn decrypt_from_sender(my_secret_key: &[u8], encrypted: &[u8]) -> Result<Vec<u8>> {
    crypto::decrypt_from_sender(my_secret_key, encrypted).map_err(|e| e.into())
}

pub fn encrypt_with_key(key: &[u8], data: &[u8]) -> Result<Vec<u8>> {
    crypto::encrypt_aes_gcm(key, data).map_err(|e| e.into())
}

pub fn decrypt_with_key(key: &[u8], encrypted: &[u8]) -> Result<Vec<u8>> {
    crypto::decrypt_aes_gcm(key, encrypted).map_err(|e| e.into())
}

pub fn dsa_sign(secret_key: &[u8], message: &[u8]) -> Result<Vec<u8>> {
    let keypair =
        DsaKeyPair::from_bytes(&[], secret_key).map_err(|e| CryptoError::Crypto(e.to_string()))?;
    keypair.sign(message).map_err(|e| e.into())
}

pub fn dsa_verify(public_key: &[u8], message: &[u8], signature: &[u8]) -> Result<bool> {
    DsaKeyPair::verify(public_key, message, signature).map_err(|e| e.into())
}

pub fn create_sender_key_state() -> Result<Vec<u8>> {
    crypto::create_sender_key_state().map_err(|e| e.into())
}

pub fn encrypt_group_message(
    state_bytes: &[u8],
    plaintext: &[u8],
) -> Result<EncryptGroupMessageResult> {
    let (msg, new_state) = crypto::encrypt_group_message(state_bytes, plaintext)?;
    Ok(EncryptGroupMessageResult {
        ciphertext: msg.ciphertext,
        chain_id: msg.chain_id,
        iteration: msg.iteration,
        new_state,
    })
}

pub fn decrypt_group_message(
    state_bytes: &[u8],
    target_chain_id: i32,
    target_iteration: i32,
    ciphertext: &[u8],
) -> Result<Vec<u8>> {
    crypto::decrypt_group_message(state_bytes, target_chain_id, target_iteration, ciphertext)
        .map_err(|e| e.into())
}

pub fn update_sender_key_state_after_decrypt(
    state_bytes: &[u8],
    target_iteration: i32,
) -> Result<Vec<u8>> {
    crypto::update_sender_key_state_after_decrypt(state_bytes, target_iteration)
        .map_err(|e| e.into())
}

pub fn generate_recovery_key() -> Vec<u8> {
    crypto::generate_recovery_key()
}

pub fn encrypt_keys_with_recovery(
    recovery_key: &[u8],
    kem_secret_key: &[u8],
    dsa_secret_key: &[u8],
) -> Result<RecoveryKeyData> {
    crypto::encrypt_keys_with_recovery(recovery_key, kem_secret_key, dsa_secret_key)
        .map(|k| k.into())
        .map_err(|e| e.into())
}

pub fn decrypt_keys_with_recovery(
    recovery_key: &[u8],
    kem_encrypted_private: &[u8],
    dsa_encrypted_private: &[u8],
    recovery_key_salt: &[u8],
) -> Result<DecryptedKeys> {
    crypto::decrypt_keys_with_recovery(
        recovery_key,
        kem_encrypted_private,
        dsa_encrypted_private,
        recovery_key_salt,
    )
    .map(|k| k.into())
    .map_err(|e| e.into())
}

pub fn re_encrypt_keys_for_new_password(
    password: &str,
    recovery_key: &[u8],
    kem_public_key: &[u8],
    kem_secret_key: &[u8],
    dsa_public_key: &[u8],
    dsa_secret_key: &[u8],
) -> Result<(EncryptedKeys, RecoveryKeyData)> {
    let (encrypted, recovery) = crypto::re_encrypt_keys_for_new_password(
        password,
        recovery_key,
        kem_public_key,
        kem_secret_key,
        dsa_public_key,
        dsa_secret_key,
    )?;
    Ok((encrypted.into(), recovery.into()))
}

pub fn generate_signed_prekey(dsa_secret_key: &[u8]) -> Result<SignedPrekey> {
    crypto::generate_signed_prekey_from_secret(dsa_secret_key)
        .map(|k| k.into())
        .map_err(|e| e.into())
}

pub fn generate_one_time_prekeys(count: u32) -> Vec<OneTimePrekey> {
    crypto::generate_one_time_prekeys(count)
        .into_iter()
        .map(|k| k.into())
        .collect()
}

pub fn create_initial_ratchet_session(
    our_identity_secret: &[u8],
    their_identity_public: &[u8],
    their_signed_prekey_public: &[u8],
    their_one_time_prekey_public: Option<&[u8]>,
) -> Result<InitialSessionResult> {
    let (state, key_bundle) = crypto::create_initial_session(
        our_identity_secret,
        their_identity_public,
        their_signed_prekey_public,
        their_one_time_prekey_public,
        true,
    )?;

    Ok(InitialSessionResult {
        state: state.serialize()?,
        key_bundle,
    })
}

pub fn accept_ratchet_session(
    our_identity_secret: &[u8],
    our_signed_prekey_secret: &[u8],
    our_one_time_prekey_secret: Option<&[u8]>,
    key_bundle: &[u8],
) -> Result<Vec<u8>> {
    let state = crypto::accept_initial_session(
        our_identity_secret,
        our_signed_prekey_secret,
        our_one_time_prekey_secret,
        &[],
        key_bundle,
    )?;

    state.serialize().map_err(|e| e.into())
}

pub fn ratchet_encrypt(state_bytes: &[u8], plaintext: &[u8]) -> Result<RatchetEncryptResult> {
    let mut state = RatchetState::deserialize(state_bytes)?;
    let result = state.encrypt_with_key(plaintext)?;
    let new_state = state.serialize()?;

    let message = EncryptedRatchetMessage {
        header: RatchetMessageHeader {
            sender_ratchet_public: result.message.header.sender_ratchet_public,
            ratchet_ciphertext: result.message.header.ratchet_ciphertext,
            previous_chain_length: result.message.header.previous_chain_length,
            message_number: result.message.header.message_number,
        },
        ciphertext: result.message.ciphertext,
    };

    Ok(RatchetEncryptResult {
        message,
        new_state,
        message_key: result.message_key,
    })
}

pub fn decrypt_with_message_key(message_key: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>> {
    crypto::decrypt_aes_gcm(message_key, ciphertext).map_err(|e| e.into())
}

pub fn ratchet_decrypt(
    state_bytes: &[u8],
    message: &EncryptedRatchetMessage,
) -> Result<RatchetDecryptResult> {
    let mut state = RatchetState::deserialize(state_bytes)?;

    let sdk_message = EncryptedMessage {
        header: MessageHeader {
            sender_ratchet_public: message.header.sender_ratchet_public.clone(),
            ratchet_ciphertext: message.header.ratchet_ciphertext.clone(),
            previous_chain_length: message.header.previous_chain_length,
            message_number: message.header.message_number,
        },
        ciphertext: message.ciphertext.clone(),
    };

    let plaintext = state.decrypt(&sdk_message)?;
    let new_state = state.serialize()?;

    Ok(RatchetDecryptResult {
        plaintext,
        new_state,
    })
}

pub fn generate_safety_number(our_identity_key: &[u8], their_identity_key: &[u8]) -> String {
    crypto::generate_safety_number(our_identity_key, their_identity_key)
}
