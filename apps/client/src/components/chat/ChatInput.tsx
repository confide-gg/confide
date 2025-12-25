import { useState, useRef, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useChat } from "../../context/chat";
import { GifPicker } from "./GifPicker";
import { EmojiPicker } from "./EmojiPicker";
import { EmojiAutocomplete } from "./EmojiAutocomplete";
import type { PickerType, TimedMessageDuration } from "../../types";
import {
  attachmentUploadService,
  type UploadProgress,
} from "../../features/attachments/AttachmentUploadService";
import { toast } from "sonner";
import { AttachmentImage } from "./AttachmentImage";

function hasActiveShortcode(text: string): boolean {
  return /:([a-zA-Z0-9_+-]{2,})$/.test(text);
}

const TIMED_OPTIONS: { label: string; value: TimedMessageDuration }[] = [
  { label: "Off", value: null },
  { label: "5s", value: 5 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
];

export function ChatInput() {
  const {
    activeChat,
    messageInput,
    setMessageInput,
    isSending,
    sendMessage,
    handleTyping,
    replyTo,
    setReplyTo,
    timedMessageDuration,
    setTimedMessageDuration,
    friendsList,
    droppedFile,
    setDroppedFile,
  } = useChat();
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [showTimedMenu, setShowTimedMenu] = useState(false);
  const [showEmojiAutocomplete, setShowEmojiAutocomplete] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<{
    file: File;
    progress: UploadProgress;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const timedMenuRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
      }
      if (timedMenuRef.current && !timedMenuRef.current.contains(e.target as Node)) {
        setShowTimedMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus();
    }
  }, [replyTo]);

  useEffect(() => {
    if (activeChat) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [activeChat?.conversationId]);

  useEffect(() => {
    if (droppedFile) {
      setSelectedFile(droppedFile);
      const previewUrl = URL.createObjectURL(droppedFile);
      setFilePreviewUrl(previewUrl);
      setDroppedFile(null);
      inputRef.current?.focus();
    }
  }, [droppedFile, setDroppedFile]);

  const debouncedHandleTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      handleTyping();
    }, 300);
  }, [handleTyping]);

  const handleRemoveFile = useCallback(() => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
  }, [filePreviewUrl]);

  const handleSendMessage = useCallback(async () => {
    if (!activeChat) return;

    if (selectedFile) {
      try {
        setUploadingFile({ file: selectedFile, progress: { stage: "compressing", progress: 0 } });

        const metadata = await attachmentUploadService.uploadFile(
          selectedFile,
          activeChat.conversationId,
          (progress) => {
            setUploadingFile((prev) => (prev ? { ...prev, progress } : null));
          }
        );

        const caption = messageInput.trim();

        if (caption) {
          metadata.text = caption;
        }

        const s3Key = metadata.file.url.replace("s3://", "");
        const attachmentMeta = {
          s3_key: s3Key,
          file_size: metadata.file.size,
          encrypted_size: metadata.file.encryptedSize,
          mime_type: metadata.file.mimeType,
        };

        await sendMessage(JSON.stringify(metadata), attachmentMeta);

        setUploadingFile(null);
        if (filePreviewUrl) {
          URL.revokeObjectURL(filePreviewUrl);
        }
        setSelectedFile(null);
        setFilePreviewUrl(null);
        setMessageInput("");
      } catch (err) {
        console.error("File upload failed:", err);
        toast.error("Upload failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        setUploadingFile(null);
      }
    } else {
      await sendMessage();
    }
  }, [activeChat, selectedFile, messageInput, sendMessage, filePreviewUrl, setMessageInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        if (showEmojiAutocomplete && hasActiveShortcode(messageInput)) {
          return;
        }
        e.preventDefault();
        handleSendMessage();
        setActivePicker(null);
      } else if (e.key === "Tab" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (showEmojiAutocomplete && hasActiveShortcode(messageInput)) {
          e.preventDefault();
          return;
        }
      } else if (e.key === "Escape") {
        if (showEmojiAutocomplete && hasActiveShortcode(messageInput)) {
          setShowEmojiAutocomplete(false);
          return;
        }
        if (selectedFile) {
          handleRemoveFile();
        } else if (replyTo) {
          setReplyTo(null);
        }
      }
    },
    [
      handleSendMessage,
      selectedFile,
      handleRemoveFile,
      replyTo,
      setReplyTo,
      showEmojiAutocomplete,
      messageInput,
    ]
  );

  const handleEmojiSelect = useCallback(
    (emoji: { native: string; id: string }) => {
      setMessageInput(messageInput + emoji.native);
      inputRef.current?.focus();
    },
    [messageInput, setMessageInput]
  );

  const handlePickerTabChange = useCallback((tab: "gif" | "emoji") => {
    setActivePicker(tab);
  }, []);

  const handleEmojiAutocompleteSelect = useCallback(
    (emoji: string, _shortcode: string) => {
      const newText = messageInput.replace(/:([a-zA-Z0-9_+-]+)$/, emoji);
      setMessageInput(newText);
      setShowEmojiAutocomplete(false);
      setTimeout(() => setShowEmojiAutocomplete(true), 100);
      inputRef.current?.focus();
    },
    [messageInput, setMessageInput]
  );

  const handleGifSelect = useCallback(
    (gifUrl: string) => {
      sendMessage(gifUrl);
      setActivePicker(null);
    },
    [sendMessage]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setMessageInput(e.target.value);
      debouncedHandleTyping();
    },
    [setMessageInput, debouncedHandleTyping]
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Maximum file size is 100MB",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setFilePreviewUrl(previewUrl);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();

          if (file.size > 100 * 1024 * 1024) {
            toast.error("File too large", {
              description: "Maximum file size is 100MB",
            });
            return;
          }

          setSelectedFile(file);
          const previewUrl = URL.createObjectURL(file);
          setFilePreviewUrl(previewUrl);
          return;
        }
      }
    }
  }, []);

  if (!activeChat) return null;

  // Check if we can send messages
  // If it's a DM (isGroup is undefined or false) and visitor is NOT in friends list.
  const isFriend = friendsList.some((f) => f.id === activeChat.visitorId);
  const canSend = activeChat.isGroup || isFriend;

  if (!canSend) {
    return (
      <div className="h-auto min-h-[60px] px-6 py-3 flex items-center">
        <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 border border-border/50 rounded-md w-full">
          <FontAwesomeIcon
            icon="ban"
            className="w-[18px] h-[18px] text-muted-foreground shrink-0"
          />
          <span className="text-sm text-muted-foreground">
            You cannot send messages to this user because you are not friends.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-auto min-h-[60px] px-6 py-3 flex-none z-20 relative">
      {replyTo &&
        (() => {
          let fileMetadata = null;
          try {
            const parsed = JSON.parse(replyTo.content);
            if (parsed.type === "file") {
              fileMetadata = parsed;
            }
          } catch {}

          const getFileIcon = (mimeType: string) => {
            if (mimeType.startsWith("video/")) {
              return <FontAwesomeIcon icon="video" className="w-5 h-5 text-primary" />;
            }
            if (mimeType.startsWith("audio/")) {
              return <FontAwesomeIcon icon="music" className="w-5 h-5 text-primary" />;
            }
            if (mimeType === "application/pdf") {
              return <FontAwesomeIcon icon="file" className="w-5 h-5 text-primary" />;
            }
            if (mimeType.startsWith("text/") || mimeType === "application/json") {
              return <FontAwesomeIcon icon="file" className="w-5 h-5 text-primary" />;
            }
            return <FontAwesomeIcon icon="file" className="w-5 h-5 text-primary" />;
          };

          return (
            <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-2.5 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-100">
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                <div className="shrink-0 w-1 h-10 bg-primary rounded-full" />
                {fileMetadata && fileMetadata.file.mimeType.startsWith("image/") && (
                  <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-border shadow-sm bg-secondary/50">
                    <div className="[&_img]:max-h-12 [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:rounded-none [&>div]:max-w-none [&>div]:rounded-none">
                      <AttachmentImage metadata={fileMetadata} />
                    </div>
                  </div>
                )}
                {fileMetadata && !fileMetadata.file.mimeType.startsWith("image/") && (
                  <div className="shrink-0 w-12 h-12 rounded-md flex items-center justify-center bg-secondary/30 border border-border">
                    {getFileIcon(fileMetadata.file.mimeType)}
                  </div>
                )}
                <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon="reply"
                      className="w-3 h-3 text-muted-foreground shrink-0"
                    />
                    <span className="text-xs font-medium text-muted-foreground">Replying to</span>
                    <span className="text-xs font-semibold text-foreground">
                      {replyTo.senderName}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {fileMetadata ? fileMetadata.text || fileMetadata.file.name : replyTo.content}
                  </span>
                </div>
              </div>
              <button
                className="shrink-0 p-1.5 hover:bg-secondary/50 rounded-md transition-colors group"
                onClick={() => setReplyTo(null)}
                title="Cancel reply"
              >
                <FontAwesomeIcon
                  icon="xmark"
                  className="w-[14px] h-[14px] text-muted-foreground group-hover:text-foreground transition-colors"
                />
              </button>
            </div>
          );
        })()}

      {selectedFile && !uploadingFile && (
        <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-3 animate-in slide-in-from-bottom-2 duration-100">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0 group/preview">
              {selectedFile.type.startsWith("image/") && filePreviewUrl && (
                <div className="relative">
                  <img
                    src={filePreviewUrl}
                    alt={selectedFile.name}
                    className="w-24 h-24 object-cover rounded-lg border-2 border-border shadow-sm"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/10 rounded-lg transition-colors" />
                </div>
              )}
              {!selectedFile.type.startsWith("image/") && (
                <div className="w-24 h-24 flex items-center justify-center bg-secondary/50 rounded-lg border-2 border-border shadow-sm">
                  <FontAwesomeIcon icon="file" className="w-9 h-9 text-muted-foreground" />
                </div>
              )}
              <button
                onClick={handleRemoveFile}
                className="absolute -top-2 -right-2 w-7 h-7 flex items-center justify-center bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full shadow-lg transition-all hover:scale-110"
                title="Remove file"
              >
                <FontAwesomeIcon icon="xmark" className="w-[14px] h-[14px]" />
              </button>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon="paperclip" className="w-4 h-4 text-primary shrink-0" />
                <div className="text-sm font-medium text-foreground truncate">
                  {selectedFile.name}
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                <span className="text-muted-foreground/50">•</span>
                <span className="capitalize">{selectedFile.type.split("/")[0] || "File"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadingFile && (
        <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-3 animate-in slide-in-from-bottom-2 duration-100">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                <FontAwesomeIcon icon="spinner" className="w-8 h-8 text-primary" spin />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {uploadingFile.file.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs font-medium text-primary capitalize">
                    {uploadingFile.progress.stage}
                  </span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {uploadingFile.progress.progress}%
                  </span>
                </div>
              </div>
              <div className="relative w-full bg-secondary/50 rounded-full h-2 overflow-hidden shadow-inner">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${uploadingFile.progress.progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse" />
                </div>
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
        </div>
      )}

      {activePicker && (
        <div
          className="absolute bottom-[70px] right-4 z-50 animate-in slide-in-from-bottom-4 zoom-in-95 duration-100"
          ref={pickerRef}
        >
          {activePicker === "emoji" && (
            <EmojiPicker
              onSelect={handleEmojiSelect}
              onTabChange={handlePickerTabChange}
              activeTab="emoji"
            />
          )}
          {activePicker === "gif" && (
            <GifPicker
              onSelect={handleGifSelect}
              onTabChange={handlePickerTabChange}
              activeTab="gif"
            />
          )}
        </div>
      )}

      <div className="relative flex items-center gap-2 h-10 rounded-lg bg-secondary/40 px-2 border border-border/50 focus-within:border-primary/50 focus-within:bg-secondary/60 transition-all">
        {showEmojiAutocomplete && (
          <EmojiAutocomplete
            text={messageInput}
            onSelect={handleEmojiAutocompleteSelect}
            onClose={() => setShowEmojiAutocomplete(false)}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/mp4,video/quicktime,video/webm,audio/*,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json,application/javascript,application/x-typescript"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            disabled={!!uploadingFile}
          >
            <FontAwesomeIcon icon="plus" className="w-[18px] h-[18px]" />
          </button>
          <div className="relative" ref={timedMenuRef}>
            <button
              type="button"
              className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${timedMessageDuration ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}
              onClick={() => setShowTimedMenu(!showTimedMenu)}
              title="Timed message"
            >
              <FontAwesomeIcon icon="clock" className="w-[18px] h-[18px]" />
              {timedMessageDuration && (
                <span className="text-[10px] font-semibold">
                  {timedMessageDuration >= 60
                    ? `${Math.floor(timedMessageDuration / 60)}m`
                    : `${timedMessageDuration}s`}
                </span>
              )}
            </button>
            {showTimedMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-lg p-1 min-w-[80px] z-50">
                {TIMED_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    className={`
                      w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors
                      ${timedMessageDuration === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary/80 text-muted-foreground hover:text-foreground"}
                    `}
                    onClick={() => {
                      setTimedMessageDuration(opt.value);
                      setShowTimedMenu(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={messageInput}
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground h-full min-w-0"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            replyTo
              ? `Reply to ${replyTo.senderName}...`
              : `Message @${activeChat?.visitorUsername}`
          }
          disabled={isSending}
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            className={`px-1.5 py-1 rounded-md transition-colors text-[11px] font-bold ${activePicker === "gif" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}
            onClick={() => setActivePicker(activePicker === "gif" ? null : "gif")}
            title="Send GIF"
          >
            GIF
          </button>
          <button
            type="button"
            className={`p-1.5 rounded-md transition-colors ${activePicker === "emoji" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}
            onClick={() => setActivePicker(activePicker === "emoji" ? null : "emoji")}
            title="Add emoji"
          >
            <FontAwesomeIcon icon="face-smile" className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
