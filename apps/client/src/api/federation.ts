import { fetch } from "@tauri-apps/plugin-http";
import { getAuthToken, post } from "./client";

export interface FederationTokenResponse {
  token: string;
  expires_at: string;
  server_info: {
    id: string;
    domain: string;
    display_name: string;
    description?: string;
    icon_url?: string;
  };
}

export interface FederatedServer {
  id: string;
  domain: string;
  display_name: string;
  description?: string;
  icon_url?: string;
  session_token?: string;
  member_id?: string;
}

export async function requestFederationToken(serverDomain: string): Promise<FederationTokenResponse> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  return post<FederationTokenResponse>("/federation/request-token", { server_domain: serverDomain });
}

export async function joinServerWithToken(
  serverDomain: string,
  federationToken: string,
  userInfo: {
    user_id: string;
    username: string;
    kem_public_key: number[];
    dsa_public_key: number[];
  },
  password?: string
): Promise<{ session_token: string; member_id: string }> {
  const serverUrl = serverDomain.startsWith("http")
    ? serverDomain
    : serverDomain.includes("localhost")
      ? `http://${serverDomain}`
      : `https://${serverDomain}`;

  const response = await fetch(`${serverUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      federation_token: federationToken,
      user_id: userInfo.user_id,
      password: password || null,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || text;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

export async function getServerInfo(serverDomain: string): Promise<{
  display_name: string;
  description?: string;
  member_count: number;
}> {
  const serverUrl = serverDomain.startsWith("http")
    ? serverDomain
    : serverDomain.includes("localhost")
      ? `http://${serverDomain}`
      : `https://${serverDomain}`;

  const response = await fetch(`${serverUrl}/api/info`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Failed to get server info");
  }

  return response.json();
}

export async function getFederatedServerInfo(serverDomain: string): Promise<{
  name: string;
  has_password: boolean;
}> {
  const serverUrl = serverDomain.startsWith("http")
    ? serverDomain
    : serverDomain.includes("localhost")
      ? `http://${serverDomain}`
      : `https://${serverDomain}`;

  const response = await fetch(`${serverUrl}/api/server/info`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error("Failed to get server info");
  }

  return response.json();
}

export interface RegisterServerRequest {
  domain: string;
  setup_token: string;
  user_id: string;
}

export interface RegisterServerResponse {
  server_id: string;
  member_id: string;
  session_token: string;
  server_name: string;
}

interface ServerStatus {
  server_name?: string;
  setup_complete: boolean;
  central_registered: boolean;
  dsa_public_key?: number[];
}

export async function registerServer(data: RegisterServerRequest): Promise<RegisterServerResponse> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const serverUrl = data.domain.startsWith("http")
    ? data.domain
    : data.domain.includes("localhost")
      ? `http://${data.domain}`
      : `https://${data.domain}`;

  let serverInfoResponse;
  try {
    serverInfoResponse = await fetch(`${serverUrl}/api/setup/status`, {
      method: "GET",
    });
  } catch {
    throw new Error("Could not connect to server. Make sure it's running.");
  }

  if (!serverInfoResponse.ok) {
    throw new Error("Server is not responding correctly");
  }

  const serverStatus = await serverInfoResponse.json() as ServerStatus;
  if (!serverStatus.server_name) {
    throw new Error("Server has not completed initial setup");
  }

  if (serverStatus.setup_complete) {
    throw new Error("Server already has an owner");
  }

  if (!serverStatus.dsa_public_key) {
    throw new Error("Server missing identity key");
  }

  let centralServerId: string;

  if (!serverStatus.central_registered) {
    const registerResult = await post<{ server_id: string }>("/federation/register-server", {
      dsa_public_key: serverStatus.dsa_public_key,
      domain: data.domain,
      display_name: serverStatus.server_name,
      description: "",
      is_discoverable: false,
    });
    centralServerId = registerResult.server_id;
  } else {
    throw new Error("Server already registered - use Join Server instead");
  }

  const federationToken = await post<{ token: string }>("/federation/request-token", { server_domain: data.domain });

  const claimResponse = await fetch(`${serverUrl}/api/setup/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      setup_token: data.setup_token,
      federation_token: federationToken.token,
      user_id: data.user_id,
      central_server_id: centralServerId,
    }),
  });

  if (!claimResponse.ok) {
    const text = await claimResponse.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || text;
    } catch { }
    throw new Error(message);
  }

  const result = await claimResponse.json();
  return {
    ...result,
    server_name: serverStatus.server_name!,
  };
}
