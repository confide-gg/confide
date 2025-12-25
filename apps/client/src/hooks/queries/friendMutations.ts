import { useMutation, useQueryClient } from "@tanstack/react-query";
import { friendService } from "../../features/friends/friends";
import type { SendFriendRequestBody, AcceptFriendRequestBody } from "../../features/friends/types";
import { queryKeys } from "./queryKeys";

export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendFriendRequestBody) =>
      friendService.sendFriendRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends.requests(),
      });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: AcceptFriendRequestBody }) =>
      friendService.acceptFriendRequest(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends.list(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends.requests(),
      });
    },
  });
}

export function useRejectFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) =>
      friendService.rejectFriendRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.friends.requests(),
      });
    },
  });
}
