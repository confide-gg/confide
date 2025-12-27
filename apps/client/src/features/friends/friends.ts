import { httpClient } from "../../core/network/HttpClient";
import type {
  AcceptFriendRequestBody,
  FriendRequest,
  FriendRequestResponse,
  FriendsResponse,
  SendFriendRequestBody,
  UpdateFriendsRequest,
} from "./types";
import { PublicUser } from "../../core/auth/types";
import { SuccessResponse } from "@/types/common";

class FriendService {
  public async getFriends(): Promise<FriendsResponse> {
    return httpClient.get<FriendsResponse>("/friends");
  }

  public async updateFriends(data: UpdateFriendsRequest): Promise<SuccessResponse> {
    return httpClient.put<SuccessResponse>("/friends", data);
  }

  public async searchUsers(query: string, limit?: number): Promise<PublicUser[]> {
    const params: Record<string, string> = { q: query };
    if (limit !== undefined) {
      params.limit = limit.toString();
    }
    return httpClient.get<PublicUser[]>("/friends/search", params);
  }

  public async getFriendRequests(): Promise<FriendRequestResponse[]> {
    return httpClient.get<FriendRequestResponse[]>("/friends/requests");
  }

  public async sendFriendRequest(data: SendFriendRequestBody): Promise<FriendRequest> {
    return httpClient.post<FriendRequest>("/friends/requests", data);
  }

  public async acceptFriendRequest(
    requestId: string,
    data: AcceptFriendRequestBody
  ): Promise<SuccessResponse> {
    return httpClient.post<SuccessResponse>(`/friends/requests/${requestId}/accept`, data);
  }

  public async rejectFriendRequest(requestId: string): Promise<SuccessResponse> {
    return httpClient.del<SuccessResponse>(`/friends/requests/${requestId}`);
  }
}

export const friendService = new FriendService();
