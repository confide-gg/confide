export interface WsCallOffer {
  type: "call_offer";
  data: {
    call_id: string;
    caller_id: string;
    callee_id: string;
    conversation_id: string | null;
    caller_username: string;
    caller_display_name: string | null;
    caller_avatar_url: string | null;
    caller_identity_key: number[];
    ephemeral_kem_public: number[];
    signature: number[];
    created_at: string;
  };
}

export interface WsCallAnswer {
  type: "call_answer";
  data: {
    call_id: string;
    callee_id: string;
    ephemeral_kem_public: number[];
    kem_ciphertext: number[];
    signature: number[];
  };
}

export interface WsCallKeyComplete {
  type: "call_key_complete";
  data: {
    call_id: string;
    kem_ciphertext: number[];
  };
}

export interface WsCallReject {
  type: "call_reject";
  data: {
    call_id: string;
    reason: string;
  };
}

export interface WsCallCancel {
  type: "call_cancel";
  data: {
    call_id: string;
  };
}

export interface WsCallEnd {
  type: "call_end";
  data: {
    call_id: string;
    reason: string;
    duration_seconds: number | null;
  };
}

export interface WsCallMediaReady {
  type: "call_media_ready";
  data: {
    call_id: string;
    relay_endpoint: string;
    relay_token: number[];
    expires_at: string;
  };
}

export interface WsCallMissed {
  type: "call_missed";
  data: {
    call_id: string;
    caller_id: string;
    caller_username: string;
    caller_display_name: string | null;
    conversation_id: string | null;
    created_at: string;
  };
}

export interface WsCallLeave {
  type: "call_leave";
  data: {
    call_id: string;
    user_id: string;
    left_at: string;
  };
}

export interface WsCallRejoin {
  type: "call_rejoin";
  data: {
    call_id: string;
    user_id: string;
    relay_endpoint: string;
    relay_token: number[];
    expires_at: string;
  };
}

export interface WsScreenShareStart {
  type: "screen_share_start";
  data: {
    call_id: string;
    user_id: string;
    width: number;
    height: number;
  };
}

export interface WsScreenShareStop {
  type: "screen_share_stop";
  data: {
    call_id: string;
    user_id: string;
  };
}

export interface WsCallMuteUpdate {
  type: "call_mute_update";
  data: {
    call_id: string;
    user_id: string;
    is_muted: boolean;
  };
}

export interface InitiateCallRequest {
  call_id: string;
  callee_id: string;
  offer?: {
    sdp: string;
    type: "offer";
  };
  conversation_id?: string | null;
  isVideo?: boolean;
  ephemeral_kem_public: number[];
  signature: number[];
}

export interface InitiateCallResponse {
  call_id: string;
}

export interface AnswerCallRequest {
  answer?: {
    sdp: string;
    type: "answer";
  };
  ephemeral_kem_public: number[];
  kem_ciphertext: number[];
  signature: number[];
}

export interface AnswerCallResponse {
  success: boolean;
}

export interface KeyCompleteRequest {
  kem_ciphertext: number[];
}

export interface KeyCompleteResponse {
  success: boolean;
  relay_endpoint: string;
  relay_token: number[];
}

export interface LeaveCallResponse {
  success: boolean;
}

export interface RejoinCallResponse {
  success: boolean;
  relay_endpoint: string;
  relay_token: number[];
}

export interface CallWithPeerInfo {
  id: string;
  caller_id: string;
  callee_id: string;
  conversation_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  caller_username?: string;
  caller_avatar_url?: string;
  callee_username?: string;
  callee_avatar_url?: string;
}
