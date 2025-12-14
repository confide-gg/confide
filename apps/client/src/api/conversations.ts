import { get, post } from "./client";
import type {
  AddMemberRequest,
  ConversationResponse,
  ConversationWithRouting,
  CreateConversationRequest,
  CreateDmRequest,
  MemberResponse,
  SuccessResponse,
} from "./types";

export async function getConversations(): Promise<ConversationWithRouting[]> {
  return get<ConversationWithRouting[]>("/conversations");
}

export async function createConversation(
  data: CreateConversationRequest
): Promise<ConversationResponse> {
  return post<ConversationResponse>("/conversations", data);
}

export async function getOrCreateDm(
  userId: string,
  data: CreateDmRequest
): Promise<ConversationResponse> {
  return post<ConversationResponse>(`/conversations/dm/${userId}`, data);
}

export async function getMembers(conversationId: string): Promise<MemberResponse[]> {
  return get<MemberResponse[]>(`/conversations/${conversationId}/members`);
}

export async function addMember(
  conversationId: string,
  data: AddMemberRequest
): Promise<SuccessResponse> {
  return post<SuccessResponse>(`/conversations/${conversationId}/members`, data);
}
