use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSettings {
    pub input_device: Option<String>,
    pub output_device: Option<String>,
    pub input_volume: f32,
    pub output_volume: f32,
    pub input_sensitivity: f32,
    pub voice_activity_enabled: bool,
    pub push_to_talk_enabled: bool,
    pub push_to_talk_key: Option<String>,
    #[serde(default = "default_noise_suppression")]
    pub noise_suppression_enabled: bool,
}

fn default_noise_suppression() -> bool {
    true
}

impl Default for AudioSettings {
    fn default() -> Self {
        Self {
            input_device: None,
            output_device: None,
            input_volume: 1.0,
            output_volume: 1.0,
            input_sensitivity: 0.3,
            voice_activity_enabled: false,
            push_to_talk_enabled: false,
            push_to_talk_key: None,
            noise_suppression_enabled: true,
        }
    }
}

impl AudioSettings {
    fn get_settings_path() -> Result<PathBuf, std::io::Error> {
        let app_data = dirs::data_dir().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Could not find app data directory",
            )
        })?;

        let confide_dir = app_data.join("Confide");
        if !confide_dir.exists() {
            fs::create_dir_all(&confide_dir)?;
        }

        Ok(confide_dir.join("audio_settings.json"))
    }

    pub fn load() -> Result<Self, std::io::Error> {
        let path = Self::get_settings_path()?;

        if !path.exists() {
            return Ok(Self::default());
        }

        let contents = fs::read_to_string(path)?;
        let settings: AudioSettings = serde_json::from_str(&contents)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

        Ok(settings)
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        let path = Self::get_settings_path()?;
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

        fs::write(path, json)?;
        Ok(())
    }
}
