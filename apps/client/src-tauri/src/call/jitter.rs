use std::collections::VecDeque;
use std::time::{Duration, Instant};

#[allow(dead_code)]
pub struct AudioJitterBuffer {
    buffer: VecDeque<TimestampedPacket>,
    min_packets: usize,
    max_packets: usize,
    last_output_time: Option<Instant>,
    target_interval: Duration,
    adaptive_delay: Duration,
}

#[allow(dead_code)]
struct TimestampedPacket {
    data: Vec<u8>,
    received_at: Instant,
    sequence: u32,
}

impl AudioJitterBuffer {
    #[allow(dead_code)]
    pub fn new(min_packets: usize, max_packets: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(max_packets),
            min_packets,
            max_packets,
            last_output_time: None,
            target_interval: Duration::from_millis(20),
            adaptive_delay: Duration::from_millis(40),
        }
    }

    #[allow(dead_code)]
    pub fn push(&mut self, data: Vec<u8>, sequence: u32) {
        let packet = TimestampedPacket {
            data,
            received_at: Instant::now(),
            sequence,
        };

        if self.buffer.len() >= self.max_packets {
            self.buffer.pop_front();
        }

        let insert_pos = self.buffer.iter().position(|p| p.sequence > sequence);
        match insert_pos {
            Some(pos) => self.buffer.insert(pos, packet),
            None => self.buffer.push_back(packet),
        }

        self.update_adaptive_delay();
    }

    #[allow(dead_code)]
    pub fn pop(&mut self) -> Option<Vec<u8>> {
        if self.buffer.len() < self.min_packets {
            return None;
        }

        let now = Instant::now();

        if let Some(last_time) = self.last_output_time {
            if now.duration_since(last_time) < self.target_interval {
                return None;
            }
        }

        self.last_output_time = Some(now);
        self.buffer.pop_front().map(|p| p.data)
    }

    #[allow(dead_code)]
    pub fn pop_immediate(&mut self) -> Option<Vec<u8>> {
        self.buffer.pop_front().map(|p| p.data)
    }

    fn update_adaptive_delay(&mut self) {
        if self.buffer.len() < 2 {
            return;
        }

        let mut intervals: Vec<Duration> = Vec::new();
        let packets: Vec<_> = self.buffer.iter().collect();

        for i in 1..packets.len() {
            let interval = packets[i]
                .received_at
                .duration_since(packets[i - 1].received_at);
            intervals.push(interval);
        }

        if intervals.is_empty() {
            return;
        }

        let mean: Duration = intervals.iter().sum::<Duration>() / intervals.len() as u32;

        let variance: f64 = intervals
            .iter()
            .map(|d| {
                let diff = d.as_secs_f64() - mean.as_secs_f64();
                diff * diff
            })
            .sum::<f64>()
            / intervals.len() as f64;

        let jitter_ms = (variance.sqrt() * 1000.0) as u64;

        let target_buffer_ms = 20 + (jitter_ms * 2).min(100);
        self.adaptive_delay = Duration::from_millis(target_buffer_ms);

        self.min_packets = ((target_buffer_ms / 20) as usize).clamp(2, 5);
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    #[allow(dead_code)]
    pub fn clear(&mut self) {
        self.buffer.clear();
        self.last_output_time = None;
    }

    #[allow(dead_code)]
    pub fn current_delay_ms(&self) -> u64 {
        self.adaptive_delay.as_millis() as u64
    }
}

#[allow(dead_code)]
pub struct VideoJitterBuffer {
    frames: VecDeque<VideoFrameEntry>,
    max_frames: usize,
    last_displayed_pts: Option<u64>,
    playback_start: Option<Instant>,
    base_pts: Option<u64>,
}

#[allow(dead_code)]
struct VideoFrameEntry {
    data: Vec<u8>,
    pts: u64,
    is_keyframe: bool,
    received_at: Instant,
}

impl VideoJitterBuffer {
    #[allow(dead_code)]
    pub fn new(max_frames: usize) -> Self {
        Self {
            frames: VecDeque::with_capacity(max_frames),
            max_frames,
            last_displayed_pts: None,
            playback_start: None,
            base_pts: None,
        }
    }

    #[allow(dead_code)]
    pub fn push(&mut self, data: Vec<u8>, pts: u64, is_keyframe: bool) {
        if is_keyframe {
            self.frames.clear();
            self.playback_start = Some(Instant::now());
            self.base_pts = Some(pts);
            self.last_displayed_pts = None;
        }

        if self.frames.len() >= self.max_frames {
            if let Some(oldest) = self.frames.front() {
                if !oldest.is_keyframe {
                    self.frames.pop_front();
                }
            }
        }

        let entry = VideoFrameEntry {
            data,
            pts,
            is_keyframe,
            received_at: Instant::now(),
        };

        let insert_pos = self.frames.iter().position(|f| f.pts > pts);
        match insert_pos {
            Some(pos) => self.frames.insert(pos, entry),
            None => self.frames.push_back(entry),
        }
    }

    #[allow(dead_code)]
    pub fn pop_ready(&mut self) -> Option<Vec<u8>> {
        let playback_start = self.playback_start?;
        let base_pts = self.base_pts?;

        let elapsed_ms = playback_start.elapsed().as_millis() as u64;

        if let Some(frame) = self.frames.front() {
            let frame_time = frame.pts.saturating_sub(base_pts);

            if frame_time <= elapsed_ms + 16 {
                let frame = self.frames.pop_front().unwrap();
                self.last_displayed_pts = Some(frame.pts);
                return Some(frame.data);
            }
        }

        None
    }

    #[allow(dead_code)]
    pub fn pop_immediate(&mut self) -> Option<Vec<u8>> {
        self.frames.pop_front().map(|f| {
            self.last_displayed_pts = Some(f.pts);
            f.data
        })
    }

    #[allow(dead_code)]
    pub fn skip_to_keyframe(&mut self) -> Option<Vec<u8>> {
        while let Some(frame) = self.frames.pop_front() {
            if frame.is_keyframe {
                self.last_displayed_pts = Some(frame.pts);
                self.playback_start = Some(Instant::now());
                self.base_pts = Some(frame.pts);
                return Some(frame.data);
            }
        }
        None
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.frames.len()
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.frames.is_empty()
    }

    #[allow(dead_code)]
    pub fn clear(&mut self) {
        self.frames.clear();
        self.last_displayed_pts = None;
        self.playback_start = None;
        self.base_pts = None;
    }

    #[allow(dead_code)]
    pub fn has_keyframe(&self) -> bool {
        self.frames.iter().any(|f| f.is_keyframe)
    }

    #[allow(dead_code)]
    pub fn buffered_duration_ms(&self) -> u64 {
        if self.frames.len() < 2 {
            return 0;
        }

        let first_pts = self.frames.front().map(|f| f.pts).unwrap_or(0);
        let last_pts = self.frames.back().map(|f| f.pts).unwrap_or(0);

        last_pts.saturating_sub(first_pts)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_jitter_buffer_ordering() {
        let mut buffer = AudioJitterBuffer::new(2, 10);

        buffer.push(vec![3], 3);
        buffer.push(vec![1], 1);
        buffer.push(vec![2], 2);

        assert_eq!(buffer.pop_immediate(), Some(vec![1]));
        assert_eq!(buffer.pop_immediate(), Some(vec![2]));
        assert_eq!(buffer.pop_immediate(), Some(vec![3]));
    }

    #[test]
    fn test_video_jitter_buffer_keyframe_reset() {
        let mut buffer = VideoJitterBuffer::new(10);

        buffer.push(vec![1], 100, false);
        buffer.push(vec![2], 200, false);
        buffer.push(vec![3], 300, true);

        assert_eq!(buffer.len(), 1);
    }
}
