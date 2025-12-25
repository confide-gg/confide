import { cryptoService, type DecryptedKeys } from "../../core/crypto/crypto";
import { keyService } from "../../core/crypto/KeyService";
import type { MemberInit } from "../chat/types";

export interface GroupMetadataPlaintext {
  name: string;
  icon?: string;
}

export async function resolveKemPublicKey(userId: string, kemPublicKey?: number[]) {
  if (kemPublicKey && kemPublicKey.length > 0) return kemPublicKey;
  const bundle = await keyService.getPrekeyBundle(userId);
  return bundle.identity_key;
}

export async function createGroupEncryptionPayload(params: {
  me: { id: string; kem_public_key: number[] };
  myKeys: DecryptedKeys;
  metadata: GroupMetadataPlaintext;
  members: Array<{ id: string; kem_public_key?: number[] }>;
}): Promise<{
  conversationKey: number[];
  encrypted_metadata: number[] | null;
  members: MemberInit[];
}> {
  const conversationKey = await cryptoService.generateConversationKey();
  const metadataBytes = cryptoService.stringToBytes(JSON.stringify(params.metadata));
  const encryptedMetadata = await cryptoService.encryptWithKey(conversationKey, metadataBytes);

  const allMemberIds = Array.from(new Set([params.me.id, ...params.members.map((m) => m.id)]));

  const memberInits: MemberInit[] = [];
  for (const userId of allMemberIds) {
    const kemPublicKey =
      userId === params.me.id
        ? params.me.kem_public_key
        : await resolveKemPublicKey(
            userId,
            params.members.find((m) => m.id === userId)?.kem_public_key
          );

    const encryptedSenderKey = await cryptoService.encryptForRecipient(
      kemPublicKey,
      conversationKey
    );
    const role = userId === params.me.id ? "owner" : "member";
    const roleBytes = cryptoService.stringToBytes(JSON.stringify({ role }));
    const encryptedRole = await cryptoService.encryptForRecipient(kemPublicKey, roleBytes);

    memberInits.push({
      user_id: userId,
      encrypted_sender_key: encryptedSenderKey,
      encrypted_role: encryptedRole,
    });
  }

  return {
    conversationKey,
    encrypted_metadata: encryptedMetadata,
    members: memberInits,
  };
}

export async function addMemberEncryptionPayload(params: {
  conversationKey: number[];
  userId: string;
  userKemPublicKey?: number[];
}): Promise<{ user_id: string; encrypted_sender_key: number[]; encrypted_role: number[] }> {
  const kemPublicKey = await resolveKemPublicKey(params.userId, params.userKemPublicKey);
  const encryptedSenderKey = await cryptoService.encryptForRecipient(
    kemPublicKey,
    params.conversationKey
  );
  const roleBytes = cryptoService.stringToBytes(JSON.stringify({ role: "member" }));
  const encryptedRole = await cryptoService.encryptForRecipient(kemPublicKey, roleBytes);
  return {
    user_id: params.userId,
    encrypted_sender_key: encryptedSenderKey,
    encrypted_role: encryptedRole,
  };
}
