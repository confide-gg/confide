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

export type ActivityType = "playing" | "listening" | "watching" | "streaming" | "custom";

export interface UserActivity {
    user_id: string;
    activity_type: ActivityType;
    name?: string;
    details?: string;
    state?: string;
    start_timestamp?: number;
    end_timestamp?: number;
    large_image_url?: string;
    small_image_url?: string;
    large_image_text?: string;
    small_image_text?: string;
    track_url?: string;
}

export interface SpotifyStatus {
    connected: boolean;
    display_in_profile: boolean;
}

export interface CurrentTrack {
    is_playing: boolean;
    track_name?: string;
    artist_name?: string;
    album_name?: string;
    album_image_url?: string;
    duration_ms?: number;
    progress_ms?: number;
}

export interface WsActivityUpdate {
    type: "activity_update";
    data: {
        user_id: string;
        activity: UserActivity | null;
    };
}
