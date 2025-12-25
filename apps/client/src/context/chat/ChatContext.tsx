import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../AuthContext";
import { usePresence } from "../PresenceContext";
import { centralWebSocketService } from "../../core/network/CentralWebSocketService";
import { conversationService } from "../../features/chat/conversations";
import { useFriends } from "../../hooks/useFriends";
import { useChatMessages } from "../../hooks/useChatMessages";
import { useGroups } from "../../hooks/useGroups";
import type { Friend, DmPreview } from "../../types/index";
import type { ChatContextType } from "./types";
import { useChatUIState } from "./useChatUIState";
import { useGroupOpen } from "./useGroupOpen";
import { useChatWebSocket } from "./useChatWebSocket";

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, keys } = useAuth();
  const { userPresence } = usePresence();

  const onlineUsers = new Set(userPresence.keys());

  const friendsLogic = useFriends();
  const chatLogic = useChatMessages(friendsLogic.friendsList);
  const groupsLogic = useGroups();
  const loadGroupPreviews = groupsLogic.loadGroupPreviews;

  const [isConnected, setIsConnected] = useState(centralWebSocketService.isConnected());
  const [hasConnectedOnce, setHasConnectedOnce] = useState(centralWebSocketService.isConnected());

  const uiState = useChatUIState();

  const { openGroupFromPreview } = useGroupOpen({
    userId: user?.id,
    userKeys: keys,
    setSidebarView: uiState.setSidebarView,
    setIsLoadingChat: chatLogic.setIsLoadingChat,
    setChatMessages: chatLogic.setChatMessages,
    setActiveChat: chatLogic.setActiveChat,
    setUnreadCounts: chatLogic.setUnreadCounts,
    setDmPreviews: chatLogic.setDmPreviews,
    setError: uiState.setError,
  });

  useChatWebSocket({
    userId: user?.id,
    userKeys: keys,
    activeChat: chatLogic.activeChat,
    friendsLogic: {
      loadFriendRequests: friendsLogic.loadFriendRequests,
      onFriendAccepted: friendsLogic.onFriendAccepted,
      onFriendRemoved: friendsLogic.onFriendRemoved,
      setFriendsList: friendsLogic.setFriendsList,
    },
    chatLogic: {
      handleIncomingMessage: chatLogic.handleIncomingMessage,
      setChatMessages: chatLogic.setChatMessages,
      setActiveChat: chatLogic.setActiveChat,
      setDmPreviews: chatLogic.setDmPreviews,
      setUnreadCounts: chatLogic.setUnreadCounts,
    },
    loadGroupPreviews,
    setSuccessMessage: uiState.setSuccessMessage,
    setTypingUsers: uiState.setTypingUsers,
    setIsConnected,
    setHasConnectedOnce,
  });

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
    uiState.setSidebarView("dms");
  };

  const createGroup = async (data: { name: string; icon?: string; memberIds: string[] }) => {
    await groupsLogic.createGroup({
      name: data.name,
      icon: data.icon,
      memberIds: data.memberIds,
      friends: friendsLogic.friendsList,
    });
  };

  const closeDm = async (conversationId: string) => {
    chatLogic.setDmPreviews(prev => prev.filter(p => p.conversationId !== conversationId));
    try {
      await conversationService.hideConversation(conversationId);
    } catch (err) {
      console.error("Failed to hide conversation:", err);
    }
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

  const value: ChatContextType = {
    sidebarView: uiState.sidebarView,
    setSidebarView: uiState.setSidebarView,

    ...friendsLogic,
    ...chatLogic,

    isConnected,
    hasConnectedOnce,
    onlineUsers,
    typingUsers: uiState.typingUsers,

    contextMenu: uiState.contextMenu,
    setContextMenu: uiState.setContextMenu,
    messageContextMenu: uiState.messageContextMenu,
    setMessageContextMenu: uiState.setMessageContextMenu,
    editingMessageId: uiState.editingMessageId,
    setEditingMessageId: uiState.setEditingMessageId,
    dmContextMenu: uiState.dmContextMenu,
    setDmContextMenu: uiState.setDmContextMenu,
    groupContextMenu: uiState.groupContextMenu,
    setGroupContextMenu: uiState.setGroupContextMenu,
    profileView: uiState.profileView,
    setProfileView: uiState.setProfileView,
    showProfilePanel: uiState.showProfilePanel,
    setShowProfilePanel: uiState.setShowProfilePanel,
    verifyModal: uiState.verifyModal,
    setVerifyModal: uiState.setVerifyModal,
    error: uiState.error,
    setError: uiState.setError,
    successMessage: uiState.successMessage,
    setSuccessMessage: uiState.setSuccessMessage,
    droppedFile: uiState.droppedFile,
    setDroppedFile: uiState.setDroppedFile,

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
