import { useState, useEffect } from "react";
import type {
  SidebarView,
  ContextMenuData,
  MessageContextMenuData,
  DmContextMenuData,
  GroupContextMenuData,
  ProfileViewData,
} from "../../types/index";
import type { VerifyModalData } from "./types";

export function useChatUIState() {
  const [sidebarView, setSidebarView] = useState<SidebarView>("friends");
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<MessageContextMenuData | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [dmContextMenu, setDmContextMenu] = useState<DmContextMenuData | null>(null);
  const [groupContextMenu, setGroupContextMenu] = useState<GroupContextMenuData | null>(null);
  const [profileView, setProfileView] = useState<ProfileViewData | null>(null);
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [verifyModal, setVerifyModal] = useState<VerifyModalData | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    return () => {
      typingUsers.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  return {
    sidebarView,
    setSidebarView,
    contextMenu,
    setContextMenu,
    messageContextMenu,
    setMessageContextMenu,
    editingMessageId,
    setEditingMessageId,
    dmContextMenu,
    setDmContextMenu,
    groupContextMenu,
    setGroupContextMenu,
    profileView,
    setProfileView,
    showProfilePanel,
    setShowProfilePanel,
    verifyModal,
    setVerifyModal,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    droppedFile,
    setDroppedFile,
    typingUsers,
    setTypingUsers,
  };
}
