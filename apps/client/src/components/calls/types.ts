export type CallStatus =
  | "idle"
  | "initiating"
  | "ringing"
  | "connecting"
  | "active"
  | "left"
  | "ended";

export type CallQuality = "excellent" | "good" | "fair" | "poor";

export type ConnectionHealth = "good" | "degraded" | "disconnected";

export interface CallState {
  call_id: string | null;
  peer_id: string | null;
  peer_username: string | null;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  status: CallStatus;
  is_caller: boolean;
  is_muted: boolean;
  is_deafened: boolean;
  peer_is_muted: boolean;
  started_at: string | null;
  connected_at: string | null;
  is_screen_sharing: boolean;
  peer_is_screen_sharing: boolean;
  screen_share_source: string | null;
  connection_health: ConnectionHealth;
  last_audio_received_at: string | null;
  relay_token_expires_at: string | null;
  relay_token_expires_soon: boolean;
  left_at: string | null;
  can_rejoin: boolean;
  rejoin_time_remaining_seconds: number | null;
}

export interface IncomingCallInfo {
  call_id: string;
  caller_id: string;
  callee_id: string;
  caller_username: string;
  caller_display_name: string | null;
  caller_avatar_url: string | null;
  caller_identity_key: number[];
  ephemeral_kem_public: number[];
  signature: number[];
  created_at: string;
}

export interface CallOfferResult {
  call_id: string;
  ephemeral_kem_public: number[];
  signature: number[];
}

export interface CallAnswerResult {
  ephemeral_kem_public: number[];
  kem_ciphertext: number[];
  signature: number[];
}

export interface KeyCompleteResult {
  kem_ciphertext: number[];
}

export interface CallQualityStats {
  packets_sent: number;
  packets_received: number;
  packets_lost: number;
  jitter_ms: number;
  round_trip_time_ms: number;
  audio_level: number;
}

export interface AudioDeviceInfo {
  id: string;
  name: string;
  is_default: boolean;
}

export interface AudioDevices {
  input: AudioDeviceInfo[];
  output: AudioDeviceInfo[];
}

export interface AudioSettings {
  input_device: string | null;
  output_device: string | null;
  input_volume: number;
  output_volume: number;
  input_sensitivity: number;
  voice_activity_enabled: boolean;
  push_to_talk_enabled: boolean;
  push_to_talk_key: string | null;
  noise_suppression_enabled: boolean;
}

export type ScreenSourceType = "screen" | "window";

export interface ScreenCaptureSource {
  id: string;
  name: string;
  source_type: ScreenSourceType;
  width: number;
  height: number;
  thumbnail: number[] | null;
}

export interface ScreenShareStartData {
  call_id: string;
  user_id: string;
  width: number;
  height: number;
}

export interface ScreenShareStopData {
  call_id: string;
  user_id: string;
}
