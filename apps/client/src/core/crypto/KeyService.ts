import { httpClient } from "../network/HttpClient";
import type {
    AcceptKeyExchangeRequest,
    InitiateKeyExchangeRequest,
    KeyExchangeResponse,
    PendingKeyExchange,
    PreKeyBundle,
    PrekeyCountResponse,
    SaveSessionRequest,
    SessionResponse,
    UploadPrekeysRequest,
} from "../../features/chat/types";
import type { SuccessResponse } from "../../shared/types/common";

class KeyService {
    public async uploadPrekeys(data: UploadPrekeysRequest): Promise<SuccessResponse> {
        return httpClient.post<SuccessResponse>("/keys/prekeys", data);
    }

    public async getPrekeyCount(): Promise<PrekeyCountResponse> {
        return httpClient.get<PrekeyCountResponse>("/keys/prekeys/count");
    }

    public async getPrekeyBundle(userId: string): Promise<PreKeyBundle> {
        return httpClient.get<PreKeyBundle>(`/keys/prekeys/${userId}`);
    }

    public async initiateKeyExchange(
        data: InitiateKeyExchangeRequest
    ): Promise<KeyExchangeResponse> {
        return httpClient.post<KeyExchangeResponse>("/keys/exchange", data);
    }

    public async getPendingExchanges(): Promise<PendingKeyExchange[]> {
        return httpClient.get<PendingKeyExchange[]>("/keys/exchange/pending");
    }

    public async acceptKeyExchange(
        exchangeId: string,
        data: AcceptKeyExchangeRequest
    ): Promise<SuccessResponse> {
        return httpClient.post<SuccessResponse>(`/keys/exchange/${exchangeId}/accept`, data);
    }

    public async getSession(
        conversationId: string,
        peerId: string
    ): Promise<SessionResponse | null> {
        return httpClient.get<SessionResponse | null>(`/keys/sessions/${conversationId}/${peerId}`);
    }

    public async saveSession(
        conversationId: string,
        peerId: string,
        data: SaveSessionRequest
    ): Promise<SuccessResponse> {
        return httpClient.post<SuccessResponse>(`/keys/sessions/${conversationId}/${peerId}`, data);
    }
}

export const keyService = new KeyService();
