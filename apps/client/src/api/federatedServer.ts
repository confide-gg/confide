import { fetch } from "@tauri-apps/plugin-http";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || text;
    } catch {
    }
    throw new ApiError(response.status, message);
  }
  return response.json();
}

function getHeaders(sessionToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }
  return headers;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface TextChannel {
  id: string;
  category_id?: string;
  name: string;
  description?: string;
  position: number;
  created_at: string;
}

export interface Member {
  id: string;
  central_user_id: string;
  username: string;
  kem_public_key: number[];
  dsa_public_key: number[];
  display_name?: string;
  avatar_url?: string;
  joined_at: string;
  encrypted_channel_keys: Record<string, number[]>;
}

export interface EncryptedMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_username: string;
  sender_dsa_public_key: number[];
  encrypted_content: number[];
  signature: number[];
  reply_to_id?: string;
  created_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  position: number;
}

export interface CreateChannelRequest {
  category_id?: string;
  name: string;
  description?: string;
  position: number;
}

export interface SendMessageRequest {
  encrypted_content: number[];
  signature: number[];
  reply_to_id?: string;
}

export interface SendMessageResponse {
  message: {
    id: string;
    channel_id: string;
    sender_id: string;
    encrypted_content: number[];
    signature: number[];
    reply_to_id?: string;
    created_at: string;
  };
}

export class FederatedServerClient {
  private baseUrl: string;
  private sessionToken: string;

  constructor(domain: string, sessionToken: string) {
    this.baseUrl = domain.startsWith("http") ? domain : `http://${domain}`;
    if (!this.baseUrl.endsWith("/api")) {
      this.baseUrl = `${this.baseUrl}/api`;
    }
    this.sessionToken = sessionToken;
  }

  async getMembers(): Promise<Member[]> {
    const response = await fetch(`${this.baseUrl}/members`, {
      method: "GET",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<Member[]>(response);
  }

  async getMe(): Promise<Member> {
    const response = await fetch(`${this.baseUrl}/members/me`, {
      method: "GET",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<Member>(response);
  }

  async getMyPermissions(): Promise<{ permissions: number }> {
    const response = await fetch(`${this.baseUrl}/members/me/permissions`, {
      method: "GET",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<{ permissions: number }>(response);
  }

  async getCategories(): Promise<Category[]> {
    const response = await fetch(`${this.baseUrl}/channels/categories`, {
      method: "GET",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<Category[]>(response);
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    const response = await fetch(`${this.baseUrl}/channels/categories`, {
      method: "POST",
      headers: getHeaders(this.sessionToken),
      body: JSON.stringify(data),
    });
    return handleResponse<Category>(response);
  }

  async updateCategory(categoryId: string, data: Partial<CreateCategoryRequest>): Promise<Category> {
    const response = await fetch(`${this.baseUrl}/channels/categories/${categoryId}`, {
      method: "PATCH",
      headers: getHeaders(this.sessionToken),
      body: JSON.stringify(data),
    });
    return handleResponse<Category>(response);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/channels/categories/${categoryId}`, {
      method: "DELETE",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<void>(response);
  }

  async getChannels(): Promise<TextChannel[]> {
    const response = await fetch(`${this.baseUrl}/channels`, {
      method: "GET",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<TextChannel[]>(response);
  }

  async createChannel(data: CreateChannelRequest): Promise<TextChannel> {
    const response = await fetch(`${this.baseUrl}/channels`, {
      method: "POST",
      headers: getHeaders(this.sessionToken),
      body: JSON.stringify(data),
    });
    return handleResponse<TextChannel>(response);
  }

  async updateChannel(channelId: string, data: Partial<CreateChannelRequest>): Promise<TextChannel> {
    const response = await fetch(`${this.baseUrl}/channels/${channelId}`, {
      method: "PATCH",
      headers: getHeaders(this.sessionToken),
      body: JSON.stringify(data),
    });
    return handleResponse<TextChannel>(response);
  }

  async deleteChannel(channelId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/channels/${channelId}`, {
      method: "DELETE",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<void>(response);
  }

  async getMessages(channelId: string, limit: number = 50, before?: string): Promise<EncryptedMessage[]> {
    let url = `${this.baseUrl}/messages/${channelId}?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<EncryptedMessage[]>(response);
  }

  async sendMessage(channelId: string, data: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await fetch(`${this.baseUrl}/messages/${channelId}`, {
      method: "POST",
      headers: getHeaders(this.sessionToken),
      body: JSON.stringify(data),
    });
    return handleResponse<SendMessageResponse>(response);
  }

  async updateMyChannelKeys(channelKeys: Record<string, number[]>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/members/me/channel-keys`, {
      method: "POST",
      headers: getHeaders(this.sessionToken),
      body: JSON.stringify({ channel_keys: channelKeys }),
    });
    return handleResponse<void>(response);
  }

  async distributeChannelKey(memberId: string, channelId: string, encryptedKey: number[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/members/${memberId}/channel-keys`, {
      method: "POST",
      headers: getHeaders(this.sessionToken),
      body: JSON.stringify({ channel_id: channelId, encrypted_key: encryptedKey }),
    });
    return handleResponse<void>(response);
  }

  async getServerInfo(): Promise<{ name: string; has_password: boolean }> {
    const response = await fetch(`${this.baseUrl}/server/info`, {
      method: "GET",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<{ name: string; has_password: boolean }>(response);
  }

  async setServerPassword(password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/server/password`, {
      method: "POST",
      headers: getHeaders(this.sessionToken),
      body: JSON.stringify({ password }),
    });
    return handleResponse<void>(response);
  }

  async removeServerPassword(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/server/password/remove`, {
      method: "POST",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<void>(response);
  }

  async leaveServer(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/members/me/leave`, {
      method: "POST",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<void>(response);
  }

  async deleteServer(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/server`, {
      method: "DELETE",
      headers: getHeaders(this.sessionToken),
    });
    return handleResponse<void>(response);
  }
}
