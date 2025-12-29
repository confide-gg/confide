import { useEffect, useRef, useState } from "react";
import { useChat } from "../../context/chat";
import { useCall } from "../calls/context";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { MessageContextMenu } from "./MessageContextMenu";
import { CallHeader } from "../calls/CallHeader";
import { useMessages } from "../../hooks/queries";
import { EmojiPicker } from "./EmojiPicker";

export function ChatArea() {
  const {
    activeChat,
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
  const { callState } = useCall();
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  useMessages(activeChat?.conversationId || null);

  const isInCallWithActiveChat =
    (callState.status === "active" || callState.status === "left") &&
    activeChat &&
    callState.peer_id === activeChat.visitorId;
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

  if (!activeChat) {
    return null;
  }

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

  return (
    <div className="flex flex-col h-full">
      <ChatHeader />
      {isInCallWithActiveChat && <CallHeader />}
      <ChatMessages />
      <TypingIndicator />
      <ChatInput />
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
