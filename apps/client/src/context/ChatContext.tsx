
import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useAuth, getPrekeySecrets } from "./AuthContext";
import { usePresence } from "./PresenceContext";
import { centralWebSocketService } from "../core/network/CentralWebSocketService";
import { cryptoService } from "../core/crypto/crypto";
import { keyService } from "../core/crypto/KeyService";
import { initNotifications, playFriendRequestSound, NotificationService } from "../utils/notifications";
import { messageService } from "../features/chat/messages";
import type {
  Friend, FriendRequestResponse, ActiveChat, DecryptedMessage, SidebarView,
  ContextMenuData, MessageContextMenuData, DmContextMenuData, GroupContextMenuData, ReplyTo,
  TimedMessageDuration, ProfileViewData, DmPreview, SystemMessageType,
} from "../types/index";
import type {
  Reaction,
} from "../features/chat/types";

import { useFriends } from "../hooks/useFriends";
import { useChatMessages } from "../hooks/useChatMessages";
import { useGroups } from "../hooks/useGroups";
import { groupService } from "../features/groups/groupService";
import { conversationService } from "../features/chat/conversations";


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

  // Connection / Status
  isConnected: boolean;
  hasConnectedOnce: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, ReturnType<typeof setTimeout>>;

  // UI State
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

  // Methods
  openChat: (friend: Friend) => Promise<void>;
  createGroup: (data: { name: string; icon?: string; memberIds: string[] }) => Promise<void>;
  removeFriend: (friend: Friend) => Promise<void>;
  sendMessage: (content?: string) => Promise<void>;
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
  const groupsLogic = useGroups();
  const loadGroupPreviews = groupsLogic.loadGroupPreviews;

  // --- Local State ---
  const [isConnected, setIsConnected] = useState(centralWebSocketService.isConnected());
  const [hasConnectedOnce, setHasConnectedOnce] = useState(centralWebSocketService.isConnected());
  const [typingUsers, setTypingUsers] = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [sidebarView, setSidebarView] = useState<SidebarView>("friends");
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);

  useEffect(() => {
    return () => {
      typingUsers.forEach(timeout => clearTimeout(timeout));
    };
  }, []);
  const [messageContextMenu, setMessageContextMenu] = useState<MessageContextMenuData | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [dmContextMenu, setDmContextMenu] = useState<DmContextMenuData | null>(null);
  const [groupContextMenu, setGroupContextMenu] = useState<GroupContextMenuData | null>(null);
  const [profileView, setProfileView] = useState<ProfileViewData | null>(null);
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [verifyModal, setVerifyModal] = useState<VerifyModalData | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Typing logic
  const handleTyping = () => {
    if (chatLogic.activeChat) {
      centralWebSocketService.sendTyping(chatLogic.activeChat.conversationId, true);
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

  const openGroupFromPreview = async (preview: DmPreview) => {
    if (!user || !keys) return;
    setSidebarView("dms");
    chatLogic.setIsLoadingChat(true);
    chatLogic.setChatMessages([]);
    chatLogic.setActiveChat(null);
    try {
      const convs = await conversationService.getConversations();
      const conv = convs.find((c) => c.id === preview.conversationId);
      if (!conv) throw new Error("Conversation not found");

      const conversationKey = await cryptoService.decryptFromSender(
        keys.kem_secret_key,
        conv.encrypted_sender_key
      );

      let groupName = preview.groupName || "Group";
      let groupIcon = preview.groupIcon;
      if (conv.encrypted_metadata && conv.encrypted_metadata.length > 0) {
        try {
          const plaintext = await cryptoService.decryptWithKey(conversationKey, conv.encrypted_metadata);
          const parsed = JSON.parse(cryptoService.bytesToString(plaintext));
          if (parsed && typeof parsed.name === "string" && parsed.name.trim()) {
            groupName = parsed.name.trim();
          }
          if (parsed && typeof parsed.icon === "string" && parsed.icon.trim()) {
            groupIcon = parsed.icon.trim();
          }
        } catch {
        }
      }

      let memberUsernames: string[] = preview.memberUsernames || [];
      try {
        const members = await groupService.getMembers(preview.conversationId);
        memberUsernames = members.map((m) => m.user.username);
      } catch {
      }

      chatLogic.setActiveChat({
        visitorId: preview.conversationId,
        visitorUsername: groupName,
        conversationId: preview.conversationId,
        conversationKey,
        isGroup: true,
        groupName,
        groupOwnerId: conv.owner_id || null,
        groupIcon,
        memberUsernames,
      });

      chatLogic.setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(preview.conversationId);
        return next;
      });

      chatLogic.setDmPreviews((prev) => {
        const idx = prev.findIndex((p) => p.conversationId === preview.conversationId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            isGroup: true,
            groupName,
            groupOwnerId: conv.owner_id || null,
            groupIcon,
            memberUsernames,
            visitorId: preview.conversationId,
            visitorUsername: groupName,
          };
          return next;
        }
        return [...prev, {
          ...preview,
          isGroup: true,
          groupName,
          groupOwnerId: conv.owner_id || null,
          groupIcon,
          memberUsernames,
          visitorId: preview.conversationId,
          visitorUsername: groupName,
        }];
      });

      centralWebSocketService.subscribeConversation(preview.conversationId);

      const msgs = await messageService.getMessages(preview.conversationId, { limit: 50 });
      const decryptedMsgs: DecryptedMessage[] = [];

      const members = await groupService.getMembers(preview.conversationId);
      const nameMap = new Map(members.map((m) => [m.user.id, m.user.username]));

      const msgMap = new Map<string, { content: string; senderName: string; isSystem?: boolean; messageType?: string }>();
      for (const msg of msgs) {
        const isSystemMessage = msg.message_type && msg.message_type !== "text";
        if (isSystemMessage) {
          const actorName = msg.sender_id === user.id ? "You" : (nameMap.get(msg.sender_id) || "Someone");
          let content = "";
          try {
            const payload = JSON.parse(cryptoService.bytesToString(msg.encrypted_content));
            if (msg.message_type === "group_member_added" && Array.isArray(payload.added_user_ids)) {
              const names = payload.added_user_ids.map((id: string) => nameMap.get(id) || "Someone");
              content = `${actorName} added ${names.join(", ")}`;
            } else if (msg.message_type === "group_member_removed" && payload.removed_user_id) {
              const name = nameMap.get(payload.removed_user_id) || "Someone";
              content = `${actorName} removed ${name}`;
            } else if (msg.message_type === "group_member_left" && payload.user_id) {
              const name = payload.user_id === user.id ? "You" : (nameMap.get(payload.user_id) || "Someone");
              content = `${name} left the group`;
            } else if (msg.message_type === "group_owner_changed" && payload.new_owner_id) {
              const name = nameMap.get(payload.new_owner_id) || "Someone";
              content = `${actorName} made ${name} the owner`;
            }
          } catch {
          }
          msgMap.set(msg.id, { content, senderName: actorName, isSystem: true, messageType: msg.message_type });
          continue;
        }
        try {
          const decrypted = await cryptoService.decryptWithKey(conversationKey, msg.encrypted_content);
          const content = cryptoService.bytesToString(decrypted);
          const senderName = nameMap.get(msg.sender_id) || "Unknown";
          msgMap.set(msg.id, { content, senderName, isSystem: false });
        } catch {
          msgMap.set(msg.id, { content: "[Unable to decrypt]", senderName: "Unknown", isSystem: false });
        }
      }

      for (const msg of msgs) {
        const decrypted = msgMap.get(msg.id)!;
        if (decrypted.isSystem) {
          decryptedMsgs.push({
            id: msg.id,
            senderId: msg.sender_id,
            senderName: decrypted.senderName,
            content: decrypted.content,
            createdAt: msg.created_at,
            isMine: msg.sender_id === user.id,
            isSystem: true,
            systemType: msg.message_type as SystemMessageType,
            callDurationSeconds: msg.call_duration_seconds,
            reactions: [],
          });
          continue;
        }

        let replyToMsg: DecryptedMessage["replyTo"];
        if (msg.reply_to_id) {
          const replyData = msgMap.get(msg.reply_to_id);
          if (replyData && !replyData.isSystem) {
            replyToMsg = {
              id: msg.reply_to_id,
              content: replyData.content,
              senderName: replyData.senderName,
            };
          }
        }

        decryptedMsgs.push({
          id: msg.id,
          senderId: msg.sender_id,
          senderName: decrypted.senderName,
          content: decrypted.content,
          createdAt: msg.created_at,
          isMine: msg.sender_id === user.id,
          isGif: decrypted.content.startsWith("https://") && decrypted.content.includes("tenor"),
          expiresAt: msg.expires_at,
          replyToId: msg.reply_to_id,
          replyTo: replyToMsg,
          reactions: msg.reactions.map((r) => ({
            id: r.id,
            userId: r.user_id,
            messageId: r.message_id,
            emoji: r.emoji,
            createdAt: r.created_at,
          })),
          editedAt: msg.edited_at,
          pinnedAt: msg.pinned_at,
        });
      }
      chatLogic.setChatMessages(decryptedMsgs.reverse());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      chatLogic.setIsLoadingChat(false);
    }
  };

  const createGroup = async (data: { name: string; icon?: string; memberIds: string[] }) => {
    await groupsLogic.createGroup({
      name: data.name,
      icon: data.icon,
      memberIds: data.memberIds,
      friends: friendsLogic.friendsList,
    });
  };

  useEffect(() => {
    if (user && keys) {
      groupsLogic.loadGroupPreviews();
    }
  }, [user, keys, groupsLogic.loadGroupPreviews]);

  useEffect(() => {
    if (groupsLogic.groupPreviews.length === 0) return;
    chatLogic.setDmPreviews((prev) => {
      const nonGroups = prev.filter((p) => !p.isGroup);
      const merged = [...nonGroups, ...groupsLogic.groupPreviews];
      const seen = new Set<string>();
      const deduped = merged.filter((p) => {
        if (seen.has(p.conversationId)) return false;
        seen.add(p.conversationId);
        return true;
      });
      deduped.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
      return deduped;
    });
  }, [groupsLogic.groupPreviews]);

  const closeDm = (conversationId: string) => {
    chatLogic.setDmPreviews(prev => prev.filter(p => p.conversationId !== conversationId));
  };


  // --- WebSocket Listener ---
  useEffect(() => {
    const unsubConnect = centralWebSocketService.onConnect(() => {
      setIsConnected(true);
      setHasConnectedOnce(true);
    });
    const unsubDisconnect = centralWebSocketService.onDisconnect(() => setIsConnected(false));

    // Initial check
    const initiallyConnected = centralWebSocketService.isConnected();
    setIsConnected(initiallyConnected);
    if (initiallyConnected) {
      setHasConnectedOnce(true);
    }

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

    const unsubscribe = centralWebSocketService.onMessage((message) => {
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
          if (message.data.conversation_id) {
            chatLogic.handleIncomingMessage({
              ...message.data,
              conversation_id: message.data.conversation_id // ensure string
            });
          }
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
                const msgJson = cryptoService.bytesToString(msgData.encrypted_content);
                const parsedMsg = JSON.parse(msgJson);

                const keyResponse = await messageService.getMessageKey(msgData.conversation_id, msgData.message_id);

                let content: string;

                if (parsedMsg.chain_id !== undefined && parsedMsg.iteration !== undefined) {
                  if (keyResponse.encrypted_key) {
                    const senderKeyState = await cryptoService.decryptFromSender(keys.kem_secret_key, keyResponse.encrypted_key);
                    const contentBytes = await cryptoService.decryptGroupMessage(
                      senderKeyState,
                      parsedMsg.chain_id,
                      parsedMsg.iteration,
                      parsedMsg.ciphertext
                    );
                    content = cryptoService.bytesToString(contentBytes);
                  } else {
                    throw new Error("No key for group message");
                  }
                } else {
                  if (keyResponse.encrypted_key) {
                    const messageKey = await cryptoService.decryptFromSender(keys.kem_secret_key, keyResponse.encrypted_key);
                    const contentBytes = await cryptoService.decryptWithKey(messageKey, parsedMsg.ciphertext);
                    content = cryptoService.bytesToString(contentBytes);
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
        case "message_pinned":
          if (chatLogic.activeChat && chatLogic.activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages(prev => prev.map(m =>
              m.id === message.data.message_id
                ? { ...m, pinnedAt: message.data.pinned_at }
                : m
            ));
          }
          break;
        case "message_unpinned":
          if (chatLogic.activeChat && chatLogic.activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages(prev => prev.map((m: DecryptedMessage) =>
              m.id === message.data.message_id
                ? { ...m, pinnedAt: null }
                : m
            ));
          }
          break;
        case "reaction_added":
          if (chatLogic.activeChat && chatLogic.activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages(prev => prev.map((m: DecryptedMessage) => {
              if (m.id !== message.data.message_id) return m;
              if (m.reactions.some((r: Reaction) => r.userId === message.data.user_id && r.emoji === message.data.emoji)) return m;
              return { ...m, reactions: [...m.reactions, { id: message.data.id, userId: message.data.user_id, messageId: message.data.message_id, emoji: message.data.emoji, createdAt: new Date().toISOString() }] };
            }));
          }
          break;
        case "reaction_removed":
          if (chatLogic.activeChat && chatLogic.activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages(prev => prev.map((m: DecryptedMessage) => {
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

                  const ratchetState = await cryptoService.acceptRatchetSession(
                    keys.kem_secret_key,
                    prekeySecrets.signedPrekey.secret_key,
                    null,
                    key_bundle
                  );

                  chatLogic.setActiveChat((prev: ActiveChat | null) => prev ? { ...prev, ratchetState } : null);

                  const encryptedState = await cryptoService.encryptData(keys.kem_secret_key, ratchetState);
                  await keyService.saveSession(conversation_id, from_user_id, { encrypted_state: encryptedState });
                } catch (err) {
                  console.error("Failed to accept key exchange:", err);
                }
              })();
            }
          }
          break;
        case "group_created":
        case "group_member_added":
        case "group_metadata_updated":
          loadGroupPreviews();
          break;
        case "group_owner_changed":
          {
            const { conversation_id, new_owner_id } = message.data;
            chatLogic.setDmPreviews((prev) =>
              prev.map((p) =>
                p.conversationId === conversation_id ? { ...p, groupOwnerId: new_owner_id } : p
              )
            );
            chatLogic.setActiveChat((prev) =>
              prev && prev.isGroup && prev.conversationId === conversation_id
                ? { ...prev, groupOwnerId: new_owner_id }
                : prev
            );
            loadGroupPreviews();
          }
          break;
        case "group_member_removed":
          {
            const { conversation_id, user_id } = message.data;
            if (user && user_id === user.id) {
              chatLogic.setDmPreviews((prev) => prev.filter((p) => p.conversationId !== conversation_id));
              chatLogic.setUnreadCounts((prev) => {
                const next = new Map(prev);
                next.delete(conversation_id);
                return next;
              });
              chatLogic.setActiveChat((prev) =>
                prev && prev.isGroup && prev.conversationId === conversation_id ? null : prev
              );
            } else {
              loadGroupPreviews();
            }
          }
          break;
        case "group_member_left":
          {
            const { conversation_id, user_id } = message.data;
            if (user && user_id === user.id) {
              chatLogic.setDmPreviews((prev) => prev.filter((p) => p.conversationId !== conversation_id));
              chatLogic.setUnreadCounts((prev) => {
                const next = new Map(prev);
                next.delete(conversation_id);
                return next;
              });
              chatLogic.setActiveChat((prev) =>
                prev && prev.isGroup && prev.conversationId === conversation_id ? null : prev
              );
            } else {
              loadGroupPreviews();
            }
          }
          break;
        case "group_deleted":
          {
            const { conversation_id } = message.data;
            chatLogic.setDmPreviews((prev) => prev.filter((p) => p.conversationId !== conversation_id));
            chatLogic.setUnreadCounts((prev) => {
              const next = new Map(prev);
              next.delete(conversation_id);
              return next;
            });
            chatLogic.setActiveChat((prev) =>
              prev && prev.isGroup && prev.conversationId === conversation_id ? null : prev
            );
          }
          break;
      }
    });
    return () => unsubscribe();
  }, [friendsLogic, chatLogic, user, keys, loadGroupPreviews]);

  // Context Value
  const value: ChatContextType = {
    sidebarView, setSidebarView,

    // Friends
    ...friendsLogic,

    // Chat
    ...chatLogic,

    // Connection
    isConnected,
    hasConnectedOnce,
    onlineUsers,
    typingUsers,

    // UI
    contextMenu, setContextMenu,
    messageContextMenu, setMessageContextMenu,
    editingMessageId, setEditingMessageId,
    dmContextMenu, setDmContextMenu,
    groupContextMenu, setGroupContextMenu,
    profileView, setProfileView,
    showProfilePanel, setShowProfilePanel,
    verifyModal, setVerifyModal,
    error, setError,
    successMessage, setSuccessMessage,

    // Methods
    handleTyping,
    openDmFromPreview,
    openGroupFromPreview,
    createGroup,
    closeDm,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};