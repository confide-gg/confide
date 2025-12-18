import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { centralWebSocketService } from "../core/network/CentralWebSocketService";
import { queryKeys } from "./useQueries";
import type { Message, ApiMessageReaction } from "../features/chat/types";

export function useCacheSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleMessage = (data: any) => {
      try {
        switch (data.type) {
          case "new_message": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            if (conversationId) {
              queryClient.setQueryData<Message[]>(
                queryKeys.messages.list(conversationId),
                (old) => {
                  if (!old) return old;
                  const newMessage: Message = {
                    id: data.data?.id || data.id,
                    conversation_id: conversationId,
                    sender_id: data.data?.sender_id || data.sender_id,
                    encrypted_content: data.data?.encrypted_content || data.encrypted_content,
                    signature: data.data?.signature || data.signature,
                    reply_to_id: data.data?.reply_to_id || data.reply_to_id || null,
                    expires_at: data.data?.expires_at || data.expires_at || null,
                    sender_chain_id: data.data?.sender_chain_id || data.sender_chain_id,
                    sender_chain_iteration: data.data?.sender_chain_iteration || data.sender_chain_iteration,
                    reactions: [],
                    created_at: data.data?.created_at || data.created_at,
                    message_type: data.data?.message_type || data.message_type,
                    call_id: data.data?.call_id || data.call_id,
                    call_duration_seconds: data.data?.call_duration_seconds || data.call_duration_seconds,
                  };
                  const exists = old.some(msg => msg.id === newMessage.id);
                  return exists ? old : [...old, newMessage];
                }
              );
              queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.list(),
              });
            }
            break;
          }

          case "message_edited": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            const messageId = data.message_id || data.data?.message_id;
            if (conversationId && messageId) {
              queryClient.setQueryData<Message[]>(
                queryKeys.messages.list(conversationId),
                (old) => old?.map(msg =>
                  msg.id === messageId
                    ? {
                        ...msg,
                        encrypted_content: data.data?.encrypted_content || data.encrypted_content,
                        signature: data.data?.signature || data.signature,
                        edited_at: data.data?.edited_at || data.edited_at || new Date().toISOString()
                      }
                    : msg
                ) || []
              );
            }
            break;
          }

          case "message_deleted": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            const messageId = data.message_id || data.data?.message_id;
            if (conversationId && messageId) {
              queryClient.setQueryData<Message[]>(
                queryKeys.messages.list(conversationId),
                (old) => old?.filter(msg => msg.id !== messageId) || []
              );
              queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.list(),
              });
            }
            break;
          }

          case "message_pinned": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            const messageId = data.message_id || data.data?.message_id;
            if (conversationId && messageId) {
              queryClient.setQueryData<Message[]>(
                queryKeys.messages.list(conversationId),
                (old) => old?.map(msg =>
                  msg.id === messageId
                    ? { ...msg, pinned_at: data.data?.pinned_at || data.pinned_at || new Date().toISOString() }
                    : msg
                ) || []
              );
              queryClient.invalidateQueries({
                queryKey: queryKeys.messages.pinned(conversationId),
              });
            }
            break;
          }

          case "message_unpinned": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            const messageId = data.message_id || data.data?.message_id;
            if (conversationId && messageId) {
              queryClient.setQueryData<Message[]>(
                queryKeys.messages.list(conversationId),
                (old) => old?.map(msg =>
                  msg.id === messageId
                    ? { ...msg, pinned_at: undefined }
                    : msg
                ) || []
              );
              queryClient.invalidateQueries({
                queryKey: queryKeys.messages.pinned(conversationId),
              });
            }
            break;
          }

          case "reaction_added":
          case "message_reaction": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            const messageId = data.message_id || data.data?.message_id;
            if (conversationId && messageId) {
              queryClient.setQueryData<Message[]>(
                queryKeys.messages.list(conversationId),
                (old) => old?.map(msg => {
                  if (msg.id === messageId) {
                    const newReaction: ApiMessageReaction = {
                      id: data.data?.id || data.id || `reaction-${Date.now()}`,
                      message_id: messageId,
                      user_id: data.data?.user_id || data.user_id || "",
                      emoji: data.data?.emoji || data.emoji || "",
                      created_at: data.data?.created_at || data.created_at || new Date().toISOString(),
                    };
                    const exists = msg.reactions.some(r => r.id === newReaction.id);
                    return {
                      ...msg,
                      reactions: exists ? msg.reactions : [...msg.reactions, newReaction]
                    };
                  }
                  return msg;
                }) || []
              );
            }
            break;
          }

          case "reaction_removed": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            const messageId = data.message_id || data.data?.message_id;
            const userId = data.user_id || data.data?.user_id;
            const emoji = data.emoji || data.data?.emoji;
            if (conversationId && messageId && userId && emoji) {
              queryClient.setQueryData<Message[]>(
                queryKeys.messages.list(conversationId),
                (old) => old?.map(msg => {
                  if (msg.id === messageId) {
                    return {
                      ...msg,
                      reactions: msg.reactions.filter(r => !(r.user_id === userId && r.emoji === emoji))
                    };
                  }
                  return msg;
                }) || []
              );
            }
            break;
          }

          case "friend_request":
          case "friend_accepted":
            queryClient.invalidateQueries({
              queryKey: queryKeys.friends.list(),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.friends.requests(),
            });
            break;

          case "group_created":
          case "conversation_created":
          case "conversation_updated":
            queryClient.invalidateQueries({
              queryKey: queryKeys.conversations.list(),
            });
            break;

          case "group_member_added":
          case "group_member_removed":
          case "group_member_left": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            if (conversationId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.members(conversationId),
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.list(),
              });
            }
            break;
          }

          case "group_owner_changed":
          case "group_metadata_updated": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            if (conversationId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.detail(conversationId),
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.list(),
              });
            }
            break;
          }

          case "group_deleted": {
            const conversationId = data.conversation_id || data.data?.conversation_id;
            if (conversationId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.list(),
              });
              queryClient.removeQueries({
                queryKey: queryKeys.conversations.detail(conversationId),
              });
            }
            break;
          }

          case "server_created":
          case "server_updated":
          case "server_deleted":
            queryClient.invalidateQueries({
              queryKey: queryKeys.servers.list(),
            });
            break;

          case "member_roles_updated": {
            const serverId = data.server_id || data.data?.server_id;
            if (serverId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.servers.members(serverId),
              });
            }
            break;
          }

          case "role_created":
          case "role_updated":
          case "role_deleted": {
            const serverId = data.server_id || data.data?.server_id;
            if (serverId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.servers.roles(serverId),
              });
            }
            break;
          }

          case "typing":
          case "typing_start":
          case "typing_stop":
            break;

          default:
            console.log("[CacheSync] Unhandled WebSocket event:", data.type);
        }
      } catch (err) {
        console.error("[CacheSync] Failed to process WebSocket message:", err);
      }
    };

    const unsubscribe = centralWebSocketService.onMessage(handleMessage);
    return unsubscribe;
  }, [queryClient]);
}
