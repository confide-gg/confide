import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "../AuthContext";
import { centralWebSocketService } from "../../core/network/CentralWebSocketService";
import type {
  DecryptedServer,
  DecryptedCategory,
  DecryptedChannel,
  FederatedServer,
  AnyServer,
} from "../../features/servers/types";
import { isFederatedServer } from "../../features/servers/types";
import {
  FederatedServerClient,
  type FederatedMember as Member,
} from "../../features/servers/federatedClient";
import { FederatedWebSocketService as FederatedWsClient } from "../../features/servers/federatedWebSocket";
import type { ServerContextType, RoleEventCallback } from "./types";
import {
  saveLastChannelForServer,
  loadFederatedServersFromDB,
  migrateFromLocalStorage,
} from "./storage";
import { FEDERATED_SERVERS_KEY } from "./types";
import { useFederatedServerData } from "./useFederatedServerData";
import { useServerCRUD } from "./useServerCRUD";
import { useServerMembership } from "./useServerMembership";

const ServerContext = createContext<ServerContextType | null>(null);

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

  const { loadFederatedServerData, distributeKeysToMember } = useFederatedServerData({
    keys,
    setIsLoading,
    setCategories,
    setChannels,
    setActiveChannel,
    federatedClientRef,
    myMemberRef,
  });

  const notifyRoleEvent = useCallback(
    (serverId: string) => {
      roleEventCallbacks.forEach((callback) => callback(serverId));
    },
    [roleEventCallbacks]
  );

  const setActiveServer = useCallback(
    (server: AnyServer | null) => {
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
                  distributeKeysToMember(
                    federatedClientRef.current,
                    newMember,
                    myMemberRef.current
                  );
                }
              }
              if (
                message.type === "member_roles_updated" ||
                message.type === "role_created" ||
                message.type === "role_updated" ||
                message.type === "role_deleted"
              ) {
                notifyRoleEvent(server.id);
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
    },
    [loadFederatedServerData, distributeKeysToMember, notifyRoleEvent]
  );

  const { createServer, createCategory, createChannel, deleteChannel } = useServerCRUD({
    keys,
    activeServer,
    channels,
    activeChannel,
    setActiveChannel,
    federatedClientRef,
    loadFederatedServerData,
  });

  const { joinServerByDomain, registerAndJoinServer, leaveServer, deleteServer } =
    useServerMembership({
      user,
      keys,
      federatedServers,
      activeServer,
      setFederatedServers,
      setActiveServer,
      setActiveChannel: () => setActiveChannelState(null),
    });

  const reloadServerData = useCallback(async () => {
    if (!activeServer) return;
    if (isFederatedServer(activeServer)) {
      await loadFederatedServerData(activeServer);
    }
  }, [activeServer, loadFederatedServerData]);

  const onRoleEvent = useCallback(
    (callback: RoleEventCallback) => {
      roleEventCallbacks.add(callback);
      return () => {
        roleEventCallbacks.delete(callback);
      };
    },
    [roleEventCallbacks]
  );

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
    const unsubscribe = centralWebSocketService.onMessage((message) => {
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
