import { fetch } from "@tauri-apps/plugin-http";
import { httpClient } from "../../core/network/HttpClient";

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

class FederationService {
  public async requestFederationToken(serverDomain: string): Promise<FederationTokenResponse> {
    const token = httpClient.getAuthToken();
    if (!token) throw new Error("Not authenticated");

    return httpClient.post<FederationTokenResponse>("/federation/request-token", {
      server_domain: serverDomain,
    });
  }

  public async joinServerWithToken(
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
    const serverUrl = this.resolveServerUrl(serverDomain);

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
      await this.handleFetchError(response);
    }

    return response.json();
  }

  public async getServerInfo(serverDomain: string): Promise<{
    display_name: string;
    description?: string;
    member_count: number;
  }> {
    const serverUrl = this.resolveServerUrl(serverDomain);

    const response = await fetch(`${serverUrl}/api/info`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to get server info");
    }

    return response.json();
  }

  public async getFederatedServerInfo(serverDomain: string): Promise<{
    name: string;
    has_password: boolean;
  }> {
    const serverUrl = this.resolveServerUrl(serverDomain);

    const response = await fetch(`${serverUrl}/api/server/info`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to get server info");
    }

    return response.json();
  }

  public async registerServer(data: RegisterServerRequest): Promise<RegisterServerResponse> {
    const token = httpClient.getAuthToken();
    if (!token) throw new Error("Not authenticated");

    const serverUrl = this.resolveServerUrl(data.domain);

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

    const serverStatus = (await serverInfoResponse.json()) as ServerStatus;
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

    if (serverStatus.central_registered) {
      throw new Error("Server already registered locally - use Join Server instead");
    }

    // Try to register with Central
    try {
      const registerResult = await httpClient.post<{ server_id: string }>(
        "/federation/register-server",
        {
          dsa_public_key: serverStatus.dsa_public_key,
          domain: data.domain,
          display_name: serverStatus.server_name,
          description: "",
          is_discoverable: false,
        }
      );
      centralServerId = registerResult.server_id;
    } catch (error: any) {
      console.error("[Federation] Registration error:", error);
      // Check if "already registered"
      const errorMessage = error?.message || JSON.stringify(error);
      if (errorMessage.includes("already registered")) {
        console.log(
          "[Federation] Server already registered on Central. Attempting to recover ID..."
        );
        try {
          // Lookup the ID
          const tokenResponse = await this.requestFederationToken(data.domain);
          centralServerId = tokenResponse.server_info.id;
          console.log("[Federation] Recovered ID:", centralServerId);
        } catch (lookupError) {
          console.error("[Federation] Failed to recover server ID:", lookupError);
          throw error; // Rethrow original registration error if we can't recover
        }
      } else {
        throw error;
      }
    }

    // Proceed to Claim
    const federationToken = await httpClient.post<{ token: string }>("/federation/request-token", {
      server_domain: data.domain,
    });

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
      await this.handleFetchError(claimResponse);
    }

    const result = await claimResponse.json();
    return {
      ...result,
      server_name: serverStatus.server_name!,
    };
  }

  private resolveServerUrl(domain: string): string {
    let url = domain;
    if (!domain.startsWith("http") && !domain.startsWith("ws")) {
      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(domain);
      // Default to HTTP for localhost and IP addresses to avoid SSL errors with self-signed certs
      if (domain.includes("localhost") || isIp) {
        url = `http://${domain}`;
      } else {
        url = `https://${domain}`;
      }
    }
    console.log(`[Federation] Resolved URL for ${domain} -> ${url}`);
    return url;
  }

  private async handleFetchError(response: Response): Promise<void> {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || text;
    } catch {}
    throw new Error(message);
  }
}

export const federationService = new FederationService();
