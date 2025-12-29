mod call;
mod crypto;
mod group_call;
mod notifications;

use call::{
    CallAnswerResult, CallManager, CallOfferResult, CallState, IncomingCallInfo, KeyCompleteResult,
};
use crypto::{
    DecryptedKeys, EncryptGroupMessageResult, EncryptedKeys, EncryptedRatchetMessage,
    InitialSessionResult, OneTimePrekey, RatchetDecryptResult, RatchetEncryptResult,
    RecoveryKeyData, SignedPrekey,
};
use group_call::{
    CreateGroupCallResult, GroupCallManager, GroupCallMediaState, JoinGroupCallResult,
    SenderKeyBundle, SpeakingStateInfo,
};
use notifications::{NotificationOptions, NotificationService, NotificationStats};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use confide_sdk::crypto::group_call::GroupCallState as SdkGroupCallState;
use confide_sdk::crypto::DsaKeyPair;

static CALL_MANAGER: std::sync::OnceLock<Arc<RwLock<CallManager>>> = std::sync::OnceLock::new();
static GROUP_CALL_MANAGER: std::sync::OnceLock<Arc<RwLock<GroupCallManager>>> =
    std::sync::OnceLock::new();
static NOTIFICATION_SERVICE: std::sync::OnceLock<Arc<NotificationService>> =
    std::sync::OnceLock::new();

#[allow(clippy::type_complexity)]
static PENDING_GROUP_CALL_STATES: std::sync::OnceLock<
    std::sync::Mutex<HashMap<Uuid, (SdkGroupCallState, DsaKeyPair, Vec<u8>, Vec<u8>)>>,
> = std::sync::OnceLock::new();

#[allow(clippy::type_complexity)]
fn get_pending_group_call_states(
) -> &'static std::sync::Mutex<HashMap<Uuid, (SdkGroupCallState, DsaKeyPair, Vec<u8>, Vec<u8>)>> {
    PENDING_GROUP_CALL_STATES.get_or_init(|| std::sync::Mutex::new(HashMap::new()))
}

fn get_call_manager() -> &'static Arc<RwLock<CallManager>> {
    CALL_MANAGER.get_or_init(|| Arc::new(RwLock::new(CallManager::new())))
}

fn get_group_call_manager() -> &'static Arc<RwLock<GroupCallManager>> {
    GROUP_CALL_MANAGER.get_or_init(|| Arc::new(RwLock::new(GroupCallManager::new())))
}

fn get_notification_service() -> &'static Arc<NotificationService> {
    NOTIFICATION_SERVICE.get_or_init(|| Arc::new(NotificationService::new()))
}

#[tauri::command]
fn generate_keys(password: String) -> Result<EncryptedKeys, String> {
    crypto::generate_and_encrypt_keys(&password).map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_keys(
    password: String,
    kem_public_key: Vec<u8>,
    kem_encrypted_private: Vec<u8>,
    dsa_public_key: Vec<u8>,
    dsa_encrypted_private: Vec<u8>,
    key_salt: Vec<u8>,
) -> Result<DecryptedKeys, String> {
    crypto::decrypt_keys(
        &password,
        &kem_public_key,
        &kem_encrypted_private,
        &dsa_public_key,
        &dsa_encrypted_private,
        &key_salt,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn encrypt_data(kem_secret_key: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>, String> {
    crypto::encrypt_data(&kem_secret_key, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_data(kem_secret_key: Vec<u8>, encrypted: Vec<u8>) -> Result<Vec<u8>, String> {
    crypto::decrypt_data(&kem_secret_key, &encrypted).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_conversation_key() -> Vec<u8> {
    crypto::generate_conversation_key()
}

#[tauri::command]
fn encrypt_for_recipient(recipient_public_key: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>, String> {
    crypto::encrypt_for_recipient(&recipient_public_key, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_from_sender(my_secret_key: Vec<u8>, encrypted: Vec<u8>) -> Result<Vec<u8>, String> {
    crypto::decrypt_from_sender(&my_secret_key, &encrypted).map_err(|e| e.to_string())
}

#[tauri::command]
fn encrypt_with_key(key: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>, String> {
    crypto::encrypt_with_key(&key, &data).map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_with_key(key: Vec<u8>, encrypted: Vec<u8>) -> Result<Vec<u8>, String> {
    crypto::decrypt_with_key(&key, &encrypted).map_err(|e| e.to_string())
}

#[tauri::command]
fn dsa_sign(secret_key: Vec<u8>, message: Vec<u8>) -> Result<Vec<u8>, String> {
    crypto::dsa_sign(&secret_key, &message).map_err(|e| e.to_string())
}

#[tauri::command]
fn dsa_verify(public_key: Vec<u8>, message: Vec<u8>, signature: Vec<u8>) -> Result<bool, String> {
    crypto::dsa_verify(&public_key, &message, &signature).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_sender_key_state() -> Result<Vec<u8>, String> {
    crypto::create_sender_key_state().map_err(|e| e.to_string())
}

#[tauri::command]
fn encrypt_group_message(
    state_bytes: Vec<u8>,
    plaintext: Vec<u8>,
) -> Result<EncryptGroupMessageResult, String> {
    crypto::encrypt_group_message(&state_bytes, &plaintext).map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_group_message(
    state_bytes: Vec<u8>,
    target_chain_id: i32,
    target_iteration: i32,
    ciphertext: Vec<u8>,
) -> Result<Vec<u8>, String> {
    crypto::decrypt_group_message(&state_bytes, target_chain_id, target_iteration, &ciphertext)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_sender_key_state_after_decrypt(
    state_bytes: Vec<u8>,
    target_iteration: i32,
) -> Result<Vec<u8>, String> {
    crypto::update_sender_key_state_after_decrypt(&state_bytes, target_iteration)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_recovery_key() -> Vec<u8> {
    crypto::generate_recovery_key()
}

#[tauri::command]
fn encrypt_keys_with_recovery(
    recovery_key: Vec<u8>,
    kem_secret_key: Vec<u8>,
    dsa_secret_key: Vec<u8>,
) -> Result<RecoveryKeyData, String> {
    crypto::encrypt_keys_with_recovery(&recovery_key, &kem_secret_key, &dsa_secret_key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_keys_with_recovery(
    recovery_key: Vec<u8>,
    kem_encrypted_private: Vec<u8>,
    dsa_encrypted_private: Vec<u8>,
    recovery_key_salt: Vec<u8>,
) -> Result<DecryptedKeys, String> {
    crypto::decrypt_keys_with_recovery(
        &recovery_key,
        &kem_encrypted_private,
        &dsa_encrypted_private,
        &recovery_key_salt,
    )
    .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct ReEncryptedKeys {
    encrypted_keys: EncryptedKeys,
    recovery_data: RecoveryKeyData,
}

#[tauri::command]
fn re_encrypt_keys_for_new_password(
    password: String,
    recovery_key: Vec<u8>,
    kem_public_key: Vec<u8>,
    kem_secret_key: Vec<u8>,
    dsa_public_key: Vec<u8>,
    dsa_secret_key: Vec<u8>,
) -> Result<ReEncryptedKeys, String> {
    crypto::re_encrypt_keys_for_new_password(
        &password,
        &recovery_key,
        &kem_public_key,
        &kem_secret_key,
        &dsa_public_key,
        &dsa_secret_key,
    )
    .map(|(encrypted_keys, recovery_data)| ReEncryptedKeys {
        encrypted_keys,
        recovery_data,
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_signed_prekey(dsa_secret_key: Vec<u8>) -> Result<SignedPrekey, String> {
    crypto::generate_signed_prekey(&dsa_secret_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_one_time_prekeys(count: u32) -> Vec<OneTimePrekey> {
    crypto::generate_one_time_prekeys(count)
}

#[tauri::command]
fn create_initial_ratchet_session(
    our_identity_secret: Vec<u8>,
    their_identity_public: Vec<u8>,
    their_signed_prekey_public: Vec<u8>,
    their_one_time_prekey_public: Option<Vec<u8>>,
) -> Result<InitialSessionResult, String> {
    crypto::create_initial_ratchet_session(
        &our_identity_secret,
        &their_identity_public,
        &their_signed_prekey_public,
        their_one_time_prekey_public.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn accept_ratchet_session(
    our_identity_secret: Vec<u8>,
    our_signed_prekey_secret: Vec<u8>,
    our_one_time_prekey_secret: Option<Vec<u8>>,
    key_bundle: Vec<u8>,
) -> Result<Vec<u8>, String> {
    crypto::accept_ratchet_session(
        &our_identity_secret,
        &our_signed_prekey_secret,
        our_one_time_prekey_secret.as_deref(),
        &key_bundle,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn ratchet_encrypt(
    state_bytes: Vec<u8>,
    plaintext: Vec<u8>,
) -> Result<RatchetEncryptResult, String> {
    crypto::ratchet_encrypt(&state_bytes, &plaintext).map_err(|e| e.to_string())
}

#[tauri::command]
fn ratchet_decrypt(
    state_bytes: Vec<u8>,
    message: EncryptedRatchetMessage,
) -> Result<RatchetDecryptResult, String> {
    crypto::ratchet_decrypt(&state_bytes, &message).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_safety_number(our_identity_key: Vec<u8>, their_identity_key: Vec<u8>) -> String {
    crypto::generate_safety_number(&our_identity_key, &their_identity_key)
}

#[tauri::command]
fn decrypt_with_message_key(message_key: Vec<u8>, ciphertext: Vec<u8>) -> Result<Vec<u8>, String> {
    crypto::decrypt_with_message_key(&message_key, &ciphertext).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_call_state() -> Result<CallState, String> {
    let manager = get_call_manager().read().await;
    Ok(manager.get_state().await)
}

#[tauri::command]
async fn get_call_stats() -> Result<call::CallQualityStats, String> {
    let manager = get_call_manager().read().await;
    Ok(manager.get_stats())
}

#[tauri::command]
async fn reset_call_state() -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.end_call().await;
    Ok(())
}

#[tauri::command]
async fn create_call_offer(
    caller_id: String,
    callee_id: String,
    dsa_secret_key: Vec<u8>,
    peer_username: String,
    peer_display_name: Option<String>,
    peer_avatar_url: Option<String>,
) -> Result<CallOfferResult, String> {
    let caller_uuid = Uuid::parse_str(&caller_id).map_err(|_| "Invalid caller ID")?;
    let callee_uuid = Uuid::parse_str(&callee_id).map_err(|_| "Invalid callee ID")?;
    let manager = get_call_manager().read().await;
    manager
        .create_call_offer(
            caller_uuid,
            callee_uuid,
            &dsa_secret_key,
            peer_username,
            peer_display_name,
            peer_avatar_url,
        )
        .await
}

#[tauri::command]
async fn handle_incoming_call(info: IncomingCallInfo) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.handle_incoming_call(info).await;
    Ok(())
}

#[tauri::command]
async fn accept_incoming_call(
    caller_identity_public: Vec<u8>,
    dsa_secret_key: Vec<u8>,
) -> Result<CallAnswerResult, String> {
    let manager = get_call_manager().read().await;
    manager
        .accept_call(&caller_identity_public, &dsa_secret_key)
        .await
}

#[tauri::command]
async fn complete_call_key_exchange_as_caller(
    callee_ephemeral_public: Vec<u8>,
    callee_kem_ciphertext: Vec<u8>,
    callee_signature: Vec<u8>,
    callee_identity_public: Vec<u8>,
) -> Result<KeyCompleteResult, String> {
    let manager = get_call_manager().read().await;
    manager
        .complete_key_exchange_caller(
            &callee_ephemeral_public,
            &callee_kem_ciphertext,
            &callee_signature,
            &callee_identity_public,
        )
        .await
}

#[tauri::command]
async fn complete_call_key_exchange_as_callee(
    caller_kem_ciphertext: Vec<u8>,
) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager
        .complete_key_exchange_callee(&caller_kem_ciphertext)
        .await
}

#[tauri::command]
async fn start_call_media_session(
    relay_endpoint: String,
    relay_token: Vec<u8>,
) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager
        .start_media_session(&relay_endpoint, relay_token)
        .await
}

#[tauri::command]
async fn end_call() -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.end_call().await;
    Ok(())
}

#[tauri::command]
async fn leave_call() -> Result<Option<String>, String> {
    let manager = get_call_manager().read().await;
    let call_id = manager.leave_call().await;
    Ok(call_id.map(|id| id.to_string()))
}

#[tauri::command]
async fn can_rejoin_call() -> Result<bool, String> {
    let manager = get_call_manager().read().await;
    Ok(manager.can_rejoin().await)
}

#[tauri::command]
async fn prepare_rejoin_call() -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.prepare_rejoin().await;
    Ok(())
}

#[tauri::command]
async fn reject_incoming_call() -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.reject_call().await;
    Ok(())
}

#[tauri::command]
async fn set_call_muted(muted: bool) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.set_muted(muted).await;
    Ok(())
}

#[tauri::command]
async fn set_call_deafened(deafened: bool) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.set_deafened(deafened).await;
    Ok(())
}

#[tauri::command]
fn get_audio_devices() -> Result<call::AudioDevices, String> {
    call::audio::get_audio_devices()
}

#[tauri::command]
async fn get_audio_settings() -> Result<call::AudioSettings, String> {
    let manager = get_call_manager().read().await;
    Ok(manager.get_audio_settings().await)
}

#[tauri::command]
async fn update_audio_settings(settings: call::AudioSettings) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.update_audio_settings(settings).await
}

#[tauri::command]
fn get_current_audio_level() -> Result<f32, String> {
    Ok(0.0)
}

#[tauri::command]
fn get_screen_sources() -> Result<Vec<call::ScreenCaptureSource>, String> {
    call::get_screen_sources()
}

#[tauri::command]
async fn start_screen_share(source_id: String) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.start_screen_share(&source_id).await
}

#[tauri::command]
async fn stop_screen_share() -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.stop_screen_share().await
}

#[tauri::command]
fn check_screen_recording_permission() -> bool {
    call::check_screen_recording_permission()
}

#[tauri::command]
fn request_screen_recording_permission() -> bool {
    call::request_screen_recording_permission()
}

#[tauri::command]
async fn set_peer_screen_sharing(is_sharing: bool) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.set_peer_screen_sharing(is_sharing).await
}

#[tauri::command]
async fn set_peer_muted(is_muted: bool) -> Result<(), String> {
    let manager = get_call_manager().read().await;
    manager.set_peer_muted(is_muted).await;
    Ok(())
}

#[tauri::command]
async fn get_video_frame() -> Option<call::DecodedFrame> {
    let manager = get_call_manager().read().await;
    let rx = manager.get_decoded_frame_receiver();
    rx.try_recv().ok()
}

#[tauri::command]
async fn get_h264_chunk() -> Option<call::H264Chunk> {
    let manager = get_call_manager().read().await;
    let rx = manager.get_h264_chunk_receiver();
    let mut last: Option<call::H264Chunk> = None;
    let mut drained: u32 = 0;
    while let Ok(chunk) = rx.try_recv() {
        if last.is_some() {
            drained = drained.saturating_add(1);
        }
        last = Some(chunk);
    }
    if let Some(mut chunk) = last {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        chunk.age_ms = now_ms.saturating_sub(chunk.queued_at_ms);
        chunk.drained = drained;
        Some(chunk)
    } else {
        None
    }
}

#[tauri::command]
async fn init_notification_service() -> Result<(), String> {
    let service = get_notification_service();
    service.initialize().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_notification_permission() -> Result<bool, String> {
    let service = get_notification_service();
    service.check_permission().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn send_enhanced_notification(options: NotificationOptions) -> Result<String, String> {
    let service = get_notification_service();
    service
        .send_notification(options)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn dismiss_notification(id: String) -> Result<(), String> {
    let service = get_notification_service();
    service
        .dismiss_notification(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn handle_notification_click(id: String) -> Result<(), String> {
    let service = get_notification_service();
    service
        .handle_notification_click(&id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_notification_stats() -> NotificationStats {
    let service = get_notification_service();
    service.get_notification_stats().await
}

#[tauri::command]
async fn clear_all_notifications() -> Result<(), String> {
    let service = get_notification_service();
    service
        .clear_notifications()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_app_badge(count: u32) -> Result<(), String> {
    update_platform_badge(count)
        .await
        .map_err(|e| e.to_string())
}

async fn update_platform_badge(count: u32) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    {
        update_macos_badge(count).await?;
    }

    #[cfg(target_os = "windows")]
    {
        update_windows_badge(count).await?;
    }

    #[cfg(target_os = "linux")]
    {
        update_linux_badge(count).await?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
async fn update_macos_badge(count: u32) -> Result<(), Box<dyn std::error::Error>> {
    use std::process::Command;

    let badge_text = if count > 0 {
        count.to_string()
    } else {
        String::new()
    };

    // Use osascript to update dock badge
    let output = Command::new("osascript")
        .arg("-e")
        .arg(format!("tell application \"System Events\" to set badge of (first application process whose name is \"confide\") to \"{}\"", badge_text))
        .output();

    match output {
        Ok(_) => {
            log::info!("macOS badge updated to: {}", count);
            Ok(())
        }
        Err(e) => {
            log::warn!("Failed to update macOS badge: {}", e);
            Err(Box::new(e))
        }
    }
}

#[cfg(target_os = "windows")]
async fn update_windows_badge(count: u32) -> Result<(), Box<dyn std::error::Error>> {
    // Windows badge support would require additional Windows APIs
    // For now, we'll just log the attempt
    log::info!("Windows badge update requested: {}", count);
    Ok(())
}

#[cfg(target_os = "linux")]
async fn update_linux_badge(count: u32) -> Result<(), Box<dyn std::error::Error>> {
    // Linux badge support varies by desktop environment
    // For now, we'll just log the attempt
    log::info!("Linux badge update requested: {}", count);
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
async fn update_platform_badge(_count: u32) -> Result<(), Box<dyn std::error::Error>> {
    log::warn!("Badge updates not supported on this platform");
    Ok(())
}

#[tauri::command]
fn create_group_call_announcement(
    user_id: String,
    identity_public_key: Vec<u8>,
    dsa_secret_key: Vec<u8>,
) -> Result<CreateGroupCallResult, String> {
    let user_uuid = Uuid::parse_str(&user_id).map_err(|e| e.to_string())?;
    let (result, sdk_state, dsa) =
        group_call::create_group_call_crypto(user_uuid, identity_public_key, &dsa_secret_key)?;

    let call_uuid = Uuid::parse_str(&result.call_id).map_err(|e| e.to_string())?;
    let announcement_bytes = result.announcement.clone();
    let our_ephemeral = result.initiator_ephemeral_public.clone();

    if let Ok(mut states) = get_pending_group_call_states().lock() {
        states.insert(
            call_uuid,
            (sdk_state, dsa, announcement_bytes, our_ephemeral),
        );
    }

    Ok(result)
}

#[tauri::command]
fn create_group_call_join(
    call_id: String,
    user_id: String,
    identity_public_key: Vec<u8>,
    dsa_secret_key: Vec<u8>,
    announcement: Vec<u8>,
) -> Result<JoinGroupCallResult, String> {
    let call_uuid = Uuid::parse_str(&call_id).map_err(|e| e.to_string())?;
    let user_uuid = Uuid::parse_str(&user_id).map_err(|e| e.to_string())?;
    let (result, sdk_state, dsa) = group_call::join_group_call_crypto(
        user_uuid,
        identity_public_key,
        &dsa_secret_key,
        &announcement,
    )?;

    let our_ephemeral = result.joiner_ephemeral_public.clone();

    if let Ok(mut states) = get_pending_group_call_states().lock() {
        states.insert(call_uuid, (sdk_state, dsa, announcement, our_ephemeral));
    }

    Ok(result)
}

#[tauri::command]
async fn start_group_call_media_session(
    call_id: String,
    relay_endpoint: String,
    relay_token: Vec<u8>,
    our_participant_id: String,
    existing_sender_keys: Vec<SenderKeyBundle>,
) -> Result<(), String> {
    eprintln!(
        "[GroupCall] start_group_call_media_session called for call_id: {}",
        call_id
    );
    let call_uuid = Uuid::parse_str(&call_id).map_err(|e| e.to_string())?;
    let participant_uuid = Uuid::parse_str(&our_participant_id).map_err(|e| e.to_string())?;

    let (sdk_state, dsa, our_ephemeral) = {
        let mut states = get_pending_group_call_states()
            .lock()
            .map_err(|e| format!("Failed to lock state: {}", e))?;
        eprintln!(
            "[GroupCall] Pending states: {:?}",
            states.keys().collect::<Vec<_>>()
        );
        states
            .remove(&call_uuid)
            .ok_or_else(|| format!("No pending state found for call_id: {}", call_id))
            .map(|(state, dsa, _, ephemeral)| (state, dsa, ephemeral))?
    };
    eprintln!(
        "[GroupCall] SDK state retrieved, connecting to relay: {}",
        relay_endpoint
    );

    let manager = get_group_call_manager().write().await;
    manager
        .start_media_session(
            call_uuid,
            &relay_endpoint,
            relay_token,
            participant_uuid,
            sdk_state,
            dsa,
            our_ephemeral,
        )
        .await?;

    for bundle in existing_sender_keys {
        let pid = Uuid::parse_str(&bundle.participant_id).map_err(|e| e.to_string())?;
        manager
            .add_participant_sender_key(
                pid,
                &bundle.encrypted_sender_key,
                &bundle.identity_public,
                &[],
            )
            .ok();
    }

    Ok(())
}

#[tauri::command]
async fn stop_group_call_media_session() -> Result<(), String> {
    let manager = get_group_call_manager().write().await;
    manager.stop_media_session().await
}

#[tauri::command]
async fn handle_group_call_sender_key(
    participant_id: String,
    encrypted_sender_key: Vec<u8>,
    sender_identity_public: Vec<u8>,
    sender_ephemeral_public: Vec<u8>,
) -> Result<(), String> {
    let pid = Uuid::parse_str(&participant_id).map_err(|e| e.to_string())?;
    let manager = get_group_call_manager().write().await;
    manager.add_participant_sender_key(
        pid,
        &encrypted_sender_key,
        &sender_identity_public,
        &sender_ephemeral_public,
    )
}

#[tauri::command]
async fn remove_group_call_participant(participant_id: String) -> Result<(), String> {
    let pid = Uuid::parse_str(&participant_id).map_err(|e| e.to_string())?;
    let manager = get_group_call_manager().read().await;
    manager.remove_participant(pid);
    Ok(())
}

#[tauri::command]
async fn get_group_call_speaking_states() -> Result<Vec<SpeakingStateInfo>, String> {
    let manager = get_group_call_manager().read().await;
    Ok(manager.get_speaking_states())
}

#[tauri::command]
async fn get_group_call_media_state() -> Result<GroupCallMediaState, String> {
    let manager = get_group_call_manager().read().await;
    Ok(manager.get_state().await)
}

#[tauri::command]
async fn set_group_call_muted(muted: bool) -> Result<(), String> {
    let manager = get_group_call_manager().read().await;
    manager.set_muted(muted).await;
    Ok(())
}

#[tauri::command]
async fn set_group_call_deafened(deafened: bool) -> Result<(), String> {
    let manager = get_group_call_manager().read().await;
    manager.set_deafened(deafened).await;
    Ok(())
}

#[tauri::command]
async fn update_group_call_relay_token(
    relay_token: Vec<u8>,
    expires_at: String,
) -> Result<(), String> {
    let expires = chrono::DateTime::parse_from_rfc3339(&expires_at)
        .map_err(|e| e.to_string())?
        .with_timezone(&chrono::Utc);
    let manager = get_group_call_manager().read().await;
    manager.update_relay_token(relay_token, expires).await;
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SenderKeyDistributionResult {
    pub encrypted_sender_key: Vec<u8>,
    pub our_ephemeral_public: Vec<u8>,
}

#[tauri::command]
async fn create_sender_key_for_participant(
    participant_id: String,
    participant_identity_public: Vec<u8>,
    participant_ephemeral_public: Vec<u8>,
) -> Result<SenderKeyDistributionResult, String> {
    let manager = get_group_call_manager().read().await;
    let (encrypted, our_ephemeral) = manager
        .create_sender_key_for_participant(
            &participant_id,
            &participant_identity_public,
            &participant_ephemeral_public,
        )
        .map_err(|e| format!("Failed to create sender key: {}", e))?;
    Ok(SenderKeyDistributionResult {
        encrypted_sender_key: encrypted,
        our_ephemeral_public: our_ephemeral,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build());

    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_plugin_macos_permissions::init());

    builder
        .invoke_handler(tauri::generate_handler![
            generate_keys,
            decrypt_keys,
            encrypt_data,
            decrypt_data,
            generate_conversation_key,
            encrypt_for_recipient,
            decrypt_from_sender,
            encrypt_with_key,
            decrypt_with_key,
            dsa_sign,
            dsa_verify,
            create_sender_key_state,
            encrypt_group_message,
            decrypt_group_message,
            update_sender_key_state_after_decrypt,
            generate_recovery_key,
            encrypt_keys_with_recovery,
            decrypt_keys_with_recovery,
            re_encrypt_keys_for_new_password,
            generate_signed_prekey,
            generate_one_time_prekeys,
            create_initial_ratchet_session,
            accept_ratchet_session,
            ratchet_encrypt,
            ratchet_decrypt,
            generate_safety_number,
            decrypt_with_message_key,
            get_call_state,
            get_call_stats,
            reset_call_state,
            create_call_offer,
            handle_incoming_call,
            accept_incoming_call,
            complete_call_key_exchange_as_caller,
            complete_call_key_exchange_as_callee,
            start_call_media_session,
            end_call,
            leave_call,
            can_rejoin_call,
            prepare_rejoin_call,
            reject_incoming_call,
            set_call_muted,
            set_call_deafened,
            get_audio_devices,
            get_audio_settings,
            update_audio_settings,
            get_current_audio_level,
            get_screen_sources,
            start_screen_share,
            stop_screen_share,
            check_screen_recording_permission,
            request_screen_recording_permission,
            set_peer_screen_sharing,
            set_peer_muted,
            get_video_frame,
            get_h264_chunk,
            init_notification_service,
            check_notification_permission,
            send_enhanced_notification,
            dismiss_notification,
            handle_notification_click,
            get_notification_stats,
            clear_all_notifications,
            update_app_badge,
            create_group_call_announcement,
            create_group_call_join,
            start_group_call_media_session,
            stop_group_call_media_session,
            handle_group_call_sender_key,
            remove_group_call_participant,
            get_group_call_speaking_states,
            get_group_call_media_state,
            set_group_call_muted,
            set_group_call_deafened,
            update_group_call_relay_token,
            create_sender_key_for_participant
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
