import { httpClient } from "../../core/network/HttpClient";
import type {
  GetMessagesQuery,
  Message,
  SendMessageRequest,
  SendMessageResponse,
  EditMessageRequest,
  EditMessageResponse,
  AddReactionRequest,
  ReactionResponse,
} from "./types";
import { SuccessResponse } from "../../shared/types/common";

export interface MessageKeyResponse {
  encrypted_key: number[] | null;
}

class MessageService {
  public async getMessages(conversationId: string, query?: GetMessagesQuery): Promise<Message[]> {
    const params: Record<string, string> = {};
    if (query?.limit !== undefined) {
      params.limit = query.limit.toString();
    }
    if (query?.before) {
      params.before = query.before;
    }
    return httpClient.get<Message[]>(`/messages/${conversationId}`, params);
  }

  public async sendMessage(
    conversationId: string,
    data: SendMessageRequest
  ): Promise<SendMessageResponse> {
    return httpClient.post<SendMessageResponse>(`/messages/${conversationId}`, data);
  }

  public async deleteMessage(conversationId: string, messageId: string): Promise<SuccessResponse> {
    return httpClient.del<SuccessResponse>(`/messages/${conversationId}/${messageId}`);
  }

  public async editMessage(
    conversationId: string,
    messageId: string,
    data: EditMessageRequest
  ): Promise<EditMessageResponse> {
    return httpClient.put<EditMessageResponse>(`/messages/${conversationId}/${messageId}`, data);
  }

  public async addReaction(
    conversationId: string,
    messageId: string,
    data: AddReactionRequest
  ): Promise<ReactionResponse> {
    return httpClient.post<ReactionResponse>(
      `/messages/${conversationId}/${messageId}/reactions`,
      data
    );
  }

  public async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<SuccessResponse> {
    return httpClient.del<SuccessResponse>(
      `/messages/${conversationId}/${messageId}/reactions/${encodeURIComponent(emoji)}`
    );
  }

  public async getMessageKey(
    conversationId: string,
    messageId: string
  ): Promise<MessageKeyResponse> {
    return httpClient.get<MessageKeyResponse>(`/messages/${conversationId}/${messageId}/key`);
  }

  public async pinMessage(conversationId: string, messageId: string): Promise<SuccessResponse> {
    return httpClient.post<SuccessResponse>(`/messages/${conversationId}/${messageId}/pin`, {});
  }

  public async unpinMessage(conversationId: string, messageId: string): Promise<SuccessResponse> {
    return httpClient.post<SuccessResponse>(`/messages/${conversationId}/${messageId}/unpin`, {});
  }

  public async getPinnedMessages(conversationId: string): Promise<Message[]> {
    return httpClient.get<Message[]>(`/messages/${conversationId}/pinned`);
  }
}

export const messageService = new MessageService();
