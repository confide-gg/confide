use crate::call::settings::AudioSettings;
use crate::call::state::{AudioDeviceInfo, AudioDevices};
use audiopus::{
    coder::Decoder, coder::Encoder, packet::Packet, Application, Bandwidth, Bitrate, Channels,
    MutSignals, SampleRate, Signal,
};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use crossbeam_channel::{Receiver, Sender};
use nnnoiseless::DenoiseState;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::oneshot;

pub const SAMPLE_RATE: u32 = 48000;
pub const FRAME_SIZE: usize = 480;
pub const MAX_OPUS_FRAME_SIZE: usize = 1275;

const OPUS_BITRATE: i32 = 128000;
const OPUS_COMPLEXITY: u8 = 10;
const OPUS_ENABLE_FEC: bool = true;
const OPUS_PACKET_LOSS_PERC: u8 = 5;
const OPUS_USE_DTX: bool = false;
const OPUS_USE_VBR: bool = true;

const JITTER_BUFFER_MIN_MS: usize = 10;
const JITTER_BUFFER_TARGET_MS: usize = 30;
const JITTER_BUFFER_MAX_MS: usize = 80;
const JITTER_BUFFER_ADAPTATION_RATE: f32 = 0.15;

const DENOISE_FRAME_SIZE: usize = DenoiseState::FRAME_SIZE;

#[derive(Debug)]
pub enum AudioCommand {
    SwitchInputDevice(Option<String>),
    SwitchOutputDevice(Option<String>),
    SetInputVolume(f32),
    SetOutputVolume(f32),
    SetNoiseSuppressionEnabled(bool),
    Stop,
}

pub struct AudioPipelineHandle {
    command_tx: Sender<AudioCommand>,
}

impl AudioPipelineHandle {
    pub fn switch_input_device(&self, device_name: Option<&str>) -> Result<(), String> {
        self.command_tx
            .send(AudioCommand::SwitchInputDevice(
                device_name.map(|s| s.to_string()),
            ))
            .map_err(|e| format!("Failed to send command: {}", e))
    }

    pub fn switch_output_device(&self, device_name: Option<&str>) -> Result<(), String> {
        self.command_tx
            .send(AudioCommand::SwitchOutputDevice(
                device_name.map(|s| s.to_string()),
            ))
            .map_err(|e| format!("Failed to send command: {}", e))
    }

    pub fn set_input_volume(&self, volume: f32) {
        let _ = self.command_tx.send(AudioCommand::SetInputVolume(volume));
    }

    pub fn set_output_volume(&self, volume: f32) {
        let _ = self.command_tx.send(AudioCommand::SetOutputVolume(volume));
    }

    pub fn set_noise_suppression_enabled(&self, enabled: bool) {
        let _ = self
            .command_tx
            .send(AudioCommand::SetNoiseSuppressionEnabled(enabled));
    }

    pub fn stop(&self) {
        let _ = self.command_tx.send(AudioCommand::Stop);
    }
}

struct AdaptiveJitterBuffer {
    packets: VecDeque<TimestampedAudioPacket>,
    min_packets: usize,
    max_packets: usize,
    target_packets: usize,
    current_delay_ms: f32,
    jitter_estimate: f32,
    last_arrival_time: Option<std::time::Instant>,
    arrival_intervals: VecDeque<f32>,
    consecutive_packet_loss: u32,
    last_sequence: Option<u32>,
}

struct TimestampedAudioPacket {
    data: Vec<u8>,
    sequence: u32,
}

impl AdaptiveJitterBuffer {
    fn new() -> Self {
        let min_packets = (JITTER_BUFFER_MIN_MS as f32 / 10.0).ceil() as usize;
        let target_packets = (JITTER_BUFFER_TARGET_MS as f32 / 10.0).ceil() as usize;
        let max_packets = (JITTER_BUFFER_MAX_MS as f32 / 10.0).ceil() as usize;

        Self {
            packets: VecDeque::with_capacity(max_packets * 2),
            min_packets,
            max_packets,
            target_packets,
            current_delay_ms: JITTER_BUFFER_TARGET_MS as f32,
            jitter_estimate: 5.0,
            last_arrival_time: None,
            arrival_intervals: VecDeque::with_capacity(50),
            consecutive_packet_loss: 0,
            last_sequence: None,
        }
    }

    fn push(&mut self, data: Vec<u8>, sequence: u32) {
        let now = std::time::Instant::now();

        // Detect packet loss
        if let Some(last_seq) = self.last_sequence {
            let expected_seq = last_seq.wrapping_add(1);
            if sequence != expected_seq && sequence != last_seq {
                let loss_count = sequence.wrapping_sub(expected_seq);
                self.consecutive_packet_loss =
                    self.consecutive_packet_loss.saturating_add(loss_count);
            }
        }
        self.last_sequence = Some(sequence);

        if let Some(last_time) = self.last_arrival_time {
            let interval_ms = now.duration_since(last_time).as_secs_f32() * 1000.0;
            self.arrival_intervals.push_back(interval_ms);
            if self.arrival_intervals.len() > 50 {
                self.arrival_intervals.pop_front();
            }
            self.update_jitter_estimate();
        }
        self.last_arrival_time = Some(now);

        let packet = TimestampedAudioPacket { data, sequence };

        // More aggressive buffer management for lower latency
        if self.packets.len() >= self.max_packets {
            let drain_count = self.packets.len() - self.max_packets + 1;
            self.packets.drain(..drain_count);
        }

        let insert_pos = self.packets.iter().position(|p| p.sequence > sequence);
        match insert_pos {
            Some(pos) => {
                if pos > 0 && self.packets[pos - 1].sequence == sequence {
                    return;
                }
                self.packets.insert(pos, packet);
            }
            None => {
                if self.packets.back().is_none_or(|p| p.sequence != sequence) {
                    self.packets.push_back(packet);
                }
            }
        }
    }

    fn update_jitter_estimate(&mut self) {
        if self.arrival_intervals.len() < 5 {
            return;
        }

        let mean: f32 =
            self.arrival_intervals.iter().sum::<f32>() / self.arrival_intervals.len() as f32;
        let variance: f32 = self
            .arrival_intervals
            .iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f32>()
            / self.arrival_intervals.len() as f32;
        let new_jitter = variance.sqrt();

        // Faster adaptation to network changes
        self.jitter_estimate = self.jitter_estimate * (1.0 - JITTER_BUFFER_ADAPTATION_RATE)
            + new_jitter * JITTER_BUFFER_ADAPTATION_RATE;

        // More aggressive jitter buffer adaptation
        let target_delay = (JITTER_BUFFER_MIN_MS as f32 + self.jitter_estimate * 1.8)
            .clamp(JITTER_BUFFER_MIN_MS as f32, JITTER_BUFFER_MAX_MS as f32);

        // Faster convergence to target delay
        self.current_delay_ms = self.current_delay_ms * (1.0 - JITTER_BUFFER_ADAPTATION_RATE * 2.0)
            + target_delay * (JITTER_BUFFER_ADAPTATION_RATE * 2.0);
        self.target_packets = (self.current_delay_ms / 10.0).ceil() as usize;
        self.target_packets = self
            .target_packets
            .clamp(self.min_packets, self.max_packets);
    }

    fn pop_if_ready(&mut self) -> Option<Vec<u8>> {
        if self.packets.is_empty() {
            return None;
        }

        if self.packets.len() >= self.min_packets {
            return self.packets.pop_front().map(|p| p.data);
        }

        None
    }

    fn clear(&mut self) {
        self.packets.clear();
        self.last_arrival_time = None;
        self.arrival_intervals.clear();
    }
}

fn linear_resample(input: &[f32], input_rate: u32, output_rate: u32) -> Vec<f32> {
    if input_rate == output_rate || input.is_empty() {
        return input.to_vec();
    }

    let ratio = output_rate as f64 / input_rate as f64;
    let output_len = ((input.len() as f64) * ratio).ceil() as usize;
    let mut output = Vec::with_capacity(output_len);

    // Use higher quality cubic interpolation for better audio quality
    for i in 0..output_len {
        let src_pos = i as f64 / ratio;
        let src_idx = src_pos.floor() as usize;
        let frac = (src_pos - src_idx as f64) as f32;

        // Get 4 samples for cubic interpolation
        let s_1 = input.get(src_idx.saturating_sub(1)).copied().unwrap_or(0.0);
        let s0 = input.get(src_idx).copied().unwrap_or(0.0);
        let s1 = input.get(src_idx + 1).copied().unwrap_or(s0);
        let s2 = input.get(src_idx + 2).copied().unwrap_or(s1);

        // Cubic interpolation for smoother resampling
        let sample = cubic_interpolate(s_1, s0, s1, s2, frac);
        output.push(sample);
    }

    output
}

fn cubic_interpolate(y0: f32, y1: f32, y2: f32, y3: f32, mu: f32) -> f32 {
    let mu2 = mu * mu;
    let a0 = y3 - y2 - y0 + y1;
    let a1 = y0 - y1 - a0;
    let a2 = y2 - y0;
    let a3 = y1;

    a0 * mu * mu2 + a1 * mu2 + a2 * mu + a3
}

pub fn start_audio_pipeline(
    audio_tx: Sender<Vec<u8>>,
    audio_rx: Receiver<Vec<u8>>,
    is_muted: Arc<std::sync::atomic::AtomicBool>,
    is_deafened: Arc<std::sync::atomic::AtomicBool>,
    ready_tx: Option<oneshot::Sender<()>>,
) -> Result<AudioPipelineHandle, String> {
    let settings = AudioSettings::load().unwrap_or_default();

    let (command_tx, command_rx) = crossbeam_channel::unbounded::<AudioCommand>();

    let input_volume = Arc::new(std::sync::atomic::AtomicU32::new(
        settings.input_volume.to_bits(),
    ));
    let output_volume = Arc::new(std::sync::atomic::AtomicU32::new(
        settings.output_volume.to_bits(),
    ));
    let noise_suppression_enabled = Arc::new(std::sync::atomic::AtomicBool::new(
        settings.noise_suppression_enabled,
    ));

    let input_device_name = settings.input_device.clone();
    let output_device_name = settings.output_device.clone();

    let input_volume_clone = input_volume.clone();
    let output_volume_clone = output_volume.clone();
    let noise_suppression_clone = noise_suppression_enabled.clone();

    std::thread::spawn(move || {
        run_audio_pipeline(
            audio_tx,
            audio_rx,
            is_muted,
            is_deafened,
            command_rx,
            input_device_name,
            output_device_name,
            input_volume_clone,
            output_volume_clone,
            noise_suppression_clone,
            ready_tx,
        );
    });

    Ok(AudioPipelineHandle { command_tx })
}

#[allow(clippy::too_many_arguments)]
fn run_audio_pipeline(
    audio_tx: Sender<Vec<u8>>,
    audio_rx: Receiver<Vec<u8>>,
    is_muted: Arc<std::sync::atomic::AtomicBool>,
    is_deafened: Arc<std::sync::atomic::AtomicBool>,
    command_rx: Receiver<AudioCommand>,
    initial_input_device: Option<String>,
    initial_output_device: Option<String>,
    input_volume: Arc<std::sync::atomic::AtomicU32>,
    output_volume: Arc<std::sync::atomic::AtomicU32>,
    noise_suppression_enabled: Arc<std::sync::atomic::AtomicBool>,
    ready_tx: Option<oneshot::Sender<()>>,
) {
    let encoder = match Encoder::new(SampleRate::Hz48000, Channels::Mono, Application::Voip) {
        Ok(mut e) => {
            let _ = e.set_bitrate(Bitrate::BitsPerSecond(OPUS_BITRATE));
            let _ = e.set_complexity(OPUS_COMPLEXITY);
            let _ = e.set_signal(Signal::Voice);
            let _ = e.set_bandwidth(Bandwidth::Fullband);
            if OPUS_ENABLE_FEC {
                let _ = e.set_inband_fec(true);
                let _ = e.set_packet_loss_perc(OPUS_PACKET_LOSS_PERC);
            }
            let _ = e.set_vbr(OPUS_USE_VBR);
            let _ = e.set_vbr_constraint(false);
            let _ = e.set_dtx(OPUS_USE_DTX);
            let _ = e.set_force_channels(Channels::Mono);

            Arc::new(std::sync::Mutex::new(e))
        }
        Err(e) => {
            eprintln!("Failed to create encoder: {:?}", e);
            return;
        }
    };

    let decoder = match Decoder::new(SampleRate::Hz48000, Channels::Mono) {
        Ok(d) => Arc::new(std::sync::Mutex::new(d)),
        Err(e) => {
            eprintln!("Failed to create decoder: {:?}", e);
            return;
        }
    };

    eprintln!(
        "[Audio] Encoder: bitrate={}kbps, complexity={}, bandwidth=fullband, FEC={}",
        OPUS_BITRATE / 1000,
        OPUS_COMPLEXITY,
        OPUS_ENABLE_FEC
    );
    eprintln!(
        "[Audio] Jitter buffer: min={}ms, target={}ms, max={}ms",
        JITTER_BUFFER_MIN_MS, JITTER_BUFFER_TARGET_MS, JITTER_BUFFER_MAX_MS
    );
    eprintln!("[Audio] Denoise frame size: {}", DENOISE_FRAME_SIZE);
    eprintln!(
        "[Audio] Noise suppression: {}",
        if noise_suppression_enabled.load(std::sync::atomic::Ordering::Relaxed) {
            "enabled"
        } else {
            "disabled"
        }
    );

    let input_buffer = Arc::new(std::sync::Mutex::new(Vec::<f32>::with_capacity(
        FRAME_SIZE * 4,
    )));
    let jitter_buffer = Arc::new(std::sync::Mutex::new(AdaptiveJitterBuffer::new()));
    let playback_buffer = Arc::new(std::sync::Mutex::new(VecDeque::<f32>::with_capacity(
        SAMPLE_RATE as usize / 5,
    )));

    let mut input_stream: Option<cpal::Stream> = None;
    let mut output_stream: Option<cpal::Stream> = None;

    if let Ok(stream) = create_input_stream(
        initial_input_device.as_deref(),
        audio_tx.clone(),
        is_muted.clone(),
        input_volume.clone(),
        input_buffer.clone(),
        encoder.clone(),
        noise_suppression_enabled.clone(),
    ) {
        input_stream = Some(stream);
    }

    let playback_buffer_decoder = playback_buffer.clone();
    let decoder_clone = decoder.clone();
    let jitter_buffer_decoder = jitter_buffer.clone();
    std::thread::spawn(move || {
        run_decoder_thread(
            audio_rx,
            decoder_clone,
            jitter_buffer_decoder,
            playback_buffer_decoder,
        );
    });

    if let Ok(stream) = create_output_stream(
        initial_output_device.as_deref(),
        is_deafened.clone(),
        output_volume.clone(),
        playback_buffer.clone(),
    ) {
        output_stream = Some(stream);
    }

    if let Some(tx) = ready_tx {
        let _ = tx.send(());
    }

    loop {
        match command_rx.recv_timeout(std::time::Duration::from_millis(50)) {
            Ok(AudioCommand::SwitchInputDevice(device_name)) => {
                eprintln!("[Audio] Switching input device to: {:?}", device_name);
                input_stream = None;
                if let Ok(mut buf) = input_buffer.lock() {
                    buf.clear();
                }
                if let Ok(stream) = create_input_stream(
                    device_name.as_deref(),
                    audio_tx.clone(),
                    is_muted.clone(),
                    input_volume.clone(),
                    input_buffer.clone(),
                    encoder.clone(),
                    noise_suppression_enabled.clone(),
                ) {
                    input_stream = Some(stream);
                }
            }
            Ok(AudioCommand::SwitchOutputDevice(device_name)) => {
                eprintln!("[Audio] Switching output device to: {:?}", device_name);
                output_stream = None;
                if let Ok(mut buf) = playback_buffer.lock() {
                    buf.clear();
                }
                if let Ok(mut jb) = jitter_buffer.lock() {
                    jb.clear();
                }
                if let Ok(stream) = create_output_stream(
                    device_name.as_deref(),
                    is_deafened.clone(),
                    output_volume.clone(),
                    playback_buffer.clone(),
                ) {
                    output_stream = Some(stream);
                }
            }
            Ok(AudioCommand::SetInputVolume(vol)) => {
                input_volume.store(vol.to_bits(), std::sync::atomic::Ordering::Relaxed);
            }
            Ok(AudioCommand::SetOutputVolume(vol)) => {
                output_volume.store(vol.to_bits(), std::sync::atomic::Ordering::Relaxed);
            }
            Ok(AudioCommand::SetNoiseSuppressionEnabled(enabled)) => {
                eprintln!(
                    "[Audio] Noise suppression: {}",
                    if enabled { "enabled" } else { "disabled" }
                );
                noise_suppression_enabled.store(enabled, std::sync::atomic::Ordering::Relaxed);
            }
            Ok(AudioCommand::Stop) => {
                eprintln!("[Audio] Stopping audio pipeline");
                break;
            }
            Err(crossbeam_channel::RecvTimeoutError::Timeout) => {}
            Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                break;
            }
        }
    }

    drop(input_stream);
    drop(output_stream);
}

fn run_decoder_thread(
    audio_rx: Receiver<Vec<u8>>,
    decoder: Arc<std::sync::Mutex<Decoder>>,
    jitter_buffer: Arc<std::sync::Mutex<AdaptiveJitterBuffer>>,
    playback_buffer: Arc<std::sync::Mutex<VecDeque<f32>>>,
) {
    let max_buffer_samples = (SAMPLE_RATE as usize / 1000) * JITTER_BUFFER_MAX_MS * 2;
    let mut sequence: u32 = 0;
    let mut consecutive_losses = 0u32;
    let mut last_process_time = std::time::Instant::now();

    loop {
        match audio_rx.recv_timeout(std::time::Duration::from_millis(5)) {
            Ok(opus_data) => {
                if let Ok(mut jb) = jitter_buffer.lock() {
                    jb.push(opus_data, sequence);
                    sequence = sequence.wrapping_add(1);
                }
                consecutive_losses = 0;
            }
            Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                consecutive_losses += 1;
            }
            Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                break;
            }
        }

        let now = std::time::Instant::now();
        if now.duration_since(last_process_time).as_millis() >= 8 {
            last_process_time = now;

            let packet_to_decode = if let Ok(mut jb) = jitter_buffer.lock() {
                jb.pop_if_ready()
            } else {
                None
            };

            if let Some(opus_data) = packet_to_decode {
                let mut output = [0i16; FRAME_SIZE];
                if let Ok(mut dec) = decoder.lock() {
                    if let Ok(packet) = Packet::try_from(&opus_data[..]) {
                        if let Ok(signals) = MutSignals::try_from(&mut output[..]) {
                            if dec.decode(Some(packet), signals, false).is_ok() {
                                let samples: Vec<f32> =
                                    output.iter().map(|&s| s as f32 / 32768.0).collect();
                                if let Ok(mut buf) = playback_buffer.lock() {
                                    if buf.len() > max_buffer_samples {
                                        let drain_amount =
                                            buf.len() - max_buffer_samples + FRAME_SIZE;
                                        buf.drain(..drain_amount);
                                    }
                                    buf.extend(samples);
                                }
                            }
                        }
                    }
                }
            } else if consecutive_losses > 0 && consecutive_losses <= 5 {
                let mut output = [0i16; FRAME_SIZE];
                if let Ok(mut dec) = decoder.lock() {
                    if let Ok(signals) = MutSignals::try_from(&mut output[..]) {
                        let none_packet: Option<Packet> = None;
                        if dec.decode(none_packet, signals, false).is_ok() {
                            let samples: Vec<f32> =
                                output.iter().map(|&s| s as f32 / 32768.0).collect();
                            if let Ok(mut buf) = playback_buffer.lock() {
                                buf.extend(samples);
                            }
                        }
                    }
                }
            }
        }
    }
}

fn create_input_stream(
    device_name: Option<&str>,
    audio_tx: Sender<Vec<u8>>,
    is_muted: Arc<std::sync::atomic::AtomicBool>,
    input_volume: Arc<std::sync::atomic::AtomicU32>,
    input_buffer: Arc<std::sync::Mutex<Vec<f32>>>,
    encoder: Arc<std::sync::Mutex<Encoder>>,
    noise_suppression_enabled: Arc<std::sync::atomic::AtomicBool>,
) -> Result<cpal::Stream, String> {
    let host = cpal::default_host();

    let input_device = if let Some(name) = device_name {
        host.input_devices()
            .map_err(|e| e.to_string())?
            .find(|d| d.name().ok().as_deref() == Some(name))
            .or_else(|| host.default_input_device())
            .ok_or("No input device available")?
    } else {
        host.default_input_device()
            .ok_or("No input device available")?
    };

    let device_name_actual = input_device.name().unwrap_or_default();
    eprintln!("[Audio] Using input device: {}", device_name_actual);

    let supported_input = input_device
        .default_input_config()
        .map_err(|e| format!("Failed to get input config: {}", e))?;

    let buffer_frames = (supported_input.sample_rate().0 / 100) as u32;
    let input_config = cpal::StreamConfig {
        channels: supported_input.channels(),
        sample_rate: supported_input.sample_rate(),
        buffer_size: cpal::BufferSize::Fixed(buffer_frames),
    };

    eprintln!(
        "[Audio] Input: {}Hz, {} ch, buffer={} frames ({}ms)",
        supported_input.sample_rate().0,
        supported_input.channels(),
        buffer_frames,
        buffer_frames as f32 / supported_input.sample_rate().0 as f32 * 1000.0
    );

    let input_sample_rate = supported_input.sample_rate().0;
    let input_channels = supported_input.channels() as usize;

    let denoise_state = Arc::new(std::sync::Mutex::new(DenoiseState::new()));
    let denoise_buffer = Arc::new(std::sync::Mutex::new(Vec::<f32>::with_capacity(
        DENOISE_FRAME_SIZE * 2,
    )));

    let input_stream = input_device
        .build_input_stream(
            &input_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if is_muted.load(std::sync::atomic::Ordering::Relaxed) {
                    return;
                }

                let volume =
                    f32::from_bits(input_volume.load(std::sync::atomic::Ordering::Relaxed));
                let ns_enabled =
                    noise_suppression_enabled.load(std::sync::atomic::Ordering::Relaxed);

                let mono_samples: Vec<f32> = if input_channels > 1 {
                    data.chunks(input_channels)
                        .map(|chunk| (chunk.iter().sum::<f32>() / input_channels as f32) * volume)
                        .collect()
                } else {
                    data.iter().map(|&s| s * volume).collect()
                };

                let resampled = linear_resample(&mono_samples, input_sample_rate, SAMPLE_RATE);

                if resampled.is_empty() {
                    return;
                }

                let processed = if ns_enabled {
                    let mut output_samples = Vec::with_capacity(resampled.len());

                    if let (Ok(mut dns), Ok(mut dns_buf)) =
                        (denoise_state.lock(), denoise_buffer.lock())
                    {
                        dns_buf.extend_from_slice(&resampled);

                        while dns_buf.len() >= DENOISE_FRAME_SIZE {
                            let frame: Vec<f32> = dns_buf.drain(..DENOISE_FRAME_SIZE).collect();

                            let frame_i16_range: Vec<f32> =
                                frame.iter().map(|&s| s * 32767.0).collect();

                            let mut output_frame = vec![0.0f32; DENOISE_FRAME_SIZE];
                            dns.process_frame(&mut output_frame, &frame_i16_range);

                            let output_normalized: Vec<f32> =
                                output_frame.iter().map(|&s| s / 32767.0).collect();

                            output_samples.extend_from_slice(&output_normalized);
                        }
                    }

                    if output_samples.is_empty() {
                        return;
                    }
                    output_samples
                } else {
                    resampled
                };

                if let Ok(mut buf) = input_buffer.lock() {
                    buf.extend_from_slice(&processed);

                    while buf.len() >= FRAME_SIZE {
                        let frame: Vec<f32> = buf.drain(..FRAME_SIZE).collect();
                        let frame_i16: Vec<i16> = frame
                            .iter()
                            .map(|&s| (s * 32767.0).clamp(-32768.0, 32767.0) as i16)
                            .collect();

                        let mut output = [0u8; MAX_OPUS_FRAME_SIZE];
                        if let Ok(enc) = encoder.lock() {
                            if let Ok(result) = enc.encode(&frame_i16, &mut output) {
                                let encoded = output[..result].to_vec();
                                let _ = audio_tx.send(encoded);
                            }
                        }
                    }
                }
            },
            |err| {
                eprintln!("[Audio] Input stream error: {:?}", err);
            },
            None,
        )
        .map_err(|e| format!("Failed to build input stream: {}", e))?;

    input_stream
        .play()
        .map_err(|e| format!("Failed to start input: {}", e))?;

    Ok(input_stream)
}

fn create_output_stream(
    device_name: Option<&str>,
    is_deafened: Arc<std::sync::atomic::AtomicBool>,
    output_volume: Arc<std::sync::atomic::AtomicU32>,
    playback_buffer: Arc<std::sync::Mutex<VecDeque<f32>>>,
) -> Result<cpal::Stream, String> {
    let host = cpal::default_host();

    let output_device = if let Some(name) = device_name {
        host.output_devices()
            .map_err(|e| e.to_string())?
            .find(|d| d.name().ok().as_deref() == Some(name))
            .or_else(|| host.default_output_device())
            .ok_or("No output device available")?
    } else {
        host.default_output_device()
            .ok_or("No output device available")?
    };

    let device_name_actual = output_device.name().unwrap_or_default();
    eprintln!("[Audio] Using output device: {}", device_name_actual);

    let supported_output = output_device
        .default_output_config()
        .map_err(|e| format!("Failed to get output config: {}", e))?;

    let output_sample_rate = supported_output.sample_rate().0;
    let output_buffer_frames = (output_sample_rate / 100) as u32;
    let output_config = cpal::StreamConfig {
        channels: supported_output.channels(),
        sample_rate: supported_output.sample_rate(),
        buffer_size: cpal::BufferSize::Fixed(output_buffer_frames),
    };

    let output_channels = supported_output.channels() as usize;

    let resample_buffer = Arc::new(std::sync::Mutex::new(VecDeque::<f32>::with_capacity(4096)));

    eprintln!(
        "[Audio] Output: {}Hz, {} ch, buffer={} frames ({}ms)",
        output_sample_rate,
        output_channels,
        output_buffer_frames,
        output_buffer_frames as f32 / output_sample_rate as f32 * 1000.0
    );

    let output_stream = output_device
        .build_output_stream(
            &output_config,
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                if is_deafened.load(std::sync::atomic::Ordering::Relaxed) {
                    data.fill(0.0);
                    return;
                }

                let volume =
                    f32::from_bits(output_volume.load(std::sync::atomic::Ordering::Relaxed));
                let frames_needed = data.len() / output_channels;

                if let Ok(mut rb) = resample_buffer.lock() {
                    while rb.len() < frames_needed {
                        if let Ok(mut src_buf) = playback_buffer.lock() {
                            if src_buf.is_empty() {
                                break;
                            }
                            let available = src_buf.len().min(FRAME_SIZE * 2);
                            let chunk: Vec<f32> = src_buf.drain(..available).collect();
                            drop(src_buf);

                            let resampled =
                                linear_resample(&chunk, SAMPLE_RATE, output_sample_rate);
                            rb.extend(resampled);
                        } else {
                            break;
                        }
                    }

                    for i in 0..frames_needed {
                        let sample = rb.pop_front().unwrap_or(0.0) * volume;
                        for c in 0..output_channels {
                            data[i * output_channels + c] = sample;
                        }
                    }
                } else {
                    data.fill(0.0);
                }
            },
            |err| {
                eprintln!("[Audio] Output stream error: {:?}", err);
            },
            None,
        )
        .map_err(|e| format!("Failed to build output stream: {}", e))?;

    output_stream
        .play()
        .map_err(|e| format!("Failed to start output: {}", e))?;

    Ok(output_stream)
}

pub fn get_audio_devices() -> Result<AudioDevices, String> {
    let host = cpal::default_host();

    let default_input_name = host.default_input_device().and_then(|d| d.name().ok());

    let default_output_name = host.default_output_device().and_then(|d| d.name().ok());

    let input_devices: Vec<AudioDeviceInfo> = host
        .input_devices()
        .map_err(|e| e.to_string())?
        .filter_map(|d| {
            let name = d.name().ok()?;
            Some(AudioDeviceInfo {
                id: name.clone(),
                is_default: Some(&name) == default_input_name.as_ref(),
                name,
            })
        })
        .collect();

    let output_devices: Vec<AudioDeviceInfo> = host
        .output_devices()
        .map_err(|e| e.to_string())?
        .filter_map(|d| {
            let name = d.name().ok()?;
            Some(AudioDeviceInfo {
                id: name.clone(),
                is_default: Some(&name) == default_output_name.as_ref(),
                name,
            })
        })
        .collect();

    Ok(AudioDevices {
        input: input_devices,
        output: output_devices,
    })
}
