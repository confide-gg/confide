import { useState, useEffect, useRef, memo, useMemo } from "react";
import { Avatar } from "../ui/avatar";
import { formatDate } from "../../utils/formatters";
import { useChat } from "../../context/ChatContext";
import { usePresence } from "../../context/PresenceContext";
import { useAuth } from "../../context/AuthContext";
import { uploadService } from "../../features/uploads/UploadService";
import { GifModal } from "../common/GifModal";
import type { DecryptedMessage } from "../../types/index";

interface MessageProps {
  message: DecryptedMessage;
  showHeader: boolean;
}

export const Message = memo(function Message({ message, showHeader }: MessageProps) {
  const { setMessageContextMenu, addReaction, favoriteGifUrls, toggleFavoriteGif, setProfileView, editMessage, editingMessageId, setEditingMessageId } = useChat();
  const { isOnline } = usePresence();
  const { user, profile } = useAuth();
  const [expandedGif, setExpandedGif] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [editContent, setEditContent] = useState(message.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = editingMessageId === message.id;

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (message.isMine && user) {
      setProfileView({
        userId: user.id,
        username: user.username,
        isOnline: true,
      });
    } else if (!message.isMine) {
      setProfileView({
        userId: message.senderId,
        username: message.senderName || "Unknown",
        isOnline: isOnline(message.senderId),
      });
    }
  };

  useEffect(() => {
    if (!message.expiresAt) return;

    const updateTimeLeft = () => {
      const remaining = Math.max(0, new Date(message.expiresAt!).getTime() - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [message.expiresAt]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMessageContextMenu({
      x: e.clientX,
      y: e.clientY,
      messageId: message.id,
      isMine: message.isMine,
      content: message.content,
      isPinned: !!message.pinnedAt,
      isGif: !!message.isGif
    });
  };

  const handleQuickReact = (emoji: string) => {
    addReaction(message.id, emoji);
  };

  const handleStartEdit = () => {
    if (!message.isMine || message.isGif) return;
    setEditContent(message.content);
    setEditingMessageId(message.id);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent(message.content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      handleCancelEdit();
      return;
    }
    setIsSubmitting(true);
    try {
      await editMessage(message.id, editContent.trim());
      setEditingMessageId(null);
    } catch {
      setEditContent(message.content);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const renderContent = () => {
    if (message.isGif) {
      const isFavorite = favoriteGifUrls.has(message.content);
      return (
        <div className="relative inline-block group/gif max-w-xs">
          <img
            src={message.content}
            alt="GIF"
            className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity max-h-64 w-auto"
            loading="lazy"
            onClick={() => setExpandedGif(message.content)}
          />
          <button
            className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md backdrop-blur-sm transition-all opacity-0 group-hover/gif:opacity-100 ${isFavorite
              ? "bg-primary/80 text-primary-foreground hover:bg-primary"
              : "bg-black/50 text-white hover:bg-black/70"
              }`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteGif(message.content);
            }}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        </div>
      );
    }
    return <>{message.content}</>;
  };

  const formatTimeLeft = (seconds: number) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${seconds}s`;
  };

  const groupedReactions = useMemo(() => {
    return message.reactions.reduce((acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = [];
      }
      acc[r.emoji].push(r.userId);
      return acc;
    }, {} as Record<string, string[]>);
  }, [message.reactions]);

  return (
    <div
      id={message.id}
      className={`
        group relative flex gap-3 hover:bg-secondary/20 px-6 py-1 transition-colors duration-150
        ${showHeader ? "mt-2" : "mt-0"}
        ${message.expiresAt ? "opacity-90" : ""}
      `}
      onContextMenu={handleContextMenu}
    >
      {message.isMine && !message.isGif && !isEditing && (
        <div className="absolute right-6 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-1 bg-card border border-border rounded-sm shadow-md p-0.5">
          <button
            onClick={handleStartEdit}
            className="p-1 hover:bg-secondary/50 rounded transition-colors"
            title="Edit message"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
      <div className="w-8 shrink-0 flex items-start pt-0.5">
        {showHeader && (
          <>
            {message.isMine && profile?.avatar_url ? (
              <Avatar
                src={uploadService.getUploadUrl(profile.avatar_url)}
                fallback={message.senderName}
                size="sm"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleProfileClick}
              />
            ) : showHeader ? (
              <Avatar
                fallback={message.senderName || "?"}
                size="sm"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleProfileClick}
              />
            ) : null}
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className="text-sm font-medium text-foreground cursor-pointer hover:underline"
              onClick={handleProfileClick}
            >
              {message.senderName || "Unknown"}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
            {message.editedAt && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
            {message.expiresAt && timeLeft !== null && (
              <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-sm">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {formatTimeLeft(timeLeft)}
              </span>
            )}
          </div>
        )}
        {message.replyTo && (
          <div className="mb-1 rounded-sm bg-secondary/30 border-l-2 border-border/50 p-2 text-xs flex flex-col gap-0.5 max-w-full">
            <span className="font-medium text-foreground">{message.replyTo.senderName}</span>
            <span className="text-muted-foreground truncate">{message.replyTo.content}</span>
          </div>
        )}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={editInputRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              disabled={isSubmitting}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-border"
              rows={Math.min(editContent.split("\n").length + 1, 5)}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>escape to</span>
              <button
                onClick={handleCancelEdit}
                className="text-foreground hover:underline"
              >
                cancel
              </button>
              <span>• enter to</span>
              <button
                onClick={handleSaveEdit}
                disabled={isSubmitting}
                className="text-foreground hover:underline disabled:opacity-50"
              >
                {isSubmitting ? "saving..." : "save"}
              </button>
            </div>
          </div>
        ) : (
          <div className={`${message.expiresAt ? "border border-dashed border-muted-foreground/20 rounded-sm p-2 w-fit" : ""} ${message.isGif ? "" : "text-sm text-foreground break-words"}`}>
            {renderContent()}
          </div>
        )}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(groupedReactions).map(([emoji, userIds]) => (
              <button
                key={emoji}
                className="flex items-center gap-1 bg-secondary/30 hover:bg-secondary/50 border border-border/50 rounded-full px-2 py-0.5 text-xs transition-colors"
                onClick={() => handleQuickReact(emoji)}
              >
                <span>{emoji}</span>
                <span className="font-medium text-muted-foreground">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {expandedGif && (
        <GifModal gifUrl={expandedGif} onClose={() => setExpandedGif(null)} />
      )}
    </div>
  );
});