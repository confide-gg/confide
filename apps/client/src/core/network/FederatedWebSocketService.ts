import { BaseWebSocket, type BaseMessageHandler } from "./BaseWebSocket";

export type MessageHandler = BaseMessageHandler<FederatedServerMessage>;

// Client -> Server messages
export interface FederatedClientMessage {
    type: 'subscribe_channel' | 'unsubscribe_channel' | 'typing' | 'stop_typing' | 'update_presence' | 'ping';
    channel_id?: string;
    status?: string;
}

interface WsEncryptedMessage {
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

interface WsMember {
    id: string;
    central_user_id: string;
    username: string;
    kem_public_key: number[];
    dsa_public_key: number[];
    display_name?: string;
    avatar_url?: string;
    joined_at: string;
}

interface WsChannel {
    id: string;
    category_id?: string;
    name: string;
    description?: string;
    position: number;
    created_at: string;
}

interface WsCategory {
    id: string;
    name: string;
    position: number;
    created_at: string;
}

interface WsRole {
    id: string;
    name: string;
    permissions: number;
    color?: string;
    position: number;
    created_at: string;
}

// Server -> Client messages
export type FederatedServerMessage =
    | { type: 'connected'; member_id: string }
    | { type: 'pong' }
    | { type: 'new_message'; message: WsEncryptedMessage }
    | { type: 'message_deleted'; channel_id: string; message_id: string }
    | { type: 'typing_start'; channel_id: string; member_id: string; username: string }
    | { type: 'typing_stop'; channel_id: string; member_id: string }
    | { type: 'member_joined'; member: WsMember }
    | { type: 'member_left'; member_id: string }
    | { type: 'member_updated'; member: WsMember }
    | { type: 'member_banned'; member_id: string }
    | { type: 'channel_created'; channel: WsChannel }
    | { type: 'channel_updated'; channel: WsChannel }
    | { type: 'channel_deleted'; channel_id: string }
    | { type: 'category_created'; category: WsCategory }
    | { type: 'category_updated'; category: WsCategory }
    | { type: 'category_deleted'; category_id: string }
    | { type: 'role_created'; role: WsRole }
    | { type: 'role_updated'; role: WsRole }
    | { type: 'role_deleted'; role_id: string }
    | { type: 'member_roles_updated'; member_id: string; role_ids: string[] }
    | { type: 'server_updated'; name: string; description?: string; icon_url?: string }
    | { type: 'presence_update'; member_id: string; status: string; online: boolean }
    | { type: 'presence_sync'; presences: { member_id: string; status: string }[] }
    | { type: 'error'; message: string };

export class FederatedWsClient extends BaseWebSocket<FederatedServerMessage, FederatedClientMessage> {
    private domain: string;
    private sessionToken: string;
    private subscribedChannels: Set<string> = new Set();
    // private isConnecting = false; // Handled by BaseWebSocket

    constructor(domain: string, sessionToken: string) {
        super();
        this.domain = domain;
        this.sessionToken = sessionToken;
        this.shouldPing = true;
    }

    protected getUrl(): string {
        const protocol = this.domain.startsWith('localhost') ? 'ws' : 'wss';
        return `${protocol}://${this.domain}/ws?token=${this.sessionToken}`;
    }

    protected getPingMessage(): FederatedClientMessage | null {
        return { type: 'ping' };
    }

    protected onConnected(): void {
        for (const channelId of this.subscribedChannels) {
            this.send({ type: 'subscribe_channel', channel_id: channelId });
        }
    }

    subscribeChannel(channelId: string) {
        this.subscribedChannels.add(channelId);
        if (this.isConnected()) {
            this.send({ type: 'subscribe_channel', channel_id: channelId });
        }
    }

    unsubscribeChannel(channelId: string) {
        this.subscribedChannels.delete(channelId);
        if (this.isConnected()) {
            this.send({ type: 'unsubscribe_channel', channel_id: channelId });
        }
    }

    /**
     * Send typing indicator
     */
    sendTyping(channelId: string) {
        this.send({ type: 'typing', channel_id: channelId });
    }

    sendStopTyping(channelId: string) {
        this.send({ type: 'stop_typing', channel_id: channelId });
    }

    updatePresence(status: string) {
        this.send({ type: 'update_presence', status });
    }
}
