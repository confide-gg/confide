import { useState, useRef, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useChat } from "../../context/chat";
import { GifPicker } from "./GifPicker";
import { EmojiPicker } from "./EmojiPicker";
import { EmojiAutocomplete } from "./EmojiAutocomplete";
import type { PickerType } from "../../types";
import {
  attachmentUploadService,
  type UploadProgress as UploadProgressType,
} from "../../features/attachments/AttachmentUploadService";
import { toast } from "sonner";
import {
  ReplyContext,
  FilePreview,
  UploadProgress,
  TimedMessageMenu,
  FILE_SIZE_LIMIT,
  hasActiveShortcode,
} from "./input";

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
    progress: UploadProgressType;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
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

    if (file.size > FILE_SIZE_LIMIT) {
      toast.error("File too large", { description: "Maximum file size is 100MB" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setFilePreviewUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          if (file.size > FILE_SIZE_LIMIT) {
            toast.error("File too large", { description: "Maximum file size is 100MB" });
            return;
          }
          setSelectedFile(file);
          setFilePreviewUrl(URL.createObjectURL(file));
          return;
        }
      }
    }
  }, []);

  if (!activeChat) return null;

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
      {replyTo && <ReplyContext replyTo={replyTo} onCancel={() => setReplyTo(null)} />}

      {selectedFile && !uploadingFile && (
        <FilePreview file={selectedFile} previewUrl={filePreviewUrl} onRemove={handleRemoveFile} />
      )}

      {uploadingFile && (
        <UploadProgress file={uploadingFile.file} progress={uploadingFile.progress} />
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
          <TimedMessageMenu
            duration={timedMessageDuration}
            onDurationChange={setTimedMessageDuration}
            isOpen={showTimedMenu}
            onOpenChange={setShowTimedMenu}
          />
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
