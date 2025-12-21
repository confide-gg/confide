import { PublicUser } from "../../core/auth/types";

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

// WS Types
export interface WsNewMessage {
    type: "new_message";
    data: {
        id: string;
        conversation_id?: string;
        channel_id?: string;
        sender_id: string;
        encrypted_content: number[];
        signature: number[];
        sender_dsa_public_key?: number[]; // Added this as used in ChannelChat
        reply_to_id: string | null;
        expires_at: string | null;
        sender_chain_id?: number | null;
        sender_chain_iteration?: number | null;
        created_at: string;
        message_type?: string;
        call_id?: string | null;
        call_duration_seconds?: number | null;
        pinned_at?: string | null;
        sender_username: string; // Added as it seems used/expected
    };
}

export interface WsMessageDeleted {
    type: "message_deleted";
    data: {
        message_id: string;
        conversation_id?: string;
        channel_id?: string;
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

export interface WsMessagePinned {
    type: "message_pinned";
    data: {
        message_id: string;
        conversation_id: string;
        pinner_id: string;
        pinned_at: string;
    };
}

export interface WsMessageUnpinned {
    type: "message_unpinned";
    data: {
        message_id: string;
        conversation_id: string;
        unpinner_id: string;
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

export interface WsGroupCreated {
    type: "group_created";
    data: {
        conversation_id: string;
        owner_id: string;
    };
}

export interface WsGroupOwnerChanged {
    type: "group_owner_changed";
    data: {
        conversation_id: string;
        old_owner_id: string;
        new_owner_id: string;
        changed_by: string;
    };
}

export interface WsGroupDeleted {
    type: "group_deleted";
    data: {
        conversation_id: string;
        deleted_by: string;
    };
}

export interface WsGroupMetadataUpdated {
    type: "group_metadata_updated";
    data: {
        conversation_id: string;
        updated_by: string;
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

export interface WsTypingStart {
    type: "typing_start";
    data: {
        channel_id: string;
        member_id: string;
        username: string;
    };
}

export interface WsTypingStop {
    type: "typing_stop";
    data: {
        channel_id: string;
        member_id: string;
    };
}

// --- Domain/UI Models ---

export type SystemMessageType =
    | 'call_started'
    | 'call_ended'
    | 'call_missed'
    | 'call_rejected'
    | 'channel_pin'
    | 'group_member_added'
    | 'group_member_removed'
    | 'group_member_left'
    | 'group_owner_changed';

export interface ReplyTo {
    id: string;
    content: string;
    senderName: string;
}

export interface DecryptedMessage {
    id: string;
    senderId: string;
    senderName?: string;
    content: string;
    createdAt: string;
    isMine: boolean;
    isGif?: boolean;
    expiresAt?: string | null;
    replyToId?: string | null;
    replyTo?: ReplyTo;
    reactions: Reaction[];
    editedAt?: string | null;
    isSystem?: boolean;
    systemType?: SystemMessageType;
    callDurationSeconds?: number | null;
    pinnedAt?: string | null;
}

export interface ActiveChat {
    visitorId: string;
    visitorUsername: string;
    conversationId: string;
    conversationKey: number[];
    isGroup?: boolean;
    groupName?: string;
    groupOwnerId?: string | null;
    groupIcon?: string;
    memberUsernames?: string[];
    ratchetState?: number[];
    isVerified?: boolean;
    theirIdentityKey?: number[];
    theirDsaKey?: number[];
}

export interface DmPreview {
    conversationId: string;
    visitorId: string;
    visitorUsername: string;
    lastMessage: string;
    lastMessageTime: string;
    isLastMessageMine: boolean;
    isGroup?: boolean;
    groupName?: string;
    groupOwnerId?: string | null;
    groupIcon?: string;
    memberIds?: string[];
    memberUsernames?: string[];
}

export interface TenorGif {
    id: string;
    title: string;
    media_formats: {
        gif: { url: string };
        tinygif: { url: string };
    };
}

export interface FavoriteGif {
    id: string;
    user_id: string;
    gif_url: string;
    gif_preview_url: string;
    created_at: string;
}

export type PickerType = "emoji" | "gif" | null;
export type TimedMessageDuration = null | 5 | 30 | 60 | 300;

// Key Exchange Types
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
