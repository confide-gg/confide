import { fetch } from "@tauri-apps/plugin-http";

export interface FederatedCategory {
    id: string;
    server_id: string;
    name: string;
    position: number;
    created_at: string;
}

export interface FederatedChannel {
    id: string;
    server_id: string;
    category_id: string | undefined;
    name: string;
    description: string;
    position: number;
    created_at: string;
}

export interface FederatedMember {
    id: string;
    central_user_id: string;
    username: string;
    display_name?: string;
    kem_public_key: number[];
    encrypted_channel_keys?: Record<string, number[]>;
}

export class FederatedServerClient {
    private baseUrl: string;
    private token: string;

    constructor(domain: string, token: string) {
        this.baseUrl = this.resolveUrl(domain);
        this.token = token;
    }

    private resolveUrl(domain: string): string {
        return domain.startsWith("http") ? domain : domain.includes("localhost") ? `http://${domain}` : `https://${domain}`;
    }

    private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}/api${path}`;
        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.token}`,
            ...options.headers,
        };

        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const text = await response.text();
            console.error(`[FederatedClient] Request to ${path} failed with status ${response.status}: ${text}`);
            const err = new Error(`Federated request failed: ${text}`) as Error & { status?: number; path?: string };
            err.status = response.status;
            err.path = path;
            throw err;
        }
        return response.json();
    }

    async getCategories(): Promise<FederatedCategory[]> {
        return this.fetch<FederatedCategory[]>("/channels/categories");
    }

    async getChannels(): Promise<FederatedChannel[]> {
        return this.fetch<FederatedChannel[]>("/channels");
    }

    async getMe(): Promise<FederatedMember> {
        return this.fetch<FederatedMember>("/members/me");
    }

    async getMembers(): Promise<FederatedMember[]> {
        return this.fetch<FederatedMember[]>("/members");
    }

    async getMemberRoles(memberId: string): Promise<string[]> {
        return this.fetch<string[]>(`/members/${memberId}/roles`);
    }

    async getAllMemberRoles(): Promise<Array<{ member_id: string; role_ids: string[] }>> {
        return this.fetch<Array<{ member_id: string; role_ids: string[] }>>("/members/roles");
    }

    async createCategory(data: { name: string; position: number }): Promise<FederatedCategory> {
        return this.fetch<FederatedCategory>("/channels/categories", {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    async createChannel(data: { name: string; category_id?: string; description?: string; position: number }): Promise<FederatedChannel> {
        return this.fetch<FederatedChannel>("/channels", {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    public async updateChannel(channelId: string, data: any): Promise<void> {
        const path = `/channels/${channelId}`;
        await this.fetch<void>(path, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    }

    public async updateCategory(categoryId: string, data: any): Promise<void> {
        const path = `/channels/categories/${categoryId}`;
        await this.fetch<void>(path, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    }

    public async updateServerSettings(data: {
        server_name?: string;
        description?: string;
        is_discoverable?: boolean;
        icon_url?: string;
        max_users?: number;
        max_upload_size_mb?: number;
        message_retention?: string;
    }): Promise<any> {
        return this.fetch<any>("/server/settings", {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    }

    public async getServerInfo(): Promise<any> {
        return this.fetch<any>("/server/info");
    }

    public async getMyPermissions(): Promise<number> {
        const response = await this.fetch<{ permissions: number }>("/members/me/permissions");
        return response.permissions;
    }

    public async setServerPassword(password: string): Promise<void> {
        await this.fetch<void>("/settings/password", {
            method: "POST",
            body: JSON.stringify({ password }),
        });
    }

    public async removeServerPassword(): Promise<void> {
        await this.fetch<void>("/settings/password/remove", {
            method: "POST",
            body: JSON.stringify({}),
        });
    }


    public async getRoles(): Promise<any[]> {
        return this.fetch<any[]>("/roles");
    }

    public async createRole(data: { name: string; permissions: number; color?: string; position: number }): Promise<any> {
        return this.fetch<any>("/roles", {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    public async updateRole(roleId: string, data: { name?: string; permissions?: number; color?: string; position?: number }): Promise<any> {
        return this.fetch<any>(`/roles/${roleId}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
    }

    public async reorderRoles(roleIds: string[]): Promise<any[]> {
        return this.fetch<any[]>("/roles/reorder", {
            method: "PATCH",
            body: JSON.stringify({ role_ids: roleIds }),
        });
    }

    public async deleteRole(roleId: string): Promise<void> {
        await this.fetch<void>(`/roles/${roleId}`, {
            method: "DELETE",
        });
    }

    public async assignRole(roleId: string, memberId: string): Promise<void> {
        await this.fetch<void>(`/roles/${roleId}/members/${memberId}`, {
            method: "POST",
        });
    }

    public async removeRole(roleId: string, memberId: string): Promise<void> {
        await this.fetch<void>(`/roles/${roleId}/members/${memberId}`, {
            method: "DELETE",
        });
    }

    public async deleteChannel(channelId: string): Promise<void> {
        await this.fetch<void>(`/channels/${channelId}/delete`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    }

    public async deleteCategory(categoryId: string): Promise<void> {
        await this.fetch<void>(`/channels/categories/${categoryId}/delete`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    }

    async deleteServer(): Promise<void> {
        return this.fetch<void>("/server", {
            method: "DELETE",
        });
    }

    async leaveServer(): Promise<void> {
        return this.fetch<void>("/members/leave", {
            method: "POST",
        });
    }

    async updateMyChannelKeys(keys: Record<string, number[]>): Promise<void> {
        return this.fetch<void>("/members/me/channel-keys", {
            method: "POST",
            body: JSON.stringify({ channel_keys: keys }),
        });
    }

    async distributeChannelKey(memberId: string, channelId: string, encryptedKey: number[]): Promise<void> {
        return this.fetch<void>(`/members/${memberId}/channel-keys`, {
            method: "POST",
            body: JSON.stringify({
                channel_id: channelId,
                encrypted_key: encryptedKey,
            }),
        });
    }

    async getMessages(channelId: string, limit = 50, before?: string): Promise<any[]> {
        let url = `/messages/${channelId}?limit=${limit}`;
        if (before) url += `&before=${before}`;
        return this.fetch<any[]>(url);
    }

    async sendMessage(channelId: string, data: any): Promise<any> {
        return this.fetch<any>(`/messages/${channelId}`, {
            method: "POST",
            body: JSON.stringify(data),
        });
    }
}
