import { useCallback, type MutableRefObject } from "react";
import { cryptoService } from "../../core/crypto/crypto";
import type { DecryptedChannel, FederatedServer, AnyServer } from "../../features/servers/types";
import { isFederatedServer } from "../../features/servers/types";
import { FederatedServerClient } from "../../features/servers/federatedClient";

interface UseServerCRUDParams {
  keys: { kem_public_key: Uint8Array; kem_secret_key: Uint8Array } | null;
  activeServer: AnyServer | null;
  channels: DecryptedChannel[];
  activeChannel: DecryptedChannel | null;
  setActiveChannel: (channel: DecryptedChannel | null) => void;
  federatedClientRef: MutableRefObject<FederatedServerClient | null>;
  loadFederatedServerData: (server: FederatedServer, autoSelectChannel?: boolean) => Promise<void>;
}

export function useServerCRUD({
  keys,
  activeServer,
  channels,
  activeChannel,
  setActiveChannel,
  federatedClientRef,
  loadFederatedServerData,
}: UseServerCRUDParams) {
  const createServer = useCallback(async (_name: string, _description?: string) => {
    throw new Error("Direct server creation not supported - use federated servers");
  }, []);

  const createCategory = useCallback(async (_serverId: string, name: string, position: number = 0) => {
    if (!activeServer || !isFederatedServer(activeServer)) {
      throw new Error("Can only create categories on federated servers");
    }

    if (!federatedClientRef.current) {
      throw new Error("No federated client available");
    }

    try {
      await federatedClientRef.current.createCategory({ name, position });
      await loadFederatedServerData(activeServer);
    } catch (error) {
      console.error("Failed to create category:", error);
      throw error;
    }
  }, [activeServer, federatedClientRef, loadFederatedServerData]);

  const createChannel = useCallback(async (
    serverId: string,
    name: string,
    categoryId?: string,
    description?: string
  ) => {
    if (!activeServer || !isFederatedServer(activeServer)) {
      throw new Error("Can only create channels on federated servers");
    }

    if (!federatedClientRef.current || !keys) {
      throw new Error("No federated client available");
    }

    try {
      const existingChannels = channels.filter((ch) =>
        categoryId ? ch.category_id === categoryId : !ch.category_id
      );
      const position = existingChannels.length;

      const newChannel = await federatedClientRef.current.createChannel({
        category_id: categoryId,
        name,
        description,
        position,
      });

      const channelKey = await cryptoService.generateChannelKey();
      const encryptedChannelKey = await cryptoService.encryptForRecipient(
        Array.from(keys.kem_public_key),
        channelKey
      );

      const myMember = await federatedClientRef.current.getMe();
      const currentChannelKeys = myMember.encrypted_channel_keys || {};
      const updatedKeys = {
        ...currentChannelKeys,
        [newChannel.id]: encryptedChannelKey,
      };

      await federatedClientRef.current.updateMyChannelKeys(updatedKeys);

      await loadFederatedServerData(activeServer);

      const decryptedChannel: DecryptedChannel = {
        id: newChannel.id,
        server_id: serverId,
        category_id: newChannel.category_id,
        conversation_id: newChannel.id,
        name: newChannel.name,
        description: newChannel.description,
        position: newChannel.position,
        created_at: newChannel.created_at,
      };

      setActiveChannel(decryptedChannel);
    } catch (error) {
      console.error("Failed to create channel:", error);
      throw error;
    }
  }, [activeServer, keys, channels, federatedClientRef, loadFederatedServerData, setActiveChannel]);

  const deleteChannel = useCallback(async (_serverId: string, channelId: string) => {
    if (!activeServer || !isFederatedServer(activeServer)) {
      throw new Error("Can only delete channels on federated servers");
    }

    if (!federatedClientRef.current) {
      throw new Error("No federated client available");
    }

    try {
      await federatedClientRef.current.deleteChannel(channelId);

      if (activeChannel?.id === channelId) {
        setActiveChannel(null);
      }

      await loadFederatedServerData(activeServer);
    } catch (error) {
      console.error("Failed to delete channel:", error);
      throw error;
    }
  }, [activeServer, activeChannel, federatedClientRef, loadFederatedServerData, setActiveChannel]);

  return { createServer, createCategory, createChannel, deleteChannel };
}
