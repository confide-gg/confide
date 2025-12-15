import { httpClient } from "../../core/network/HttpClient";
import type {
  AddMemberRequest,
  ConversationResponse,
  ConversationWithRouting,
  CreateConversationRequest,
  CreateDmRequest,
  MemberResponse,
} from "./types";
import { SuccessResponse } from "../../shared/types/common";

class ConversationService {
  public async getConversations(): Promise<ConversationWithRouting[]> {
    return httpClient.get<ConversationWithRouting[]>("/conversations");
  }

  public async createConversation(
    data: CreateConversationRequest
  ): Promise<ConversationResponse> {
    return httpClient.post<ConversationResponse>("/conversations", data);
  }

  public async getOrCreateDm(
    userId: string,
    data: CreateDmRequest
  ): Promise<ConversationResponse> {
    return httpClient.post<ConversationResponse>(`/conversations/dm/${userId}`, data);
  }

  public async getMembers(conversationId: string): Promise<MemberResponse[]> {
    return httpClient.get<MemberResponse[]>(`/conversations/${conversationId}/members`);
  }

  public async addMember(
    conversationId: string,
    data: AddMemberRequest
  ): Promise<SuccessResponse> {
    return httpClient.post<SuccessResponse>(`/conversations/${conversationId}/members`, data);
  }
}

export const conversationService = new ConversationService();
