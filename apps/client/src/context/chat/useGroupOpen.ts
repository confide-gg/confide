import { useCallback } from "react";
import { cryptoService } from "../../core/crypto/crypto";
import { centralWebSocketService } from "../../core/network/CentralWebSocketService";
import { messageService } from "../../features/chat/messages";
import { conversationService } from "../../features/chat/conversations";
import { groupService } from "../../features/groups/groupService";
import type {
  DecryptedMessage,
  DmPreview,
  SidebarView,
  SystemMessageType,
} from "../../types/index";

interface UseGroupOpenParams {
  userId: string | undefined;
  userKeys: { kem_secret_key: number[] } | null;
  setSidebarView: (view: SidebarView) => void;
  setIsLoadingChat: (loading: boolean) => void;
  setChatMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setActiveChat: React.Dispatch<React.SetStateAction<any>>;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  setDmPreviews: React.Dispatch<React.SetStateAction<DmPreview[]>>;
  setError: (error: string) => void;
}

export function useGroupOpen({
  userId,
  userKeys,
  setSidebarView,
  setIsLoadingChat,
  setChatMessages,
  setActiveChat,
  setUnreadCounts,
  setDmPreviews,
  setError,
}: UseGroupOpenParams) {
  const openGroupFromPreview = useCallback(
    async (preview: DmPreview) => {
      if (!userId || !userKeys) return;
      setSidebarView("dms");
      setIsLoadingChat(true);
      setChatMessages([]);
      setActiveChat(null);

      try {
        const convs = await conversationService.getConversations();
        const conv = convs.find((c) => c.id === preview.conversationId);
        if (!conv) throw new Error("Conversation not found");

        const conversationKey = await cryptoService.decryptFromSender(
          userKeys.kem_secret_key,
          conv.encrypted_sender_key
        );

        let groupName = preview.groupName || "Group";
        let groupIcon = preview.groupIcon;
        if (conv.encrypted_metadata && conv.encrypted_metadata.length > 0) {
          try {
            const plaintext = await cryptoService.decryptWithKey(
              conversationKey,
              conv.encrypted_metadata
            );
            const parsed = JSON.parse(cryptoService.bytesToString(plaintext));
            if (parsed && typeof parsed.name === "string" && parsed.name.trim()) {
              groupName = parsed.name.trim();
            }
            if (parsed && typeof parsed.icon === "string" && parsed.icon.trim()) {
              groupIcon = parsed.icon.trim();
            }
          } catch {}
        }

        let memberUsernames: string[] = preview.memberUsernames || [];
        try {
          const members = await groupService.getMembers(preview.conversationId);
          memberUsernames = members.map((m) => m.user.username);
        } catch {}

        setActiveChat({
          visitorId: preview.conversationId,
          visitorUsername: groupName,
          conversationId: preview.conversationId,
          conversationKey,
          isGroup: true,
          groupName,
          groupOwnerId: conv.owner_id || null,
          groupIcon,
          memberUsernames,
        });

        setUnreadCounts((prev) => {
          const next = new Map(prev);
          next.delete(preview.conversationId);
          return next;
        });

        setDmPreviews((prev) => {
          const idx = prev.findIndex((p) => p.conversationId === preview.conversationId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              isGroup: true,
              groupName,
              groupOwnerId: conv.owner_id || null,
              groupIcon,
              memberUsernames,
              visitorId: preview.conversationId,
              visitorUsername: groupName,
            };
            return next;
          }
          return [
            ...prev,
            {
              ...preview,
              isGroup: true,
              groupName,
              groupOwnerId: conv.owner_id || null,
              groupIcon,
              memberUsernames,
              visitorId: preview.conversationId,
              visitorUsername: groupName,
            },
          ];
        });

        centralWebSocketService.subscribeConversation(preview.conversationId);

        const msgs = await messageService.getMessages(preview.conversationId, { limit: 50 });
        const decryptedMsgs: DecryptedMessage[] = [];

        const members = await groupService.getMembers(preview.conversationId);
        const nameMap = new Map(members.map((m) => [m.user.id, m.user.username]));

        const msgMap = new Map<
          string,
          { content: string; senderName: string; isSystem?: boolean; messageType?: string }
        >();
        for (const msg of msgs) {
          const isSystemMessage = msg.message_type && msg.message_type !== "text";
          if (isSystemMessage) {
            const actorName =
              msg.sender_id === userId ? "You" : nameMap.get(msg.sender_id) || "Someone";
            let content = "";
            try {
              const payload = JSON.parse(cryptoService.bytesToString(msg.encrypted_content));
              if (
                msg.message_type === "group_member_added" &&
                Array.isArray(payload.added_user_ids)
              ) {
                const names = payload.added_user_ids.map(
                  (id: string) => nameMap.get(id) || "Someone"
                );
                content = `${actorName} added ${names.join(", ")}`;
              } else if (msg.message_type === "group_member_removed" && payload.removed_user_id) {
                const name = nameMap.get(payload.removed_user_id) || "Someone";
                content = `${actorName} removed ${name}`;
              } else if (msg.message_type === "group_member_left" && payload.user_id) {
                const name =
                  payload.user_id === userId ? "You" : nameMap.get(payload.user_id) || "Someone";
                content = `${name} left the group`;
              } else if (msg.message_type === "group_owner_changed" && payload.new_owner_id) {
                const name = nameMap.get(payload.new_owner_id) || "Someone";
                content = `${actorName} made ${name} the owner`;
              }
            } catch {}
            msgMap.set(msg.id, {
              content,
              senderName: actorName,
              isSystem: true,
              messageType: msg.message_type,
            });
            continue;
          }
          try {
            const decrypted = await cryptoService.decryptWithKey(
              conversationKey,
              msg.encrypted_content
            );
            const content = cryptoService.bytesToString(decrypted);
            const senderName = nameMap.get(msg.sender_id) || "Unknown";
            msgMap.set(msg.id, { content, senderName, isSystem: false });
          } catch {
            msgMap.set(msg.id, {
              content: "[Unable to decrypt]",
              senderName: "Unknown",
              isSystem: false,
            });
          }
        }

        for (const msg of msgs) {
          const decrypted = msgMap.get(msg.id)!;
          if (decrypted.isSystem) {
            decryptedMsgs.push({
              id: msg.id,
              senderId: msg.sender_id,
              senderName: decrypted.senderName,
              content: decrypted.content,
              createdAt: msg.created_at,
              isMine: msg.sender_id === userId,
              isSystem: true,
              systemType: msg.message_type as SystemMessageType,
              callDurationSeconds: msg.call_duration_seconds,
              reactions: [],
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
            isMine: msg.sender_id === userId,
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
        setChatMessages(decryptedMsgs.reverse());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoadingChat(false);
      }
    },
    [
      userId,
      userKeys,
      setSidebarView,
      setIsLoadingChat,
      setChatMessages,
      setActiveChat,
      setUnreadCounts,
      setDmPreviews,
      setError,
    ]
  );

  return { openGroupFromPreview };
}
