import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useChat } from "../../context/ChatContext";
import { GifPicker } from "./GifPicker";
import data from "@emoji-mart/data";
import type { PickerType, TimedMessageDuration } from "../../types";

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
    friendsList
  } = useChat();
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [showTimedMenu, setShowTimedMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const timedMenuRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

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

  const debouncedHandleTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      handleTyping();
    }, 300);
  }, [handleTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      setActivePicker(null);
    } else if (e.key === "Escape" && replyTo) {
      setReplyTo(null);
    }
  }, [sendMessage, replyTo, setReplyTo]);

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
      {replyTo && (
        <div className="absolute bottom-full left-0 right-0 bg-secondary/80 backdrop-blur border-b border-border/50 px-6 py-2 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Replying to</span>
            <span className="text-xs font-medium text-foreground whitespace-nowrap">{replyTo.senderName}</span>
            <span className="text-xs text-muted-foreground truncate">{replyTo.content}</span>
          </div>
          <button
            className="p-1 hover:bg-secondary/50 rounded transition-colors"
            onClick={() => setReplyTo(null)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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
        <div className="flex items-center gap-1 shrink-0">
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
          placeholder={replyTo ? `Reply to ${replyTo.senderName}...` : `Message @${activeChat?.visitorUsername}`}
          disabled={isSending}
        />
      </div>
    </div>
  );
}
