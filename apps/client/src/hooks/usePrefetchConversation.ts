import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { messageService } from "../features/chat/messages";
import { queryKeys } from "./queries/queryKeys";

export function usePrefetchConversation() {
  const queryClient = useQueryClient();

  const prefetch = useCallback(
    (conversationId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.messages.list(conversationId),
        queryFn: () => messageService.getMessages(conversationId, { limit: 50 }),
        staleTime: 30000,
      });
    },
    [queryClient]
  );

  return { prefetch };
}
