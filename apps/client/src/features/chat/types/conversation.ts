import type { PublicUser } from "../../../core/auth/types";

export type ConversationType = "dm" | "group";

export interface ConversationWithRouting {
  id: string;
  conversation_type: string;
  encrypted_metadata: number[] | null;
  owner_id?: string | null;
  encrypted_sender_key: number[];
  encrypted_role: number[];
  created_at: string;
}

export interface ConversationResponse {
  id: string;
  conversation_type: string;
  encrypted_sender_key?: number[];
  encrypted_role?: number[];
}

export interface MemberInit {
  user_id: string;
  encrypted_sender_key: number[];
  encrypted_role: number[];
}

export interface CreateConversationRequest {
  conversation_type: ConversationType;
  encrypted_metadata: number[] | null;
  members: MemberInit[];
}

export interface CreateDmRequest {
  my_encrypted_sender_key: number[];
  my_encrypted_role: number[];
  their_encrypted_sender_key: number[];
  their_encrypted_role: number[];
  encrypted_metadata: number[] | null;
}

export interface MemberResponse {
  user: PublicUser;
  encrypted_role: number[];
  joined_at: string;
}

export interface AddMemberRequest {
  user_id: string;
  encrypted_sender_key: number[];
  encrypted_role: number[];
}
