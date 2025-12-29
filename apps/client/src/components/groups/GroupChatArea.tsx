import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/chat";
import { useCall } from "../calls/context";
import { cryptoService } from "../../core/crypto/crypto";
import { groupService } from "../../features/groups/groupService";
import { callService } from "../../features/calls/calls";
import { ChatInput } from "../chat/ChatInput";
import { ChatMessages } from "../chat/ChatMessages";
import { EmojiPicker } from "../chat/EmojiPicker";
import { MessageContextMenu } from "../chat/MessageContextMenu";
import { PinnedMessages } from "../chat/PinnedMessages";
import { TypingIndicator } from "../chat/TypingIndicator";
import { MessageSearch } from "@/features/search";
import { Input } from "../ui/input";
import { AvatarPile } from "../ui/avatar-pile";
import { AddGroupMembersModal } from "./AddGroupMembersModal";
import { GroupCallButton, GroupCallHeader } from "../calls/group";
import type { ActiveGroupCallResponse } from "../calls/types";

export function GroupChatArea() {
  const {
    activeChat,
    setActiveChat,
    setDmPreviews,
    friendsList,
    messageContextMenu,
    setMessageContextMenu,
    deleteMessage,
    addReaction,
    pinMessage,
    unpinMessage,
    setReplyTo,
    chatMessages,
    setEditingMessageId,
    showProfilePanel,
    setShowProfilePanel,
  } = useChat();
  const { user, keys } = useAuth();
  const { groupCallState, startGroupCall, joinGroupCall } = useCall();

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [activeGroupCall, setActiveGroupCall] = useState<ActiveGroupCallResponse | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

  const checkActiveCall = useCallback(async () => {
    if (!activeChat?.conversationId) return;
    try {
      const call = await callService.getActiveGroupCall(activeChat.conversationId);
      setActiveGroupCall(call);
    } catch {
      setActiveGroupCall(null);
    }
  }, [activeChat?.conversationId]);

  useEffect(() => {
    checkActiveCall();
    const interval = setInterval(checkActiveCall, 10000);
    return () => clearInterval(interval);
  }, [checkActiveCall]);

  useEffect(() => {
    checkActiveCall();
  }, [groupCallState?.call_id, groupCallState?.status, checkActiveCall]);

  const handleStartCall = useCallback(async () => {
    if (!activeChat?.conversationId || !user?.id || !keys?.dsa_secret_key || !keys?.dsa_public_key)
      return;
    try {
      await startGroupCall({
        conversationId: activeChat.conversationId,
        userId: user.id,
        identityPublicKey: Array.from(keys.dsa_public_key),
        dsaSecretKey: Array.from(keys.dsa_secret_key),
      });
      checkActiveCall();
    } catch (e) {
      console.error("[GroupChat] Failed to start group call:", e);
    }
  }, [activeChat?.conversationId, user?.id, keys, startGroupCall, checkActiveCall]);

  const handleJoinCall = useCallback(async () => {
    if (!activeGroupCall?.call_id || !user?.id || !keys?.dsa_secret_key || !keys?.dsa_public_key)
      return;
    try {
      await joinGroupCall({
        callId: activeGroupCall.call_id,
        userId: user.id,
        identityPublicKey: Array.from(keys.dsa_public_key),
        dsaSecretKey: Array.from(keys.dsa_secret_key),
        announcement: [],
      });
      checkActiveCall();
    } catch (e) {
      console.error("[GroupChat] Failed to join group call:", e);
    }
  }, [activeGroupCall, user?.id, keys, joinGroupCall, checkActiveCall]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node) &&
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(e.target as Node)
      ) {
        setMessageContextMenu(null);
        setShowReactionPicker(false);
      } else if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node) &&
        !showReactionPicker
      ) {
        setMessageContextMenu(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMessageContextMenu(null);
        setShowReactionPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [setMessageContextMenu, showReactionPicker]);

  if (!activeChat || !activeChat.isGroup) return null;

  const groupName = activeChat.groupName || activeChat.visitorUsername || "Group";
  const isOwner = !!(activeChat.groupOwnerId && user?.id && activeChat.groupOwnerId === user.id);
  const canEditName = isOwner;

  const beginEdit = () => {
    if (!canEditName) return;
    setPendingName(groupName);
    setIsEditingName(true);
  };

  const cancelEdit = () => {
    setIsEditingName(false);
    setPendingName("");
  };

  const saveName = async () => {
    if (!canEditName) return;
    const nextName = pendingName.trim();
    if (!nextName || nextName === groupName) {
      cancelEdit();
      return;
    }
    const metadataBytes = cryptoService.stringToBytes(
      JSON.stringify({ name: nextName, icon: activeChat.groupIcon })
    );
    const encrypted_metadata = await cryptoService.encryptWithKey(
      activeChat.conversationKey,
      metadataBytes
    );
    await groupService.updateMetadata(activeChat.conversationId, { encrypted_metadata });
    setActiveChat((prev) =>
      prev
        ? { ...prev, groupName: nextName, visitorUsername: nextName, groupIcon: prev.groupIcon }
        : prev
    );
    setDmPreviews((prev) =>
      prev.map((p) =>
        p.conversationId === activeChat.conversationId
          ? { ...p, groupName: nextName, visitorUsername: nextName }
          : p
      )
    );
    setIsEditingName(false);
  };

  const handleReply = () => {
    if (messageContextMenu) {
      const msg = chatMessages.find((m) => m.id === messageContextMenu.messageId);
      if (msg) {
        setReplyTo({
          id: msg.id,
          content: msg.content,
          senderName: msg.senderName || "Unknown",
        });
      }
      setMessageContextMenu(null);
    }
  };

  const handleReact = () => {
    setShowReactionPicker(true);
  };

  const handleDelete = () => {
    if (messageContextMenu) {
      deleteMessage(messageContextMenu.messageId);
    }
    setMessageContextMenu(null);
  };

  const handlePin = () => {
    if (messageContextMenu) {
      pinMessage(messageContextMenu.messageId);
    }
    setMessageContextMenu(null);
  };

  const handleUnpin = () => {
    if (messageContextMenu) {
      unpinMessage(messageContextMenu.messageId);
    }
    setMessageContextMenu(null);
  };

  const handleEdit = () => {
    if (messageContextMenu) {
      setEditingMessageId(messageContextMenu.messageId);
    }
    setMessageContextMenu(null);
  };

  const handleEmojiSelect = (emoji: { native: string; id: string }) => {
    if (messageContextMenu) {
      addReaction(messageContextMenu.messageId, emoji.native);
    }
    setShowReactionPicker(false);
    setMessageContextMenu(null);
  };

  const handleJump = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      (element as HTMLElement).style.transition = "background-color 0.5s ease";
      (element as HTMLElement).style.backgroundColor = "#1a1a1a";
      setTimeout(() => {
        (element as HTMLElement).style.backgroundColor = "";
      }, 2000);
    }
    setShowPinned(false);
  };

  const isInGroupCall =
    groupCallState &&
    (groupCallState.status === "active" ||
      groupCallState.status === "ringing" ||
      groupCallState.status === "connecting" ||
      groupCallState.status === "left") &&
    groupCallState.conversation_id === activeChat.conversationId;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 z-10 border-b border-border relative">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <AvatarPile
              users={(activeChat.memberUsernames || []).map((username) => ({ name: username }))}
              size="md"
              max={3}
            />
            <div className="flex flex-col justify-center min-w-0">
              {isEditingName ? (
                <Input
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  className="h-8 bg-secondary/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveName();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  onBlur={() => cancelEdit()}
                />
              ) : (
                <button
                  type="button"
                  onClick={beginEdit}
                  className={`font-semibold text-base text-foreground truncate ${canEditName ? "hover:underline" : ""}`}
                >
                  {groupName}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MessageSearch conversationName={groupName} />
            <GroupCallButton
              conversationId={activeChat.conversationId}
              activeCall={activeGroupCall}
              isInCall={!!isInGroupCall}
              onStartCall={handleStartCall}
              onJoinCall={handleJoinCall}
            />
            {isOwner && (
              <button
                onClick={() => setShowAddMembers(true)}
                className="p-2 rounded-lg transition-colors hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Add members"
              >
                <FontAwesomeIcon icon="user-plus" className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowPinned(!showPinned)}
              className={`p-2 rounded-lg transition-colors ${
                showPinned
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
              title="Pinned Messages"
            >
              <FontAwesomeIcon icon="thumbtack" className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowProfilePanel(!showProfilePanel)}
              className={`p-2 rounded-lg transition-colors ${
                showProfilePanel
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
              title={showProfilePanel ? "Hide members" : "Show members"}
            >
              <FontAwesomeIcon icon="users" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      {isInGroupCall && <GroupCallHeader conversationId={activeChat.conversationId} />}
      {showPinned && (
        <PinnedMessages
          conversationId={activeChat.conversationId}
          onClose={() => setShowPinned(false)}
          onJump={handleJump}
        />
      )}
      <ChatMessages />
      <TypingIndicator />
      <ChatInput />

      <AddGroupMembersModal
        isOpen={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        conversationId={activeChat.conversationId}
        conversationKey={activeChat.conversationKey}
        friends={friendsList}
        maxTotalMembers={10}
        onAdded={() => {
          setShowAddMembers(false);
        }}
      />

      {messageContextMenu && (
        <div ref={contextMenuRef}>
          <MessageContextMenu
            data={messageContextMenu}
            onReply={handleReply}
            onReact={handleReact}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPin={handlePin}
            onUnpin={handleUnpin}
            onClose={() => setMessageContextMenu(null)}
          />
        </div>
      )}
      {showReactionPicker && messageContextMenu && (
        <div
          ref={reactionPickerRef}
          style={{
            position: "fixed",
            top: messageContextMenu.y,
            left: messageContextMenu.x + 160,
            zIndex: 1001,
          }}
        >
          <EmojiPicker onSelect={handleEmojiSelect} />
        </div>
      )}
    </div>
  );
}
