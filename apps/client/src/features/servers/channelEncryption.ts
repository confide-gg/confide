import { cryptoService } from "../../core/crypto/crypto";
import { keyService } from "../../core/crypto/KeyService";

export interface ChannelKeyDistribution {
  member_id: string;
  encrypted_key: number[];
}

async function resolveKemPublicKey(userId: string, kemPublicKey?: number[]): Promise<number[]> {
  if (kemPublicKey && kemPublicKey.length > 0) return kemPublicKey;
  const bundle = await keyService.getPrekeyBundle(userId);
  return bundle.identity_key;
}

export async function createChannelEncryptionPayload(
  members: Array<{ id: string; kem_public_key?: number[] }>
): Promise<{ channelKey: number[]; distributions: ChannelKeyDistribution[] }> {
  const channelKey = await cryptoService.generateConversationKey();
  const distributions: ChannelKeyDistribution[] = [];

  for (const member of members) {
    const kemPubKey = await resolveKemPublicKey(member.id, member.kem_public_key);
    const encryptedKey = await cryptoService.encryptForRecipient(kemPubKey, channelKey);
    distributions.push({ member_id: member.id, encrypted_key: encryptedKey });
  }

  return { channelKey, distributions };
}

export async function encryptChannelKeyForMember(
  channelKey: number[],
  member: { id: string; kem_public_key?: number[] }
): Promise<ChannelKeyDistribution> {
  const kemPubKey = await resolveKemPublicKey(member.id, member.kem_public_key);
  const encryptedKey = await cryptoService.encryptForRecipient(kemPubKey, channelKey);
  return { member_id: member.id, encrypted_key: encryptedKey };
}

export async function encryptChannelKeysForMembers(
  channelKey: number[],
  members: Array<{ id: string; kem_public_key?: number[] }>
): Promise<ChannelKeyDistribution[]> {
  const distributions: ChannelKeyDistribution[] = [];
  for (const member of members) {
    const distribution = await encryptChannelKeyForMember(channelKey, member);
    distributions.push(distribution);
  }
  return distributions;
}
