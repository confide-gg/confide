import { useState, useCallback, useRef } from "react";
import type { ReplyTo, TimedMessageDuration } from "@/types";
import { MessageQueue } from "@/utils/MessageQueue";

export function useMessageInput() {
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [timedMessageDuration, setTimedMessageDuration] = useState<TimedMessageDuration>(null);

  const messageQueuesRef = useRef<Map<string, MessageQueue>>(new Map());

  const clearInput = useCallback(() => {
    setMessageInput("");
    setReplyTo(null);
    setTimedMessageDuration(null);
  }, []);

  return {
    messageInput,
    setMessageInput,
    isSending,
    setIsSending,
    replyTo,
    setReplyTo,
    timedMessageDuration,
    setTimedMessageDuration,
    messageQueuesRef,
    clearInput,
  };
}
