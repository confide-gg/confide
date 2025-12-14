import { get, post } from "./client";

export interface InitiateCallRequest {
  call_id: string;
  callee_id: string;
  ephemeral_kem_public: number[];
  signature: number[];
}

export interface InitiateCallResponse {
  id: string;
  status: string;
  created_at: string;
}

export interface AnswerCallRequest {
  ephemeral_kem_public: number[];
  kem_ciphertext: number[];
  signature: number[];
}

export interface AnswerCallResponse {
  status: string;
  answered_at: string;
}

export interface KeyCompleteRequest {
  kem_ciphertext: number[];
}

export interface KeyCompleteResponse {
  relay_endpoint: string;
  relay_token: number[];
}

export interface LeaveCallResponse {
  id: string;
  status: string;
  caller_left_at: string | null;
  callee_left_at: string | null;
}

export interface RejoinCallResponse {
  call_id: string;
  relay_endpoint: string;
  relay_token: number[];
  expires_at: string;
}

export interface CallWithPeerInfo {
  call: {
    id: string;
    caller_id: string;
    callee_id: string;
    status: string;
    created_at: string;
    caller_left_at: string | null;
    callee_left_at: string | null;
  };
  peer_username: string;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
}

export async function initiateCall(request: InitiateCallRequest): Promise<InitiateCallResponse> {
  return post<InitiateCallResponse>("/calls", request);
}

export async function answerCall(callId: string, request: AnswerCallRequest): Promise<AnswerCallResponse> {
  return post<AnswerCallResponse>(`/calls/${callId}/answer`, request);
}

export async function rejectCall(callId: string, reason: string = "declined"): Promise<void> {
  await post(`/calls/${callId}/reject`, { reason });
}

export async function cancelCall(callId: string): Promise<void> {
  await post(`/calls/${callId}/cancel`, {});
}

export async function endCall(callId: string, reason: string = "normal"): Promise<void> {
  await post(`/calls/${callId}/end`, { reason });
}

export async function completeKeyExchange(callId: string, request: KeyCompleteRequest): Promise<KeyCompleteResponse> {
  return post<KeyCompleteResponse>(`/calls/${callId}/key-complete`, request);
}

export async function leaveCall(callId: string): Promise<LeaveCallResponse> {
  return post<LeaveCallResponse>(`/calls/${callId}/leave`, {});
}

export async function rejoinCall(callId: string): Promise<RejoinCallResponse> {
  return post<RejoinCallResponse>(`/calls/${callId}/rejoin`, {});
}

export async function getRejoinableCall(): Promise<CallWithPeerInfo | null> {
  return get<CallWithPeerInfo | null>("/calls/rejoinable");
}
