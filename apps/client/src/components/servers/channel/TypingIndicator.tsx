import { TypingIndicator as BaseTypingIndicator } from "@/features/shared-kernel";

interface TypingIndicatorProps {
  typingUsers: Map<string, string>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  const typingNames = Array.from(typingUsers.values());

  return <BaseTypingIndicator typingNames={typingNames} position="absolute" />;
}
