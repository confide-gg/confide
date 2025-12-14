export interface Server {
  id: string;
  encrypted_name: number[];
  encrypted_description?: number[];
  icon_url?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface DecryptedServer {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  server_id: string;
  encrypted_name: number[];
  position: number;
  created_at: string;
}

export interface DecryptedCategory {
  id: string;
  server_id: string;
  name: string;
  position: number;
  created_at: string;
  channels: DecryptedChannel[];
}

export interface TextChannel {
  id: string;
  server_id: string;
  category_id?: string;
  conversation_id: string;
  encrypted_name: number[];
  encrypted_description?: number[];
  position: number;
  created_at: string;
}

export interface DecryptedChannel {
  id: string;
  server_id: string;
  category_id?: string;
  conversation_id: string;
  name: string;
  description?: string;
  position: number;
  created_at: string;
}

export interface UserInfo {
  id: string;
  username: string;
  kem_public_key: number[];
  status: string;
}

export interface ServerRole {
  id: string;
  server_id: string;
  encrypted_name: number[];
  permissions: number;
  color?: string;
  position: number;
  created_at: string;
}

export interface DecryptedRole {
  id: string;
  server_id: string;
  name: string;
  permissions: number;
  color?: string;
  position: number;
  created_at: string;
}

export interface ServerMember {
  server_id: string;
  user_id: string;
  user: UserInfo;
  encrypted_role: number[];
  roles: ServerRole[];
  joined_at: string;
}

export interface ServerBan {
  id: string;
  server_id: string;
  user_id: string;
  banned_by: string;
  encrypted_reason?: number[];
  created_at: string;
}

export interface ChannelPermission {
  id: string;
  channel_id: string;
  role_id?: string;
  user_id?: string;
  allow: number;
  deny: number;
  created_at: string;
}

export interface ServerInvite {
  id: string;
  server_id: string;
  code: string;
  created_by: string;
  max_uses?: number;
  uses: number;
  expires_at?: string;
  created_at: string;
}

export const Permissions = {
  NONE: 0,
  CREATE_INVITE: 1 << 0,
  KICK_MEMBERS: 1 << 1,
  BAN_MEMBERS: 1 << 2,
  MANAGE_CHANNELS: 1 << 3,
  MANAGE_SERVER: 1 << 4,
  READ_MESSAGES: 1 << 5,
  SEND_MESSAGES: 1 << 6,
  MANAGE_MESSAGES: 1 << 7,
  MENTION_EVERYONE: 1 << 8,
  ADMINISTRATOR: 1 << 9,
  MANAGE_ROLES: 1 << 10,
  VIEW_CHANNELS: 1 << 11,
} as const;

export function hasPermission(userPerms: number, required: number): boolean {
  if (userPerms & Permissions.ADMINISTRATOR) {
    return true;
  }
  return (userPerms & required) !== 0;
}

export interface FederatedServer {
  id: string;
  domain: string;
  name: string;
  description?: string;
  icon_url?: string;
  session_token?: string;
  member_id?: string;
  is_owner?: boolean;
  isFederated: true;
}

export type AnyServer = DecryptedServer | FederatedServer;

export function isFederatedServer(server: AnyServer): server is FederatedServer {
  return 'isFederated' in server && server.isFederated === true;
}
