import { httpClient } from "../../core/network/HttpClient";

export interface AudioSettings {
  user_id: string;
  input_volume: number;
  output_volume: number;
  input_sensitivity: number;
  voice_activity_enabled: boolean;
  push_to_talk_enabled: boolean;
  push_to_talk_key: string | null;
  noise_suppression_enabled: boolean;
  updated_at: string;
}

export interface UpdateAudioSettingsRequest {
  input_volume?: number;
  output_volume?: number;
  input_sensitivity?: number;
  voice_activity_enabled?: boolean;
  push_to_talk_enabled?: boolean;
  push_to_talk_key?: string | null;
  noise_suppression_enabled?: boolean;
}

class AudioSettingsService {
  public async getAudioSettings(): Promise<AudioSettings> {
    return httpClient.get<AudioSettings>("/audio-settings");
  }

  public async updateAudioSettings(data: UpdateAudioSettingsRequest): Promise<AudioSettings> {
    return httpClient.put<AudioSettings>("/audio-settings", data);
  }
}

export const audioSettingsService = new AudioSettingsService();
