import { httpClient } from "../../core/network/HttpClient";
import type { ConversationResponse, MemberInit, MemberResponse } from "../chat/types";
import type { SuccessResponse } from "../../shared/types/common";

export interface CreateGroupRequest {
  encrypted_metadata: number[] | null;
  members: MemberInit[];
}

export interface AddGroupMemberRequest {
  user_id: string;
  encrypted_sender_key: number[];
  encrypted_role: number[];
}

export interface AddGroupMembersBulkRequest {
  members: AddGroupMemberRequest[];
}

export interface UpdateGroupOwnerRequest {
  new_owner_id: string;
}

export interface UpdateGroupMetadataRequest {
  encrypted_metadata: number[] | null;
}

class GroupService {
  public async createGroup(data: CreateGroupRequest): Promise<ConversationResponse> {
    return httpClient.post<ConversationResponse>("/conversations/groups", data);
  }

  public async getMembers(conversationId: string): Promise<MemberResponse[]> {
    return httpClient.get<MemberResponse[]>(`/conversations/${conversationId}/members`);
  }

  public async addMember(
    conversationId: string,
    data: AddGroupMemberRequest
  ): Promise<SuccessResponse> {
    return httpClient.post<SuccessResponse>(`/conversations/${conversationId}/members`, data);
  }

  public async addMembersBulk(
    conversationId: string,
    data: AddGroupMembersBulkRequest
  ): Promise<SuccessResponse> {
    return httpClient.post<SuccessResponse>(`/conversations/${conversationId}/members/bulk`, data);
  }

  public async removeMember(conversationId: string, userId: string): Promise<SuccessResponse> {
    return httpClient.del<SuccessResponse>(`/conversations/${conversationId}/members/${userId}`);
  }

  public async leaveGroup(conversationId: string): Promise<SuccessResponse> {
    return httpClient.post<SuccessResponse>(`/conversations/${conversationId}/leave`, {});
  }

  public async deleteGroup(conversationId: string): Promise<SuccessResponse> {
    return httpClient.del<SuccessResponse>(`/conversations/${conversationId}`);
  }

  public async transferOwnership(
    conversationId: string,
    data: UpdateGroupOwnerRequest
  ): Promise<SuccessResponse> {
    return httpClient.put<SuccessResponse>(`/conversations/${conversationId}/owner`, data);
  }

  public async updateMetadata(
    conversationId: string,
    data: UpdateGroupMetadataRequest
  ): Promise<SuccessResponse> {
    return httpClient.patch<SuccessResponse>(`/conversations/${conversationId}/metadata`, data);
  }
}

export const groupService = new GroupService();
