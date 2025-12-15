export type UserStatus = "online" | "away" | "dnd" | "invisible" | "offline";

export interface UserProfile {
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    status: UserStatus;
    custom_status: string | null;
    accent_color: string | null;
    banner_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface PublicProfile {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    status: UserStatus;
    custom_status: string | null;
    accent_color: string | null;
    banner_url: string | null;
    member_since: string;
}

export interface UpdateProfileRequest {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
    status?: UserStatus;
    custom_status?: string;
    accent_color?: string;
    banner_url?: string;
}

export interface ProfileViewData {
    userId: string;
    username: string;
    isOnline: boolean;
}
