import { useQuery } from "@tanstack/react-query";
import { serverService } from "../../features/servers/servers";
import { queryKeys } from "./queryKeys";

export function useServers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.list(),
    queryFn: () => serverService.getUserServers(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5,
  });
}

export function useServer(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.detail(serverId || ""),
    queryFn: () => serverService.getServer(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useServerMembers(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.members(serverId || ""),
    queryFn: () => serverService.getServerMembers(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60,
  });
}

export function useServerCategories(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.categories(serverId || ""),
    queryFn: () => serverService.getServerCategories(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useServerChannels(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.channels(serverId || ""),
    queryFn: () => serverService.getServerChannels(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useServerRoles(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.roles(serverId || ""),
    queryFn: () => serverService.getServerRoles(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useServerInvites(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.invites(serverId || ""),
    queryFn: () => serverService.getServerInvites(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60,
  });
}

export function useServerBans(serverId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.servers.bans(serverId || ""),
    queryFn: () => serverService.getServerBans(serverId!),
    enabled: !!serverId && (options?.enabled ?? true),
    staleTime: 1000 * 60,
  });
}
