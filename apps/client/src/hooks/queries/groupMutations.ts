import { useMutation, useQueryClient } from "@tanstack/react-query";
import { groupService } from "../../features/groups/groupService";
import type { CreateGroupRequest, AddGroupMemberRequest, UpdateGroupOwnerRequest, UpdateGroupMetadataRequest } from "../../features/groups/groupService";
import { queryKeys } from "./queryKeys";

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGroupRequest) => groupService.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });
    },
  });
}

export function useAddGroupMember(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddGroupMemberRequest) =>
      groupService.addMember(conversationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.members(conversationId),
      });
    },
  });
}

export function useRemoveGroupMember(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      groupService.removeMember(conversationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.members(conversationId),
      });
    },
  });
}

export function useLeaveGroup(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => groupService.leaveGroup(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });
    },
  });
}

export function useDeleteGroup(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => groupService.deleteGroup(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.conversations.detail(conversationId),
      });
    },
  });
}

export function useTransferGroupOwnership(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateGroupOwnerRequest) =>
      groupService.transferOwnership(conversationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(conversationId),
      });
    },
  });
}

export function useUpdateGroupMetadata(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateGroupMetadataRequest) =>
      groupService.updateMetadata(conversationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });
    },
  });
}
