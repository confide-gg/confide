import { DecryptedMessage } from "../../features/chat/types";

export type SidebarView = "dms" | "friends";

export interface ContextMenuData {
    x: number;
    y: number;
    friendId: string;
    friendUsername: string;
}

export interface MessageContextMenuData {
    x: number;
    y: number;
    message: DecryptedMessage;
}

export interface DmContextMenuData {
    x: number;
    y: number;
    conversationId: string;
    visitorId: string;
    visitorUsername: string;
}
