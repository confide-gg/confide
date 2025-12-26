import type {
  DecryptedServer,
  DecryptedCategory,
  DecryptedChannel,
  FederatedServer,
  AnyServer,
} from "../../features/servers/types";
import { FederatedServerClient } from "../../features/servers/federatedClient";
import { FederatedWebSocketService as FederatedWsClient } from "../../features/servers/federatedWebSocket";

export type RoleEventCallback = (serverId: string) => void;

export interface RegisterServerData {
  domain: string;
  setup_token: string;
}

export interface ServerContextType {
  servers: DecryptedServer[];
  federatedServers: FederatedServer[];
  activeServer: AnyServer | null;
  activeChannel: DecryptedChannel | null;
  categories: DecryptedCategory[];
  channels: DecryptedChannel[];
  isLoading: boolean;
  myPermissions: number;
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

export const FEDERATED_SERVERS_KEY = "confide_federated_servers";
export const LAST_CHANNEL_KEY = "confide_last_channel";
