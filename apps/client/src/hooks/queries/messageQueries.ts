import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { messageService } from "../../features/chat/messages";
import { queryKeys } from "./queryKeys";

export function useMessages(conversationId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.messages.list(conversationId || ""),
    queryFn: () => messageService.getMessages(conversationId!),
    enabled: !!conversationId && (options?.enabled ?? true),
    staleTime: 1000 * 30,
  });
}

export function useInfiniteMessages(
  conversationId: string | null,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages.infinite(conversationId || ""),
    queryFn: ({ pageParam }) =>
      messageService.getMessages(conversationId!, {
        limit: 50,
        before: pageParam,
      }),
    enabled: !!conversationId && (options?.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) return undefined;
      return lastPage[0]?.id;
    },
    staleTime: 1000 * 30,
  });
}

export function usePinnedMessages(conversationId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.messages.pinned(conversationId || ""),
    queryFn: () => messageService.getPinnedMessages(conversationId!),
    enabled: !!conversationId && (options?.enabled ?? true),
    staleTime: 1000 * 60,
  });
}
