import { useMemo } from "react";

interface UseTypingNamesOptions<T> {
  typingUsers: Map<string, T>;
  getDisplayName: (userId: string, userData?: T) => string;
}

export function useTypingNames<T>({
  typingUsers,
  getDisplayName,
}: UseTypingNamesOptions<T>): string[] {
  return useMemo(() => {
    return Array.from(typingUsers.entries()).map(([userId, userData]) =>
      getDisplayName(userId, userData)
    );
  }, [typingUsers, getDisplayName]);
}
