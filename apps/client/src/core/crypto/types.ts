export interface OneTimePrekeyUpload {
    prekey_id: number;
    public_key: number[];
}

export interface UploadPrekeysRequest {
    signed_prekey_public: number[];
    signed_prekey_signature: number[];
    signed_prekey_id: number;
    one_time_prekeys: OneTimePrekeyUpload[];
}

export interface PrekeyCountResponse {
    count: number;
}

export interface OneTimePrekeyInfo {
    prekey_id: number;
    public_key: number[];
}

export interface PreKeyBundle {
    identity_key: number[];
    signed_prekey_public: number[];
    signed_prekey_signature: number[];
    signed_prekey_id: number;
    one_time_prekey: OneTimePrekeyInfo | null;
}

export interface InitiateKeyExchangeRequest {
    to_user_id: string;
    conversation_id: string;
    key_bundle: number[];
    encrypted_session_state: number[];
}

export interface KeyExchangeResponse {
    id: string;
}

export interface PendingKeyExchange {
    id: string;
    from_user_id: string;
    to_user_id: string;
    conversation_id: string;
    key_bundle: number[];
    created_at: string;
}

export interface AcceptKeyExchangeRequest {
    encrypted_session_state: number[];
}

export interface SessionResponse {
    encrypted_state: number[];
}

export interface SaveSessionRequest {
    encrypted_state: number[];
}

export interface WsKeyUpdate {
    type: "key_update";
    data: {
        user_id: string;
        kem_public_key: number[];
    };
}

export interface WsKeyExchange {
    type: "key_exchange";
    data: PendingKeyExchange;
}
