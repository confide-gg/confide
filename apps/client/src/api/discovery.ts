import { get } from "./client";

export interface DiscoverableServer {
  id: string;
  domain: string;
  display_name: string;
  description: string | null;
  icon_url: string | null;
  member_count: number;
  is_discoverable: boolean;
  last_heartbeat: string;
  created_at: string;
}

export interface ListServersResponse {
  servers: DiscoverableServer[];
  total: number;
  limit: number;
  offset: number;
}

export async function listServers(limit: number = 20, offset: number = 0): Promise<ListServersResponse> {
  return get<ListServersResponse>("/discovery/servers", {
    limit: limit.toString(),
    offset: offset.toString(),
  });
}

export async function searchServers(query: string, limit: number = 20, offset: number = 0): Promise<ListServersResponse> {
  return get<ListServersResponse>("/discovery/search", {
    q: query,
    limit: limit.toString(),
    offset: offset.toString(),
  });
}

export async function getActiveServers(limit: number = 10): Promise<DiscoverableServer[]> {
  return get<DiscoverableServer[]>("/discovery/active", {
    limit: limit.toString(),
  });
}
