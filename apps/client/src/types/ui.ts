export type SidebarView = "friends" | "dms" | "servers" | "settings";

export interface ContextMenuData {
    x: number;
    y: number;
    type: string;
    friendId?: string;
    data?: any;
}

export interface MessageContextMenuData {
    x: number;
    y: number;
    messageId: string;
    isMine: boolean;
    content: string;
    isPinned: boolean;
    isGif: boolean;
}

export interface DmContextMenuData {
    x: number;
    y: number;
    conversationId: string;
    visitorId: string;
    visitorUsername?: string;
    isMuted: boolean;
}

