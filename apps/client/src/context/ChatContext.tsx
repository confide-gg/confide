
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth, getPrekeySecrets } from "./AuthContext";
import { usePresence } from "./PresenceContext";
import { wsService, crypto, keys as keysApi } from "../api";
import { initNotifications, playFriendRequestSound, NotificationService } from "../utils/notifications";
import type {
  Friend, FriendRequestResponse, ActiveChat, DecryptedMessage, SidebarView,
  ContextMenuData, MessageContextMenuData, DmContextMenuData, ReplyTo,
  TimedMessageDuration, ProfileViewData, DmPreview, SystemMessageType
} from "../types";

import { useFriends } from "../hooks/useFriends";
import { useChatMessages } from "../hooks/useChatMessages";


interface VerifyModalData {
  friendId: string;
  friendUsername: string;
  theirIdentityKey: number[];
}

interface ChatContextType {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;

  // Friends
  friendsList: Friend[];
  friendRequests: FriendRequestResponse[];
  sentRequests: Set<string>;
  searchResults: { id: string; username: string; kem_public_key: number[] }[];
  isSearching: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  confirmRemove: Friend | null;
  setConfirmRemove: (friend: Friend | null) => void;

  // Chat
  activeChat: ActiveChat | null;
  setActiveChat: (chat: ActiveChat | null) => void;
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
  unreadCounts: Map<string, number>;

  // Connection / Status
  isConnected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, ReturnType<typeof setTimeout>>;

  // UI State
  contextMenu: ContextMenuData | null;
  setContextMenu: (menu: ContextMenuData | null) => void;
  messageContextMenu: MessageContextMenuData | null;
  setMessageContextMenu: (menu: MessageContextMenuData | null) => void;
  dmContextMenu: DmContextMenuData | null;
  setDmContextMenu: (menu: DmContextMenuData | null) => void;
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

  // Methods
  openChat: (friend: Friend) => Promise<void>;
  removeFriend: (friend: Friend) => Promise<void>;
  sendMessage: (content?: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  handleTyping: () => void;
  loadFriendRequests: () => Promise<void>;
  handleAcceptRequest: (request: FriendRequestResponse) => Promise<void>;
  handleRejectRequest: (requestId: string) => Promise<void>;
  handleSendFriendRequest: (toUser: { id: string; username: string }) => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  openDmFromPreview: (preview: DmPreview) => void;
  closeDm: (conversationId: string) => void;
  favoriteGifUrls: Set<string>;
  toggleFavoriteGif: (gifUrl: string, previewUrl?: string) => Promise<void>;
  addSystemMessage: (conversationId: string, content: string, systemType: SystemMessageType) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, keys } = useAuth();
  const { userPresence } = usePresence(); // Removed isOnline if unused

  // Derived set for compatibility
  const onlineUsers = new Set(userPresence.keys());

  // --- Hooks ---
  const friendsLogic = useFriends();
  const chatLogic = useChatMessages(friendsLogic.friendsList);

  // --- Local State ---
  const [isConnected, setIsConnected] = useState(wsService.isConnected());
  const [typingUsers, setTypingUsers] = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [sidebarView, setSidebarView] = useState<SidebarView>("friends");
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<MessageContextMenuData | null>(null);
  const [dmContextMenu, setDmContextMenu] = useState<DmContextMenuData | null>(null);
  const [profileView, setProfileView] = useState<ProfileViewData | null>(null);
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [verifyModal, setVerifyModal] = useState<VerifyModalData | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Typing logic
  const handleTyping = () => {
    if (chatLogic.activeChat) {
      wsService.sendTyping(chatLogic.activeChat.conversationId, true);
    }
  };

  const openDmFromPreview = (preview: DmPreview) => {
    const friend = friendsLogic.friendsList.find(f => f.id === preview.visitorId);
    if (friend) {
      chatLogic.openChat(friend);
    } else {
      chatLogic.openChat({ id: preview.visitorId, username: preview.visitorUsername } as Friend);
    }
    setSidebarView("dms");
  };

  const closeDm = (conversationId: string) => {
    chatLogic.setDmPreviews(prev => prev.filter(p => p.conversationId !== conversationId));
  };


  // --- WebSocket Listener ---
  useEffect(() => {
    const unsubConnect = wsService.onConnect(() => setIsConnected(true));
    const unsubDisconnect = wsService.onDisconnect(() => setIsConnected(false));

    // Initial check
    setIsConnected(wsService.isConnected());

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, []);

  // --- WebSocket Listener ---
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await NotificationService.initialize();
      } catch (error) {
        await initNotifications();
      }
    };

    initializeNotifications();

    const unsubscribe = wsService.onMessage((message) => {
      switch (message.type) {
        case "friend_request":
          friendsLogic.loadFriendRequests();
          playFriendRequestSound();
          break;
        case "friend_accepted":
          friendsLogic.onFriendAccepted(
            message.data.by_user_id,
            message.data.by_username
          );
          setSuccessMessage(`Friend request accepted by ${message.data.by_username}`);
          break;
        case "friend_removed":
          friendsLogic.onFriendRemoved(message.data.by_user_id);
          break;
        case "key_update":
          friendsLogic.setFriendsList(prev => prev.map(f => {
            if (f.id === message.data.user_id) {
              return { ...f, kem_public_key: message.data.kem_public_key };
            }
            return f;
          }));
          break;
        case "new_message":
          chatLogic.handleIncomingMessage(message.data);
          break;
        case "message_deleted":
          if (chatLogic.activeChat && chatLogic.activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages(prev => prev.filter(m => m.id !== message.data.message_id));
          }
          break;
        case "message_edited":
          if (chatLogic.activeChat && chatLogic.activeChat.conversationId === message.data.conversation_id && keys) {
            (async () => {
              try {
                const msgData = message.data;
                const msgJson = crypto.bytesToString(msgData.encrypted_content);
                const parsedMsg = JSON.parse(msgJson);

                const keyResponse = await import("../api").then(api =>
                  api.messages.getMessageKey(msgData.conversation_id, msgData.message_id)
                );

                let content: string;

                if (parsedMsg.chain_id !== undefined && parsedMsg.iteration !== undefined) {
                  if (keyResponse.encrypted_key) {
                    const senderKeyState = await crypto.decryptFromSender(keys.kem_secret_key, keyResponse.encrypted_key);
                    const contentBytes = await crypto.decryptGroupMessage(
                      senderKeyState,
                      parsedMsg.chain_id,
                      parsedMsg.iteration,
                      parsedMsg.ciphertext
                    );
                    content = crypto.bytesToString(contentBytes);
                  } else {
                    throw new Error("No key for group message");
                  }
                } else {
                  if (keyResponse.encrypted_key) {
                    const messageKey = await crypto.decryptFromSender(keys.kem_secret_key, keyResponse.encrypted_key);
                    const contentBytes = await crypto.decryptWithKey(messageKey, parsedMsg.ciphertext);
                    content = crypto.bytesToString(contentBytes);
                  } else {
                    throw new Error("No key for DM message");
                  }
                }

                chatLogic.setChatMessages(prev => prev.map(m =>
                  m.id === msgData.message_id
                    ? { ...m, content, editedAt: msgData.edited_at }
                    : m
                ));
              } catch (err) {
                console.error("Failed to decrypt edited message:", err);
              }
            })();
          }
          break;
        case "reaction_added":
          if (chatLogic.activeChat && chatLogic.activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages(prev => prev.map(m => {
              if (m.id !== message.data.message_id) return m;
              if (m.reactions.some(r => r.userId === message.data.user_id && r.emoji === message.data.emoji)) return m;
              return { ...m, reactions: [...m.reactions, { id: message.data.id, userId: message.data.user_id, emoji: message.data.emoji }] };
            }));
          }
          break;
        case "reaction_removed":
          if (chatLogic.activeChat && chatLogic.activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages(prev => prev.map(m => {
              if (m.id !== message.data.message_id) return m;
              return { ...m, reactions: m.reactions.filter(r => !(r.userId === message.data.user_id && r.emoji === message.data.emoji)) };
            }));
          }
          break;
        case "typing":
          {
            const { user_id, is_typing, conversation_id } = message.data;
            if (chatLogic.activeChat && chatLogic.activeChat.conversationId === conversation_id && user_id !== user?.id && user_id) {
              if (is_typing) {
                setTypingUsers(prev => {
                  const next = new Map(prev);
                  if (next.has(user_id)) clearTimeout(next.get(user_id)!);
                  const timeout = setTimeout(() => {
                    setTypingUsers(p => {
                      const n = new Map(p);
                      n.delete(user_id);
                      return n;
                    });
                  }, 3000);
                  next.set(user_id, timeout);
                  return next;
                });
              } else {
                setTypingUsers(prev => {
                  const next = new Map(prev);
                  if (next.has(user_id)) clearTimeout(next.get(user_id)!);
                  next.delete(user_id);
                  return next;
                });
              }
            }
          }
          break;
        case "key_exchange":
          {
            const { from_user_id, conversation_id, key_bundle } = message.data;
            if (chatLogic.activeChat && chatLogic.activeChat.conversationId === conversation_id && keys) {
              (async () => {
                try {
                  const prekeySecrets = await getPrekeySecrets();
                  if (!prekeySecrets) return;

                  const ratchetState = await crypto.acceptRatchetSession(
                    keys.kem_secret_key,
                    prekeySecrets.signedPrekey.secret_key,
                    null,
                    key_bundle
                  );

                  chatLogic.setActiveChat(prev => prev ? { ...prev, ratchetState } : null);

                  const encryptedState = await crypto.encryptData(keys.kem_secret_key, ratchetState);
                  await keysApi.saveSession(conversation_id, from_user_id, { encrypted_state: encryptedState });
                } catch (err) {
                  console.error("Failed to accept key exchange:", err);
                }
              })();
            }
          }
          break;
      }
    });
    return () => unsubscribe();
  }, [friendsLogic, chatLogic, user, keys]);

  // Context Value
  const value: ChatContextType = {
    sidebarView, setSidebarView,

    // Friends
    ...friendsLogic,

    // Chat
    ...chatLogic,

    // Connection
    isConnected,
    onlineUsers,
    typingUsers,

    // UI
    contextMenu, setContextMenu,
    messageContextMenu, setMessageContextMenu,
    dmContextMenu, setDmContextMenu,
    profileView, setProfileView,
    showProfilePanel, setShowProfilePanel,
    verifyModal, setVerifyModal,
    error, setError,
    successMessage, setSuccessMessage,

    // Methods
    handleTyping,
    openDmFromPreview,
    closeDm,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};
