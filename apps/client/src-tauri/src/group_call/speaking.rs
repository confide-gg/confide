use dashmap::DashMap;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicI32, AtomicU32, Ordering};
use std::time::Instant;
use uuid::Uuid;

const DEFAULT_THRESHOLD_DB: i32 = -50;
const DEFAULT_HOLD_TIME_MS: u32 = 200;
const RMS_WINDOW_SIZE: usize = 5;
const MIN_AUDIO_LEVEL: f32 = 0.0;
const MAX_AUDIO_LEVEL: f32 = 1.0;

struct SpeakingState {
    is_speaking: bool,
    audio_level: f32,
    last_voice_at: Option<Instant>,
    rms_window: VecDeque<f32>,
}

impl Default for SpeakingState {
    fn default() -> Self {
        Self {
            is_speaking: false,
            audio_level: 0.0,
            last_voice_at: None,
            rms_window: VecDeque::with_capacity(RMS_WINDOW_SIZE),
        }
    }
}

pub struct SpeakingDetector {
    threshold_db: AtomicI32,
    hold_time_ms: AtomicU32,
    states: DashMap<Uuid, SpeakingState>,
}

impl SpeakingDetector {
    pub fn new() -> Self {
        Self {
            threshold_db: AtomicI32::new(DEFAULT_THRESHOLD_DB),
            hold_time_ms: AtomicU32::new(DEFAULT_HOLD_TIME_MS),
            states: DashMap::new(),
        }
    }

    pub fn process_audio(&self, participant_id: Uuid, samples: &[f32]) -> (bool, f32) {
        if samples.is_empty() {
            return (false, 0.0);
        }

        let rms = calculate_rms(samples);
        let threshold = self.threshold_db.load(Ordering::Relaxed);
        let hold_time = self.hold_time_ms.load(Ordering::Relaxed);
        let now = Instant::now();

        let mut state = self.states.entry(participant_id).or_default();

        state.rms_window.push_back(rms);
        if state.rms_window.len() > RMS_WINDOW_SIZE {
            state.rms_window.pop_front();
        }

        let smoothed_rms: f32 =
            state.rms_window.iter().sum::<f32>() / state.rms_window.len() as f32;
        let smoothed_db = rms_to_db(smoothed_rms);
        let smoothed_level = normalize_audio_level(smoothed_rms);

        let voice_detected = smoothed_db > threshold as f32;

        if voice_detected {
            state.last_voice_at = Some(now);
            state.is_speaking = true;
        } else if let Some(last_voice) = state.last_voice_at {
            let elapsed_ms = now.duration_since(last_voice).as_millis() as u32;
            if elapsed_ms > hold_time {
                state.is_speaking = false;
            }
        }

        state.audio_level = smoothed_level;

        (state.is_speaking, smoothed_level)
    }

    pub fn get_all_states(&self) -> Vec<(Uuid, bool, f32)> {
        let now = Instant::now();
        let hold_time = self.hold_time_ms.load(Ordering::Relaxed);

        self.states
            .iter()
            .map(|entry| {
                let participant_id = *entry.key();
                let state = entry.value();

                let is_speaking = if let Some(last_voice) = state.last_voice_at {
                    let elapsed_ms = now.duration_since(last_voice).as_millis() as u32;
                    elapsed_ms <= hold_time && state.is_speaking
                } else {
                    false
                };

                (participant_id, is_speaking, state.audio_level)
            })
            .collect()
    }

    pub fn remove_participant(&self, participant_id: Uuid) {
        self.states.remove(&participant_id);
    }

    pub fn clear(&self) {
        self.states.clear();
    }
}

impl Default for SpeakingDetector {
    fn default() -> Self {
        Self::new()
    }
}

fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
    (sum_squares / samples.len() as f32).sqrt()
}

fn rms_to_db(rms: f32) -> f32 {
    if rms <= 0.0 {
        return -100.0;
    }
    20.0 * rms.log10()
}

fn normalize_audio_level(rms: f32) -> f32 {
    let db = rms_to_db(rms);
    let normalized = (db + 60.0) / 60.0;
    normalized.clamp(MIN_AUDIO_LEVEL, MAX_AUDIO_LEVEL)
}
