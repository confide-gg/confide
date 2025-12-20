import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { messageService } from "../features/chat/messages";
import { conversationService } from "../features/chat/conversations";
import { friendService } from "../features/friends/friends";
import { groupService } from "../features/groups/groupService";
import { serverService } from "../features/servers/servers";
import type { Message, SendMessageRequest, EditMessageRequest } from "../features/chat/types";
import type { CreateGroupRequest, AddGroupMemberRequest, UpdateGroupOwnerRequest, UpdateGroupMetadataRequest } from "../features/groups/groupService";
import type { SendFriendRequestBody, AcceptFriendRequestBody } from "../features/friends/types";

export const queryKeys = {
  all: ["confide"] as const,

  conversations: {
    all: ["conversations"] as const,
    lists: () => [...queryKeys.conversations.all, "list"] as const,
    list: () => [...queryKeys.conversations.lists()] as const,
    details: () => [...queryKeys.conversations.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.conversations.details(), id] as const,
    members: (id: string) => [...queryKeys.conversations.detail(id), "members"] as const,
  },

  messages: {
    all: ["messages"] as const,
    lists: () => [...queryKeys.messages.all, "list"] as const,
    list: (conversationId: string) => [...queryKeys.messages.lists(), conversationId] as const,
    infinite: (conversationId: string) => [...queryKeys.messages.lists(), conversationId, "infinite"] as const,
    pinned: (conversationId: string) => [...queryKeys.messages.list(conversationId), "pinned"] as const,
  },

  friends: {
    all: ["friends"] as const,
    lists: () => [...queryKeys.friends.all, "list"] as const,
    list: () => [...queryKeys.friends.lists()] as const,
    requests: () => [...queryKeys.friends.all, "requests"] as const,
  },

  servers: {
    all: ["servers"] as const,
    lists: () => [...queryKeys.servers.all, "list"] as const,
    list: () => [...queryKeys.servers.lists()] as const,
    details: () => [...queryKeys.servers.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.servers.details(), id] as const,
    members: (id: string) => [...queryKeys.servers.detail(id), "members"] as const,
    categories: (id: string) => [...queryKeys.servers.detail(id), "categories"] as const,
    channels: (id: string) => [...queryKeys.servers.detail(id), "channels"] as const,
    roles: (id: string) => [...queryKeys.servers.detail(id), "roles"] as const,
    invites: (id: string) => [...queryKeys.servers.detail(id), "invites"] as const,
    bans: (id: string) => [...queryKeys.servers.detail(id), "bans"] as const,
    channelPermissions: (serverId: string, channelId: string) =>
      [...queryKeys.servers.detail(serverId), "channels", channelId, "permissions"] as const,
  },
};

export function useMessages(conversationId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.messages.list(conversationId || ""),
    queryFn: () => messageService.getMessages(conversationId!),
    enabled: !!conversationId && (options?.enabled ?? true),
    staleTime: 1000 * 30,
  });
}

export function useInfiniteMessages(conversationId: string | null, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages.infinite(conversationId || ""),
    queryFn: ({ pageParam }) =>
      messageService.getMessages(conversationId!, {
        limit: 50,
        before: pageParam
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

export function useConversations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: () => conversationService.getConversations(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
  });
}

export function useConversationMembers(conversationId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.conversations.members(conversationId || ""),
    queryFn: () => conversationService.getMembers(conversationId!),
    enabled: !!conversationId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

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

export function useServers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.list(),
    queryFn: () => serverService.getUserServers(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5,
  });
}

export function useServer(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.detail(serverId || ""),
    queryFn: () => serverService.getServer(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useServerMembers(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.members(serverId || ""),
    queryFn: () => serverService.getServerMembers(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60,
  });
}

export function useServerCategories(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.categories(serverId || ""),
    queryFn: () => serverService.getServerCategories(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useServerChannels(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.channels(serverId || ""),
    queryFn: () => serverService.getServerChannels(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useServerRoles(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.roles(serverId || ""),
    queryFn: () => serverService.getServerRoles(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useServerInvites(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.invites(serverId || ""),
    queryFn: () => serverService.getServerInvites(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60,
  });
}

export function useServerBans(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.bans(serverId || ""),
    queryFn: () => serverService.getServerBans(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60,
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageRequest) =>
      messageService.sendMessage(conversationId, data),
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.messages.list(conversationId),
      });

      const previousMessages = queryClient.getQueryData<Message[]>(
        queryKeys.messages.list(conversationId)
      );

      queryClient.setQueryData<Message[]>(
        queryKeys.messages.list(conversationId),
        (old) => [
          ...(old || []),
          {
            id: `temp-${Date.now()}`,
            conversation_id: conversationId,
            encrypted_content: newMessage.encrypted_content,
            signature: newMessage.signature,
            created_at: new Date().toISOString(),
            sender_id: "",
            reply_to_id: newMessage.reply_to_id,
            expires_at: newMessage.expires_at,
            reactions: [],
            message_keys: newMessage.message_keys || [],
          } as Message,
        ]
      );

      return { previousMessages };
    },
    onError: (_err, _newMessage, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.messages.list(conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(conversationId),
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.infinite(conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });
    },
  });
}

export function useEditMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, data }: { messageId: string; data: EditMessageRequest }) =>
      messageService.editMessage(conversationId, messageId, data),
    onMutate: async ({ messageId, data }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.messages.list(conversationId),
      });

      const previousMessages = queryClient.getQueryData<Message[]>(
        queryKeys.messages.list(conversationId)
      );

      queryClient.setQueryData<Message[]>(
        queryKeys.messages.list(conversationId),
        (old) => old?.map((msg) =>
          msg.id === messageId
            ? { ...msg, encrypted_content: data.encrypted_content, edited_at: new Date().toISOString() }
            : msg
        ) || []
      );

      return { previousMessages };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.messages.list(conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(conversationId),
        exact: false,
      });
    },
  });
}

export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      messageService.deleteMessage(conversationId, messageId),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.messages.list(conversationId),
      });

      const previousMessages = queryClient.getQueryData<Message[]>(
        queryKeys.messages.list(conversationId)
      );

      queryClient.setQueryData<Message[]>(
        queryKeys.messages.list(conversationId),
        (old) => old?.filter((msg) => msg.id !== messageId) || []
      );

      return { previousMessages };
    },
    onError: (_err, _messageId, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.messages.list(conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });
    },
  });
}

export function usePinMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      messageService.pinMessage(conversationId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(conversationId),
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.pinned(conversationId),
      });
    },
  });
}

export function useUnpinMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) =>
      messageService.unpinMessage(conversationId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(conversationId),
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.pinned(conversationId),
      });
    },
  });
}

export function useAddReaction(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      messageService.addReaction(conversationId, messageId, { emoji }),
    onMutate: async ({ messageId, emoji }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.messages.list(conversationId),
      });

      const previousMessages = queryClient.getQueryData<Message[]>(
        queryKeys.messages.list(conversationId)
      );

      queryClient.setQueryData<Message[]>(
        queryKeys.messages.list(conversationId),
        (old) => old?.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: [
                ...msg.reactions,
                {
                  id: `temp-${Date.now()}`,
                  message_id: messageId,
                  user_id: "",
                  emoji,
                  created_at: new Date().toISOString(),
                },
              ],
            };
          }
          return msg;
        }) || []
      );

      return { previousMessages };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.messages.list(conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(conversationId),
        exact: false,
      });
    },
  });
}

export function useRemoveReaction(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      messageService.removeReaction(conversationId, messageId, emoji),
    onMutate: async ({ messageId, emoji }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.messages.list(conversationId),
      });

      const previousMessages = queryClient.getQueryData<Message[]>(
        queryKeys.messages.list(conversationId)
      );

      queryClient.setQueryData<Message[]>(
        queryKeys.messages.list(conversationId),
        (old) => old?.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: msg.reactions.filter((r) => !(r.emoji === emoji)),
            };
          }
          return msg;
        }) || []
      );

      return { previousMessages };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.messages.list(conversationId),
          context.previousMessages
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(conversationId),
        exact: false,
      });
    },
  });
}

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
