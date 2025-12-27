import { useState, useRef, useEffect } from "react";
import type { ActiveChat, DecryptedMessage } from "@/types";

export function useChatState() {
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [chatMessages, setChatMessages] = useState<DecryptedMessage[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  const activeChatRef = useRef<ActiveChat | null>(null);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const groupMemberNameCache = useRef<Map<string, Map<string, string>>>(new Map());

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  return {
    activeChat,
    setActiveChat,
    chatMessages,
    setChatMessages,
    isLoadingChat,
    setIsLoadingChat,
    activeChatRef,
    processedMessageIds,
    groupMemberNameCache,
  };
}
