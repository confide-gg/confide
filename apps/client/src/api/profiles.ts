import { get, put } from "./client";
import type { UserProfile, PublicProfile, UpdateProfileRequest } from "../types";

export async function getMyProfile(): Promise<UserProfile | null> {
  return get<UserProfile | null>("/profiles/me");
}

export async function updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
  return put<UserProfile>("/profiles/me", data);
}

export async function getUserProfile(userId: string): Promise<PublicProfile | null> {
  return get<PublicProfile | null>(`/profiles/${userId}`);
}
