use dashmap::DashMap;
use std::collections::VecDeque;
use uuid::Uuid;

const FRAME_SIZE: usize = 480;
const MAX_BUFFER_FRAMES: usize = 15;
const MIN_BUFFER_FRAMES: usize = 6;
const TARGET_BUFFER_FRAMES: usize = 8;
const MAX_PARTICIPANTS: usize = 10;

#[allow(dead_code)]
struct ParticipantBuffer {
    samples: VecDeque<f32>,
    sequence: u32,
    gain: f32,
}

impl ParticipantBuffer {
    fn new() -> Self {
        Self {
            samples: VecDeque::with_capacity(FRAME_SIZE * MAX_BUFFER_FRAMES * 2),
            sequence: 0,
            gain: 1.0,
        }
    }

    fn push_samples(&mut self, samples: &[f32], sequence: u32) {
        if sequence <= self.sequence && self.sequence > 0 {
            return;
        }

        self.sequence = sequence;

        for sample in samples {
            if self.samples.len() >= FRAME_SIZE * MAX_BUFFER_FRAMES {
                self.samples.pop_front();
            }
            self.samples.push_back(*sample);
        }
    }

    fn get_samples(&mut self, count: usize) -> Vec<f32> {
        let available = self.samples.len().min(count);
        let mut result = Vec::with_capacity(count);

        for _ in 0..available {
            if let Some(sample) = self.samples.pop_front() {
                result.push(sample * self.gain);
            }
        }

        if result.len() < count && !result.is_empty() {
            let last_sample = *result.last().unwrap();
            let fade_steps = count - result.len();
            for i in 0..fade_steps {
                let fade = 1.0 - (i as f32 / fade_steps as f32);
                result.push(last_sample * fade * 0.7);
            }
        } else {
            while result.len() < count {
                result.push(0.0);
            }
        }

        result
    }

    fn available_samples(&self) -> usize {
        self.samples.len()
    }
}

pub struct AudioMixer {
    participant_buffers: DashMap<Uuid, ParticipantBuffer>,
    initial_buffer_done: std::sync::atomic::AtomicBool,
}

impl AudioMixer {
    pub fn new() -> Self {
        Self {
            participant_buffers: DashMap::new(),
            initial_buffer_done: std::sync::atomic::AtomicBool::new(false),
        }
    }

    pub fn add_audio(&self, participant_id: Uuid, samples: Vec<f32>, sequence: u32) {
        if self.participant_buffers.len() >= MAX_PARTICIPANTS
            && !self.participant_buffers.contains_key(&participant_id)
        {
            return;
        }

        let mut buffer = self
            .participant_buffers
            .entry(participant_id)
            .or_insert_with(ParticipantBuffer::new);

        buffer.push_samples(&samples, sequence);
    }

    pub fn get_mixed_output(&self, frame_size: usize) -> Vec<f32> {
        let participant_count = self.participant_buffers.len();

        if participant_count == 0 {
            return vec![0.0; frame_size];
        }

        let mut mixed = vec![0.0f32; frame_size];
        let mut active_count = 0;

        for mut entry in self.participant_buffers.iter_mut() {
            let buffer = entry.value_mut();

            if buffer.available_samples() < frame_size / 4 {
                continue;
            }

            let samples = buffer.get_samples(frame_size);
            active_count += 1;

            for (i, sample) in samples.iter().enumerate() {
                mixed[i] += sample;
            }
        }

        if active_count > 1 {
            let normalization = 0.98 / (1.0 + (active_count as f32 - 1.0) * 0.05);
            for sample in mixed.iter_mut() {
                *sample *= normalization;
            }
        }

        soft_clip(&mut mixed);

        mixed
    }

    pub fn remove_participant(&self, participant_id: Uuid) {
        self.participant_buffers.remove(&participant_id);
    }

    pub fn clear(&self) {
        self.participant_buffers.clear();
        self.initial_buffer_done
            .store(false, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn is_ready(&self) -> bool {
        use std::sync::atomic::Ordering;

        if self.initial_buffer_done.load(Ordering::Relaxed) {
            self.participant_buffers
                .iter()
                .any(|entry| entry.value().available_samples() >= MIN_BUFFER_FRAMES * FRAME_SIZE)
        } else {
            let has_enough = self.participant_buffers.iter().any(|entry| {
                entry.value().available_samples() >= TARGET_BUFFER_FRAMES * FRAME_SIZE
            });
            if has_enough {
                self.initial_buffer_done.store(true, Ordering::Relaxed);
            }
            has_enough
        }
    }
}

impl Default for AudioMixer {
    fn default() -> Self {
        Self::new()
    }
}

fn soft_clip(samples: &mut [f32]) {
    const THRESHOLD: f32 = 0.92;
    for sample in samples.iter_mut() {
        let abs_sample = sample.abs();
        if abs_sample > THRESHOLD {
            let sign = sample.signum();
            let excess = abs_sample - THRESHOLD;
            let compressed = THRESHOLD + (1.0 - THRESHOLD) * (excess / (excess + 0.2));
            *sample = sign * compressed.min(1.0);
        }
    }
}
