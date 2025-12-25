import { useMutation, useQueryClient } from "@tanstack/react-query";
import { messageService } from "../../features/chat/messages";
import type { Message, SendMessageRequest, EditMessageRequest } from "../../features/chat/types";
import { queryKeys } from "./queryKeys";

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
      queryClient.setQueryData<Message[]>(
        queryKeys.messages.list(conversationId),
        (old) => {
          if (!old) return old;
          return old.filter((msg) => !msg.id.startsWith("temp-"));
        }
      );
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
