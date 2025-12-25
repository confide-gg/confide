import { serverService } from "../../features/servers/servers";
import { cryptoService } from "../../core/crypto/crypto";
import type { FederatedServer } from "../../features/servers/types";
import { FEDERATED_SERVERS_KEY, LAST_CHANNEL_KEY } from "./types";

export function getLastChannelForServer(serverId: string): string | null {
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored);
    return data[serverId] || null;
  } catch {
    return null;
  }
}

export function saveLastChannelForServer(serverId: string, channelId: string): void {
  try {
    const stored = localStorage.getItem(LAST_CHANNEL_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[serverId] = channelId;
    localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save last channel:", err);
  }
}

export async function loadFederatedServersFromDB(
  kemSecretKey: number[]
): Promise<FederatedServer[]> {
  try {
    const response = await serverService.getFederatedServers();
    if (!response.encrypted_servers || response.encrypted_servers.length === 0) {
      return [];
    }
    const decrypted = await cryptoService.decryptData(kemSecretKey, response.encrypted_servers);
    const servers = JSON.parse(cryptoService.bytesToString(decrypted));
    return servers.map((server: FederatedServer) => ({
      ...server,
      isFederated: true as const,
    }));
  } catch (error) {
    console.error("Failed to load federated servers from DB:", error);
    return [];
  }
}

export async function saveFederatedServersToDB(
  servers: FederatedServer[],
  kemSecretKey: number[]
): Promise<void> {
  try {
    const jsonBytes = cryptoService.stringToBytes(JSON.stringify(servers));
    const encrypted = await cryptoService.encryptData(kemSecretKey, jsonBytes);
    await serverService.updateFederatedServers(encrypted);
  } catch (error) {
    console.error("Failed to save federated servers to DB:", error);
  }
}

export async function migrateFromLocalStorage(kemSecretKey: number[]): Promise<FederatedServer[]> {
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
