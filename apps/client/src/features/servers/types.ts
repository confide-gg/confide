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
    updated_at?: string; // Added mainly for consistency, check backend if exists
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

// Request/Response Types
export interface FederatedServersResponse {
    encrypted_servers: number[];
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

export interface CreateRoleRequest {
    name: string;
    permissions: number;
    color?: string;
    position: number;
}

export interface UpdateRoleRequest {
    name?: string;
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


export interface EncryptedMessage {
    id: string;
    channel_id: string;
    sender_id: string;
    sender_username: string;
    sender_dsa_public_key?: number[];
    encrypted_content: number[];
    signature?: number[];
    reply_to_id?: string;
    created_at: string;
}
