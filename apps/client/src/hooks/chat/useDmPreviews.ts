import { useCallback } from "react";
import { conversationService } from "../../features/chat/conversations";
import { messageService } from "../../features/chat/messages";
import type { DmPreview } from "../../types";

interface UseDmPreviewsParams {
  userKeys: { kem_secret_key: number[] } | null;
  userId: string | undefined;
  setDmPreviews: React.Dispatch<React.SetStateAction<DmPreview[]>>;
}

export function useDmPreviews({ userKeys, userId, setDmPreviews }: UseDmPreviewsParams) {
  const loadDmPreviews = useCallback(async () => {
    if (!userKeys || !userId) return;

    try {
      const allConvs = await conversationService.getConversations();
      const previews: DmPreview[] = [];

      for (const conv of allConvs) {
        if (conv.conversation_type !== "dm") continue;

        let visitorId = "";
        let visitorUsername = "";

        try {
          const members = await conversationService.getMembers(conv.id);
          const otherMember = members.find((m) => m.user.id !== userId);
          if (!otherMember) continue;
          visitorId = otherMember.user.id;
          visitorUsername = otherMember.user.username;
        } catch {
          continue;
        }

        try {
          const recentMsgs = await messageService.getMessages(conv.id, { limit: 1 });
          let lastMessage = "";
          let lastMessageTime = conv.created_at;
          let isLastMessageMine = false;

          if (recentMsgs.length > 0) {
            const msg = recentMsgs[0];
            lastMessage = "📎 Attachment";
            lastMessageTime = msg.created_at;
            isLastMessageMine = msg.sender_id === userId;
          } else {
            lastMessage = "Started a chat";
          }

          previews.push({
            conversationId: conv.id,
            visitorId,
            visitorUsername,
            lastMessage,
            lastMessageTime,
            isLastMessageMine,
          });
        } catch {
          continue;
        }
      }

      previews.sort(
        (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );
      setDmPreviews((prev) => {
        const groups = prev.filter((p) => p.isGroup);
        const merged = [...groups, ...previews];
        merged.sort(
          (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );
        return merged;
      });
    } catch (err) {
      console.error("Failed to load DM previews:", err);
    }
  }, [userKeys, userId, setDmPreviews]);

  return { loadDmPreviews };
}
