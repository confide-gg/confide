import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useChat } from "../../context/chat";
import { GifPicker } from "./GifPicker";
import data from "@emoji-mart/data";
import type { PickerType, TimedMessageDuration } from "../../types";
import { attachmentUploadService, type UploadProgress } from "../../features/attachments/AttachmentUploadService";
import { toast } from "sonner";
import { AttachmentImage } from "./AttachmentImage";

const Picker = lazy(() => import("@emoji-mart/react"));

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<{ file: File; progress: UploadProgress } | null>(null);
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
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
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
        setUploadingFile({ file: selectedFile, progress: { stage: 'compressing', progress: 0 } });

        const metadata = await attachmentUploadService.uploadFile(
          selectedFile,
          activeChat.conversationId,
          (progress) => {
            setUploadingFile((prev) => prev ? { ...prev, progress } : null);
          }
        );

        const caption = messageInput.trim();

        if (caption) {
          metadata.text = caption;
        }

        const s3Key = metadata.file.url.replace('s3://', '');
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
        setMessageInput('');
      } catch (err) {
        console.error('File upload failed:', err);
        toast.error('Upload failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
        setUploadingFile(null);
      }
    } else {
      await sendMessage();
    }
  }, [activeChat, selectedFile, messageInput, sendMessage, filePreviewUrl, setMessageInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
      setActivePicker(null);
    } else if (e.key === "Escape") {
      if (selectedFile) {
        handleRemoveFile();
      } else if (replyTo) {
        setReplyTo(null);
      }
    }
  }, [handleSendMessage, selectedFile, handleRemoveFile, replyTo, setReplyTo]);

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    setMessageInput(messageInput + emoji.native);
    inputRef.current?.focus();
  }, [messageInput, setMessageInput]);

  const handleGifSelect = useCallback((gifUrl: string) => {
    sendMessage(gifUrl);
    setActivePicker(null);
  }, [sendMessage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    debouncedHandleTyping();
  }, [setMessageInput, debouncedHandleTyping]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast.error('File too large', {
        description: 'Maximum file size is 100MB',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setFilePreviewUrl(previewUrl);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
  const isFriend = friendsList.some(f => f.id === activeChat.visitorId);
  const canSend = activeChat.isGroup || isFriend;

  if (!canSend) {
    return (
      <div className="h-auto min-h-[60px] px-6 py-3 flex items-center">
        <div className="flex items-center gap-3 px-4 py-2 bg-secondary/30 border border-border/50 rounded-md w-full">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <span className="text-sm text-muted-foreground">You cannot send messages to this user because you are not friends.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-auto min-h-[60px] px-6 py-3 flex-none z-20 relative">
      {replyTo && (() => {
        let fileMetadata = null;
        try {
          const parsed = JSON.parse(replyTo.content);
          if (parsed.type === 'file') {
            fileMetadata = parsed;
          }
        } catch {}

        const getFileIcon = (mimeType: string) => {
          if (mimeType.startsWith('video/')) {
            return (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            );
          }
          if (mimeType.startsWith('audio/')) {
            return (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            );
          }
          if (mimeType === 'application/pdf') {
            return (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            );
          }
          if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            return (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            );
          }
          return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          );
        };

        return (
          <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-2.5 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-3 overflow-hidden min-w-0">
              <div className="shrink-0 w-1 h-10 bg-primary rounded-full" />
              {fileMetadata && fileMetadata.file.mimeType.startsWith('image/') && (
                <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-border shadow-sm bg-secondary/50">
                  <div className="[&_img]:max-h-12 [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:rounded-none [&>div]:max-w-none [&>div]:rounded-none">
                    <AttachmentImage metadata={fileMetadata} />
                  </div>
                </div>
              )}
              {fileMetadata && !fileMetadata.file.mimeType.startsWith('image/') && (
                <div className="shrink-0 w-12 h-12 rounded-md flex items-center justify-center bg-secondary/30 border border-border">
                  {getFileIcon(fileMetadata.file.mimeType)}
                </div>
              )}
              <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                <div className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground shrink-0">
                    <polyline points="9 10 4 15 9 20" />
                    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                  </svg>
                  <span className="text-xs font-medium text-muted-foreground">Replying to</span>
                  <span className="text-xs font-semibold text-foreground">{replyTo.senderName}</span>
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  {fileMetadata ? (fileMetadata.text || fileMetadata.file.name) : replyTo.content}
                </span>
              </div>
            </div>
            <button
              className="shrink-0 p-1.5 hover:bg-secondary/50 rounded-md transition-colors group"
              onClick={() => setReplyTo(null)}
              title="Cancel reply"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground group-hover:text-foreground transition-colors">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        );
      })()}

      {selectedFile && !uploadingFile && (
        <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0 group/preview">
              {selectedFile.type.startsWith('image/') && filePreviewUrl && (
                <div className="relative">
                  <img
                    src={filePreviewUrl}
                    alt={selectedFile.name}
                    className="w-24 h-24 object-cover rounded-lg border-2 border-border shadow-sm"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/10 rounded-lg transition-colors" />
                </div>
              )}
              {!selectedFile.type.startsWith('image/') && (
                <div className="w-24 h-24 flex items-center justify-center bg-secondary/50 rounded-lg border-2 border-border shadow-sm">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                </div>
              )}
              <button
                onClick={handleRemoveFile}
                className="absolute -top-2 -right-2 w-7 h-7 flex items-center justify-center bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full shadow-lg transition-all hover:scale-110"
                title="Remove file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary shrink-0">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <div className="text-sm font-medium text-foreground truncate">{selectedFile.name}</div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                <span className="text-muted-foreground/50">•</span>
                <span className="capitalize">{selectedFile.type.split('/')[0] || 'File'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadingFile && (
        <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-3 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
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
          className="absolute bottom-[70px] left-6 z-50 shadow-lg rounded-lg overflow-hidden border border-border animate-in slide-in-from-bottom-4 zoom-in-95 duration-200"
          ref={pickerRef}
        >
          {activePicker === "emoji" && (
            <Suspense fallback={<div className="w-[350px] h-[400px] flex items-center justify-center bg-background">Loading...</div>}>
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="dark"
                previewPosition="none"
                skinTonePosition="none"
              />
            </Suspense>
          )}
          {activePicker === "gif" && (
            <GifPicker onSelect={handleGifSelect} />
          )}
        </div>
      )}

      <div className="flex items-center gap-2 h-9 rounded-md bg-secondary/30 px-3 border border-border/50 focus-within:border-border transition-all">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/mp4,video/quicktime,video/webm,audio/*,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json,application/javascript,application/x-typescript"
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="p-1 rounded transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            disabled={!!uploadingFile}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <button
            type="button"
            className={`p-1 rounded transition-colors ${activePicker === "gif" ? "text-foreground bg-secondary/50" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActivePicker(activePicker === "gif" ? null : "gif")}
            title="Send GIF"
          >
            <span className="text-[9px] font-medium px-1">GIF</span>
          </button>
          <button
            type="button"
            className={`p-1 rounded transition-colors ${activePicker === "emoji" ? "text-foreground bg-secondary/50" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActivePicker(activePicker === "emoji" ? null : "emoji")}
            title="Add emoji"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <div className="relative" ref={timedMenuRef}>
            <button
              type="button"
              className={`p-1 rounded transition-colors flex items-center gap-1 ${timedMessageDuration ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setShowTimedMenu(!showTimedMenu)}
              title="Timed message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {timedMessageDuration && (
                <span className="text-[9px] font-medium">
                  {timedMessageDuration >= 60 ? `${Math.floor(timedMessageDuration / 60)}m` : `${timedMessageDuration}s`}
                </span>
              )}
            </button>
            {showTimedMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-md shadow-lg p-1 min-w-[80px] z-50">
                {TIMED_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    className={`
                      w-full text-left px-2 py-1 text-xs rounded transition-colors
                      ${timedMessageDuration === opt.value ? "bg-secondary text-foreground" : "hover:bg-secondary/50 text-muted-foreground"}
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
          placeholder={replyTo ? `Reply to ${replyTo.senderName}...` : `Message @${activeChat?.visitorUsername}`}
          disabled={isSending}
        />
      </div>
    </div>
  );
}
