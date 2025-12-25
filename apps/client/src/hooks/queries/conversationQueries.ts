import { useQuery } from "@tanstack/react-query";
import { conversationService } from "../../features/chat/conversations";
import { queryKeys } from "./queryKeys";

export function useConversations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: () => conversationService.getConversations(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
  });
}

export function useConversationMembers(
  conversationId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: queryKeys.conversations.members(conversationId || ""),
    queryFn: () => conversationService.getMembers(conversationId!),
    enabled: !!conversationId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}
