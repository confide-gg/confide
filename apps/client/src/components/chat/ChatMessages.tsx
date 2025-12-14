import { useEffect, useRef, useLayoutEffect } from "react";
import { useChat } from "../../context/ChatContext";
import { Message } from "./Message";
import { SystemMessage } from "./SystemMessage";
import type { DecryptedMessage } from "../../types";

function shouldShowHeader(msg: DecryptedMessage, idx: number, messages: DecryptedMessage[]): boolean {
  if (msg.isSystem) return false;
  if (idx === 0) return true;
  const prevMsg = messages[idx - 1];
  if (prevMsg.isSystem) return true;
  if (prevMsg.senderId !== msg.senderId) return true;
  const prevTime = new Date(prevMsg.createdAt).getTime();
  const currTime = new Date(msg.createdAt).getTime();
  return currTime - prevTime > 5 * 60 * 1000;
}

export function ChatMessages() {
  const { activeChat, chatMessages, isLoadingChat } = useChat();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const prevMessageCount = useRef(0);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScroll.current = distanceFromBottom < 100;
  };

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNewMessage = chatMessages.length > prevMessageCount.current;
    prevMessageCount.current = chatMessages.length;

    if (shouldAutoScroll.current || isNewMessage) {
      container.scrollTop = container.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [activeChat?.visitorId]);

  if (!activeChat) return null;

  if (isLoadingChat) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col p-8 gap-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium">Loading conversation...</span>
        </div>
      </div>
    );
  }

  if (chatMessages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col p-8 gap-1">
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center text-muted-foreground p-8">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground">Start a conversation</h3>
          <p className="text-sm max-w-sm">Send a message, emoji, or GIF to @{activeChat.visitorUsername}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col py-6" ref={messagesContainerRef} onScroll={handleScroll}>
      {chatMessages.map((msg, idx) => (
        msg.isSystem ? (
          <SystemMessage key={msg.id} message={msg} />
        ) : (
          <Message
            key={msg.id}
            message={msg}
            showHeader={shouldShowHeader(msg, idx, chatMessages)}
          />
        )
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
