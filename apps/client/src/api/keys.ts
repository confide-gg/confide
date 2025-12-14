import { get, post } from "./client";
import type {
  AcceptKeyExchangeRequest,
  InitiateKeyExchangeRequest,
  KeyExchangeResponse,
  PendingKeyExchange,
  PreKeyBundle,
  PrekeyCountResponse,
  SaveSessionRequest,
  SessionResponse,
  SuccessResponse,
  UploadPrekeysRequest,
} from "./types";

export async function uploadPrekeys(data: UploadPrekeysRequest): Promise<SuccessResponse> {
  return post<SuccessResponse>("/keys/prekeys", data);
}

export async function getPrekeyCount(): Promise<PrekeyCountResponse> {
  return get<PrekeyCountResponse>("/keys/prekeys/count");
}

export async function getPrekeyBundle(userId: string): Promise<PreKeyBundle> {
  return get<PreKeyBundle>(`/keys/prekeys/${userId}`);
}

export async function initiateKeyExchange(
  data: InitiateKeyExchangeRequest
): Promise<KeyExchangeResponse> {
  return post<KeyExchangeResponse>("/keys/exchange", data);
}

export async function getPendingExchanges(): Promise<PendingKeyExchange[]> {
  return get<PendingKeyExchange[]>("/keys/exchange/pending");
}

export async function acceptKeyExchange(
  exchangeId: string,
  data: AcceptKeyExchangeRequest
): Promise<SuccessResponse> {
  return post<SuccessResponse>(`/keys/exchange/${exchangeId}/accept`, data);
}

export async function getSession(
  conversationId: string,
  peerId: string
): Promise<SessionResponse | null> {
  return get<SessionResponse | null>(`/keys/sessions/${conversationId}/${peerId}`);
}

export async function saveSession(
  conversationId: string,
  peerId: string,
  data: SaveSessionRequest
): Promise<SuccessResponse> {
  return post<SuccessResponse>(`/keys/sessions/${conversationId}/${peerId}`, data);
}
