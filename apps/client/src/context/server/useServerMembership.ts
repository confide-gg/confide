import { useCallback } from "react";
import { cryptoService } from "../../core/crypto/crypto";
import { federationService } from "../../features/servers/federation";
import type { FederatedServer, AnyServer } from "../../features/servers/types";
import { FederatedServerClient } from "../../features/servers/federatedClient";
import { saveFederatedServersToDB } from "./storage";
import type { RegisterServerData } from "./types";

interface UseServerMembershipParams {
  user: { id: string; username: string } | null;
  keys: { kem_public_key: number[]; kem_secret_key: number[]; dsa_public_key: number[] } | null;
  federatedServers: FederatedServer[];
  activeServer: AnyServer | null;
  setFederatedServers: React.Dispatch<React.SetStateAction<FederatedServer[]>>;
  setActiveServer: (server: AnyServer | null) => void;
  setActiveChannel: (channel: null) => void;
}

export function useServerMembership({
  user,
  keys,
  federatedServers,
  activeServer,
  setFederatedServers,
  setActiveServer,
  setActiveChannel,
}: UseServerMembershipParams) {
  const joinServerByDomain = useCallback(
    async (domain: string, password?: string) => {
      if (!user || !keys) throw new Error("Not authenticated");

      try {
        const tokenResponse = await federationService.requestFederationToken(domain);

        const joinResponse = await federationService.joinServerWithToken(
          domain,
          tokenResponse.token,
          {
            user_id: user.id,
            username: user.username,
            kem_public_key: Array.from(keys.kem_public_key),
            dsa_public_key: Array.from(keys.dsa_public_key),
          },
          password
        );

        const newServer: FederatedServer = {
          id: tokenResponse.server_info.id,
          domain,
          name: tokenResponse.server_info.display_name,
          description: tokenResponse.server_info.description,
          icon_url: tokenResponse.server_info.icon_url,
          session_token: joinResponse.session_token,
          member_id: joinResponse.member_id,
          isFederated: true,
        };

        const updatedServers = [...federatedServers, newServer];
        setFederatedServers(updatedServers);
        await saveFederatedServersToDB(updatedServers, Array.from(keys.kem_secret_key));
      } catch (error) {
        console.error("Failed to join server:", error);
        throw error;
      }
    },
    [user, keys, federatedServers, setFederatedServers]
  );

  const registerAndJoinServer = useCallback(
    async (data: RegisterServerData) => {
      if (!user || !keys) throw new Error("Not authenticated");

      try {
        const result = await federationService.registerServer({
          ...data,
          user_id: user.id,
        });

        const newServer: FederatedServer = {
          id: result.server_id,
          domain: data.domain,
          name: result.server_name,
          description: "",
          session_token: result.session_token,
          member_id: result.member_id,
          is_owner: true,
          isFederated: true,
        };

        const updatedServers = [...federatedServers, newServer];
        setFederatedServers(updatedServers);
        await saveFederatedServersToDB(updatedServers, Array.from(keys.kem_secret_key));

        try {
          if (newServer.session_token) {
            const client = new FederatedServerClient(newServer.domain, newServer.session_token);

            const category = await client.createCategory({
              name: "Text Channels",
              position: 0,
            });

            const channel = await client.createChannel({
              name: "general",
              category_id: category.id,
              position: 0,
              description: "General discussion",
            });

            const channelKey = await cryptoService.generateChannelKey();
            const encryptedChannelKey = await cryptoService.encryptForRecipient(
              Array.from(keys.kem_public_key),
              channelKey
            );

            const myMember = await client.getMe();
            const currentChannelKeys = myMember.encrypted_channel_keys || {};

            await client.updateMyChannelKeys({
              ...currentChannelKeys,
              [channel.id]: encryptedChannelKey,
            });
          }
        } catch (err) {
          console.error("Failed to setup default channels:", err);
        }
      } catch (error) {
        console.error("Failed to register server:", error);
        throw error;
      }
    },
    [user, keys, federatedServers, setFederatedServers]
  );

  const leaveServer = useCallback(
    async (serverId: string) => {
      if (!keys) throw new Error("Not authenticated");

      const server = federatedServers.find((s) => s.id === serverId);
      if (!server) throw new Error("Server not found");

      try {
        const client = new FederatedServerClient(server.domain, server.session_token || "");
        await client.leaveServer();

        if (activeServer?.id === serverId) {
          setActiveServer(null);
          setActiveChannel(null);
        }

        const updatedServers = federatedServers.filter((s) => s.id !== serverId);
        setFederatedServers(updatedServers);
        await saveFederatedServersToDB(updatedServers, Array.from(keys.kem_secret_key));
      } catch (error) {
        console.error("Failed to leave server:", error);
        throw error;
      }
    },
    [keys, federatedServers, activeServer, setFederatedServers, setActiveServer, setActiveChannel]
  );

  const deleteServer = useCallback(
    async (serverId: string) => {
      if (!keys) throw new Error("Not authenticated");

      const server = federatedServers.find((s) => s.id === serverId);
      if (!server) throw new Error("Server not found");

      if (!server.is_owner) {
        throw new Error("Only the server owner can delete the server");
      }

      try {
        const client = new FederatedServerClient(server.domain, server.session_token || "");
        await client.deleteServer();

        if (activeServer?.id === serverId) {
          setActiveServer(null);
          setActiveChannel(null);
        }

        const updatedServers = federatedServers.filter((s) => s.id !== serverId);
        setFederatedServers(updatedServers);
        await saveFederatedServersToDB(updatedServers, Array.from(keys.kem_secret_key));
      } catch (error) {
        console.error("Failed to delete server:", error);
        throw error;
      }
    },
    [keys, federatedServers, activeServer, setFederatedServers, setActiveServer, setActiveChannel]
  );

  return { joinServerByDomain, registerAndJoinServer, leaveServer, deleteServer };
}
