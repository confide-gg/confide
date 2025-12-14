import { get, post, put, patch, del } from "./client";
import type { Server, Category, TextChannel, ServerMember, ServerInvite, ServerRole, ServerBan, ChannelPermission } from "../types/servers";

export interface FederatedServersResponse {
  encrypted_servers: number[];
}

export async function getFederatedServers(): Promise<FederatedServersResponse> {
  return get<FederatedServersResponse>("/servers/federated");
}

export async function updateFederatedServers(encrypted_servers: number[]): Promise<{ success: boolean }> {
  return put<{ success: boolean }>("/servers/federated", { encrypted_servers });
}

export interface CreateServerRequest {
  encrypted_name: number[];
  encrypted_description?: number[];
}

export interface UpdateServerRequest {
  encrypted_name?: number[];
  encrypted_description?: number[];
  icon_url?: string;
}

export interface CreateCategoryRequest {
  encrypted_name: number[];
  position: number;
}

export interface UpdateCategoryRequest {
  encrypted_name?: number[];
  position?: number;
}

export interface MemberKeyData {
  user_id: string;
  encrypted_sender_key: number[];
  encrypted_role: number[];
}

export interface CreateChannelRequest {
  category_id?: string;
  encrypted_name: number[];
  encrypted_description?: number[];
  position: number;
  member_keys: MemberKeyData[];
}

export interface UpdateChannelRequest {
  encrypted_name?: number[];
  encrypted_description?: number[];
  category_id?: string | null;
  position?: number;
}

export interface CreateInviteRequest {
  max_uses?: number;
  expires_in_seconds?: number;
}

export async function createServer(data: CreateServerRequest) {
  return post<Server>("/servers", data);
}

export async function getUserServers() {
  return get<Server[]>("/servers");
}

export async function getServer(serverId: string) {
  return get<Server>(`/servers/${serverId}`);
}

export async function updateServer(serverId: string, data: UpdateServerRequest) {
  return patch<Server>(`/servers/${serverId}`, data);
}

export async function deleteServer(serverId: string) {
  return del<void>(`/servers/${serverId}`);
}

export async function leaveServer(serverId: string) {
  return post<void>(`/servers/${serverId}/leave`);
}

export async function getServerMembers(serverId: string) {
  return get<ServerMember[]>(`/servers/${serverId}/members`);
}

export async function removeMember(serverId: string, userId: string) {
  return del<void>(`/servers/${serverId}/members/${userId}`);
}

export async function createCategory(serverId: string, data: CreateCategoryRequest) {
  return post<Category>(`/servers/${serverId}/categories`, data);
}

export async function getServerCategories(serverId: string) {
  return get<Category[]>(`/servers/${serverId}/categories`);
}

export async function updateCategory(
  serverId: string,
  categoryId: string,
  data: UpdateCategoryRequest
) {
  return patch<Category>(`/servers/${serverId}/categories/${categoryId}`, data);
}

export async function deleteCategory(serverId: string, categoryId: string) {
  return del<void>(`/servers/${serverId}/categories/${categoryId}`);
}

export async function createChannel(serverId: string, data: CreateChannelRequest) {
  return post<TextChannel>(`/servers/${serverId}/channels`, data);
}

export async function getServerChannels(serverId: string) {
  return get<TextChannel[]>(`/servers/${serverId}/channels`);
}

export async function updateChannel(
  serverId: string,
  channelId: string,
  data: UpdateChannelRequest
) {
  return patch<TextChannel>(`/servers/${serverId}/channels/${channelId}`, data);
}

export async function deleteChannel(serverId: string, channelId: string) {
  return del<void>(`/servers/${serverId}/channels/${channelId}`);
}

export async function createInvite(serverId: string, data: CreateInviteRequest) {
  return post<ServerInvite>(`/servers/${serverId}/invites`, data);
}

export async function getServerInvites(serverId: string) {
  return get<ServerInvite[]>(`/servers/${serverId}/invites`);
}

export async function joinServerByInvite(code: string) {
  return post<Server>(`/servers/invites/${code}`);
}

export interface CreateRoleRequest {
  encrypted_name: number[];
  permissions: number;
  color?: string;
  position: number;
}

export interface UpdateRoleRequest {
  encrypted_name?: number[];
  permissions?: number;
  color?: string | null;
  position?: number;
}

export interface BanMemberRequest {
  encrypted_reason?: number[];
}

export interface CreateChannelPermissionRequest {
  role_id?: string;
  user_id?: string;
  allow: number;
  deny: number;
}

export interface UpdateChannelPermissionRequest {
  allow?: number;
  deny?: number;
}

export async function createRole(serverId: string, data: CreateRoleRequest) {
  return post<ServerRole>(`/servers/${serverId}/roles`, data);
}

export async function getServerRoles(serverId: string) {
  return get<ServerRole[]>(`/servers/${serverId}/roles`);
}

export async function updateRole(serverId: string, roleId: string, data: UpdateRoleRequest) {
  return patch<ServerRole>(`/servers/${serverId}/roles/${roleId}`, data);
}

export async function deleteRole(serverId: string, roleId: string) {
  return del<void>(`/servers/${serverId}/roles/${roleId}`);
}

export async function assignRole(serverId: string, userId: string, roleId: string) {
  return post<void>(`/servers/${serverId}/members/${userId}/roles/${roleId}`);
}

export async function removeRole(serverId: string, userId: string, roleId: string) {
  return del<void>(`/servers/${serverId}/members/${userId}/roles/${roleId}`);
}

export async function banMember(serverId: string, userId: string, data: BanMemberRequest) {
  return post<ServerBan>(`/servers/${serverId}/members/${userId}/ban`, data);
}

export async function unbanMember(serverId: string, userId: string) {
  return post<void>(`/servers/${serverId}/members/${userId}/unban`);
}

export async function kickMember(serverId: string, userId: string) {
  return post<void>(`/servers/${serverId}/members/${userId}/kick`);
}

export async function getServerBans(serverId: string) {
  return get<ServerBan[]>(`/servers/${serverId}/bans`);
}

export async function createChannelPermission(serverId: string, channelId: string, data: CreateChannelPermissionRequest) {
  return post<ChannelPermission>(`/servers/${serverId}/channels/${channelId}/permissions`, data);
}

export async function getChannelPermissions(serverId: string, channelId: string) {
  return get<ChannelPermission[]>(`/servers/${serverId}/channels/${channelId}/permissions`);
}

export async function updateChannelPermission(serverId: string, channelId: string, permId: string, data: UpdateChannelPermissionRequest) {
  return patch<void>(`/servers/${serverId}/channels/${channelId}/permissions/${permId}`, data);
}

export async function deleteChannelPermission(serverId: string, channelId: string, permId: string) {
  return del<void>(`/servers/${serverId}/channels/${channelId}/permissions/${permId}`);
}
