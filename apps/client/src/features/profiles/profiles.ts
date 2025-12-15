import { httpClient } from "../../core/network/HttpClient";
import type { UserProfile, PublicProfile, UpdateProfileRequest } from "./types";

class ProfileService {
  public async getMyProfile(): Promise<UserProfile | null> {
    return httpClient.get<UserProfile | null>("/profiles/me");
  }

  public async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    return httpClient.put<UserProfile>("/profiles/me", data);
  }

  public async getUserProfile(userId: string): Promise<PublicProfile | null> {
    return httpClient.get<PublicProfile | null>(`/profiles/${userId}`);
  }
}

export const profileService = new ProfileService();
