import { useCallback, MutableRefObject } from "react";
import { conversationService } from "@/features/chat/conversations";
import { messageService } from "@/features/chat/messages";
import { centralWebSocketService } from "@/core/network/CentralWebSocketService";
import { cryptoService } from "@/core/crypto/crypto";
import { showMessageNotification } from "@/utils/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries";
import type { ActiveChat, DecryptedMessage, Friend, DmPreview, SystemMessageType } from "@/types";
import type { IncomingMessageData } from "./types";
import { getPreviewContent } from "./utils";

interface UseIncomingMessagesParams {
  userId: string | undefined;
  userKeys: { kem_secret_key: number[] } | null;
  friendsList: Friend[];
  profileStatus: string | undefined;
  activeChatRef: MutableRefObject<ActiveChat | null>;
  processedMessageIds: MutableRefObject<Set<string>>;
  groupMemberNameCache: MutableRefObject<Map<string, Map<string, string>>>;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  setDmPreviews: React.Dispatch<React.SetStateAction<DmPreview[]>>;
  setChatMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
}

export function useIncomingMessages({
  userId,
  userKeys,
  friendsList,
  profileStatus,
  activeChatRef,
  processedMessageIds,
  groupMemberNameCache,
  setUnreadCounts,
  setDmPreviews,
  setChatMessages,
}: UseIncomingMessagesParams) {
  const queryClient = useQueryClient();

  const handleIncomingMessage = useCallback(
    async (msgData: IncomingMessageData) => {
      const isSystemMessage = msgData.message_type && msgData.message_type !== "text";

      if (!isSystemMessage && msgData.sender_id === userId) return;

      if (processedMessageIds.current.has(msgData.id)) return;
      processedMessageIds.current.add(msgData.id);

      centralWebSocketService.subscribeConversation(msgData.conversation_id);

      const currentChat = activeChatRef.current;
      if (!currentChat || currentChat.conversationId !== msgData.conversation_id) {
        if (!isSystemMessage) {
          setUnreadCounts((prev) => {
            const next = new Map(prev);
            const current = next.get(msgData.conversation_id) || 0;
            next.set(msgData.conversation_id, current + 1);
            return next;
          });

          const senderFriend = friendsList.find((f) => f.id === msgData.sender_id);
          if (senderFriend) {
            showMessageNotification(senderFriend.username, "sent you a message", profileStatus);
          } else {
            showMessageNotification("Someone", "sent you a message", profileStatus);
          }
        }
        setDmPreviews((prev) => {
          const idx = prev.findIndex((p) => p.conversationId === msgData.conversation_id);
          const updated = [...prev];
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              lastMessage: isSystemMessage ? updated[idx].lastMessage : "📎 Attachment",
              lastMessageTime: msgData.created_at,
              isLastMessageMine: false,
            };
          } else {
            const isGroupSystemMessage =
              msgData.message_type === "group_member_added" ||
              msgData.message_type === "group_created" ||
              msgData.message_type === "group_member_removed" ||
              msgData.message_type === "group_member_left" ||
              msgData.message_type === "group_owner_changed";
            if (!isGroupSystemMessage) {
              const senderFriend = friendsList.find((f) => f.id === msgData.sender_id);
              if (senderFriend) {
                updated.unshift({
                  conversationId: msgData.conversation_id,
                  visitorId: senderFriend.id,
                  visitorUsername: senderFriend.username,
                  lastMessage: "📎 Attachment",
                  lastMessageTime: msgData.created_at,
                  isLastMessageMine: false,
                });
              }
            }
          }
          updated.sort(
            (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
          );
          return updated;
        });
        return;
      }

      if (isSystemMessage) {
        const systemType = msgData.message_type as SystemMessageType;
        let content = "";
        if (currentChat?.isGroup) {
          let nameMap = groupMemberNameCache.current.get(msgData.conversation_id);
          if (!nameMap) {
            try {
              const members = await conversationService.getMembers(msgData.conversation_id);
              nameMap = new Map(members.map((m) => [m.user.id, m.user.username]));
              groupMemberNameCache.current.set(msgData.conversation_id, nameMap);
            } catch {
              nameMap = new Map();
            }
          }
          const actorName =
            msgData.sender_id === userId ? "You" : nameMap.get(msgData.sender_id) || "Someone";
          try {
            const payload = JSON.parse(cryptoService.bytesToString(msgData.encrypted_content));
            if (
              msgData.message_type === "group_member_added" &&
              Array.isArray(payload.added_user_ids)
            ) {
              const names = payload.added_user_ids.map(
                (id: string) => nameMap!.get(id) || "Someone"
              );
              content = `${actorName} added ${names.join(", ")}`;
            } else if (msgData.message_type === "group_member_removed" && payload.removed_user_id) {
              const name = nameMap.get(payload.removed_user_id) || "Someone";
              content = `${actorName} removed ${name}`;
            } else if (msgData.message_type === "group_member_left" && payload.user_id) {
              const name =
                payload.user_id === userId ? "You" : nameMap.get(payload.user_id) || "Someone";
              content = `${name} left the group`;
            } else if (msgData.message_type === "group_owner_changed" && payload.new_owner_id) {
              const name = nameMap.get(payload.new_owner_id) || "Someone";
              content = `${actorName} made ${name} the owner`;
            }
          } catch {}
        }
        const systemMsg: DecryptedMessage = {
          id: msgData.id,
          senderId: msgData.sender_id,
          senderName: "",
          content,
          createdAt: msgData.created_at,
          isMine: msgData.sender_id === userId,
          isSystem: true,
          systemType,
          callDurationSeconds: msgData.call_duration_seconds,
          reactions: [],
        };

        queryClient.invalidateQueries({
          queryKey: queryKeys.messages.list(msgData.conversation_id),
        });

        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msgData.id)) return prev;
          return [...prev, systemMsg];
        });
        return;
      }

      let senderName = "Unknown";

      if (currentChat.isGroup) {
        let nameMap = groupMemberNameCache.current.get(msgData.conversation_id);
        if (!nameMap) {
          try {
            const members = await conversationService.getMembers(msgData.conversation_id);
            nameMap = new Map(members.map((m) => [m.user.id, m.user.username]));
            groupMemberNameCache.current.set(msgData.conversation_id, nameMap);
          } catch {
            nameMap = new Map();
          }
        }
        senderName = nameMap.get(msgData.sender_id) || "Unknown";
      } else {
        const senderFriend = friendsList.find((f) => f.id === msgData.sender_id);
        senderName = senderFriend?.username || "Unknown";
      }

      try {
        let content = "";
        if (currentChat.isGroup) {
          const decryptedBytes = await cryptoService.decryptWithKey(
            currentChat.conversationKey,
            msgData.encrypted_content
          );
          content = cryptoService.bytesToString(decryptedBytes);
        } else {
          const keyResponse = await messageService.getMessageKey(
            msgData.conversation_id,
            msgData.id
          );
          if (!keyResponse.encrypted_key || !userKeys) {
            throw new Error("No message key available");
          }

          const messageKey = await cryptoService.decryptFromSender(
            userKeys.kem_secret_key,
            keyResponse.encrypted_key
          );

          if (!messageKey || messageKey.length !== 32) {
            throw new Error(
              `Invalid message key length: ${messageKey?.length || 0} bytes (expected 32)`
            );
          }

          const ratchetMsgJson = cryptoService.bytesToString(msgData.encrypted_content);
          const ratchetMsg = JSON.parse(ratchetMsgJson);
          const contentBytes = await cryptoService.decryptWithMessageKey(
            messageKey,
            ratchetMsg.ciphertext
          );
          content = cryptoService.bytesToString(contentBytes);
        }

        let replyToMsg: DecryptedMessage["replyTo"];
        if (msgData.reply_to_id) {
          setChatMessages((prev) => {
            const r = prev.find((m) => m.id === msgData.reply_to_id);
            if (r)
              replyToMsg = { id: r.id, content: r.content, senderName: r.senderName || "Unknown" };
            return prev;
          });
        }

        const newMsg: DecryptedMessage = {
          id: msgData.id,
          senderId: msgData.sender_id,
          senderName,
          content,
          createdAt: msgData.created_at,
          isMine: false,
          isGif: content.startsWith("https://") && content.includes("tenor"),
          expiresAt: msgData.expires_at,
          replyToId: msgData.reply_to_id,
          replyTo: replyToMsg,
          reactions: [],
          pinnedAt: msgData.pinned_at,
        };

        queryClient.invalidateQueries({
          queryKey: queryKeys.messages.list(msgData.conversation_id),
        });

        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msgData.id)) return prev;
          if (msgData.reply_to_id && !newMsg.replyTo) {
            const r = prev.find((m) => m.id === msgData.reply_to_id);
            if (r)
              newMsg.replyTo = {
                id: r.id,
                content: r.content,
                senderName: r.senderName || "Unknown",
              };
          }
          return [...prev, newMsg];
        });

        const previewContent = getPreviewContent(content);
        setDmPreviews((prev) => {
          const idx = prev.findIndex((p) => p.conversationId === msgData.conversation_id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              lastMessage: previewContent,
              lastMessageTime: msgData.created_at,
              isLastMessageMine: false,
            };
            updated.sort(
              (a, b) =>
                new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
            );
            return updated;
          }
          return prev;
        });
      } catch (err) {
        console.error("Failed to decrypt incoming message:", err);
      }
    },
    [
      userId,
      userKeys,
      friendsList,
      profileStatus,
      activeChatRef,
      processedMessageIds,
      groupMemberNameCache,
      setUnreadCounts,
      setDmPreviews,
      setChatMessages,
      queryClient,
    ]
  );

  return { handleIncomingMessage };
}
