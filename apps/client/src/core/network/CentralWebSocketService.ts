import { httpClient } from "./HttpClient";
import { BaseWebSocket } from "./BaseWebSocket";
import { CENTRAL_WS_URL } from "../../config";
import { WsMessage } from "./wsTypes";

const WS_BASE_URL = CENTRAL_WS_URL;

interface OutgoingTyping {
    type: "typing";
    data: {
        conversation_id: string;
        is_typing: boolean;
    };
}

interface OutgoingUpdatePresence {
    type: "update_presence";
    data: {
        status: string;
        custom_status?: string;
    };
}

interface OutgoingSubscribeConversation {
    type: "subscribe_conversation";
    data: {
        conversation_id: string;
    };
}

interface OutgoingSubscribeUser {
    type: "subscribe_user";
    data: {
        user_id: string;
    };
}

interface OutgoingScreenShareStart {
    type: "screen_share_start";
    data: {
        call_id: string;
        user_id: string;
        width: number;
        height: number;
    };
}

interface OutgoingScreenShareStop {
    type: "screen_share_stop";
    data: {
        call_id: string;
        user_id: string;
    };
}

interface OutgoingCallMuteUpdate {
    type: "call_mute_update";
    data: {
        call_id: string;
        user_id: string;
        is_muted: boolean;
    };
}

interface OutgoingPing {
    type: "ping";
}

export type OutgoingMessage =
    | OutgoingTyping
    | OutgoingUpdatePresence
    | OutgoingSubscribeConversation
    | OutgoingSubscribeUser
    | OutgoingScreenShareStart
    | OutgoingScreenShareStop
    | OutgoingCallMuteUpdate
    | OutgoingPing;

class CentralWebSocketService extends BaseWebSocket<WsMessage, OutgoingMessage> {
    constructor() {
        super();
        this.shouldPing = true;
        this.pingIntervalMs = 25000;
    }

    protected getPingMessage(): OutgoingMessage {
        return { type: "ping" };
    }

    protected getUrl(): string {
        const token = httpClient.getAuthToken();
        if (!token) {
            throw new Error("No auth token available for WebSocket connection");
        }
        return `${WS_BASE_URL}/ws?token=${token}`;
    }

    sendTyping(conversationId: string, isTyping: boolean): void {
        this.send({
            type: "typing",
            data: {
                conversation_id: conversationId,
                is_typing: isTyping,
            },
        });
    }

    updatePresence(status: string, customStatus?: string): void {
        this.send({
            type: "update_presence",
            data: {
                status,
                custom_status: customStatus,
            },
        });
    }

    subscribeConversation(conversationId: string): void {
        this.send({
            type: "subscribe_conversation",
            data: {
                conversation_id: conversationId,
            },
        });
    }

    subscribeUser(userId: string): void {
        this.send({
            type: "subscribe_user",
            data: {
                user_id: userId,
            },
        });
    }
}

export const centralWebSocketService = new CentralWebSocketService();
