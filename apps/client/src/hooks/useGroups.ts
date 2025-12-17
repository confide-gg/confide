import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { conversationService } from "../features/chat/conversations";
import type { ConversationWithRouting, DmPreview } from "../features/chat/types";
import type { Friend } from "../features/friends/types";
import { cryptoService } from "../core/crypto/crypto";
import { groupService } from "../features/groups/groupService";
import { createGroupEncryptionPayload } from "../features/groups/groupEncryption";

export function useGroups() {
  const { user, keys } = useAuth();

  const [groupPreviews, setGroupPreviews] = useState<DmPreview[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  const loadGroupPreviews = useCallback(async () => {
    if (!user || !keys) return;
    setIsLoadingGroups(true);
    try {
      const convs = await conversationService.getConversations();
      const groups = convs.filter((c) => c.conversation_type === "group");
      const previews: DmPreview[] = [];

      for (const conv of groups) {
        const conversationKey = await cryptoService.decryptFromSender(
          keys.kem_secret_key,
          conv.encrypted_sender_key
        );

        let groupName = "Group";
        let groupIcon: string | undefined;
        if (conv.encrypted_metadata && conv.encrypted_metadata.length > 0) {
          try {
            const plaintext = await cryptoService.decryptWithKey(conversationKey, conv.encrypted_metadata);
            const json = cryptoService.bytesToString(plaintext);
            const parsed = JSON.parse(json);
            if (parsed && typeof parsed.name === "string" && parsed.name.trim()) {
              groupName = parsed.name.trim();
            }
            if (parsed && typeof parsed.icon === "string" && parsed.icon.trim()) {
              groupIcon = parsed.icon.trim();
            }
          } catch {
          }
        }

        let memberUsernames: string[] = [];
        try {
          const members = await groupService.getMembers(conv.id);
          memberUsernames = members.map((m) => m.user.username);
        } catch {
        }

        previews.push({
          conversationId: conv.id,
          visitorId: conv.id,
          visitorUsername: groupName,
          lastMessage: "",
          lastMessageTime: conv.created_at,
          isLastMessageMine: false,
          isGroup: true,
          groupName,
          groupOwnerId: (conv as ConversationWithRouting).owner_id || null,
          groupIcon,
          memberUsernames,
          memberIds: undefined,
        });
      }

      setGroupPreviews(previews);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [user, keys]);

  const createGroup = useCallback(
    async (params: { name: string; icon?: string; memberIds: string[]; friends: Friend[] }) => {
      if (!user || !keys) throw new Error("Not authenticated");

      const members = params.memberIds.map((id) => ({
        id,
        kem_public_key: params.friends.find((f) => f.id === id)?.kem_public_key,
      }));

      const payload = await createGroupEncryptionPayload({
        me: { id: user.id, kem_public_key: keys.kem_public_key },
        myKeys: keys,
        metadata: { name: params.name, icon: params.icon },
        members,
      });

      await groupService.createGroup({
        encrypted_metadata: payload.encrypted_metadata,
        members: payload.members,
      });

      await loadGroupPreviews();
    },
    [user, keys, loadGroupPreviews]
  );

  const mergedPreviews = useMemo(() => groupPreviews, [groupPreviews]);

  return {
    groupPreviews: mergedPreviews,
    setGroupPreviews,
    isLoadingGroups,
    loadGroupPreviews,
    createGroup,
  };
}


