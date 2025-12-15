import { get, post, put, del } from "./client";
import type {
  GetMessagesQuery,
  Message,
  SendMessageRequest,
  SendMessageResponse,
  EditMessageRequest,
  EditMessageResponse,
  AddReactionRequest,
  ReactionResponse,
  SuccessResponse,
} from "./types";

export async function getMessages(
  conversationId: string,
  query?: GetMessagesQuery
): Promise<Message[]> {
  const params: Record<string, string> = {};
  if (query?.limit !== undefined) {
    params.limit = query.limit.toString();
  }
  if (query?.before) {
    params.before = query.before;
  }
  return get<Message[]>(`/messages/${conversationId}`, params);
}

export async function sendMessage(
  conversationId: string,
  data: SendMessageRequest
): Promise<SendMessageResponse> {
  return post<SendMessageResponse>(`/messages/${conversationId}`, data);
}

export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<SuccessResponse> {
  return del<SuccessResponse>(`/messages/${conversationId}/${messageId}`);
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  data: EditMessageRequest
): Promise<EditMessageResponse> {
  return put<EditMessageResponse>(`/messages/${conversationId}/${messageId}`, data);
}

export async function addReaction(
  conversationId: string,
  messageId: string,
  data: AddReactionRequest
): Promise<ReactionResponse> {
  return post<ReactionResponse>(`/messages/${conversationId}/${messageId}/reactions`, data);
}

export async function removeReaction(
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<SuccessResponse> {
  return del<SuccessResponse>(`/messages/${conversationId}/${messageId}/reactions/${encodeURIComponent(emoji)}`);
}

export interface MessageKeyResponse {
  encrypted_key: number[] | null;
}

export async function getMessageKey(
  conversationId: string,
  messageId: string
): Promise<MessageKeyResponse> {
  return get<MessageKeyResponse>(`/messages/${conversationId}/${messageId}/key`);
}

export async function pinMessage(
  conversationId: string,
  messageId: string
): Promise<SuccessResponse> {
  return post<SuccessResponse>(`/messages/${conversationId}/${messageId}/pin`, {});
}

export async function unpinMessage(
  conversationId: string,
  messageId: string
): Promise<SuccessResponse> {
  return post<SuccessResponse>(`/messages/${conversationId}/${messageId}/unpin`, {});
}

export async function getPinnedMessages(
  conversationId: string
): Promise<Message[]> {
  return get<Message[]>(`/messages/${conversationId}/pinned`);
}
