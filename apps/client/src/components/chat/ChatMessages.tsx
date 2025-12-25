import { useEffect, useRef, useLayoutEffect, useState } from "react";
import { useChat } from "../../context/chat";
import { Message } from "./Message";
import { SystemMessage } from "./SystemMessage";
import { MessageSkeletonList } from "./MessageSkeleton";
import type { DecryptedMessage } from "../../types";

function shouldShowHeader(
  msg: DecryptedMessage,
  idx: number,
  messages: DecryptedMessage[]
): boolean {
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
  const scrollTimeoutRef = useRef<number | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const scrollToBottom = (smooth = false) => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const scrollOptions: ScrollToOptions = {
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    };

    container.scrollTo(scrollOptions);
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScroll.current = distanceFromBottom < 100;
    if (shouldAutoScroll.current) {
      setHasNewMessages(false);
    }
  };

  const handleScrollToNew = () => {
    scrollToBottom(true);
    setHasNewMessages(false);
  };

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNewMessage = chatMessages.length > prevMessageCount.current;
    prevMessageCount.current = chatMessages.length;

    if (shouldAutoScroll.current) {
      scrollToBottom(false);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollToBottom(false);
      }, 50);
    } else if (isNewMessage) {
      setHasNewMessages(true);
    }
  }, [chatMessages]);

  useEffect(() => {
    scrollToBottom(false);
    setHasNewMessages(false);
  }, [activeChat?.visitorId]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  if (!activeChat) return null;

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const images = container.querySelectorAll("img");
    let loadedCount = 0;
    const totalImages = images.length;

    if (totalImages === 0) return;

    const handleImageLoad = () => {
      loadedCount++;
      if (loadedCount === totalImages && shouldAutoScroll.current) {
        scrollToBottom(false);
      }
    };

    images.forEach((img) => {
      if (img.complete) {
        loadedCount++;
      } else {
        img.addEventListener("load", handleImageLoad, { once: true });
      }
    });

    if (loadedCount === totalImages && shouldAutoScroll.current) {
      scrollToBottom(false);
    }

    return () => {
      images.forEach((img) => {
        img.removeEventListener("load", handleImageLoad);
      });
    };
  }, [chatMessages]);

  if (isLoadingChat && chatMessages.length === 0) {
    return (
      <div className="relative flex-1 min-h-0">
        <div className="h-full overflow-y-auto flex flex-col">
          <MessageSkeletonList count={8} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        className="h-full overflow-y-auto flex flex-col py-6 animate-in fade-in duration-100"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {chatMessages.map((msg, idx) =>
          msg.isSystem ? (
            <SystemMessage key={msg.id} message={msg} peerName={activeChat.visitorUsername} />
          ) : (
            <Message
              key={msg.id}
              message={msg}
              showHeader={shouldShowHeader(msg, idx, chatMessages)}
            />
          )
        )}
        <div ref={messagesEndRef} />
      </div>
      {hasNewMessages && (
        <button
          onClick={handleScrollToNew}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg text-sm font-medium hover:bg-primary/90 transition-all animate-in slide-in-from-bottom-2 flex items-center gap-2"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          New messages
        </button>
      )}
    </div>
  );
}
