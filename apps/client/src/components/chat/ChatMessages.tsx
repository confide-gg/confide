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
  const { activeChat, chatMessages } = useChat();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const prevMessageCount = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);

  const scrollToBottom = (smooth = false) => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const scrollOptions: ScrollToOptions = {
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    };

    container.scrollTo(scrollOptions);
  };

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
      scrollToBottom(false);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollToBottom(false);
      }, 100);

      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollToBottom(false);
      }, 300);
    }
  }, [chatMessages]);

  useEffect(() => {
    scrollToBottom(false);
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

    const images = container.querySelectorAll('img');
    let loadedCount = 0;
    const totalImages = images.length;

    if (totalImages === 0) return;

    const handleImageLoad = () => {
      loadedCount++;
      if (loadedCount === totalImages && shouldAutoScroll.current) {
        scrollToBottom(false);
      }
    };

    images.forEach(img => {
      if (img.complete) {
        loadedCount++;
      } else {
        img.addEventListener('load', handleImageLoad, { once: true });
      }
    });

    if (loadedCount === totalImages && shouldAutoScroll.current) {
      scrollToBottom(false);
    }

    return () => {
      images.forEach(img => {
        img.removeEventListener('load', handleImageLoad);
      });
    };
  }, [chatMessages]);

  return (
    <div
      className="flex-1 overflow-y-auto min-h-0 flex flex-col py-6 animate-in fade-in duration-100 scroll-smooth"
      ref={messagesContainerRef}
      onScroll={handleScroll}
      style={{ scrollBehavior: 'smooth' }}
    >
      {chatMessages.map((msg, idx) => (
        msg.isSystem ? (
          <SystemMessage key={msg.id} message={msg} peerName={activeChat.visitorUsername} />
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
