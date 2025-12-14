import { get, put } from "./client";

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

export async function getAudioSettings(): Promise<AudioSettings> {
  return get<AudioSettings>("/audio-settings");
}

export async function updateAudioSettings(data: UpdateAudioSettingsRequest): Promise<AudioSettings> {
  return put<AudioSettings>("/audio-settings", data);
}
