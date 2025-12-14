import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { wsService, federation, FederatedServerClient, servers as serversApi, crypto } from "../api";
import { FederatedWsClient, type WsMember } from "../api/federatedWs";
import type { Member } from "../api/federatedServer";
import type {
  DecryptedServer,
  DecryptedCategory,
  DecryptedChannel,
  FederatedServer,
  AnyServer,
} from "../types/servers";
import { isFederatedServer } from "../types/servers";

type RoleEventCallback = (serverId: string) => void;

interface RegisterServerData {
  domain: string;
  setup_token: string;
}

interface ServerContextType {
  servers: DecryptedServer[];
  federatedServers: FederatedServer[];
  activeServer: AnyServer | null;
  activeChannel: DecryptedChannel | null;
  categories: DecryptedCategory[];
  channels: DecryptedChannel[];
  isLoading: boolean;
  federatedClient: FederatedServerClient | null;
  federatedWs: FederatedWsClient | null;

  setActiveServer: (server: AnyServer | null) => void;
  setActiveChannel: (channel: DecryptedChannel | null) => void;
  loadServers: () => Promise<void>;
  reloadServerData: () => Promise<void>;
  createServer: (name: string, description?: string) => Promise<void>;
  createCategory: (serverId: string, name: string, position?: number) => Promise<void>;
  createChannel: (
    serverId: string,
    name: string,
    categoryId?: string,
    description?: string
  ) => Promise<void>;
  deleteChannel: (serverId: string, channelId: string) => Promise<void>;
  joinServerByDomain: (domain: string, password?: string) => Promise<void>;
  registerAndJoinServer: (data: RegisterServerData) => Promise<void>;
  leaveServer: (serverId: string) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  onRoleEvent: (callback: RoleEventCallback) => () => void;
}

const ServerContext = createContext<ServerContextType | null>(null);

const FEDERATED_SERVERS_KEY = "confide_federated_servers";
const LAST_CHANNEL_KEY = "confide_last_channel";

function getLastChannelForServer(serverId: string): string | null {
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    return data[serverId] || null;
  } catch {
    return null;
  }
}

function saveLastChannelForServer(serverId: string, channelId: string): void {
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[serverId] = channelId;
    localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save last channel:", err);
  }
}

async function loadFederatedServersFromDB(kemSecretKey: number[]): Promise<FederatedServer[]> {
  try {
    const response = await serversApi.getFederatedServers();
    if (!response.encrypted_servers || response.encrypted_servers.length === 0) {
      return [];
    }
    const decrypted = await crypto.decryptData(kemSecretKey, response.encrypted_servers);
    const servers = JSON.parse(crypto.bytesToString(decrypted));
    return servers.map((server: FederatedServer) => ({
      ...server,
      isFederated: true as const,
    }));
  } catch (error) {
    console.error("Failed to load federated servers from DB:", error);
    return [];
  }
}

async function saveFederatedServersToDB(servers: FederatedServer[], kemSecretKey: number[]): Promise<void> {
  try {
    const jsonBytes = crypto.stringToBytes(JSON.stringify(servers));
    const encrypted = await crypto.encryptData(kemSecretKey, jsonBytes);
    await serversApi.updateFederatedServers(encrypted);
  } catch (error) {
    console.error("Failed to save federated servers to DB:", error);
  }
}

async function migrateFromLocalStorage(kemSecretKey: number[]): Promise<FederatedServer[]> {
  const stored = localStorage.getItem(FEDERATED_SERVERS_KEY);
  if (!stored) return [];

  try {
    const servers = JSON.parse(stored);
    const federatedServers = servers.map((server: FederatedServer) => ({
      ...server,
      isFederated: true as const,
    }));

    if (federatedServers.length > 0) {
      await saveFederatedServersToDB(federatedServers, kemSecretKey);
      localStorage.removeItem(FEDERATED_SERVERS_KEY);
    }

    return federatedServers;
  } catch {
    return [];
  }
}

export function ServerProvider({ children }: { children: ReactNode }) {
  const { user, keys } = useAuth();
  const [servers, setServers] = useState<DecryptedServer[]>([]);
  const [federatedServers, setFederatedServers] = useState<FederatedServer[]>([]);
  const [federatedServersLoaded, setFederatedServersLoaded] = useState(false);
  const [activeServer, setActiveServerState] = useState<AnyServer | null>(null);
  const [activeChannel, setActiveChannelState] = useState<DecryptedChannel | null>(null);
  const activeServerRef = useRef<AnyServer | null>(null);

  const setActiveChannel = useCallback((channel: DecryptedChannel | null) => {
    setActiveChannelState(channel);
    if (channel && activeServerRef.current) {
      saveLastChannelForServer(activeServerRef.current.id, channel.id);
    }
  }, []);
  const [categories, setCategories] = useState<DecryptedCategory[]>([]);
  const [channels, setChannels] = useState<DecryptedChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [roleEventCallbacks] = useState<Set<RoleEventCallback>>(() => new Set());
  const federatedClientRef = useRef<FederatedServerClient | null>(null);
  const federatedWsRef = useRef<FederatedWsClient | null>(null);
  const myMemberRef = useRef<Member | null>(null);

  const loadServers = async () => {
    if (!keys) return;
    setServers([]);
  };

  const distributeKeysToMember = async (
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
        const decryptedKey = await crypto.decryptFromSender(
          Array.from(keys.kem_secret_key),
          encryptedKey
        );

        const reEncryptedKey = await crypto.encryptForRecipient(
          newMember.kem_public_key,
          decryptedKey
        );

        await client.distributeChannelKey(newMember.id, channelId, reEncryptedKey);
      } catch (err) {
        console.error(`Failed to distribute key for channel ${channelId}:`, err);
      }
    }
  };

  const loadFederatedServerData = async (server: FederatedServer, autoSelectChannel: boolean = false) => {
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
            const channelKey = await crypto.generateChannelKey();
            const encryptedChannelKey = await crypto.encryptForRecipient(
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
  };

  const setActiveServer = (server: AnyServer | null) => {
    if (federatedWsRef.current) {
      federatedWsRef.current.disconnect();
      federatedWsRef.current = null;
    }

    setActiveServerState(server);
    activeServerRef.current = server;
    setActiveChannelState(null);
    federatedClientRef.current = null;

    if (server) {
      if (isFederatedServer(server)) {
        loadFederatedServerData(server, true);

        if (server.session_token) {
          const wsClient = new FederatedWsClient(server.domain, server.session_token);
          federatedWsRef.current = wsClient;

          wsClient.onMessage((message) => {
            if (message.type === "member_joined") {
              const newMember = message.member;
              if (server.is_owner && myMemberRef.current && federatedClientRef.current) {
                distributeKeysToMember(federatedClientRef.current, newMember, myMemberRef.current);
              }
            }
          });

          wsClient.connect().catch((err) => {
            console.error("Failed to connect WebSocket:", err);
          });
        }
      } else {
        setCategories([]);
        setChannels([]);
      }
    } else {
      setCategories([]);
      setChannels([]);
    }
  };

  const createServer = async (_name: string, _description?: string) => {
    throw new Error("Direct server creation not supported - use federated servers");
  };

  const createCategory = async (_serverId: string, name: string, position: number = 0) => {
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
  };

  const createChannel = async (
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

      const channelKey = await crypto.generateChannelKey();
      const encryptedChannelKey = await crypto.encryptForRecipient(
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
  };

  const deleteChannel = async (_serverId: string, channelId: string) => {
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
  };

  const joinServerByDomain = async (domain: string, password?: string) => {
    if (!user || !keys) throw new Error("Not authenticated");

    try {
      const tokenResponse = await federation.requestFederationToken(domain);

      const joinResponse = await federation.joinServerWithToken(
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
  };

  const registerAndJoinServer = async (data: RegisterServerData) => {
    if (!user || !keys) throw new Error("Not authenticated");

    try {
      const result = await federation.registerServer({
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

      // Create default channels
      try {
        if (newServer.session_token) {
          const client = new FederatedServerClient(newServer.domain, newServer.session_token);

          // 1. Create Category
          const category = await client.createCategory({
            name: "Text Channels",
            position: 0
          });

          // 2. Create Channel
          const channel = await client.createChannel({
            name: "general",
            category_id: category.id,
            position: 0,
            description: "General discussion"
          });

          // 3. Generate and distribute keys
          const channelKey = await crypto.generateChannelKey();
          const encryptedChannelKey = await crypto.encryptForRecipient(
            Array.from(keys.kem_public_key),
            channelKey
          );

          const myMember = await client.getMe();
          const currentChannelKeys = myMember.encrypted_channel_keys || {};

          await client.updateMyChannelKeys({
            ...currentChannelKeys,
            [channel.id]: encryptedChannelKey
          });
        }


      } catch (err) {
        console.error("Failed to setup default channels:", err);
        // Don't fail the registration if defaults fail, just log it
      }

    } catch (error) {
      console.error("Failed to register server:", error);
      throw error;
    }
  };

  const leaveServer = async (serverId: string) => {
    if (!keys) throw new Error("Not authenticated");

    const server = federatedServers.find(s => s.id === serverId);
    if (!server) throw new Error("Server not found");

    try {
      const client = new FederatedServerClient(server.domain, server.session_token || "");
      await client.leaveServer();

      if (activeServer?.id === serverId) {
        setActiveServer(null);
        setActiveChannel(null);
      }

      const updatedServers = federatedServers.filter(s => s.id !== serverId);
      setFederatedServers(updatedServers);
      await saveFederatedServersToDB(updatedServers, Array.from(keys.kem_secret_key));

    } catch (error) {
      console.error("Failed to leave server:", error);
      throw error;
    }
  };

  const deleteServer = async (serverId: string) => {
    if (!keys) throw new Error("Not authenticated");

    const server = federatedServers.find(s => s.id === serverId);
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

      const updatedServers = federatedServers.filter(s => s.id !== serverId);
      setFederatedServers(updatedServers);
      await saveFederatedServersToDB(updatedServers, Array.from(keys.kem_secret_key));

    } catch (error) {
      console.error("Failed to delete server:", error);
      throw error;
    }
  };

  const reloadServerData = async () => {
    if (!activeServer) return;
    if (isFederatedServer(activeServer)) {
      await loadFederatedServerData(activeServer);
    }
  };

  const onRoleEvent = useCallback((callback: RoleEventCallback) => {
    roleEventCallbacks.add(callback);
    return () => {
      roleEventCallbacks.delete(callback);
    };
  }, [roleEventCallbacks]);

  const notifyRoleEvent = useCallback((serverId: string) => {
    roleEventCallbacks.forEach(callback => callback(serverId));
  }, [roleEventCallbacks]);

  useEffect(() => {
    if (keys) {
      loadServers();
    }
  }, [keys]);

  useEffect(() => {
    if (!keys || federatedServersLoaded) return;

    const loadFederatedServers = async () => {
      const localStorageServers = localStorage.getItem(FEDERATED_SERVERS_KEY);
      if (localStorageServers) {
        const migrated = await migrateFromLocalStorage(Array.from(keys.kem_secret_key));
        setFederatedServers(migrated);
      } else {
        const dbServers = await loadFederatedServersFromDB(Array.from(keys.kem_secret_key));
        setFederatedServers(dbServers);
      }
      setFederatedServersLoaded(true);
    };

    loadFederatedServers();
  }, [keys, federatedServersLoaded]);

  useEffect(() => {
    const unsubscribe = wsService.onMessage((message) => {
      switch (message.type) {
        case "member_roles_updated":
        case "role_created":
        case "role_updated":
        case "role_deleted":
          notifyRoleEvent(message.data.server_id);
          break;
      }
    });
    return () => unsubscribe();
  }, [notifyRoleEvent]);

  const value: ServerContextType = {
    servers,
    federatedServers,
    activeServer,
    activeChannel,
    categories,
    channels,
    isLoading,
    federatedClient: federatedClientRef.current,
    federatedWs: federatedWsRef.current,
    setActiveServer,
    setActiveChannel,
    loadServers,
    reloadServerData,
    createServer,
    createCategory,
    createChannel,
    deleteChannel,
    joinServerByDomain,
    registerAndJoinServer,
    leaveServer,
    deleteServer,
    onRoleEvent,
  };

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer() {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error("useServer must be used within ServerProvider");
  }
  return context;
}
