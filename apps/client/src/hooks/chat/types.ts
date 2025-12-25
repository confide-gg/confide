import type {
  ActiveChat,
  DecryptedMessage,
  DmPreview,
  ReplyTo,
  TimedMessageDuration,
} from "../../types";
import type { MutableRefObject } from "react";
import type { MessageQueue } from "../../utils/MessageQueue";

export interface ChatState {
  activeChat: ActiveChat | null;
  setActiveChat: React.Dispatch<React.SetStateAction<ActiveChat | null>>;
  chatMessages: DecryptedMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  isLoadingChat: boolean;
  setIsLoadingChat: React.Dispatch<React.SetStateAction<boolean>>;
  messageInput: string;
  setMessageInput: React.Dispatch<React.SetStateAction<string>>;
  isSending: boolean;
  setIsSending: React.Dispatch<React.SetStateAction<boolean>>;
  replyTo: ReplyTo | null;
  setReplyTo: React.Dispatch<React.SetStateAction<ReplyTo | null>>;
  timedMessageDuration: TimedMessageDuration;
  setTimedMessageDuration: React.Dispatch<React.SetStateAction<TimedMessageDuration>>;
  dmPreviews: DmPreview[];
  setDmPreviews: React.Dispatch<React.SetStateAction<DmPreview[]>>;
  favoriteGifUrls: Set<string>;
  setFavoriteGifUrls: React.Dispatch<React.SetStateAction<Set<string>>>;
  unreadCounts: Map<string, number>;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  activeChatRef: MutableRefObject<ActiveChat | null>;
  processedMessageIds: MutableRefObject<Set<string>>;
  groupMemberNameCache: MutableRefObject<Map<string, Map<string, string>>>;
  messageQueuesRef: MutableRefObject<Map<string, MessageQueue>>;
}

export interface IncomingMessageData {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: number[];
  signature: number[];
  reply_to_id: string | null;
  expires_at: string | null;
  created_at: string;
  message_type?: string;
  call_duration_seconds?: number | null;
  pinned_at?: string | null;
}

export interface AttachmentMeta {
  s3_key: string;
  file_size: number;
  encrypted_size: number;
  mime_type: string;
}
