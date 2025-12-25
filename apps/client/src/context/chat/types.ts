import type { Dispatch, SetStateAction } from "react";
import type {
  Friend, FriendRequestResponse, ActiveChat, DecryptedMessage, SidebarView,
  ContextMenuData, MessageContextMenuData, DmContextMenuData, GroupContextMenuData, ReplyTo,
  TimedMessageDuration, ProfileViewData, DmPreview, SystemMessageType,
} from "../../types/index";

export interface VerifyModalData {
  friendId: string;
  friendUsername: string;
  theirIdentityKey: number[];
}

export interface ChatContextType {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;

  friendsList: Friend[];
  friendRequests: FriendRequestResponse[];
  sentRequests: Set<string>;
  searchResults: { id: string; username: string; kem_public_key: number[] }[];
  isSearching: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  confirmRemove: Friend | null;
  setConfirmRemove: (friend: Friend | null) => void;

  activeChat: ActiveChat | null;
  setActiveChat: Dispatch<SetStateAction<ActiveChat | null>>;
  chatMessages: DecryptedMessage[];
  isLoadingChat: boolean;
  messageInput: string;
  setMessageInput: (input: string) => void;
  isSending: boolean;
  replyTo: ReplyTo | null;
  setReplyTo: (reply: ReplyTo | null) => void;
  timedMessageDuration: TimedMessageDuration;
  setTimedMessageDuration: (duration: TimedMessageDuration) => void;
  dmPreviews: DmPreview[];
  setDmPreviews: Dispatch<SetStateAction<DmPreview[]>>;
  unreadCounts: Map<string, number>;
  droppedFile: File | null;
  setDroppedFile: (file: File | null) => void;

  isConnected: boolean;
  hasConnectedOnce: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, ReturnType<typeof setTimeout>>;

  contextMenu: ContextMenuData | null;
  setContextMenu: (menu: ContextMenuData | null) => void;
  messageContextMenu: MessageContextMenuData | null;
  setMessageContextMenu: (menu: MessageContextMenuData | null) => void;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  dmContextMenu: DmContextMenuData | null;
  setDmContextMenu: (menu: DmContextMenuData | null) => void;
  groupContextMenu: GroupContextMenuData | null;
  setGroupContextMenu: (menu: GroupContextMenuData | null) => void;
  profileView: ProfileViewData | null;
  setProfileView: (data: ProfileViewData | null) => void;
  showProfilePanel: boolean;
  setShowProfilePanel: (show: boolean) => void;
  verifyModal: VerifyModalData | null;
  setVerifyModal: (data: VerifyModalData | null) => void;

  error: string;
  setError: (error: string) => void;
  successMessage: string;
  setSuccessMessage: (message: string) => void;

  openChat: (friend: Friend) => Promise<void>;
  createGroup: (data: { name: string; icon?: string; memberIds: string[] }) => Promise<void>;
  removeFriend: (friend: Friend) => Promise<void>;
  sendMessage: (content?: string, attachmentMeta?: { s3_key: string; file_size: number; encrypted_size: number; mime_type: string }) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => void;
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => void;
  handleTyping: () => void;
  loadFriendRequests: () => Promise<void>;
  handleAcceptRequest: (request: FriendRequestResponse) => Promise<void>;
  handleRejectRequest: (requestId: string) => Promise<void>;
  handleSendFriendRequest: (toUser: { id: string; username: string }) => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  openDmFromPreview: (preview: DmPreview) => void;
  openGroupFromPreview: (preview: DmPreview) => void;
  closeDm: (conversationId: string) => Promise<void>;
  favoriteGifUrls: Set<string>;
  toggleFavoriteGif: (gifUrl: string, previewUrl?: string) => Promise<void>;
  addSystemMessage: (conversationId: string, content: string, systemType: SystemMessageType) => void;
}
