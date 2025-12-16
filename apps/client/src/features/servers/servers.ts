import { httpClient } from "../../core/network/HttpClient";
import type {
  Server, Category, TextChannel, ServerMember, ServerInvite, ServerRole, ServerBan, ChannelPermission,
  CreateServerRequest, UpdateServerRequest, CreateCategoryRequest, UpdateCategoryRequest,
  CreateChannelRequest, UpdateChannelRequest, CreateInviteRequest, CreateRoleRequest, UpdateRoleRequest,
  BanMemberRequest, CreateChannelPermissionRequest, UpdateChannelPermissionRequest, FederatedServersResponse
} from "./types";


class ServerService {
  public async getFederatedServers(): Promise<FederatedServersResponse> {
    return httpClient.get<FederatedServersResponse>("/servers/federated");
  }

  public async updateFederatedServers(encrypted_servers: number[]): Promise<{ success: boolean }> {
    return httpClient.put<{ success: boolean }>("/servers/federated", { encrypted_servers });
  }

  public async createServer(data: CreateServerRequest): Promise<Server> {
    return httpClient.post<Server>("/servers", data);
  }

  public async getUserServers(): Promise<Server[]> {
    return httpClient.get<Server[]>("/servers");
  }

  public async getServer(serverId: string): Promise<Server> {
    return httpClient.get<Server>(`/servers/${serverId}`);
  }

  public async updateServer(serverId: string, data: UpdateServerRequest): Promise<Server> {
    return httpClient.patch<Server>(`/servers/${serverId}`, data);
  }

  public async deleteServer(serverId: string): Promise<void> {
    return httpClient.del<void>(`/servers/${serverId}`);
  }

  public async leaveServer(serverId: string): Promise<void> {
    return httpClient.post<void>(`/servers/${serverId}/leave`);
  }

  public async getServerMembers(serverId: string): Promise<ServerMember[]> {
    return httpClient.get<ServerMember[]>(`/servers/${serverId}/members`);
  }

  public async removeMember(serverId: string, userId: string): Promise<void> {
    return httpClient.del<void>(`/servers/${serverId}/members/${userId}`);
  }

  public async createCategory(serverId: string, data: CreateCategoryRequest): Promise<Category> {
    return httpClient.post<Category>(`/servers/${serverId}/categories`, data);
  }

  public async getServerCategories(serverId: string): Promise<Category[]> {
    return httpClient.get<Category[]>(`/servers/${serverId}/categories`);
  }

  public async updateCategory(
    serverId: string,
    categoryId: string,
    data: UpdateCategoryRequest
  ): Promise<Category> {
    return httpClient.patch<Category>(`/servers/${serverId}/categories/${categoryId}`, data);
  }

  public async deleteCategory(serverId: string, categoryId: string): Promise<void> {
    return httpClient.del<void>(`/servers/${serverId}/categories/${categoryId}`);
  }

  public async createChannel(serverId: string, data: CreateChannelRequest): Promise<TextChannel> {
    return httpClient.post<TextChannel>(`/servers/${serverId}/channels`, data);
  }

  public async getServerChannels(serverId: string): Promise<TextChannel[]> {
    return httpClient.get<TextChannel[]>(`/servers/${serverId}/channels`);
  }

  public async updateChannel(
    serverId: string,
    channelId: string,
    data: UpdateChannelRequest
  ): Promise<TextChannel> {
    return httpClient.patch<TextChannel>(`/servers/${serverId}/channels/${channelId}`, data);
  }

  public async deleteChannel(serverId: string, channelId: string): Promise<void> {
    return httpClient.del<void>(`/servers/${serverId}/channels/${channelId}`);
  }

  public async createInvite(serverId: string, data: CreateInviteRequest): Promise<ServerInvite> {
    return httpClient.post<ServerInvite>(`/servers/${serverId}/invites`, data);
  }

  public async getServerInvites(serverId: string): Promise<ServerInvite[]> {
    return httpClient.get<ServerInvite[]>(`/servers/${serverId}/invites`);
  }

  public async joinServerByInvite(code: string): Promise<Server> {
    return httpClient.post<Server>(`/servers/invites/${code}`);
  }

  public async createRole(serverId: string, data: CreateRoleRequest): Promise<ServerRole> {
    return httpClient.post<ServerRole>(`/servers/${serverId}/roles`, data);
  }

  public async getServerRoles(serverId: string): Promise<ServerRole[]> {
    return httpClient.get<ServerRole[]>(`/servers/${serverId}/roles`);
  }

  public async updateRole(serverId: string, roleId: string, data: UpdateRoleRequest): Promise<ServerRole> {
    return httpClient.patch<ServerRole>(`/servers/${serverId}/roles/${roleId}`, data);
  }

  public async reorderRoles(serverId: string, roleIds: string[]): Promise<ServerRole[]> {
    return httpClient.patch<ServerRole[]>(`/servers/${serverId}/roles/reorder`, { role_ids: roleIds });
  }

  public async deleteRole(serverId: string, roleId: string): Promise<void> {
    return httpClient.del<void>(`/servers/${serverId}/roles/${roleId}`);
  }

  public async assignRole(serverId: string, userId: string, roleId: string): Promise<void> {
    return httpClient.post<void>(`/servers/${serverId}/members/${userId}/roles/${roleId}`);
  }

  public async removeRole(serverId: string, userId: string, roleId: string): Promise<void> {
    return httpClient.del<void>(`/servers/${serverId}/members/${userId}/roles/${roleId}`);
  }

  public async banMember(serverId: string, userId: string, data: BanMemberRequest): Promise<ServerBan> {
    return httpClient.post<ServerBan>(`/servers/${serverId}/members/${userId}/ban`, data);
  }

  public async unbanMember(serverId: string, userId: string): Promise<void> {
    return httpClient.post<void>(`/servers/${serverId}/members/${userId}/unban`);
  }

  public async kickMember(serverId: string, userId: string): Promise<void> {
    return httpClient.post<void>(`/servers/${serverId}/members/${userId}/kick`);
  }

  public async getServerBans(serverId: string): Promise<ServerBan[]> {
    return httpClient.get<ServerBan[]>(`/servers/${serverId}/bans`);
  }

  public async createChannelPermission(serverId: string, channelId: string, data: CreateChannelPermissionRequest): Promise<ChannelPermission> {
    return httpClient.post<ChannelPermission>(`/servers/${serverId}/channels/${channelId}/permissions`, data);
  }

  public async getChannelPermissions(serverId: string, channelId: string): Promise<ChannelPermission[]> {
    return httpClient.get<ChannelPermission[]>(`/servers/${serverId}/channels/${channelId}/permissions`);
  }

  public async updateChannelPermission(serverId: string, channelId: string, permId: string, data: UpdateChannelPermissionRequest): Promise<void> {
    return httpClient.patch<void>(`/servers/${serverId}/channels/${channelId}/permissions/${permId}`, data);
  }

  public async deleteChannelPermission(serverId: string, channelId: string, permId: string): Promise<void> {
    return httpClient.del<void>(`/servers/${serverId}/channels/${channelId}/permissions/${permId}`);
  }
}

export const serverService = new ServerService();
