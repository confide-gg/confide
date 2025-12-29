import type { Reaction } from "./message";

export type SystemMessageType =
  | "call_started"
  | "call_ended"
  | "call_missed"
  | "call_rejected"
  | "channel_pin"
  | "group_member_added"
  | "group_member_removed"
  | "group_member_left"
  | "group_owner_changed"
  | "group_call_started"
  | "group_call_ended";

export interface ReplyTo {
  id: string;
  content: string;
  senderName: string;
}

export type MessageStatus = "pending" | "sent" | "error";

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
  status?: MessageStatus;
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
