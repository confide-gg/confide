export interface UploadPrekeysRequest {
  signed_prekey_public: number[];
  signed_prekey_signature: number[];
  signed_prekey_id: number;
  one_time_prekeys: {
    prekey_id: number;
    public_key: number[];
  }[];
}

export interface PrekeyCountResponse {
  count: number;
}

export interface PreKeyBundle {
  identity_key: number[];
  signed_prekey_public: number[];
  signed_prekey_signature: number[];
  signed_prekey_id: number;
  one_time_prekey_public?: number[];
  one_time_prekey_id?: number;
}

export interface InitiateKeyExchangeRequest {
  to_user_id: string;
  conversation_id: string;
  key_bundle: number[];
  encrypted_session_state: number[];
}

export interface KeyExchangeResponse {
  id: string;
  status: string;
}

export interface PendingKeyExchange {
  id: string;
  from_user_id: string;
  conversation_id: string;
  key_bundle: number[];
  encrypted_session_state: number[];
  created_at: string;
}

export interface AcceptKeyExchangeRequest {
  encrypted_session_state: number[];
}

export interface SaveSessionRequest {
  encrypted_state: number[];
}

export interface SessionResponse {
  encrypted_state: number[];
  updated_at: string;
}
