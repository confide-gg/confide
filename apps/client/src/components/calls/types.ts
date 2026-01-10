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

export type CallType = "direct" | "group";

export type ParticipantStatus =
  | "invited"
  | "ringing"
  | "connecting"
  | "active"
  | "left"
  | "declined";

export interface GroupCallParticipant {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: ParticipantStatus;
  is_muted: boolean;
  is_speaking: boolean;
  audio_level: number;
  joined_at: string | null;
}

export interface GroupCallState {
  call_type: "group";
  call_id: string;
  conversation_id: string;
  initiator_id: string;
  status: CallStatus;
  participants: GroupCallParticipant[];
  is_muted: boolean;
  is_deafened: boolean;
  started_at: string | null;
  connected_at: string | null;
  connection_health: ConnectionHealth;
  our_identity_public?: number[];
  left_at: string | null;
  can_rejoin: boolean;
  rejoin_expires_at: string | null;
  announcement?: number[];
}

export interface IncomingGroupCallInfo {
  call_id: string;
  conversation_id: string;
  initiator_id: string;
  initiator_username: string;
  initiator_display_name: string | null;
  initiator_avatar_url: string | null;
  participant_count: number;
  encrypted_group_metadata: number[] | null;
  announcement: number[];
  signature: number[];
  created_at: string;
}

export interface GroupCallResponse {
  id: string;
  conversation_id: string;
  initiator_id: string;
  status: string;
  participants: GroupCallParticipantInfo[];
  created_at: string;
  ring_started_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
}

export interface GroupCallParticipantInfo {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: ParticipantStatus;
  is_muted: boolean;
  joined_at: string | null;
}

export interface ActiveGroupCallResponse {
  call_id: string;
  conversation_id: string;
  initiator_id: string;
  status: string;
  participant_count: number;
  created_at: string;
}

export interface GroupCallRingData {
  call_id: string;
  conversation_id: string;
  initiator_id: string;
  initiator_username: string;
  initiator_display_name: string | null;
  initiator_avatar_url: string | null;
  participant_count: number;
  encrypted_group_metadata: number[] | null;
  announcement: number[];
  signature: number[];
  created_at: string;
}

export interface GroupCallParticipantJoinedData {
  call_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  encrypted_sender_key: number[];
  joined_at: string;
}

export interface GroupCallParticipantLeftData {
  call_id: string;
  user_id: string;
  left_at: string;
}

export interface GroupCallEndedData {
  call_id: string;
  conversation_id: string;
  reason: string;
}

export interface GroupCallMuteUpdateData {
  call_id: string;
  user_id: string;
  is_muted: boolean;
}

export interface GroupCallSpeakingUpdateData {
  call_id: string;
  user_id: string;
  is_speaking: boolean;
  audio_level: number;
}

export interface CreateGroupCallApiRequest {
  call_id: string;
  conversation_id: string;
  announcement: number[];
  signature: number[];
}

export interface JoinGroupCallApiRequest {
  encrypted_sender_key_bundle: number[];
  signature: number[];
  joiner_ephemeral_public: number[];
  identity_public: number[];
}

export interface CreateGroupCallTauriResult {
  call_id: string;
  announcement: number[];
  signature: number[];
}

export interface JoinGroupCallTauriResult {
  encrypted_sender_key_bundle: number[];
  signature: number[];
  joiner_ephemeral_public: number[];
}

export interface RelayCredentials {
  call_id: string;
  relay_endpoint: string;
  relay_token: number[];
  expires_at: string;
}

export interface SpeakingStateInfo {
  participant_id: string;
  is_speaking: boolean;
  audio_level: number;
}

export interface GroupCallMediaState {
  call_id: string | null;
  status: string;
  is_muted: boolean;
  is_deafened: boolean;
  connection_health: ConnectionHealth;
  connected_at: string | null;
  relay_token_expires_at: string | null;
  relay_token_expires_soon: boolean;
  participant_count: number;
}

export interface SenderKeyBundle {
  participant_id: string;
  encrypted_sender_key: number[];
  identity_public: number[];
}

export interface RejoinableGroupCallInfo {
  call_id: string;
  conversation_id: string;
  initiator_id: string;
  status: string;
  participants: GroupCallParticipantInfo[];
  left_at: string;
  rejoin_expires_at: string;
}
