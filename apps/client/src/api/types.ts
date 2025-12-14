export interface PublicUser {
  id: string;
  username: string;
  kem_public_key: number[];
  dsa_public_key: number[];
}

export interface AuthResponse {
  user: PublicUser;
  token: string;
}

export interface LoginResponse {
  user: PublicUser;
  token: string;
  kem_encrypted_private: number[];
  dsa_encrypted_private: number[];
  key_salt: number[];
}

export interface KeysResponse {
  kem_encrypted_private: number[];
  dsa_encrypted_private: number[];
  key_salt: number[];
}

export interface RegisterRequest {
  username: string;
  password: string;
  kem_public_key: number[];
  kem_encrypted_private: number[];
  dsa_public_key: number[];
  dsa_encrypted_private: number[];
  key_salt: number[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface FriendsResponse {
  encrypted_friends: number[];
}

export interface UpdateFriendsRequest {
  encrypted_friends: number[];
  removed_friend_id?: string;
}

export interface FriendRequestResponse {
  id: string;
  from_user: PublicUser;
  encrypted_message: number[] | null;
  created_at: string;
}

export interface SendFriendRequestBody {
  to_user_id: string;
  encrypted_message: number[] | null;
}

export interface AcceptFriendRequestBody {
  encrypted_friends: number[];
}

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  encrypted_message: number[] | null;
  created_at: string;
}

export type ConversationType = "dm" | "group";

export interface ConversationWithRouting {
  id: string;
  conversation_type: string;
  encrypted_metadata: number[] | null;
  encrypted_sender_key: number[];
  encrypted_role: number[];
  created_at: string;
}

export interface ConversationResponse {
  id: string;
  conversation_type: string;
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

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
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
  reactions: MessageReaction[];
  created_at: string;
  encrypted_key?: number[] | null;
  edited_at?: string | null;
  message_type?: string;
  call_id?: string | null;
  call_duration_seconds?: number | null;
}

export interface MessageKeyData {
  user_id: string;
  encrypted_key: number[];
}

export interface SendMessageRequest {
  encrypted_content: number[];
  signature: number[];
  reply_to_id?: string | null;
  expires_at?: string | null;
  sender_chain_id?: number | null;
  sender_chain_iteration?: number | null;
  message_keys?: MessageKeyData[];
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

export interface SuccessResponse {
  success: boolean;
}

export type WsMessageType =
  | "new_message"
  | "message_deleted"
  | "message_edited"
  | "reaction_added"
  | "reaction_removed"
  | "friend_request"
  | "friend_accepted"
  | "friend_removed"
  | "key_update"
  | "group_member_added"
  | "group_member_removed"
  | "group_member_left"
  | "typing"
  | "presence"
  | "presence_sync"
  | "key_exchange"
  | "member_roles_updated"
  | "role_created"
  | "role_updated"
  | "role_deleted"
  | "call_offer"
  | "call_answer"
  | "call_key_complete"
  | "call_reject"
  | "call_cancel"
  | "call_end"
  | "call_media_ready"
  | "call_missed"
  | "call_leave"
  | "call_rejoin"
  | "screen_share_start"
  | "screen_share_stop"
  | "call_mute_update";

export interface WsNewMessage {
  type: "new_message";
  data: {
    id: string;
    conversation_id: string;
    sender_id: string;
    encrypted_content: number[];
    signature: number[];
    reply_to_id: string | null;
    expires_at: string | null;
    sender_chain_id?: number | null;
    sender_chain_iteration?: number | null;
    created_at: string;
    message_type?: string;
    call_id?: string | null;
    call_duration_seconds?: number | null;
  };
}

export interface WsMessageDeleted {
  type: "message_deleted";
  data: {
    message_id: string;
    conversation_id: string;
  };
}

export interface WsMessageEdited {
  type: "message_edited";
  data: {
    message_id: string;
    conversation_id: string;
    encrypted_content: number[];
    signature: number[];
    edited_at: string;
  };
}

export interface WsReactionAdded {
  type: "reaction_added";
  data: {
    id: string;
    message_id: string;
    conversation_id: string;
    user_id: string;
    emoji: string;
  };
}

export interface WsReactionRemoved {
  type: "reaction_removed";
  data: {
    message_id: string;
    conversation_id: string;
    user_id: string;
    emoji: string;
  };
}

export interface WsFriendRequest {
  type: "friend_request";
  data: {
    id: string;
    from_user_id: string;
    encrypted_message: number[] | null;
  };
}

export interface WsFriendAccepted {
  type: "friend_accepted";
  data: {
    by_user_id: string;
    by_username: string;
  };
}

export interface WsFriendRemoved {
  type: "friend_removed";
  data: {
    by_user_id: string;
  };
}

export interface WsKeyUpdate {
  type: "key_update";
  data: {
    user_id: string;
    kem_public_key: number[];
  };
}

export interface WsTyping {
  type: "typing";
  data: {
    conversation_id: string;
    user_id: string | null;
    is_typing: boolean;
  };
}

export interface WsPresence {
  type: "presence";
  data: {
    user_id: string;
    online: boolean;
    status?: string;
    custom_status?: string;
  };
}

export interface WsUpdatePresence {
  type: "update_presence";
  data: {
    status: string;
    custom_status?: string;
  };
}

export interface WsPresenceSync {
  type: "presence_sync";
  data: {
    online_users: string[];
  };
}

export interface WsKeyExchange {
  type: "key_exchange";
  data: PendingKeyExchange;
}

export interface WsGroupMemberAdded {
  type: "group_member_added";
  data: {
    conversation_id: string;
    user_id: string;
    added_by: string;
  };
}

export interface WsGroupMemberRemoved {
  type: "group_member_removed";
  data: {
    conversation_id: string;
    user_id: string;
    removed_by: string;
  };
}

export interface WsGroupMemberLeft {
  type: "group_member_left";
  data: {
    conversation_id: string;
    user_id: string;
  };
}

export interface WsMemberRolesUpdated {
  type: "member_roles_updated";
  data: {
    server_id: string;
    user_id: string;
    role_ids: string[];
  };
}

export interface WsRoleCreated {
  type: "role_created";
  data: {
    server_id: string;
    role_id: string;
    encrypted_name: number[];
    color: string | null;
    permissions: number;
    position: number;
  };
}

export interface WsRoleUpdated {
  type: "role_updated";
  data: {
    server_id: string;
    role_id: string;
    encrypted_name: number[] | null;
    color: string | null;
    permissions: number | null;
  };
}

export interface WsRoleDeleted {
  type: "role_deleted";
  data: {
    server_id: string;
    role_id: string;
  };
}

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

export type WsMessage =
  | WsNewMessage
  | WsMessageDeleted
  | WsMessageEdited
  | WsReactionAdded
  | WsReactionRemoved
  | WsFriendRequest
  | WsFriendAccepted
  | WsFriendRemoved
  | WsKeyUpdate
  | WsGroupMemberAdded
  | WsGroupMemberRemoved
  | WsGroupMemberLeft
  | WsTyping
  | WsPresence
  | WsPresenceSync
  | WsUpdatePresence
  | WsKeyExchange
  | WsMemberRolesUpdated
  | WsRoleCreated
  | WsRoleUpdated
  | WsRoleDeleted
  | WsCallOffer
  | WsCallAnswer
  | WsCallKeyComplete
  | WsCallReject
  | WsCallCancel
  | WsCallEnd
  | WsCallMediaReady
  | WsCallMissed
  | WsCallLeave
  | WsCallRejoin
  | WsScreenShareStart
  | WsScreenShareStop
  | WsCallMuteUpdate;
