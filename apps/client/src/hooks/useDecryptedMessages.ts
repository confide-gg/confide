import { useQuery } from "@tanstack/react-query";
import { messageService } from "../features/chat/messages";
import { conversationService } from "../features/chat/conversations";
import { cryptoService } from "../core/crypto/crypto";
import { queryKeys } from "./useQueries";
import type { Message } from "../features/chat/types";
import type { DecryptedMessage } from "../types";

interface DecryptionContext {
  userId: string;
  username: string;
  kemSecretKey: number[];
  isGroup: boolean;
  conversationKey?: number[];
  visitorUsername?: string;
  visitorId?: string;
  conversationId: string;
}

async function decryptMessages(
  messages: Message[],
  context: DecryptionContext
): Promise<DecryptedMessage[]> {
  const decryptedMsgs: DecryptedMessage[] = [];

  let groupMemberNames: Map<string, string> | null = null;
  if (context.isGroup) {
    try {
      const members = await conversationService.getMembers(context.conversationId);
      groupMemberNames = new Map(members.map((m) => [m.user.id, m.user.username]));
    } catch (err) {
      console.error("Failed to fetch group members for decryption:", err);
      groupMemberNames = new Map();
    }
  }

  const decryptPromises = messages.map(async (msg) => {
    const isSystemMessage = msg.message_type && msg.message_type !== "text";

    if (isSystemMessage) {
      return { id: msg.id, content: "", senderName: "System", isSystem: true, messageType: msg.message_type };
    }

    try {
      let senderName: string;
      if (msg.sender_id === context.userId) {
        senderName = context.username;
      } else if (context.isGroup && groupMemberNames) {
        senderName = groupMemberNames.get(msg.sender_id) || "Unknown";
      } else {
        senderName = context.visitorUsername || "Unknown";
      }

      let content = "";

      if (context.isGroup && context.conversationKey) {
        const decryptedBytes = await cryptoService.decryptWithKey(
          context.conversationKey,
          msg.encrypted_content
        );
        content = cryptoService.bytesToString(decryptedBytes);
      } else {
        if (!msg.encrypted_key || msg.encrypted_key.length === 0) {
          throw new Error("No message key available");
        }

        const messageKey = await cryptoService.decryptFromSender(
          context.kemSecretKey,
          msg.encrypted_key
        );

        if (!messageKey || messageKey.length !== 32) {
          throw new Error(`Invalid message key length: ${messageKey?.length || 0} bytes`);
        }

        const ratchetMsgJson = cryptoService.bytesToString(msg.encrypted_content);
        const ratchetMsg = JSON.parse(ratchetMsgJson);
        const contentBytes = await cryptoService.decryptWithMessageKey(
          messageKey,
          ratchetMsg.ciphertext
        );
        content = cryptoService.bytesToString(contentBytes);
      }

      return { id: msg.id, content, senderName, isSystem: false };
    } catch (err) {
      console.error(`Failed to decrypt message ${msg.id}:`, err);
      return {
        id: msg.id,
        content: "[Unable to decrypt]",
        senderName: "Unknown",
        isSystem: false
      };
    }
  });

  const decryptedResults = await Promise.all(decryptPromises);
  const msgMap = new Map(decryptedResults.map(r => [r.id, r]));

  for (const msg of messages) {
    const decrypted = msgMap.get(msg.id)!;

    if (decrypted.isSystem) {
      let systemContent = "";

      if (context.isGroup && groupMemberNames) {
        const actorName = msg.sender_id === context.userId ? "You" : (groupMemberNames.get(msg.sender_id) || "Someone");
        try {
          const payload = JSON.parse(cryptoService.bytesToString(msg.encrypted_content));
          if (msg.message_type === "group_member_added" && Array.isArray(payload.added_user_ids)) {
            const names = payload.added_user_ids.map((id: string) => groupMemberNames!.get(id) || "Someone");
            systemContent = `${actorName} added ${names.join(", ")}`;
          } else if (msg.message_type === "group_member_removed" && payload.removed_user_id) {
            const name = groupMemberNames.get(payload.removed_user_id) || "Someone";
            systemContent = `${actorName} removed ${name}`;
          } else if (msg.message_type === "group_member_left" && payload.user_id) {
            const name = payload.user_id === context.userId ? "You" : (groupMemberNames.get(payload.user_id) || "Someone");
            systemContent = `${name} left the group`;
          } else if (msg.message_type === "group_owner_changed" && payload.new_owner_id) {
            const name = groupMemberNames.get(payload.new_owner_id) || "Someone";
            systemContent = `${actorName} made ${name} the owner`;
          }
        } catch (err) {
          console.error("Failed to decode system message payload:", err);
        }
      }

      decryptedMsgs.push({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: "",
        content: systemContent,
        createdAt: msg.created_at,
        isMine: msg.sender_id === context.userId,
        isSystem: true,
        systemType: msg.message_type as any,
        callDurationSeconds: msg.call_duration_seconds,
        reactions: msg.reactions.map((r) => ({
          id: r.id,
          userId: r.user_id,
          messageId: r.message_id,
          emoji: r.emoji,
          createdAt: r.created_at,
        })),
      });
      continue;
    }

    let replyToMsg: DecryptedMessage["replyTo"];
    if (msg.reply_to_id) {
      const replyData = msgMap.get(msg.reply_to_id);
      if (replyData && !replyData.isSystem) {
        replyToMsg = {
          id: msg.reply_to_id,
          content: replyData.content,
          senderName: replyData.senderName,
        };
      }
    }

    decryptedMsgs.push({
      id: msg.id,
      senderId: msg.sender_id,
      senderName: decrypted.senderName,
      content: decrypted.content,
      createdAt: msg.created_at,
      isMine: msg.sender_id === context.userId,
      isGif: decrypted.content.startsWith("https://") && decrypted.content.includes("tenor"),
      expiresAt: msg.expires_at,
      replyToId: msg.reply_to_id,
      replyTo: replyToMsg,
      reactions: msg.reactions.map((r) => ({
        id: r.id,
        userId: r.user_id,
        messageId: r.message_id,
        emoji: r.emoji,
        createdAt: r.created_at,
      })),
      editedAt: msg.edited_at,
      pinnedAt: msg.pinned_at,
    });
  }

  return decryptedMsgs.reverse();
}

export function useDecryptedMessages(
  conversationId: string | null,
  context: DecryptionContext | null
) {
  return useQuery({
    queryKey: [...queryKeys.messages.list(conversationId || ""), "decrypted", context?.userId, context?.isGroup],
    queryFn: async () => {
      if (!conversationId || !context) {
        return [];
      }

      const encryptedMessages = await messageService.getMessages(conversationId, { limit: 50 });
      return decryptMessages(encryptedMessages, context);
    },
    enabled: !!conversationId && !!context,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  });
}
