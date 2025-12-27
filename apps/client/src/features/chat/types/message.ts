export interface ApiMessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Reaction {
  id: string;
  userId: string;
  messageId: string;
  emoji: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: number[];
  signature: number[];
  reply_to_id: string | null;
  expires_at: string | null;
  sender_chain_id?: number | null;
  sender_chain_iteration?: number | null;
  reactions: ApiMessageReaction[];
  created_at: string;
  encrypted_key?: number[] | null;
  edited_at?: string | null;
  message_type?: string;
  call_id?: string | null;
  call_duration_seconds?: number | null;
  pinned_at?: string | null;
}

export interface MessageKeyData {
  user_id: string;
  encrypted_key: number[];
}

export interface AttachmentMetadata {
  s3_key: string;
  file_size: number;
  encrypted_size: number;
  mime_type: string;
}

export interface SendMessageRequest {
  encrypted_content: number[];
  signature: number[];
  reply_to_id?: string | null;
  expires_at?: string | null;
  sender_chain_id?: number | null;
  sender_chain_iteration?: number | null;
  message_keys?: MessageKeyData[];
  attachment?: AttachmentMetadata;
}

export interface SendMessageResponse {
  id: string;
  created_at: string;
}

export interface EditMessageRequest {
  encrypted_content: number[];
  signature: number[];
  message_keys?: Array<{ user_id: string; encrypted_key: number[] }>;
}

export interface EditMessageResponse {
  edited_at: string;
}

export interface AddReactionRequest {
  emoji: string;
}

export interface ReactionResponse {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface GetMessagesQuery {
  limit?: number;
  before?: string;
}
