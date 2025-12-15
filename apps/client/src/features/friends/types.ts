import { PublicUser } from "../../core/auth/types";

export interface Friend {
    id: string;
    username: string;
    kem_public_key?: number[];
    dsa_public_key?: number[];
}

export interface FriendsResponse {
    encrypted_friends: number[];
}

export interface UpdateFriendsRequest {
    encrypted_friends: number[];
    removed_friend_id?: string;
}

export interface FriendRequestResponse {
    id: string;
    from_user: PublicUser;
    encrypted_message: number[] | null;
    created_at: string;
}

export interface SendFriendRequestBody {
    to_user_id: string;
    encrypted_message: number[] | null;
}

export interface AcceptFriendRequestBody {
    encrypted_friends: number[];
}

export interface FriendRequest {
    id: string;
    from_user_id: string;
    to_user_id: string;
    encrypted_message: number[] | null;
    created_at: string;
}

export interface WsFriendRequest {
    type: "friend_request";
    data: {
        id: string;
        from_user_id: string;
        encrypted_message: number[] | null;
    };
}

export interface WsFriendAccepted {
    type: "friend_accepted";
    data: {
        by_user_id: string;
        by_username: string;
    };
}

export interface WsFriendRemoved {
    type: "friend_removed";
    data: {
        by_user_id: string;
    };
}
