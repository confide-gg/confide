import { del, get, post, put } from "./client";
import type {
  AcceptFriendRequestBody,
  FriendRequest,
  FriendRequestResponse,
  FriendsResponse,
  PublicUser,
  SendFriendRequestBody,
  SuccessResponse,
  UpdateFriendsRequest,
} from "./types";

export async function getFriends(): Promise<FriendsResponse> {
  return get<FriendsResponse>("/friends");
}

export async function updateFriends(data: UpdateFriendsRequest): Promise<SuccessResponse> {
  return put<SuccessResponse>("/friends", data);
}

export async function searchUsers(query: string, limit?: number): Promise<PublicUser[]> {
  const params: Record<string, string> = { q: query };
  if (limit !== undefined) {
    params.limit = limit.toString();
  }
  return get<PublicUser[]>("/friends/search", params);
}

export async function getFriendRequests(): Promise<FriendRequestResponse[]> {
  return get<FriendRequestResponse[]>("/friends/requests");
}

export async function sendFriendRequest(data: SendFriendRequestBody): Promise<FriendRequest> {
  return post<FriendRequest>("/friends/requests", data);
}

export async function acceptFriendRequest(
  requestId: string,
  data: AcceptFriendRequestBody
): Promise<SuccessResponse> {
  return post<SuccessResponse>(`/friends/requests/${requestId}/accept`, data);
}

export async function rejectFriendRequest(requestId: string): Promise<SuccessResponse> {
  return del<SuccessResponse>(`/friends/requests/${requestId}`);
}
