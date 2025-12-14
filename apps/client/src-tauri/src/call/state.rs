use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CallQualityStats {
    pub packets_sent: u32,
    pub packets_received: u32,
    pub packets_lost: u32,
    pub jitter_ms: f32,
    pub round_trip_time_ms: f32,
    pub audio_level: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AudioQualityMetrics {
    pub packet_loss_rate: f32,
    pub jitter_ms: f32,
    pub rtt_ms: f32,
    pub bitrate_kbps: f32,
    pub mos_score: f32, // Mean Opinion Score (1-5)
    pub consecutive_packet_loss: u32,
    pub max_jitter_ms: f32,
    pub audio_quality_category: String,
}

impl Default for AudioQualityMetrics {
    fn default() -> Self {
        Self {
            packet_loss_rate: 0.0,
            jitter_ms: 0.0,
            rtt_ms: 0.0,
            bitrate_kbps: 0.0,
            mos_score: 4.5,
            consecutive_packet_loss: 0,
            max_jitter_ms: 0.0,
            audio_quality_category: "excellent".to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum CallQuality {
    Excellent,
    Good,
    Fair,
    Poor,
}

impl CallQuality {
    #[allow(dead_code)]
    pub fn from_stats(stats: &CallQualityStats) -> Self {
        let loss_rate = if stats.packets_sent > 0 {
            stats.packets_lost as f32 / stats.packets_sent as f32
        } else {
            0.0
        };

        if loss_rate < 0.01 && stats.jitter_ms < 20.0 && stats.round_trip_time_ms < 100.0 {
            CallQuality::Excellent
        } else if loss_rate < 0.03 && stats.jitter_ms < 50.0 && stats.round_trip_time_ms < 200.0 {
            CallQuality::Good
        } else if loss_rate < 0.08 && stats.jitter_ms < 100.0 && stats.round_trip_time_ms < 400.0 {
            CallQuality::Fair
        } else {
            CallQuality::Poor
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevices {
    pub input: Vec<AudioDeviceInfo>,
    pub output: Vec<AudioDeviceInfo>,
}
