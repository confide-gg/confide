import { useState, useEffect, useRef, memo, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Avatar } from "../ui/avatar";
import { formatDate } from "../../utils/formatters";
import { useChat } from "../../context/chat";
import { usePresence } from "../../context/PresenceContext";
import { useAuth } from "../../context/AuthContext";
import { uploadService } from "../../features/uploads/UploadService";
import { GifModal } from "../common/GifModal";
import { AttachmentImage } from "./AttachmentImage";
import { AttachmentVideo } from "./AttachmentVideo";
import { AttachmentAudio } from "./AttachmentAudio";
import { AttachmentCode } from "./AttachmentCode";
import { attachmentDownloadService } from "../../features/attachments/AttachmentDownloadService";
import { formatReplyPreview } from "../../utils/messageUtils";
import type { DecryptedMessage } from "../../types/index";
import type { FileMetadata } from "../../features/attachments/AttachmentUploadService";

interface MessageProps {
  message: DecryptedMessage;
  showHeader: boolean;
}

const EMOJI_ONLY_REGEX =
  /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\u200D\s]+$/u;

function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const withoutSpaces = trimmed.replace(/\s/g, "");
  if (withoutSpaces.length === 0) return false;
  return EMOJI_ONLY_REGEX.test(trimmed);
}

function getEmojiCount(text: string): number {
  const matches = text.match(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu);
  return matches ? matches.length : 0;
}

export const Message = memo(function Message({ message, showHeader }: MessageProps) {
  const {
    setMessageContextMenu,
    addReaction,
    favoriteGifUrls,
    toggleFavoriteGif,
    setProfileView,
    editMessage,
    editingMessageId,
    setEditingMessageId,
  } = useChat();
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
      isGif: !!message.isGif,
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

  const isFileAttachment = (content: string): FileMetadata | null => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === "file" && parsed.file) {
        if (!parsed.file.url?.startsWith("s3://")) {
          return null;
        }
        if (parsed.file.name?.includes("/") || parsed.file.name?.includes("\\")) {
          return null;
        }
        return parsed as FileMetadata;
      }
    } catch {
      return null;
    }
    return null;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadFile = async (metadata: FileMetadata) => {
    try {
      await attachmentDownloadService.downloadAndSaveFile(metadata);
    } catch (err) {
      console.error("Failed to download file:", err);
      alert("Failed to download file. Please try again.");
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("application/pdf")) {
      return <FontAwesomeIcon icon="file" className="w-5 h-5" />;
    }
    if (mimeType.startsWith("video/")) {
      return <FontAwesomeIcon icon="video" className="w-5 h-5" />;
    }
    return <FontAwesomeIcon icon="file" className="w-5 h-5" />;
  };

  const renderContent = () => {
    const fileAttachment = isFileAttachment(message.content);

    if (fileAttachment) {
      const isImage = fileAttachment.file.mimeType.startsWith("image/");
      const isVideo = fileAttachment.file.mimeType.startsWith("video/");
      const isAudio = fileAttachment.file.mimeType.startsWith("audio/");
      const isCode =
        fileAttachment.file.mimeType.startsWith("text/") ||
        fileAttachment.file.mimeType === "application/x-typescript" ||
        fileAttachment.file.mimeType === "application/javascript" ||
        fileAttachment.file.mimeType === "application/json";

      if (isImage) {
        return <AttachmentImage metadata={fileAttachment} />;
      }

      if (isVideo) {
        return <AttachmentVideo metadata={fileAttachment} />;
      }

      if (isAudio) {
        return <AttachmentAudio metadata={fileAttachment} />;
      }

      if (isCode) {
        return <AttachmentCode metadata={fileAttachment} />;
      }

      return (
        <div className="flex items-center gap-3 p-3 bg-secondary/30 border border-border/50 rounded-lg max-w-sm hover:bg-secondary/40 transition-colors">
          <div className="shrink-0 text-muted-foreground">
            {getFileIcon(fileAttachment.file.mimeType)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {fileAttachment.file.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(fileAttachment.file.size)}
            </div>
          </div>
          <button
            onClick={() => handleDownloadFile(fileAttachment)}
            className="shrink-0 p-2 hover:bg-secondary/50 rounded transition-colors"
            title="Download file"
          >
            <FontAwesomeIcon icon="download" className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (message.isGif) {
      const isFavorite = favoriteGifUrls.has(message.content);
      return (
        <div className="relative inline-block group/gif max-w-xs">
          <img
            src={message.content}
            alt="GIF"
            className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity max-h-64 w-auto"
            onClick={() => setExpandedGif(message.content)}
          />
          <button
            className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md backdrop-blur-sm transition-all opacity-0 group-hover/gif:opacity-100 ${
              isFavorite
                ? "bg-primary/80 text-primary-foreground hover:bg-primary"
                : "bg-black/50 text-white hover:bg-black/70"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteGif(message.content);
            }}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <FontAwesomeIcon icon="star" className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }
    const emojiOnly = isEmojiOnly(message.content);
    const emojiCount = emojiOnly ? getEmojiCount(message.content) : 0;

    let sizeClass = "text-sm";
    if (emojiOnly) {
      if (emojiCount === 1) {
        sizeClass = "text-5xl leading-tight";
      } else if (emojiCount === 2) {
        sizeClass = "text-4xl leading-tight";
      } else if (emojiCount <= 5) {
        sizeClass = "text-3xl leading-tight";
      } else {
        sizeClass = "text-2xl leading-tight";
      }
    }

    return <span className={emojiOnly ? sizeClass : ""}>{message.content}</span>;
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
    return message.reactions.reduce(
      (acc, r) => {
        if (!acc[r.emoji]) {
          acc[r.emoji] = [];
        }
        acc[r.emoji].push(r.userId);
        return acc;
      },
      {} as Record<string, string[]>
    );
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
            <FontAwesomeIcon icon="pen-to-square" className="w-3 h-3 text-muted-foreground" />
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
            {message.isMine && message.id.startsWith("temp-") && (
              <span className="w-3 h-3 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin" />
            )}
            {message.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
            {message.expiresAt && timeLeft !== null && (
              <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-sm">
                <FontAwesomeIcon icon="clock" className="w-2 h-2" />
                {formatTimeLeft(timeLeft)}
              </span>
            )}
          </div>
        )}
        {message.replyTo &&
          (() => {
            let fileMetadata: FileMetadata | null = null;
            try {
              const parsed = JSON.parse(message.replyTo.content);
              if (parsed.type === "file") {
                fileMetadata = parsed;
              }
            } catch {}

            if (fileMetadata && fileMetadata.file.mimeType.startsWith("image/")) {
              return (
                <div className="mb-2 rounded-lg overflow-hidden bg-card/50 border border-border/50 w-fit max-w-xs group/reply hover:border-border transition-colors">
                  <div className="relative">
                    <div className="[&_img]:rounded-none [&_img]:max-h-28 [&_img]:w-auto [&>div]:max-w-none opacity-70 group-hover/reply:opacity-80 transition-opacity">
                      <AttachmentImage metadata={fileMetadata} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-md px-2 py-1">
                      <FontAwesomeIcon icon="reply" className="w-2.5 h-2.5 text-white/80" />
                      <span className="text-[10px] font-semibold text-white/90">
                        {message.replyTo.senderName}
                      </span>
                    </div>
                    {fileMetadata.text && (
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <div className="text-xs text-white font-medium line-clamp-2 drop-shadow-lg">
                          {fileMetadata.text}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div className="mb-1.5 rounded-md bg-card/40 border border-border/40 border-l-2 border-l-primary/60 p-2.5 text-xs flex flex-col gap-1 max-w-full hover:bg-card/60 transition-colors">
                <div className="flex items-center gap-1.5">
                  <FontAwesomeIcon
                    icon="reply"
                    className="w-2.5 h-2.5 text-muted-foreground shrink-0"
                  />
                  <span className="font-semibold text-foreground">
                    {message.replyTo.senderName}
                  </span>
                </div>
                <span className="text-muted-foreground truncate leading-relaxed">
                  {formatReplyPreview(message.replyTo.content)}
                </span>
              </div>
            );
          })()}
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
              <button onClick={handleCancelEdit} className="text-foreground hover:underline">
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
          <div
            className={`${message.expiresAt ? "border border-dashed border-muted-foreground/20 rounded-sm p-2 w-fit" : ""} ${message.isGif || isFileAttachment(message.content) ? "w-fit" : "text-sm text-foreground break-words"}`}
          >
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
      {expandedGif && <GifModal gifUrl={expandedGif} onClose={() => setExpandedGif(null)} />}
    </div>
  );
});
