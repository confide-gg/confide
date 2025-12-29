pub mod audio_mixer;
pub mod crypto;
pub mod speaking;

pub use crypto::{
    create_group_call_crypto, join_group_call_crypto, CreateGroupCallResult, JoinGroupCallResult,
};

use audio_mixer::AudioMixer;
use speaking::SpeakingDetector;

use crate::call::audio::{start_audio_pipeline, AudioPipelineHandle, SAMPLE_RATE};
use crate::call::settings::AudioSettings;
use crate::call::transport::{CallTransport, DatagramChannel};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

use chrono::{DateTime, Utc};
use confide_sdk::crypto::group_call::{
    add_participant_from_existing, decrypt_group_call_audio, distribute_sender_key_to_participant,
    encrypt_group_call_audio, GroupCallMediaFrame, GroupCallParticipant,
    GroupCallState as SdkGroupCallState, ParticipantId,
};
use confide_sdk::crypto::DsaKeyPair;
use dashmap::DashMap;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

type SyncRwLock<T> = std::sync::RwLock<T>;

#[allow(clippy::type_complexity)]
static GROUP_AUDIO_SEND_CHANNEL: Lazy<(
    crossbeam_channel::Sender<Vec<u8>>,
    crossbeam_channel::Receiver<Vec<u8>>,
)> = Lazy::new(|| crossbeam_channel::bounded(50));

static GROUP_OUTPUT_STOP_TX: Lazy<std::sync::Mutex<Option<crossbeam_channel::Sender<()>>>> =
    Lazy::new(|| std::sync::Mutex::new(None));

#[allow(clippy::type_complexity)]
static GROUP_LOCAL_AUDIO_CHANNEL: Lazy<(
    crossbeam_channel::Sender<Vec<i16>>,
    crossbeam_channel::Receiver<Vec<i16>>,
)> = Lazy::new(|| crossbeam_channel::bounded(50));

pub fn get_local_audio_sender() -> crossbeam_channel::Sender<Vec<i16>> {
    GROUP_LOCAL_AUDIO_CHANNEL.0.clone()
}

static PARTICIPANT_DECODERS: Lazy<DashMap<Uuid, std::sync::Mutex<opus::Decoder>>> =
    Lazy::new(DashMap::new);

static PARTICIPANT_LAST_SEQ: Lazy<DashMap<Uuid, u32>> = Lazy::new(DashMap::new);

const DATAGRAM_TYPE_GROUP_AUDIO: u8 = 0x11;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GroupCallMediaStatus {
    Idle,
    Connecting,
    Active,
    Reconnecting,
    Disconnected,
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
pub struct GroupCallMediaState {
    pub call_id: Option<Uuid>,
    pub status: GroupCallMediaStatus,
    pub is_muted: bool,
    pub is_deafened: bool,
    pub connection_health: ConnectionHealth,
    pub connected_at: Option<DateTime<Utc>>,
    pub relay_token_expires_at: Option<DateTime<Utc>>,
    pub relay_token_expires_soon: bool,
    pub participant_count: usize,
}

impl Default for GroupCallMediaState {
    fn default() -> Self {
        Self {
            call_id: None,
            status: GroupCallMediaStatus::Idle,
            is_muted: false,
            is_deafened: false,
            connection_health: ConnectionHealth::Good,
            connected_at: None,
            relay_token_expires_at: None,
            relay_token_expires_soon: false,
            participant_count: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeakingStateInfo {
    pub participant_id: String,
    pub is_speaking: bool,
    pub audio_level: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SenderKeyBundle {
    pub participant_id: String,
    pub encrypted_sender_key: Vec<u8>,
    pub identity_public: Vec<u8>,
}

#[derive(Clone)]
struct ParticipantMediaInfo {
    last_audio_at: Option<Instant>,
}

pub struct GroupCallManager {
    state: RwLock<GroupCallMediaState>,
    sdk_state: Arc<SyncRwLock<Option<SdkGroupCallState>>>,
    dsa_keypair: RwLock<Option<DsaKeyPair>>,
    transport: RwLock<Option<Arc<Mutex<CallTransport>>>>,
    datagram_channel: RwLock<Option<Arc<DatagramChannel>>>,
    audio_mixer: Arc<AudioMixer>,
    speaking_detector: Arc<SpeakingDetector>,
    audio_pipeline: std::sync::Mutex<Option<AudioPipelineHandle>>,
    participants: DashMap<Uuid, ParticipantMediaInfo>,
    is_muted: Arc<AtomicBool>,
    is_deafened: Arc<AtomicBool>,
    connection_error: Arc<AtomicBool>,
    audio_send_stop: Arc<AtomicBool>,
    audio_recv_stop: Arc<AtomicBool>,
    audio_sequence: Arc<AtomicU32>,
    relay_token_expires_at: RwLock<Option<DateTime<Utc>>>,
    our_participant_id: RwLock<Option<Uuid>>,
    our_ephemeral_public: RwLock<Vec<u8>>,
}

impl GroupCallManager {
    pub fn new() -> Self {
        Self {
            state: RwLock::new(GroupCallMediaState::default()),
            sdk_state: Arc::new(SyncRwLock::new(None)),
            dsa_keypair: RwLock::new(None),
            transport: RwLock::new(None),
            datagram_channel: RwLock::new(None),
            audio_mixer: Arc::new(AudioMixer::new()),
            speaking_detector: Arc::new(SpeakingDetector::new()),
            audio_pipeline: std::sync::Mutex::new(None),
            participants: DashMap::new(),
            is_muted: Arc::new(AtomicBool::new(false)),
            is_deafened: Arc::new(AtomicBool::new(false)),
            connection_error: Arc::new(AtomicBool::new(false)),
            audio_send_stop: Arc::new(AtomicBool::new(false)),
            audio_recv_stop: Arc::new(AtomicBool::new(false)),
            audio_sequence: Arc::new(AtomicU32::new(0)),
            relay_token_expires_at: RwLock::new(None),
            our_participant_id: RwLock::new(None),
            our_ephemeral_public: RwLock::new(Vec::new()),
        }
    }

    pub async fn get_state(&self) -> GroupCallMediaState {
        let mut state = self.state.read().await.clone();

        if state.status == GroupCallMediaStatus::Active {
            let has_error = self.connection_error.load(Ordering::Relaxed);
            state.connection_health = if has_error {
                ConnectionHealth::Disconnected
            } else {
                ConnectionHealth::Good
            };

            if let Some(expires_at) = *self.relay_token_expires_at.read().await {
                state.relay_token_expires_at = Some(expires_at);
                let time_until_expiry = expires_at - Utc::now();
                state.relay_token_expires_soon = time_until_expiry < chrono::Duration::minutes(15);
            }

            state.participant_count = self.participants.len();
        }

        state
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn start_media_session(
        &self,
        call_id: Uuid,
        relay_endpoint: &str,
        relay_token: Vec<u8>,
        our_participant_id: Uuid,
        sdk_state: SdkGroupCallState,
        dsa_keypair: DsaKeyPair,
        our_ephemeral_public: Vec<u8>,
    ) -> Result<(), String> {
        eprintln!("[GroupCall] start_media_session: beginning setup");
        if relay_token.len() >= 41 {
            let expires_bytes: [u8; 8] = relay_token[33..41].try_into().unwrap_or([0u8; 8]);
            let expires_ts = i64::from_le_bytes(expires_bytes);
            if let Some(expires_at) = DateTime::from_timestamp(expires_ts, 0) {
                *self.relay_token_expires_at.write().await = Some(expires_at);
            }
        }

        *self.sdk_state.write().unwrap() = Some(sdk_state);
        *self.dsa_keypair.write().await = Some(dsa_keypair);
        *self.our_participant_id.write().await = Some(our_participant_id);
        *self.our_ephemeral_public.write().await = our_ephemeral_public;

        {
            let mut state = self.state.write().await;
            state.call_id = Some(call_id);
            state.status = GroupCallMediaStatus::Connecting;
        }

        let (transport, media_streams) = CallTransport::new(relay_endpoint, relay_token)
            .await
            .map_err(|e| format!("Failed to connect to relay: {}", e))?;

        let transport = Arc::new(Mutex::new(transport));
        *self.transport.write().await = Some(transport.clone());

        let datagram_channel = Arc::new(media_streams.datagram);
        *self.datagram_channel.write().await = Some(datagram_channel.clone());

        let (_audio_recv_tx, audio_recv_rx) = crossbeam_channel::bounded::<Vec<u8>>(100);

        let audio_send_tx = GROUP_AUDIO_SEND_CHANNEL.0.clone();
        let _audio_send_rx = GROUP_AUDIO_SEND_CHANNEL.1.clone();

        let is_muted = self.is_muted.clone();
        let is_deafened = self.is_deafened.clone();

        let audio_pipeline_handle = start_audio_pipeline(
            audio_send_tx,
            audio_recv_rx,
            is_muted.clone(),
            is_deafened.clone(),
            None,
        )
        .map_err(|e| format!("Failed to start audio pipeline: {}", e))?;

        *self.audio_pipeline.lock().unwrap() = Some(audio_pipeline_handle);

        self.audio_send_stop.store(false, Ordering::Relaxed);
        self.audio_recv_stop.store(false, Ordering::Relaxed);

        self.start_audio_send_loop(datagram_channel.clone(), our_participant_id);

        self.start_audio_recv_loop(media_streams.connection.clone(), our_participant_id);

        self.start_local_speaking_detection(our_participant_id);

        self.start_group_output_stream()?;

        self.connection_error.store(false, Ordering::Relaxed);

        {
            let mut state = self.state.write().await;
            state.status = GroupCallMediaStatus::Active;
            state.connected_at = Some(Utc::now());
        }

        eprintln!("[GroupCall] start_media_session: completed successfully");
        Ok(())
    }

    fn start_audio_send_loop(&self, datagram: Arc<DatagramChannel>, our_id: Uuid) {
        let audio_send_rx = GROUP_AUDIO_SEND_CHANNEL.1.clone();
        let sdk_state = self.sdk_state.clone();
        let audio_sequence = self.audio_sequence.clone();
        let is_muted = self.is_muted.clone();
        let stop_flag = self.audio_send_stop.clone();

        std::thread::spawn(move || {
            eprintln!("[GroupCall] Audio send loop started");
            let mut frames_sent = 0u32;
            loop {
                if stop_flag.load(Ordering::Relaxed) {
                    eprintln!("[GroupCall] Audio send loop stop flag set");
                    break;
                }

                match audio_send_rx.recv_timeout(std::time::Duration::from_millis(20)) {
                    Ok(opus_data) => {
                        if is_muted.load(Ordering::Relaxed) {
                            continue;
                        }

                        let encrypted_frame = {
                            let mut state_guard = match sdk_state.write() {
                                Ok(g) => g,
                                Err(_) => continue,
                            };
                            if let Some(ref mut state) = *state_guard {
                                encrypt_group_call_audio(state, &opus_data).ok()
                            } else {
                                eprintln!("[GroupCall] No SDK state available for encryption");
                                None
                            }
                        };

                        if let Some(frame) = encrypted_frame {
                            let seq = audio_sequence.fetch_add(1, Ordering::Relaxed);
                            let packet = serialize_group_audio_packet(&frame, our_id, seq);
                            let _ = datagram.send(&packet);
                            frames_sent += 1;
                            if frames_sent.is_multiple_of(500) {
                                eprintln!("[GroupCall] Sent {} audio frames", frames_sent);
                            }
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {}
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                        eprintln!("[GroupCall] Audio send channel disconnected");
                        break;
                    }
                }
            }
            eprintln!("[GroupCall] Audio send loop ended");
        });
    }

    fn start_audio_recv_loop(&self, connection: quinn::Connection, our_id: Uuid) {
        let sdk_state = self.sdk_state.clone();
        let audio_mixer = self.audio_mixer.clone();
        let speaking_detector = self.speaking_detector.clone();
        let participants = self.participants.clone();
        let conn_error = self.connection_error.clone();
        let is_deafened = self.is_deafened.clone();

        tokio::spawn(async move {
            eprintln!("[GroupCall] Audio recv loop started, our_id: {}", our_id);
            let mut frames_received = 0u32;
            let mut decrypt_failures = 0u32;
            loop {
                match connection.read_datagram().await {
                    Ok(data) => {
                        if data.is_empty() {
                            continue;
                        }

                        if data[0] != DATAGRAM_TYPE_GROUP_AUDIO {
                            eprintln!(
                                "[GroupCall] Received non-audio datagram type: 0x{:02x}, len={}",
                                data[0],
                                data.len()
                            );
                            continue;
                        }

                        let (sender_id, frame, sequence) =
                            match deserialize_group_audio_packet(&data[1..]) {
                                Some(parsed) => parsed,
                                None => {
                                    eprintln!("[GroupCall] Failed to deserialize audio packet");
                                    continue;
                                }
                            };

                        if sender_id == our_id {
                            continue;
                        }

                        frames_received += 1;
                        if frames_received % 500 == 1 {
                            eprintln!(
                                "[GroupCall] Received {} frames from {}",
                                frames_received, sender_id
                            );
                        }

                        let decrypted = {
                            let mut state_guard = match sdk_state.write() {
                                Ok(g) => g,
                                Err(_) => continue,
                            };
                            if let Some(ref mut state) = *state_guard {
                                match decrypt_group_call_audio(state, &frame) {
                                    Ok(d) => Some(d),
                                    Err(e) => {
                                        decrypt_failures += 1;
                                        if decrypt_failures % 100 == 1 {
                                            eprintln!(
                                                "[GroupCall] Decrypt failed ({}x): {}",
                                                decrypt_failures, e
                                            );
                                        }
                                        None
                                    }
                                }
                            } else {
                                eprintln!("[GroupCall] No SDK state for decryption");
                                None
                            }
                        };

                        if let Some(opus_data) = decrypted {
                            let last_seq = PARTICIPANT_LAST_SEQ
                                .get(&sender_id)
                                .map(|v| *v)
                                .unwrap_or(0);

                            if last_seq > 0 && sequence > last_seq + 1 {
                                let gap = (sequence - last_seq - 1).min(5);
                                for i in 0..gap {
                                    let plc_samples = generate_plc_audio(sender_id);
                                    if !is_deafened.load(Ordering::Relaxed) {
                                        audio_mixer.add_audio(
                                            sender_id,
                                            plc_samples,
                                            last_seq + 1 + i,
                                        );
                                    }
                                }
                            }

                            PARTICIPANT_LAST_SEQ.insert(sender_id, sequence);

                            let samples = decode_opus_to_samples(sender_id, &opus_data);

                            speaking_detector.process_audio(sender_id, &samples);

                            if !is_deafened.load(Ordering::Relaxed) {
                                audio_mixer.add_audio(sender_id, samples, sequence);
                            }

                            participants
                                .entry(sender_id)
                                .or_insert_with(|| ParticipantMediaInfo {
                                    last_audio_at: Some(Instant::now()),
                                })
                                .last_audio_at = Some(Instant::now());
                        }
                    }
                    Err(e) => {
                        eprintln!("[GroupCall] Datagram receive error: {}", e);
                        conn_error.store(true, Ordering::Relaxed);
                        break;
                    }
                }
            }
            eprintln!("[GroupCall] Audio recv loop ended");
        });
    }

    fn start_local_speaking_detection(&self, our_id: Uuid) {
        let speaking_detector = self.speaking_detector.clone();
        let stop_flag = self.audio_send_stop.clone();
        let local_audio_rx = GROUP_LOCAL_AUDIO_CHANNEL.1.clone();

        std::thread::spawn(move || {
            eprintln!("[GroupCall] Local speaking detection started");
            loop {
                if stop_flag.load(Ordering::Relaxed) {
                    break;
                }

                match local_audio_rx.recv_timeout(std::time::Duration::from_millis(50)) {
                    Ok(samples_i16) => {
                        let samples_f32: Vec<f32> =
                            samples_i16.iter().map(|&s| s as f32 / 32767.0).collect();
                        speaking_detector.process_audio(our_id, &samples_f32);
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {}
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                        break;
                    }
                }
            }
            eprintln!("[GroupCall] Local speaking detection ended");
        });
    }

    fn start_group_output_stream(&self) -> Result<(), String> {
        let settings = AudioSettings::load().unwrap_or_default();
        let audio_mixer = self.audio_mixer.clone();
        let is_deafened = self.is_deafened.clone();
        let output_device_name = settings.output_device.clone();

        let (stop_tx, stop_rx) = crossbeam_channel::bounded::<()>(1);

        if let Ok(mut tx) = GROUP_OUTPUT_STOP_TX.lock() {
            *tx = Some(stop_tx);
        }

        std::thread::spawn(move || {
            let host = cpal::default_host();

            let output_device = if let Some(ref name) = output_device_name {
                host.output_devices()
                    .ok()
                    .and_then(|mut devices| {
                        devices.find(|d| d.name().ok().as_deref() == Some(name))
                    })
                    .or_else(|| host.default_output_device())
            } else {
                host.default_output_device()
            };

            let output_device = match output_device {
                Some(d) => d,
                None => {
                    eprintln!("[GroupCall] No output device available");
                    return;
                }
            };

            let device_name = output_device.name().unwrap_or_default();
            eprintln!("[GroupCall] Using output device: {}", device_name);

            let supported_output = match output_device.default_output_config() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[GroupCall] Failed to get output config: {}", e);
                    return;
                }
            };

            let output_sample_rate = supported_output.sample_rate().0;
            let output_buffer_frames = (output_sample_rate / 50) as u32;
            let output_config = cpal::StreamConfig {
                channels: supported_output.channels(),
                sample_rate: supported_output.sample_rate(),
                buffer_size: cpal::BufferSize::Fixed(output_buffer_frames),
            };

            let output_channels = supported_output.channels() as usize;
            let resample_buffer = Arc::new(std::sync::Mutex::new(
                std::collections::VecDeque::<f32>::with_capacity(4096),
            ));

            eprintln!(
                "[GroupCall] Output: {}Hz, {} ch, buffer={} frames",
                output_sample_rate, output_channels, output_buffer_frames
            );

            let stream = match output_device.build_output_stream(
                &output_config,
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    if is_deafened.load(Ordering::Relaxed) {
                        data.fill(0.0);
                        return;
                    }

                    let samples_needed = data.len() / output_channels;

                    if !audio_mixer.is_ready() {
                        data.fill(0.0);
                        return;
                    }

                    let resampled = if output_sample_rate != SAMPLE_RATE {
                        let mut resampled_out = Vec::with_capacity(samples_needed);
                        let ratio = SAMPLE_RATE as f64 / output_sample_rate as f64;

                        if let Ok(mut resample_buf) = resample_buffer.lock() {
                            let source_samples_needed =
                                ((samples_needed as f64 * ratio).ceil() as usize) + 4;
                            while resample_buf.len() < source_samples_needed {
                                let mixed = audio_mixer.get_mixed_output(480);
                                resample_buf.extend(mixed);
                            }

                            let input: Vec<f32> = resample_buf.iter().copied().collect();
                            for i in 0..samples_needed {
                                let src_pos = i as f64 * ratio;
                                let src_idx = src_pos.floor() as usize;
                                let frac = (src_pos - src_idx as f64) as f32;

                                let s_1 =
                                    input.get(src_idx.saturating_sub(1)).copied().unwrap_or(0.0);
                                let s0 = input.get(src_idx).copied().unwrap_or(0.0);
                                let s1 = input.get(src_idx + 1).copied().unwrap_or(s0);
                                let s2 = input.get(src_idx + 2).copied().unwrap_or(s1);

                                let mu2 = frac * frac;
                                let a0 = s2 - s1 - s_1 + s0;
                                let a1 = s_1 - s0 - a0;
                                let a2 = s1 - s_1;
                                let a3 = s0;
                                resampled_out.push(a0 * frac * mu2 + a1 * mu2 + a2 * frac + a3);
                            }

                            let consumed = (samples_needed as f64 * ratio).ceil() as usize;
                            if consumed <= resample_buf.len() {
                                resample_buf.drain(..consumed);
                            } else {
                                resample_buf.clear();
                            }
                        }
                        resampled_out
                    } else {
                        let mut output = Vec::with_capacity(samples_needed);
                        while output.len() < samples_needed {
                            let mixed = audio_mixer.get_mixed_output(480);
                            let take = (samples_needed - output.len()).min(mixed.len());
                            output.extend_from_slice(&mixed[..take]);
                        }
                        output
                    };

                    for (i, frame) in data.chunks_mut(output_channels).enumerate() {
                        let sample = resampled.get(i).copied().unwrap_or(0.0);
                        for channel in frame.iter_mut() {
                            *channel = sample;
                        }
                    }
                },
                |err| {
                    eprintln!("[GroupCall] Output stream error: {:?}", err);
                },
                None,
            ) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[GroupCall] Failed to build output stream: {}", e);
                    return;
                }
            };

            if let Err(e) = stream.play() {
                eprintln!("[GroupCall] Failed to start output: {}", e);
                return;
            }

            eprintln!("[GroupCall] Output stream started, waiting for stop signal");
            let _ = stop_rx.recv();
            eprintln!("[GroupCall] Output stream stopped");
            drop(stream);
        });

        Ok(())
    }

    pub async fn stop_media_session(&self) -> Result<(), String> {
        eprintln!("[GroupCall] stop_media_session called");

        self.audio_send_stop.store(true, Ordering::Relaxed);
        self.audio_recv_stop.store(true, Ordering::Relaxed);

        if let Some(pipeline) = self.audio_pipeline.lock().unwrap().take() {
            eprintln!("[GroupCall] Stopping audio pipeline");
            pipeline.stop();
        }

        if let Ok(mut stop_tx) = GROUP_OUTPUT_STOP_TX.lock() {
            if let Some(tx) = stop_tx.take() {
                let _ = tx.send(());
            }
        }

        *self.transport.write().await = None;
        *self.datagram_channel.write().await = None;
        *self.sdk_state.write().unwrap() = None;
        *self.dsa_keypair.write().await = None;

        self.audio_mixer.clear();
        self.speaking_detector.clear();
        self.participants.clear();
        PARTICIPANT_DECODERS.clear();
        PARTICIPANT_LAST_SEQ.clear();

        {
            let mut state = self.state.write().await;
            state.status = GroupCallMediaStatus::Ended;
            state.call_id = None;
        }

        Ok(())
    }

    pub fn add_participant_sender_key(
        &self,
        participant_id: Uuid,
        encrypted_sender_key: &[u8],
        sender_identity_public: &[u8],
        sender_ephemeral_public: &[u8],
    ) -> Result<(), String> {
        self.participants.insert(
            participant_id,
            ParticipantMediaInfo {
                last_audio_at: None,
            },
        );

        if encrypted_sender_key.is_empty() || sender_identity_public.is_empty() {
            return Ok(());
        }

        let mut sdk_guard = match self.sdk_state.write() {
            Ok(g) => g,
            Err(_) => return Ok(()),
        };
        let sdk_state = match sdk_guard.as_mut() {
            Some(s) => s,
            None => return Ok(()),
        };

        let pid = match ParticipantId::from_bytes(participant_id.as_bytes()) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[GroupCall] Invalid participant ID: {}", e);
                return Ok(());
            }
        };

        if let Err(e) = add_participant_from_existing(
            sdk_state,
            pid,
            sender_identity_public.to_vec(),
            sender_ephemeral_public.to_vec(),
            0,
        ) {
            eprintln!("[GroupCall] Failed to register participant: {}", e);
        }

        let distribution: confide_sdk::crypto::group_call::GroupCallSenderKeyDistribution =
            match bincode::deserialize(encrypted_sender_key) {
                Ok(d) => d,
                Err(e) => {
                    eprintln!(
                        "[GroupCall] Sender key not in distribution format (may be raw key): {}",
                        e
                    );
                    return Ok(());
                }
            };

        if let Err(e) = confide_sdk::crypto::group_call::handle_sender_key_distribution(
            sdk_state,
            &distribution,
            sender_identity_public,
        ) {
            eprintln!(
                "[GroupCall] Failed to handle sender key distribution: {}",
                e
            );
        }

        Ok(())
    }

    pub fn remove_participant(&self, participant_id: Uuid) {
        self.participants.remove(&participant_id);
        self.audio_mixer.remove_participant(participant_id);
        self.speaking_detector.remove_participant(participant_id);
    }

    pub fn get_speaking_states(&self) -> Vec<SpeakingStateInfo> {
        self.speaking_detector
            .get_all_states()
            .into_iter()
            .map(|(id, is_speaking, level)| SpeakingStateInfo {
                participant_id: id.to_string(),
                is_speaking,
                audio_level: level,
            })
            .collect()
    }

    pub async fn set_muted(&self, muted: bool) {
        self.is_muted.store(muted, Ordering::Relaxed);
        let mut state = self.state.write().await;
        state.is_muted = muted;
    }

    pub async fn set_deafened(&self, deafened: bool) {
        self.is_deafened.store(deafened, Ordering::Relaxed);
        let mut state = self.state.write().await;
        state.is_deafened = deafened;
    }

    pub async fn update_relay_token(&self, _relay_token: Vec<u8>, expires_at: DateTime<Utc>) {
        *self.relay_token_expires_at.write().await = Some(expires_at);
    }

    pub fn create_sender_key_for_participant(
        &self,
        participant_id: &str,
        identity_public: &[u8],
        ephemeral_public: &[u8],
    ) -> Result<(Vec<u8>, Vec<u8>), String> {
        let participant_uuid = Uuid::parse_str(participant_id).map_err(|e| e.to_string())?;
        let pid =
            ParticipantId::from_bytes(participant_uuid.as_bytes()).map_err(|e| e.to_string())?;

        let participant = GroupCallParticipant {
            participant_id: pid,
            identity_public_key: identity_public.to_vec(),
            ephemeral_kem_public: ephemeral_public.to_vec(),
            joined_at: 0,
        };

        let sdk_guard = self
            .sdk_state
            .read()
            .map_err(|e| format!("Lock error: {}", e))?;
        let sdk_state = sdk_guard
            .as_ref()
            .ok_or_else(|| "No SDK state available".to_string())?;

        let dsa_guard = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(self.dsa_keypair.read())
        });
        let dsa = dsa_guard
            .as_ref()
            .ok_or_else(|| "No DSA keypair available".to_string())?;

        let our_ephemeral = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(self.our_ephemeral_public.read())
        });

        let distribution = distribute_sender_key_to_participant(sdk_state, &participant, dsa)
            .map_err(|e| format!("Distribution error: {}", e))?;

        let encrypted = bincode::serialize(&distribution).map_err(|e| e.to_string())?;
        Ok((encrypted, our_ephemeral.clone()))
    }
}

impl Default for GroupCallManager {
    fn default() -> Self {
        Self::new()
    }
}

fn serialize_group_audio_packet(
    frame: &GroupCallMediaFrame,
    sender_id: Uuid,
    sequence: u32,
) -> Vec<u8> {
    let mut packet = Vec::with_capacity(1 + 16 + 4 + frame.ciphertext.len() + 8);

    packet.push(DATAGRAM_TYPE_GROUP_AUDIO);
    packet.extend_from_slice(sender_id.as_bytes());
    packet.extend_from_slice(&sequence.to_be_bytes());
    packet.extend_from_slice(&frame.key_id.to_be_bytes());
    packet.extend_from_slice(&frame.nonce_counter.to_be_bytes());
    packet.extend_from_slice(&frame.ciphertext);

    packet
}

fn deserialize_group_audio_packet(data: &[u8]) -> Option<(Uuid, GroupCallMediaFrame, u32)> {
    if data.len() < 16 + 4 + 4 + 8 {
        return None;
    }

    let sender_id = Uuid::from_slice(&data[0..16]).ok()?;
    let sequence = u32::from_be_bytes(data[16..20].try_into().ok()?);
    let key_id = u32::from_be_bytes(data[20..24].try_into().ok()?);
    let nonce_counter = u64::from_be_bytes(data[24..32].try_into().ok()?);
    let ciphertext = data[32..].to_vec();

    let participant_id =
        confide_sdk::crypto::group_call::ParticipantId::from_bytes(sender_id.as_bytes()).ok()?;

    let frame = GroupCallMediaFrame {
        sender_id: participant_id,
        key_id,
        media_type: confide_sdk::crypto::group_call::MediaType::Audio,
        nonce_counter,
        ciphertext,
    };

    Some((sender_id, frame, sequence))
}

fn decode_opus_to_samples(sender_id: Uuid, opus_data: &[u8]) -> Vec<f32> {
    use opus::{Channels, Decoder};

    let decoder_entry = PARTICIPANT_DECODERS.entry(sender_id).or_insert_with(|| {
        std::sync::Mutex::new(
            Decoder::new(48000, Channels::Mono).expect("Failed to create Opus decoder"),
        )
    });

    if let Ok(mut decoder) = decoder_entry.lock() {
        let mut output = [0i16; 480];
        if decoder.decode(opus_data, &mut output, false).is_ok() {
            return output.iter().map(|s| *s as f32 / 32768.0).collect();
        }
        if decoder.decode(&[], &mut output, false).is_ok() {
            return output.iter().map(|s| *s as f32 / 32768.0).collect();
        }
    }

    vec![0.0; 480]
}

fn generate_plc_audio(sender_id: Uuid) -> Vec<f32> {
    if let Some(decoder_entry) = PARTICIPANT_DECODERS.get(&sender_id) {
        if let Ok(mut decoder) = decoder_entry.lock() {
            let mut output = [0i16; 480];
            if decoder.decode(&[], &mut output, false).is_ok() {
                return output.iter().map(|s| *s as f32 / 32768.0).collect();
            }
        }
    }

    vec![0.0; 480]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_group_audio_packet_serialization() {
        let sender_id = Uuid::new_v4();
        let participant_id =
            confide_sdk::crypto::group_call::ParticipantId::from_bytes(sender_id.as_bytes())
                .unwrap();
        let frame = GroupCallMediaFrame {
            sender_id: participant_id,
            key_id: 1,
            media_type: confide_sdk::crypto::group_call::MediaType::Audio,
            nonce_counter: 100,
            ciphertext: vec![1, 2, 3, 4],
        };

        let packet = serialize_group_audio_packet(&frame, sender_id, 42);
        let (parsed_id, parsed_frame, parsed_seq) =
            deserialize_group_audio_packet(&packet[1..]).unwrap();

        assert_eq!(parsed_id, sender_id);
        assert_eq!(parsed_seq, 42);
        assert_eq!(parsed_frame.key_id, 1);
        assert_eq!(parsed_frame.nonce_counter, 100);
        assert_eq!(parsed_frame.ciphertext, vec![1, 2, 3, 4]);
    }
}
