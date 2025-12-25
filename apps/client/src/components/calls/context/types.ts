import type {
  CallState,
  IncomingCallInfo,
  CallOfferResult,
  CallAnswerResult,
  KeyCompleteResult,
  ScreenCaptureSource,
} from "../types";

export const MAX_INCOMING_CALL_QUEUE = 3;
export const RING_TIMEOUT_MS = 30000;
export const KEY_EXCHANGE_TIMEOUT_MS = 30000;
export const PEER_LEFT_TIMEOUT_MS = 300000;

export interface PeerInfo {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface CallContextValue {
  callState: CallState;
  incomingCall: IncomingCallInfo | null;
  incomingCallQueue: IncomingCallInfo[];
  peerHasLeft: boolean;
  isPTTActive: boolean;
  isPTTEnabled: boolean;
  initiateCall: (
    callerId: string,
    calleeId: string,
    calleeIdentityKey: number[],
    dsaSecretKey: number[],
    peerInfo: PeerInfo
  ) => Promise<CallOfferResult>;
  handleIncomingCall: (info: IncomingCallInfo) => void;
  acceptCall: (callerIdentityPublic: number[], dsaSecretKey: number[]) => Promise<CallAnswerResult>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  leaveCall: () => Promise<void>;
  rejoinCall: () => Promise<void>;
  canRejoin: () => Promise<boolean>;
  setMuted: (muted: boolean) => Promise<void>;
  setDeafened: (deafened: boolean) => Promise<void>;
  completeKeyExchangeAsCaller: (
    calleeEphemeralPublic: number[],
    calleeKemCiphertext: number[],
    calleeSignature: number[],
    calleeIdentityPublic: number[]
  ) => Promise<KeyCompleteResult>;
  completeKeyExchangeAsCallee: (callerKemCiphertext: number[]) => Promise<void>;
  startMediaSession: (relayEndpoint: string, relayToken: number[]) => Promise<void>;
  refreshState: () => Promise<void>;
  refreshAudioSettings: () => Promise<void>;
  getScreenSources: () => Promise<ScreenCaptureSource[]>;
  startScreenShare: (sourceId: string) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  checkScreenPermission: () => Promise<boolean>;
}

export const defaultCallState: CallState = {
  call_id: null,
  peer_id: null,
  peer_username: null,
  peer_display_name: null,
  peer_avatar_url: null,
  status: "idle",
  is_caller: false,
  is_muted: false,
  is_deafened: false,
  peer_is_muted: false,
  started_at: null,
  connected_at: null,
  is_screen_sharing: false,
  peer_is_screen_sharing: false,
  screen_share_source: null,
  connection_health: "good",
  last_audio_received_at: null,
  relay_token_expires_at: null,
  relay_token_expires_soon: false,
  left_at: null,
  can_rejoin: false,
  rejoin_time_remaining_seconds: null,
};

export interface CallProviderProps {
  children: React.ReactNode;
  currentUserId?: string;
  onCallAnswerReceived?: (data: {
    call_id: string;
    callee_id: string;
    ephemeral_kem_public: number[];
    kem_ciphertext: number[];
    signature: number[];
  }) => void;
  onKeyCompleteReceived?: (data: { call_id: string; kem_ciphertext: number[] }) => void;
  onMediaReadyReceived?: (data: {
    call_id: string;
    relay_endpoint: string;
    relay_token: number[];
    expires_at: string;
  }) => void;
}

export interface CallRefs {
  peerIdentityKeyRef: React.MutableRefObject<number[] | null>;
  pendingMediaReadyRef: React.MutableRefObject<{
    relay_endpoint: string;
    relay_token: number[];
  } | null>;
  calleeKeyExchangeDoneRef: React.MutableRefObject<boolean>;
  peerLeftTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  callStartTimeRef: React.MutableRefObject<number | null>;
  callPeerIdRef: React.MutableRefObject<string | null>;
  isPTTActiveRef: React.MutableRefObject<boolean>;
  ringTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  keyExchangeTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  isOnlineRef: React.MutableRefObject<boolean>;
  wasInCallBeforeOfflineRef: React.MutableRefObject<boolean>;
  callStateRef: React.MutableRefObject<CallState>;
}
