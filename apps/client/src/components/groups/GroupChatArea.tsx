import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Pin, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/chat";
import { cryptoService } from "../../core/crypto/crypto";
import { groupService } from "../../features/groups/groupService";
import { ChatInput } from "../chat/ChatInput";
import { ChatMessages } from "../chat/ChatMessages";
import { MessageContextMenu } from "../chat/MessageContextMenu";
import { PinnedMessages } from "../chat/PinnedMessages";
import { TypingIndicator } from "../chat/TypingIndicator";
import { MessageSearch } from "../search";
import { Input } from "../ui/input";
import { AddGroupMembersModal } from "./AddGroupMembersModal";
import { GroupMemberList } from "./GroupMemberList";

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
  } = useChat();
  const { user } = useAuth();

  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

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

  const handleEmojiSelect = (emoji: { native: string }) => {
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

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="shrink-0 z-10 border-b border-border relative">
          <div className="flex items-center justify-between px-6 h-14">
            <div className="flex items-center gap-2 min-w-0">
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
            <div className="flex items-center gap-2">
              <MessageSearch conversationName={groupName} />
              {isOwner && (
                <button
                  onClick={() => setShowAddMembers(true)}
                  className="p-2 rounded-lg transition-colors hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Add members"
                >
                  <UserPlus className="w-5 h-5" />
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
                <Pin className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
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
      </div>

      <GroupMemberList
        conversationId={activeChat.conversationId}
        ownerId={activeChat.groupOwnerId || undefined}
        onOwnerIdChange={(newOwnerId) => {
          setActiveChat((prev) => (prev ? { ...prev, groupOwnerId: newOwnerId } : prev));
        }}
      />

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
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme="dark"
            previewPosition="none"
            skinTonePosition="none"
            perLine={8}
          />
        </div>
      )}
    </div>
  );
}
