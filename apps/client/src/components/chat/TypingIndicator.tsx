import { useCallback } from "react";
import { useChat } from "../../context/chat";
import { TypingIndicator as BaseTypingIndicator } from "@/features/shared-kernel";
import { useTypingNames } from "@/features/shared-kernel";

export function TypingIndicator() {
  const { typingUsers, friendsList, activeChat } = useChat();

  const getDisplayName = useCallback(
    (userId: string): string => {
      if (!activeChat) return "Someone";
      if (userId === activeChat.visitorId) {
        return activeChat.visitorUsername;
      }
      const friend = friendsList.find((f) => f.id === userId);
      return friend?.username || "Someone";
    },
    [activeChat, friendsList]
  );

  const typingNames = useTypingNames({
    typingUsers,
    getDisplayName: (userId) => getDisplayName(userId),
  });

  if (!activeChat) return null;

  return <BaseTypingIndicator typingNames={typingNames} position="inline" />;
}
