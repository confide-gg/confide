pub mod audio;
pub mod h264;
pub mod jitter;
pub mod screen;
pub mod settings;
pub mod state;
mod transport;
mod video_decoder;

pub use screen::{
    check_screen_recording_permission, get_screen_sources, request_screen_recording_permission,
    ScreenCaptureSource,
};
pub use settings::AudioSettings;
pub use state::{AudioDevices, CallQualityStats};
pub use video_decoder::{DecodedFrame, H264Chunk};

use chrono::{DateTime, Utc};
use confide_sdk::crypto::call::{
    accept_call_offer, complete_call_key_exchange_callee, complete_call_key_exchange_caller,
    create_call_offer, CallEncryptor, CallKeyPair, CallMediaKeys, CALL_ID_SIZE,
};
use confide_sdk::crypto::DsaKeyPair;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};
use uuid::Uuid;

use audio::{start_audio_pipeline, AudioPipelineHandle};
use screen::{start_screen_share_pipeline, ScreenSharePipelineHandle};
use transport::{AudioSendStream, CallTransport, DatagramChannel, VideoSendStream};
use video_decoder::{start_video_decoder, VideoDecoderHandle};

#[allow(clippy::type_complexity)]
static AUDIO_CHANNEL: Lazy<(
    crossbeam_channel::Sender<Vec<u8>>,
    crossbeam_channel::Receiver<Vec<u8>>,
)> = Lazy::new(|| crossbeam_channel::bounded(50));

#[allow(clippy::type_complexity)]
static VIDEO_SEND_CHANNEL: Lazy<(
    crossbeam_channel::Sender<Vec<u8>>,
    crossbeam_channel::Receiver<Vec<u8>>,
)> = Lazy::new(|| crossbeam_channel::bounded(200));

static VIDEO_RECV_CHANNEL: Lazy<(
    crossbeam_channel::Sender<DecodedFrame>,
    crossbeam_channel::Receiver<DecodedFrame>,
)> = Lazy::new(|| crossbeam_channel::bounded(10));

static VIDEO_H264_CHANNEL: Lazy<(
    crossbeam_channel::Sender<H264Chunk>,
    crossbeam_channel::Receiver<H264Chunk>,
)> = Lazy::new(|| crossbeam_channel::bounded(30));

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CallStatus {
    Idle,
    Initiating,
    Ringing,
    Connecting,
    Active,
    Left,
    Ended,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionHealth {
    Good,
    Degraded,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallState {
    pub call_id: Option<Uuid>,
    pub peer_id: Option<Uuid>,
    pub peer_username: Option<String>,
    pub peer_display_name: Option<String>,
    pub peer_avatar_url: Option<String>,
    pub status: CallStatus,
    pub is_caller: bool,
    pub is_muted: bool,
    pub is_deafened: bool,
    pub peer_is_muted: bool,
    pub started_at: Option<DateTime<Utc>>,
    pub connected_at: Option<DateTime<Utc>>,
    pub is_screen_sharing: bool,
    pub peer_is_screen_sharing: bool,
    pub screen_share_source: Option<String>,
    pub connection_health: ConnectionHealth,
    pub last_audio_received_at: Option<DateTime<Utc>>,
    pub relay_token_expires_at: Option<DateTime<Utc>>,
    pub relay_token_expires_soon: bool,
    pub left_at: Option<DateTime<Utc>>,
    pub can_rejoin: bool,
    pub rejoin_time_remaining_seconds: Option<i64>,
}

impl Default for CallState {
    fn default() -> Self {
        Self {
            call_id: None,
            peer_id: None,
            peer_username: None,
            peer_display_name: None,
            peer_avatar_url: None,
            status: CallStatus::Idle,
            is_caller: false,
            is_muted: false,
            is_deafened: false,
            peer_is_muted: false,
            started_at: None,
            connected_at: None,
            is_screen_sharing: false,
            peer_is_screen_sharing: false,
            screen_share_source: None,
            connection_health: ConnectionHealth::Good,
            last_audio_received_at: None,
            relay_token_expires_at: None,
            relay_token_expires_soon: false,
            left_at: None,
            can_rejoin: false,
            rejoin_time_remaining_seconds: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomingCallInfo {
    pub call_id: Uuid,
    pub caller_id: Uuid,
    pub callee_id: Uuid,
    pub caller_username: String,
    pub caller_display_name: Option<String>,
    pub caller_avatar_url: Option<String>,
    pub caller_identity_key: Vec<u8>,
    pub ephemeral_kem_public: Vec<u8>,
    pub signature: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallOfferResult {
    pub call_id: Uuid,
    pub ephemeral_kem_public: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallAnswerResult {
    pub ephemeral_kem_public: Vec<u8>,
    pub kem_ciphertext: Vec<u8>,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyCompleteResult {
    pub kem_ciphertext: Vec<u8>,
}

pub struct CallManager {
    state: RwLock<CallState>,
    ephemeral_keypair: RwLock<Option<CallKeyPair>>,
    media_keys: RwLock<Option<CallMediaKeys>>,
    shared_secret_1: RwLock<Option<Vec<u8>>>,
    incoming_call_info: RwLock<Option<IncomingCallInfo>>,
    transport: RwLock<Option<Arc<Mutex<CallTransport>>>>,
    audio_send: RwLock<Option<Arc<AudioSendStream>>>,
    video_send: RwLock<Option<Arc<VideoSendStream>>>,
    datagram_channel: RwLock<Option<Arc<DatagramChannel>>>,
    audio_tx: RwLock<Option<mpsc::Sender<Vec<u8>>>>,
    is_muted: std::sync::Arc<std::sync::atomic::AtomicBool>,
    is_deafened: std::sync::Arc<std::sync::atomic::AtomicBool>,
    stats: std::sync::Arc<std::sync::Mutex<CallQualityStats>>,
    audio_settings: RwLock<settings::AudioSettings>,
    audio_pipeline: std::sync::Mutex<Option<AudioPipelineHandle>>,
    screen_pipeline: std::sync::Mutex<Option<ScreenSharePipelineHandle>>,
    screen_quality_stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    video_decoder: std::sync::Mutex<Option<VideoDecoderHandle>>,
    video_recv_tx: Arc<std::sync::Mutex<Option<crossbeam_channel::Sender<Vec<u8>>>>>,
    encryptor: RwLock<Option<Arc<std::sync::Mutex<confide_sdk::crypto::call::CallEncryptor>>>>,
    #[allow(dead_code)]
    use_datagram_audio: std::sync::atomic::AtomicBool,
    last_audio_received: Arc<std::sync::Mutex<Option<std::time::Instant>>>,
    connection_error: Arc<std::sync::atomic::AtomicBool>,
    relay_token_expires_at: RwLock<Option<DateTime<Utc>>>,
    left_at: RwLock<Option<DateTime<Utc>>>,
}

impl CallManager {
    pub fn new() -> Self {
        let audio_settings = settings::AudioSettings::load().unwrap_or_default();
        Self {
            state: RwLock::new(CallState::default()),
            ephemeral_keypair: RwLock::new(None),
            media_keys: RwLock::new(None),
            shared_secret_1: RwLock::new(None),
            incoming_call_info: RwLock::new(None),
            transport: RwLock::new(None),
            audio_send: RwLock::new(None),
            video_send: RwLock::new(None),
            datagram_channel: RwLock::new(None),
            audio_tx: RwLock::new(None),
            is_muted: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            is_deafened: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            stats: std::sync::Arc::new(std::sync::Mutex::new(CallQualityStats::default())),
            audio_settings: RwLock::new(audio_settings),
            audio_pipeline: std::sync::Mutex::new(None),
            screen_pipeline: std::sync::Mutex::new(None),
            screen_quality_stop: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true)),
            video_decoder: std::sync::Mutex::new(None),
            video_recv_tx: Arc::new(std::sync::Mutex::new(None)),
            encryptor: RwLock::new(None),
            use_datagram_audio: std::sync::atomic::AtomicBool::new(true),
            last_audio_received: Arc::new(std::sync::Mutex::new(None)),
            connection_error: Arc::new(std::sync::atomic::AtomicBool::new(false)),
            relay_token_expires_at: RwLock::new(None),
            left_at: RwLock::new(None),
        }
    }

    pub fn get_stats(&self) -> CallQualityStats {
        self.stats.lock().unwrap().clone()
    }

    #[allow(dead_code)]
    pub fn get_audio_quality_metrics(&self) -> state::AudioQualityMetrics {
        let stats = self.stats.lock().unwrap();

        let mut metrics = state::AudioQualityMetrics {
            packet_loss_rate: 0.0,
            jitter_ms: 0.0,
            rtt_ms: 0.0,
            bitrate_kbps: 0.0,
            mos_score: 4.5, // Default MOS score
            ..Default::default()
        };

        let total_packets = stats.packets_sent + stats.packets_received + stats.packets_lost;
        if total_packets > 0 {
            metrics.packet_loss_rate = stats.packets_lost as f32 / total_packets as f32;
        }

        // Simple MOS score estimation based on packet loss
        if metrics.packet_loss_rate > 0.1 {
            metrics.mos_score = 3.0; // Poor
        } else if metrics.packet_loss_rate > 0.05 {
            metrics.mos_score = 3.5; // Fair
        } else if metrics.packet_loss_rate > 0.02 {
            metrics.mos_score = 4.0; // Good
        } else {
            metrics.mos_score = 4.5; // Excellent
        }

        metrics
    }

    pub async fn get_state(&self) -> CallState {
        let mut state = self.state.read().await.clone();

        if state.status == CallStatus::Active {
            let has_error = self
                .connection_error
                .load(std::sync::atomic::Ordering::Relaxed);
            if has_error {
                state.connection_health = ConnectionHealth::Disconnected;
            } else {
                state.connection_health = ConnectionHealth::Good;
            }

            if let Some(last_recv) = *self.last_audio_received.lock().unwrap() {
                let elapsed = last_recv.elapsed();
                state.last_audio_received_at =
                    Some(Utc::now() - chrono::Duration::milliseconds(elapsed.as_millis() as i64));
            }

            if let Some(expires_at) = *self.relay_token_expires_at.read().await {
                state.relay_token_expires_at = Some(expires_at);
                let time_until_expiry = expires_at - Utc::now();
                state.relay_token_expires_soon = time_until_expiry < chrono::Duration::minutes(15);
            }
        }

        // Update rejoin information for left state
        if state.status == CallStatus::Left {
            if let Some(left_time) = *self.left_at.read().await {
                state.left_at = Some(left_time);
                let elapsed = Utc::now().signed_duration_since(left_time);
                let remaining = 300 - elapsed.num_seconds(); // 5 minutes = 300 seconds

                if remaining > 0 {
                    state.can_rejoin = true;
                    state.rejoin_time_remaining_seconds = Some(remaining);
                } else {
                    state.can_rejoin = false;
                    state.rejoin_time_remaining_seconds = None;
                }
            }
        }

        state
    }

    pub async fn create_call_offer(
        &self,
        caller_id: Uuid,
        callee_id: Uuid,
        dsa_secret_key: &[u8],
        peer_username: String,
        peer_display_name: Option<String>,
        peer_avatar_url: Option<String>,
    ) -> Result<CallOfferResult, String> {
        let call_id = Uuid::new_v4();
        let mut call_id_bytes = [0u8; CALL_ID_SIZE];
        call_id_bytes.copy_from_slice(call_id.as_bytes());

        let mut caller_id_bytes = [0u8; CALL_ID_SIZE];
        caller_id_bytes.copy_from_slice(caller_id.as_bytes());
        let mut callee_id_bytes = [0u8; CALL_ID_SIZE];
        callee_id_bytes.copy_from_slice(callee_id.as_bytes());

        let dsa = DsaKeyPair::from_bytes(&[], dsa_secret_key).map_err(|e| e.to_string())?;

        let (ephemeral_keypair, offer) =
            create_call_offer(call_id_bytes, caller_id_bytes, callee_id_bytes, &dsa)
                .map_err(|e| e.to_string())?;

        *self.ephemeral_keypair.write().await = Some(ephemeral_keypair);

        {
            let mut state = self.state.write().await;
            state.call_id = Some(call_id);
            state.peer_id = Some(callee_id);
            state.peer_username = Some(peer_username);
            state.peer_display_name = peer_display_name;
            state.peer_avatar_url = peer_avatar_url;
            state.status = CallStatus::Initiating;
            state.is_caller = true;
            state.started_at = Some(Utc::now());
        }

        Ok(CallOfferResult {
            call_id,
            ephemeral_kem_public: offer.ephemeral_kem_public,
            signature: offer.signature,
        })
    }

    pub async fn handle_incoming_call(&self, info: IncomingCallInfo) {
        let mut state = self.state.write().await;
        state.call_id = Some(info.call_id);
        state.peer_id = Some(info.caller_id);
        state.peer_username = Some(info.caller_username.clone());
        state.peer_display_name = info.caller_display_name.clone();
        state.peer_avatar_url = info.caller_avatar_url.clone();
        state.status = CallStatus::Ringing;
        state.is_caller = false;
        state.started_at = Some(info.created_at);
        drop(state);

        *self.incoming_call_info.write().await = Some(info);
    }

    pub async fn accept_call(
        &self,
        caller_identity_public: &[u8],
        dsa_secret_key: &[u8],
    ) -> Result<CallAnswerResult, String> {
        let state = self.state.read().await;
        let call_id = state.call_id.ok_or("No active call")?;
        let peer_id = state.peer_id.ok_or("No peer ID")?;
        drop(state);

        let incoming_info = self.incoming_call_info.read().await;
        let info = incoming_info.as_ref().ok_or("No incoming call info")?;

        let mut call_id_bytes = [0u8; CALL_ID_SIZE];
        call_id_bytes.copy_from_slice(call_id.as_bytes());

        let mut caller_id_bytes = [0u8; CALL_ID_SIZE];
        caller_id_bytes.copy_from_slice(peer_id.as_bytes());

        let mut callee_id_bytes = [0u8; CALL_ID_SIZE];
        callee_id_bytes.copy_from_slice(info.callee_id.as_bytes());

        let offer = confide_sdk::crypto::call::CallOffer {
            call_id: call_id_bytes,
            caller_id: caller_id_bytes,
            callee_id: callee_id_bytes,
            ephemeral_kem_public: info.ephemeral_kem_public.clone(),
            signature: info.signature.clone(),
        };
        drop(incoming_info);

        let dsa = DsaKeyPair::from_bytes(&[], dsa_secret_key).map_err(|e| e.to_string())?;

        let (callee_ephemeral, answer, shared_secret_1) =
            accept_call_offer(&offer, &dsa, caller_identity_public).map_err(|e| e.to_string())?;

        *self.ephemeral_keypair.write().await = Some(callee_ephemeral);
        *self.shared_secret_1.write().await = Some(shared_secret_1);

        {
            let mut state = self.state.write().await;
            state.status = CallStatus::Connecting;
        }

        Ok(CallAnswerResult {
            ephemeral_kem_public: answer.ephemeral_kem_public,
            kem_ciphertext: answer.kem_ciphertext,
            signature: answer.signature,
        })
    }

    pub async fn complete_key_exchange_caller(
        &self,
        callee_ephemeral_public: &[u8],
        callee_kem_ciphertext: &[u8],
        callee_signature: &[u8],
        callee_identity_public: &[u8],
    ) -> Result<KeyCompleteResult, String> {
        let state = self.state.read().await;
        let call_id = state.call_id.ok_or("No active call")?;
        drop(state);

        let mut call_id_bytes = [0u8; CALL_ID_SIZE];
        call_id_bytes.copy_from_slice(call_id.as_bytes());

        let ephemeral = self.ephemeral_keypair.read().await;
        let caller_ephemeral = ephemeral.as_ref().ok_or("No ephemeral keypair")?;

        let answer = confide_sdk::crypto::call::CallAnswer {
            call_id: call_id_bytes,
            ephemeral_kem_public: callee_ephemeral_public.to_vec(),
            kem_ciphertext: callee_kem_ciphertext.to_vec(),
            signature: callee_signature.to_vec(),
        };

        let (key_complete, media_keys) =
            complete_call_key_exchange_caller(&answer, caller_ephemeral, callee_identity_public)
                .map_err(|e| e.to_string())?;

        *self.media_keys.write().await = Some(media_keys);

        {
            let mut state = self.state.write().await;
            state.status = CallStatus::Connecting;
        }

        Ok(KeyCompleteResult {
            kem_ciphertext: key_complete.kem_ciphertext,
        })
    }

    pub async fn complete_key_exchange_callee(
        &self,
        caller_kem_ciphertext: &[u8],
    ) -> Result<(), String> {
        let state = self.state.read().await;
        let call_id = state.call_id.ok_or("No active call")?;
        drop(state);

        let mut call_id_bytes = [0u8; CALL_ID_SIZE];
        call_id_bytes.copy_from_slice(call_id.as_bytes());

        let ephemeral = self.ephemeral_keypair.read().await;
        let callee_ephemeral = ephemeral.as_ref().ok_or("No ephemeral keypair")?;

        let ss1 = self.shared_secret_1.read().await;
        let shared_secret_1 = ss1.as_ref().ok_or("No shared secret")?;

        let key_complete = confide_sdk::crypto::call::CallKeyExchangeComplete {
            call_id: call_id_bytes,
            kem_ciphertext: caller_kem_ciphertext.to_vec(),
        };

        let media_keys =
            complete_call_key_exchange_callee(&key_complete, callee_ephemeral, shared_secret_1)
                .map_err(|e| e.to_string())?;

        *self.media_keys.write().await = Some(media_keys);

        Ok(())
    }

    pub async fn start_media_session(
        &self,
        relay_endpoint: &str,
        relay_token: Vec<u8>,
    ) -> Result<(), String> {
        if relay_token.len() >= 41 {
            let expires_bytes: [u8; 8] = relay_token[33..41].try_into().unwrap_or([0u8; 8]);
            let expires_ts = i64::from_be_bytes(expires_bytes);
            if let Some(expires_at) = DateTime::from_timestamp(expires_ts, 0) {
                *self.relay_token_expires_at.write().await = Some(expires_at);
            }
        }

        let state = self.state.read().await;
        let is_caller = state.is_caller;
        drop(state);

        let media_keys = self.media_keys.read().await;
        let keys = media_keys.as_ref().ok_or("No media keys")?;

        let encryptor = Arc::new(std::sync::Mutex::new(CallEncryptor::new(
            keys.clone(),
            is_caller,
        )));

        let (transport, media_streams) = CallTransport::new(relay_endpoint, relay_token)
            .await
            .map_err(|e| e.to_string())?;

        let transport = Arc::new(Mutex::new(transport));
        *self.transport.write().await = Some(transport.clone());

        let audio_send = Arc::new(media_streams.audio_send);
        let video_send = Arc::new(media_streams.video_send);
        let datagram_channel = Arc::new(media_streams.datagram);

        *self.audio_send.write().await = Some(audio_send.clone());
        *self.video_send.write().await = Some(video_send.clone());
        *self.datagram_channel.write().await = Some(datagram_channel.clone());

        let (audio_recv_tx, audio_recv_rx) = crossbeam_channel::bounded::<Vec<u8>>(100);

        let audio_send_tx = AUDIO_CHANNEL.0.clone();
        let audio_send_rx = AUDIO_CHANNEL.1.clone();

        let is_muted = self.is_muted.clone();
        let is_deafened = self.is_deafened.clone();

        let (audio_ready_tx, audio_ready_rx) = oneshot::channel();

        let audio_pipeline_handle = start_audio_pipeline(
            audio_send_tx,
            audio_recv_rx,
            is_muted,
            is_deafened,
            Some(audio_ready_tx),
        )
        .map_err(|e| format!("Failed to start audio pipeline: {}", e))?;

        *self.audio_pipeline.lock().unwrap() = Some(audio_pipeline_handle);

        let _ = tokio::time::timeout(std::time::Duration::from_millis(100), audio_ready_rx).await;

        let send_encryptor = encryptor.clone();
        let send_stats = self.stats.clone();
        // Force datagram usage for audio as it has lower latency
        let use_datagram = true;
        let audio_send_for_reliable = audio_send.clone();
        let datagram_for_lossy = datagram_channel.clone();

        std::thread::spawn(move || loop {
            match audio_send_rx.recv_timeout(std::time::Duration::from_millis(20)) {
                Ok(opus_data) => {
                    let encrypted = {
                        let mut enc = send_encryptor.lock().unwrap();
                        match enc.encrypt_frame(&opus_data) {
                            Ok(data) => data,
                            Err(_) => continue,
                        }
                    };

                    if use_datagram {
                        let _ = datagram_for_lossy.send_audio_lossy(&encrypted);
                    } else {
                        let rt = tokio::runtime::Handle::current();
                        let _ = rt.block_on(audio_send_for_reliable.send(&encrypted));
                    }

                    if let Ok(mut stats) = send_stats.lock() {
                        stats.packets_sent += 1;
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => {}
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        });

        let recv_encryptor = encryptor.clone();
        let recv_stats = self.stats.clone();
        let media_streams_conn = media_streams.connection.clone();
        let audio_recv_tx_datagram = audio_recv_tx.clone();
        let video_recv_tx_datagram = self.video_recv_tx.clone();
        let last_audio_recv = self.last_audio_received.clone();
        let conn_error = self.connection_error.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    datagram_result = media_streams_conn.read_datagram() => {
                        match datagram_result {
                            Ok(data) => {
                                if data.is_empty() {
                                    continue;
                                }

                                let (datagram_type, payload) = match data[0] {
                                    0x01 | 0x02 => (data[0], &data[1..]),
                                    _ => (0x01, data.as_ref()),
                                };

                                match datagram_type {
                                    0x01 => {
                                        let decrypted = {
                                            let mut enc = recv_encryptor.lock().unwrap();
                                            match enc.decrypt_frame(payload) {
                                                Ok(d) => d,
                                                Err(_) => {
                                                    if let Ok(mut stats) = recv_stats.lock() {
                                                        stats.packets_lost += 1;
                                                    }
                                                    continue;
                                                }
                                            }
                                        };

                                        if let Ok(mut stats) = recv_stats.lock() {
                                            stats.packets_received += 1;
                                        }

                                        *last_audio_recv.lock().unwrap() = Some(std::time::Instant::now());
                                        let _ = audio_recv_tx_datagram.send(decrypted);
                                    }
                                    0x02 => {
                                        let decrypted = {
                                            let mut enc = recv_encryptor.lock().unwrap();
                                            match enc.decrypt_video_frame(payload) {
                                                Ok(d) => d,
                                                Err(_) => {
                                                    if let Ok(mut stats) = recv_stats.lock() {
                                                        stats.packets_lost += 1;
                                                    }
                                                    continue;
                                                }
                                            }
                                        };

                                        if let Ok(mut stats) = recv_stats.lock() {
                                            stats.packets_received += 1;
                                        }

                                        let tx_guard = video_recv_tx_datagram.lock().unwrap();
                                        if let Some(ref tx) = *tx_guard {
                                            let _ = tx.send(decrypted);
                                        }
                                    }
                                    _ => {}
                                }
                            }
                            Err(e) => {
                                eprintln!("[QUIC] Datagram receive error: {}", e);
                                conn_error.store(true, std::sync::atomic::Ordering::Relaxed);
                                break;
                            }
                        }
                    }
                }
            }
        });

        let recv_encryptor_streams = encryptor.clone();
        let recv_stats_streams = self.stats.clone();
        let video_recv_tx_streams = self.video_recv_tx.clone();
        let audio_recv_tx_streams = audio_recv_tx.clone();
        let media_streams_for_recv = media_streams.connection.clone();
        let conn_error_streams = self.connection_error.clone();
        let last_audio_recv_streams = self.last_audio_received.clone();

        tokio::spawn(async move {
            loop {
                let stream_result = media_streams_for_recv.accept_bi().await;

                match stream_result {
                    Ok((_, mut recv)) => {
                        let enc = recv_encryptor_streams.clone();
                        let stats = recv_stats_streams.clone();
                        let video_tx = video_recv_tx_streams.clone();
                        let audio_tx = audio_recv_tx_streams.clone();
                        let last_audio = last_audio_recv_streams.clone();

                        tokio::spawn(async move {
                            let mut len_buf = [0u8; 2];
                            let mut is_first = true;
                            let mut stream_is_audio = false;

                            loop {
                                if recv.read_exact(&mut len_buf).await.is_err() {
                                    break;
                                }

                                let len = u16::from_be_bytes(len_buf) as usize;
                                if len == 0 || len > 65000 {
                                    break;
                                }

                                let mut data = vec![0u8; len];
                                if recv.read_exact(&mut data).await.is_err() {
                                    break;
                                }

                                if is_first {
                                    is_first = false;
                                    stream_is_audio = len < 500;
                                }

                                if stream_is_audio {
                                    let decrypted = {
                                        let mut e = enc.lock().unwrap();
                                        match e.decrypt_frame(&data) {
                                            Ok(d) => d,
                                            Err(_) => continue,
                                        }
                                    };
                                    *last_audio.lock().unwrap() = Some(std::time::Instant::now());
                                    let _ = audio_tx.send(decrypted);
                                } else {
                                    let tx_guard = video_tx.lock().unwrap();
                                    if let Some(ref tx) = *tx_guard {
                                        let decrypted = {
                                            let mut e = enc.lock().unwrap();
                                            match e.decrypt_video_frame(&data) {
                                                Ok(d) => d,
                                                Err(_) => continue,
                                            }
                                        };
                                        let _ = tx.send(decrypted);
                                    }
                                }

                                if let Ok(mut s) = stats.lock() {
                                    s.packets_received += 1;
                                }
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("[QUIC] Stream accept error: {}", e);
                        conn_error_streams.store(true, std::sync::atomic::Ordering::Relaxed);
                        break;
                    }
                }
            }
        });

        *self.last_audio_received.lock().unwrap() = Some(std::time::Instant::now());
        self.connection_error
            .store(false, std::sync::atomic::Ordering::Relaxed);
        *self.encryptor.write().await = Some(encryptor.clone());

        {
            let mut state = self.state.write().await;
            state.status = CallStatus::Active;
            state.connected_at = Some(Utc::now());
        }

        Ok(())
    }

    pub async fn leave_call(&self) -> Option<Uuid> {
        let state = self.state.read().await;
        if state.status != CallStatus::Active {
            return None;
        }
        let call_id = state.call_id;
        drop(state);

        if let Some(pipeline) = self.screen_pipeline.lock().unwrap().take() {
            self.screen_quality_stop
                .store(true, std::sync::atomic::Ordering::Relaxed);
            pipeline.stop();
        }
        if let Some(decoder) = self.video_decoder.lock().unwrap().take() {
            decoder.stop();
        }

        if let Some(pipeline) = self.audio_pipeline.lock().unwrap().take() {
            pipeline.stop();
        }

        if let Some(transport) = self.transport.write().await.take() {
            let mut t = transport.lock().await;
            t.close().await;
        }

        *self.audio_send.write().await = None;
        *self.video_send.write().await = None;
        *self.datagram_channel.write().await = None;
        *self.video_recv_tx.lock().unwrap() = None;
        *self.audio_tx.write().await = None;
        *self.encryptor.write().await = None;
        self.is_muted
            .store(false, std::sync::atomic::Ordering::Relaxed);
        self.is_deafened
            .store(false, std::sync::atomic::Ordering::Relaxed);

        let mut state = self.state.write().await;
        state.status = CallStatus::Left;
        state.is_screen_sharing = false;
        state.peer_is_screen_sharing = false;
        state.screen_share_source = None;

        // Set the time when user left the call
        *self.left_at.write().await = Some(Utc::now());

        call_id
    }

    pub async fn can_rejoin(&self) -> bool {
        let state = self.state.read().await;
        let left_at = self.left_at.read().await;

        if state.status != CallStatus::Left || state.call_id.is_none() {
            return false;
        }

        // Check if within 5-minute rejoin window
        if let Some(left_time) = *left_at {
            let elapsed = Utc::now().signed_duration_since(left_time);
            // 5 minutes = 300 seconds
            elapsed.num_seconds() < 300
        } else {
            false
        }
    }

    pub async fn prepare_rejoin(&self) {
        let mut state = self.state.write().await;
        if state.status == CallStatus::Left {
            state.status = CallStatus::Connecting;
        }
    }

    pub async fn end_call(&self) {
        if let Some(pipeline) = self.screen_pipeline.lock().unwrap().take() {
            self.screen_quality_stop
                .store(true, std::sync::atomic::Ordering::Relaxed);
            pipeline.stop();
        }
        if let Some(decoder) = self.video_decoder.lock().unwrap().take() {
            decoder.stop();
        }

        if let Some(pipeline) = self.audio_pipeline.lock().unwrap().take() {
            pipeline.stop();
        }

        if let Some(transport) = self.transport.write().await.take() {
            let mut t = transport.lock().await;
            t.close().await;
        }

        *self.audio_send.write().await = None;
        *self.video_send.write().await = None;
        *self.datagram_channel.write().await = None;
        *self.video_recv_tx.lock().unwrap() = None;
        *self.ephemeral_keypair.write().await = None;
        *self.media_keys.write().await = None;
        *self.shared_secret_1.write().await = None;
        *self.audio_tx.write().await = None;
        *self.encryptor.write().await = None;
        self.is_muted
            .store(false, std::sync::atomic::Ordering::Relaxed);
        self.is_deafened
            .store(false, std::sync::atomic::Ordering::Relaxed);
        self.connection_error
            .store(false, std::sync::atomic::Ordering::Relaxed);
        *self.last_audio_received.lock().unwrap() = None;
        *self.relay_token_expires_at.write().await = None;
        *self.left_at.write().await = None;

        let mut state = self.state.write().await;
        *state = CallState::default();
    }

    pub async fn set_muted(&self, muted: bool) {
        self.is_muted
            .store(muted, std::sync::atomic::Ordering::Relaxed);
        let mut state = self.state.write().await;
        state.is_muted = muted;
    }

    pub async fn set_deafened(&self, deafened: bool) {
        self.is_deafened
            .store(deafened, std::sync::atomic::Ordering::Relaxed);
        let mut state = self.state.write().await;
        state.is_deafened = deafened;
        if deafened {
            self.is_muted
                .store(true, std::sync::atomic::Ordering::Relaxed);
            state.is_muted = true;
        }
    }

    pub async fn get_audio_settings(&self) -> settings::AudioSettings {
        self.audio_settings.read().await.clone()
    }

    pub async fn update_audio_settings(
        &self,
        new_settings: settings::AudioSettings,
    ) -> Result<(), String> {
        let old_settings = self.audio_settings.read().await.clone();

        new_settings.save().map_err(|e| e.to_string())?;

        if let Ok(pipeline_guard) = self.audio_pipeline.lock() {
            if let Some(ref pipeline) = *pipeline_guard {
                if old_settings.input_device != new_settings.input_device {
                    pipeline
                        .switch_input_device(new_settings.input_device.as_deref())
                        .map_err(|e| format!("Failed to switch input device: {}", e))?;
                }

                if old_settings.output_device != new_settings.output_device {
                    pipeline
                        .switch_output_device(new_settings.output_device.as_deref())
                        .map_err(|e| format!("Failed to switch output device: {}", e))?;
                }

                if (old_settings.input_volume - new_settings.input_volume).abs() > 0.001 {
                    pipeline.set_input_volume(new_settings.input_volume);
                }

                if (old_settings.output_volume - new_settings.output_volume).abs() > 0.001 {
                    pipeline.set_output_volume(new_settings.output_volume);
                }

                if old_settings.noise_suppression_enabled != new_settings.noise_suppression_enabled
                {
                    pipeline.set_noise_suppression_enabled(new_settings.noise_suppression_enabled);
                }
            }
        }

        *self.audio_settings.write().await = new_settings;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn switch_input_device(&self, device_name: Option<&str>) -> Result<(), String> {
        if let Ok(pipeline_guard) = self.audio_pipeline.lock() {
            if let Some(ref pipeline) = *pipeline_guard {
                pipeline.switch_input_device(device_name)?;
            }
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn switch_output_device(&self, device_name: Option<&str>) -> Result<(), String> {
        if let Ok(pipeline_guard) = self.audio_pipeline.lock() {
            if let Some(ref pipeline) = *pipeline_guard {
                pipeline.switch_output_device(device_name)?;
            }
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn set_input_volume(&self, volume: f32) {
        if let Ok(pipeline_guard) = self.audio_pipeline.lock() {
            if let Some(ref pipeline) = *pipeline_guard {
                pipeline.set_input_volume(volume);
            }
        }
    }

    #[allow(dead_code)]
    pub fn set_output_volume(&self, volume: f32) {
        if let Ok(pipeline_guard) = self.audio_pipeline.lock() {
            if let Some(ref pipeline) = *pipeline_guard {
                pipeline.set_output_volume(volume);
            }
        }
    }

    pub async fn reject_call(&self) {
        self.end_call().await;
    }

    pub async fn start_screen_share(&self, source_id: &str) -> Result<(), String> {
        let state = self.state.read().await;
        if state.status != CallStatus::Active {
            return Err("Call not active".to_string());
        }
        drop(state);

        if self.screen_pipeline.lock().unwrap().is_some() {
            return Err("Already screen sharing".to_string());
        }

        let encryptor = self.encryptor.read().await;
        let enc = encryptor.as_ref().ok_or("No encryptor available")?;
        enc.lock().unwrap().reset_video_send_counter();
        let enc_clone = enc.clone();
        drop(encryptor);

        let datagram_guard = self.datagram_channel.read().await;
        let datagram_channel = datagram_guard
            .as_ref()
            .ok_or("No datagram channel available")?
            .clone();
        drop(datagram_guard);

        let video_send_guard = self.video_send.read().await;
        let video_send = video_send_guard
            .as_ref()
            .ok_or("No video send stream available")?
            .clone();
        drop(video_send_guard);

        let frame_tx = VIDEO_SEND_CHANNEL.0.clone();
        let frame_rx = VIDEO_SEND_CHANNEL.1.clone();

        let pipeline = start_screen_share_pipeline(source_id, frame_tx)?;
        let pipeline_for_quality = pipeline.clone();
        *self.screen_pipeline.lock().unwrap() = Some(pipeline);

        self.screen_quality_stop
            .store(false, std::sync::atomic::Ordering::Relaxed);
        let quality_stop = self.screen_quality_stop.clone();
        let quality_stats = self.stats.clone();
        std::thread::spawn(move || {
            let mut bitrate = screen::TARGET_BITRATE;
            let mut last_sent = 0u32;
            let mut last_lost = 0u32;
            while !quality_stop.load(std::sync::atomic::Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_secs(2));
                let stats = match quality_stats.lock() {
                    Ok(s) => s.clone(),
                    Err(_) => continue,
                };
                let sent = stats.packets_sent;
                let lost = stats.packets_lost;
                let delta_sent = sent.saturating_sub(last_sent);
                let delta_lost = lost.saturating_sub(last_lost);
                last_sent = sent;
                last_lost = lost;

                let loss = if delta_sent > 0 {
                    delta_lost as f32 / delta_sent as f32
                } else {
                    0.0
                };

                if loss > 0.08 {
                    bitrate = ((bitrate as f32) * 0.75) as u32;
                    pipeline_for_quality.request_keyframe();
                } else if loss > 0.03 {
                    bitrate = ((bitrate as f32) * 0.85) as u32;
                } else if loss < 0.01 {
                    bitrate = ((bitrate as f32) * 1.10) as u32;
                }

                bitrate = bitrate.clamp(1_500_000, 12_000_000);
                pipeline_for_quality.set_quality(screen::TARGET_FPS, bitrate);
            }
        });

        let send_enc = enc_clone.clone();
        let send_stats = self.stats.clone();
        let video_send_for_reliable = video_send.clone();
        std::thread::spawn(move || loop {
            match frame_rx.recv_timeout(std::time::Duration::from_millis(50)) {
                Ok(frame_data) => {
                    let encrypted = {
                        let mut e = send_enc.lock().unwrap();
                        match e.encrypt_video_frame(&frame_data) {
                            Ok(data) => data,
                            Err(err) => {
                                eprintln!("[Video] Encrypt error: {}", err);
                                continue;
                            }
                        }
                    };
                    match datagram_channel.send_video_lossy(&encrypted) {
                        Ok(_) => {
                            if let Ok(mut stats) = send_stats.lock() {
                                stats.packets_sent += 1;
                            }
                        }
                        Err(_) => {
                            let rt = tokio::runtime::Handle::current();
                            let _ = rt.block_on(video_send_for_reliable.send(&encrypted));
                            if let Ok(mut stats) = send_stats.lock() {
                                stats.packets_lost += 1;
                            }
                        }
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => {}
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                    eprintln!("[Video] Channel disconnected, stopping");
                    break;
                }
            }
        });

        {
            let mut state = self.state.write().await;
            state.is_screen_sharing = true;
            state.screen_share_source = Some(source_id.to_string());
        }

        Ok(())
    }

    pub async fn stop_screen_share(&self) -> Result<(), String> {
        if let Some(pipeline) = self.screen_pipeline.lock().unwrap().take() {
            self.screen_quality_stop
                .store(true, std::sync::atomic::Ordering::Relaxed);
            pipeline.stop();
        }

        {
            let mut state = self.state.write().await;
            state.is_screen_sharing = false;
            state.screen_share_source = None;
        }

        Ok(())
    }

    pub async fn set_peer_muted(&self, is_muted: bool) {
        let mut state = self.state.write().await;
        state.peer_is_muted = is_muted;
    }

    pub async fn set_peer_screen_sharing(&self, is_sharing: bool) -> Result<(), String> {
        if is_sharing {
            if let Some(ref enc) = *self.encryptor.read().await {
                enc.lock().unwrap().reset_video_recv_counter();
            }

            let decoded_tx = VIDEO_RECV_CHANNEL.0.clone();
            let h264_tx = VIDEO_H264_CHANNEL.0.clone();
            let (video_recv_tx, video_recv_rx) = crossbeam_channel::bounded::<Vec<u8>>(30);

            *self.video_recv_tx.lock().unwrap() = Some(video_recv_tx);

            let decoder = start_video_decoder(video_recv_rx, decoded_tx, h264_tx)?;
            *self.video_decoder.lock().unwrap() = Some(decoder);
        } else {
            *self.video_recv_tx.lock().unwrap() = None;

            if let Some(decoder) = self.video_decoder.lock().unwrap().take() {
                decoder.stop();
            }
        }

        let mut state = self.state.write().await;
        state.peer_is_screen_sharing = is_sharing;
        Ok(())
    }

    pub fn get_decoded_frame_receiver(&self) -> crossbeam_channel::Receiver<DecodedFrame> {
        VIDEO_RECV_CHANNEL.1.clone()
    }

    pub fn get_h264_chunk_receiver(&self) -> crossbeam_channel::Receiver<H264Chunk> {
        VIDEO_H264_CHANNEL.1.clone()
    }

    #[allow(dead_code)]
    pub fn set_use_datagram_audio(&self, use_datagram: bool) {
        self.use_datagram_audio
            .store(use_datagram, std::sync::atomic::Ordering::Relaxed);
    }
}
