import { useCallback, type MutableRefObject } from "react";
import { cryptoService } from "../../core/crypto/crypto";
import type { DecryptedCategory, DecryptedChannel, FederatedServer } from "../../features/servers/types";
import { FederatedServerClient, type FederatedMember as Member } from "../../features/servers/federatedClient";
import type { WsMember } from "../../features/servers/federatedWebSocket";
import { getLastChannelForServer } from "./storage";

interface UseFederatedServerDataParams {
  keys: { kem_public_key: number[]; kem_secret_key: number[] } | null;
  setIsLoading: (loading: boolean) => void;
  setCategories: React.Dispatch<React.SetStateAction<DecryptedCategory[]>>;
  setChannels: React.Dispatch<React.SetStateAction<DecryptedChannel[]>>;
  setActiveChannel: (channel: DecryptedChannel | null) => void;
  federatedClientRef: MutableRefObject<FederatedServerClient | null>;
  myMemberRef: MutableRefObject<Member | null>;
}

export function useFederatedServerData({
  keys,
  setIsLoading,
  setCategories,
  setChannels,
  setActiveChannel,
  federatedClientRef,
  myMemberRef,
}: UseFederatedServerDataParams) {
  const distributeKeysToMember = useCallback(async (
    client: FederatedServerClient,
    newMember: WsMember | Member,
    myMember: Member
  ) => {
    if (!keys) return;

    const myChannelKeys = myMember.encrypted_channel_keys || {};
    const channelIds = Object.keys(myChannelKeys);

    for (const channelId of channelIds) {
      const encryptedKey = myChannelKeys[channelId];
      if (!encryptedKey || encryptedKey.length === 0) continue;

      try {
        const decryptedKey = await cryptoService.decryptFromSender(
          Array.from(keys.kem_secret_key),
          encryptedKey
        );

        const reEncryptedKey = await cryptoService.encryptForRecipient(
          newMember.kem_public_key,
          decryptedKey
        );

        await client.distributeChannelKey(newMember.id, channelId, reEncryptedKey);
      } catch (err) {
        console.error(`Failed to distribute key for channel ${channelId}:`, err);
      }
    }
  }, [keys]);

  const loadFederatedServerData = useCallback(async (server: FederatedServer, autoSelectChannel: boolean = false) => {
    if (!server.session_token) {
      console.error("No session token for federated server");
      return;
    }

    setIsLoading(true);
    try {
      const client = new FederatedServerClient(server.domain, server.session_token);
      federatedClientRef.current = client;

      const [categoriesRes, channelsRes, myMember] = await Promise.all([
        client.getCategories(),
        client.getChannels(),
        client.getMe(),
      ]);

      const decryptedChannels: DecryptedChannel[] = channelsRes.map((ch) => ({
        id: ch.id,
        server_id: server.id,
        category_id: ch.category_id,
        conversation_id: ch.id,
        name: ch.name,
        description: ch.description,
        position: ch.position,
        created_at: ch.created_at,
      }));

      const decryptedCategories: DecryptedCategory[] = categoriesRes.map((cat) => ({
        id: cat.id,
        server_id: server.id,
        name: cat.name,
        position: cat.position,
        created_at: cat.created_at,
        channels: decryptedChannels.filter((ch) => ch.category_id === cat.id),
      }));

      setCategories(decryptedCategories);
      setChannels(decryptedChannels);

      if (autoSelectChannel && decryptedChannels.length > 0) {
        const lastChannelId = getLastChannelForServer(server.id);
        const lastChannel = lastChannelId
          ? decryptedChannels.find(ch => ch.id === lastChannelId)
          : null;

        if (lastChannel) {
          setActiveChannel(lastChannel);
        } else {
          const sortedChannels = [...decryptedChannels].sort((a, b) => a.position - b.position);
          setActiveChannel(sortedChannels[0]);
        }
      }

      if (keys && channelsRes.length > 0 && server.is_owner) {
        const currentChannelKeys = myMember.encrypted_channel_keys || {};
        const missingKeyChannels = channelsRes.filter(
          (ch) => !currentChannelKeys[ch.id] || currentChannelKeys[ch.id].length === 0
        );

        if (missingKeyChannels.length > 0) {
          const updatedKeys = { ...currentChannelKeys };
          for (const ch of missingKeyChannels) {
            const channelKey = await cryptoService.generateChannelKey();
            const encryptedChannelKey = await cryptoService.encryptForRecipient(
              Array.from(keys.kem_public_key),
              channelKey
            );
            updatedKeys[ch.id] = encryptedChannelKey;
          }
          await client.updateMyChannelKeys(updatedKeys);
          const updatedMyMember = await client.getMe();
          myMemberRef.current = updatedMyMember;

          const allMembers = await client.getMembers();
          for (const member of allMembers) {
            if (member.id === updatedMyMember.id) continue;
            const memberKeys = member.encrypted_channel_keys || {};
            const hasMissingKeys = channelsRes.some(
              ch => !memberKeys[ch.id] || memberKeys[ch.id].length === 0
            );
            if (hasMissingKeys) {
              await distributeKeysToMember(client, member, updatedMyMember);
            }
          }
        } else {
          myMemberRef.current = myMember;
        }
      } else {
        myMemberRef.current = myMember;
      }
    } catch (error) {
      console.error("Failed to load federated server data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [keys, setIsLoading, setCategories, setChannels, setActiveChannel, federatedClientRef, myMemberRef, distributeKeysToMember]);

  return { loadFederatedServerData, distributeKeysToMember };
}
