import { useQuery } from "@tanstack/react-query";
import { friendService } from "../../features/friends/friends";
import { queryKeys } from "./queryKeys";

export function useFriends(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => friendService.getFriends(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFriendRequests(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => friendService.getFriendRequests(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 30,
  });
}
