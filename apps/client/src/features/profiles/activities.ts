import { httpClient } from "../../core/network/HttpClient";
import type { UserActivity } from "./types";

export interface UpdateActivityRequest {
    activity_type?: string;
    name?: string;
    details?: string;
    state?: string;
    start_timestamp?: number;
    end_timestamp?: number;
    large_image_url?: string;
    small_image_url?: string;
    large_image_text?: string;
    small_image_text?: string;
    metadata?: Record<string, unknown>;
}

class ActivityService {
    public async getMyActivity(): Promise<UserActivity | null> {
        return httpClient.get<UserActivity | null>("/activities/me");
    }

    public async updateActivity(data: UpdateActivityRequest): Promise<UserActivity> {
        return httpClient.put<UserActivity>("/activities/me", data);
    }

    public async deleteMyActivity(): Promise<void> {
        return httpClient.del<void>("/activities/me");
    }

    public async getUserActivity(userId: string): Promise<UserActivity | null> {
        return httpClient.get<UserActivity | null>(`/activities/${userId}`);
    }
}

export const activityService = new ActivityService();
