import { PublicUser } from "../api/types";

export interface Friend {
  id: string;
  username: string;
  kem_public_key?: number[];
  dsa_public_key?: number[];
}

export interface FriendRequestResponse {
  id: string;
  from_user: PublicUser;
  encrypted_message: number[] | null;
  created_at: string;
}

export interface DmPreview {
  conversationId: string;
  visitorId: string;
  visitorUsername: string;
  lastMessage: string;
  lastMessageTime: string;
  isLastMessageMine: boolean;
}

export interface ContextMenuData {
  x: number;
  y: number;
  friendId: string;
  friendUsername: string;
}

export interface MessageContextMenuData {
  x: number;
  y: number;
  message: DecryptedMessage;
}

export interface DmContextMenuData {
  x: number;
  y: number;
  conversationId: string;
  visitorId: string;
  visitorUsername: string;
}

export interface MessageReaction {
  id: string;
  userId: string;
  emoji: string;
}

export interface ReplyTo {
  id: string;
  content: string;
  senderName: string;
}

export type SystemMessageType = 'call_started' | 'call_ended' | 'call_missed' | 'call_rejected';

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
  reactions: MessageReaction[];
  editedAt?: string | null;
  isSystem?: boolean;
  systemType?: SystemMessageType;
  callDurationSeconds?: number | null;
}

export interface ActiveChat {
  visitorId: string;
  visitorUsername: string;
  conversationId: string;
  conversationKey: number[];
  isGroup?: boolean;
  ratchetState?: number[];
  isVerified?: boolean;
  theirIdentityKey?: number[];
  theirDsaKey?: number[];
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

export type SidebarView = "dms" | "friends";
export type PickerType = "emoji" | "gif" | null;
export type TimedMessageDuration = null | 5 | 30 | 60 | 300;
export type UserStatus = "online" | "away" | "dnd" | "invisible" | "offline";

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: UserStatus;
  custom_status: string | null;
  accent_color: string | null;
  banner_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: UserStatus;
  custom_status: string | null;
  accent_color: string | null;
  banner_url: string | null;
  member_since: string;
}

export interface UpdateProfileRequest {
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  status?: UserStatus;
  custom_status?: string;
  accent_color?: string;
  banner_url?: string;
}

export interface ProfileViewData {
  userId: string;
  username: string;
  isOnline: boolean;
}
