import { invoke } from "@tauri-apps/api/core";
import { httpClient } from "../../core/network/HttpClient";
import type {
  AnswerCallRequest,
  AnswerCallResponse,
  CallWithPeerInfo,
  InitiateCallRequest,
  InitiateCallResponse,
  KeyCompleteRequest,
  KeyCompleteResponse,
  LeaveCallResponse,
  RejoinCallResponse,
} from "./types";
import type {
  CreateGroupCallApiRequest,
  CreateGroupCallTauriResult,
  GroupCallResponse,
  JoinGroupCallApiRequest,
  JoinGroupCallTauriResult,
  ActiveGroupCallResponse,
  RelayCredentials,
} from "../../components/calls/types";

class CallService {
  public async initiateCall(request: InitiateCallRequest): Promise<InitiateCallResponse> {
    return httpClient.post<InitiateCallResponse>("/calls", request);
  }

  public async answerCall(callId: string, request: AnswerCallRequest): Promise<AnswerCallResponse> {
    return httpClient.post<AnswerCallResponse>(`/calls/${callId}/answer`, request);
  }

  public async rejectCall(callId: string, reason: string = "declined"): Promise<void> {
    return httpClient.post<void>(`/calls/${callId}/reject`, { reason });
  }

  public async cancelCall(callId: string): Promise<void> {
    return httpClient.post<void>(`/calls/${callId}/cancel`, {});
  }

  public async endCall(callId: string, reason: string = "normal"): Promise<void> {
    return httpClient.post<void>(`/calls/${callId}/end`, { reason });
  }

  public async completeKeyExchange(
    callId: string,
    request: KeyCompleteRequest
  ): Promise<KeyCompleteResponse> {
    return httpClient.post<KeyCompleteResponse>(`/calls/${callId}/key-complete`, request);
  }

  public async leaveCall(callId: string): Promise<LeaveCallResponse> {
    return httpClient.post<LeaveCallResponse>(`/calls/${callId}/leave`, {});
  }

  public async rejoinCall(callId: string): Promise<RejoinCallResponse> {
    return httpClient.post<RejoinCallResponse>(`/calls/${callId}/rejoin`, {});
  }

  public async getRejoinableCall(): Promise<CallWithPeerInfo | null> {
    return httpClient.get<CallWithPeerInfo | null>("/calls/rejoinable");
  }

  public async createGroupCall(params: {
    conversation_id: string;
    user_id: string;
    identity_public_key: number[];
    dsa_secret_key: number[];
  }): Promise<GroupCallResponse & { announcement: number[] }> {
    const tauriResult = await invoke<CreateGroupCallTauriResult>("create_group_call_announcement", {
      userId: params.user_id,
      identityPublicKey: params.identity_public_key,
      dsaSecretKey: params.dsa_secret_key,
    });

    const apiRequest: CreateGroupCallApiRequest = {
      call_id: tauriResult.call_id,
      conversation_id: params.conversation_id,
      announcement: tauriResult.announcement,
      signature: tauriResult.signature,
    };

    const response = await httpClient.post<GroupCallResponse>("/calls/group", apiRequest);
    return { ...response, announcement: tauriResult.announcement };
  }

  public async getGroupCall(callId: string): Promise<GroupCallResponse> {
    return httpClient.get<GroupCallResponse>(`/calls/group/${callId}`);
  }

  public async joinGroupCall(
    callId: string,
    params: {
      user_id: string;
      identity_public_key: number[];
      dsa_secret_key: number[];
      announcement: number[];
    }
  ): Promise<RelayCredentials> {
    const tauriResult = await invoke<JoinGroupCallTauriResult>("create_group_call_join", {
      callId: callId,
      userId: params.user_id,
      identityPublicKey: params.identity_public_key,
      dsaSecretKey: params.dsa_secret_key,
      announcement: params.announcement,
    });

    const apiRequest: JoinGroupCallApiRequest = {
      encrypted_sender_key_bundle: tauriResult.encrypted_sender_key_bundle,
      signature: tauriResult.signature,
      joiner_ephemeral_public: tauriResult.joiner_ephemeral_public,
      identity_public: params.identity_public_key,
    };

    return httpClient.post<RelayCredentials>(`/calls/group/${callId}/join`, apiRequest);
  }

  public async joinGroupCallAsInitiator(callId: string): Promise<RelayCredentials> {
    return httpClient.post<RelayCredentials>(`/calls/group/${callId}/join`, {
      encrypted_sender_key_bundle: [],
      signature: [],
      joiner_ephemeral_public: [],
      identity_public: [],
    });
  }

  public async leaveGroupCall(callId: string): Promise<void> {
    return httpClient.post<void>(`/calls/group/${callId}/leave`, {});
  }

  public async declineGroupCall(callId: string): Promise<void> {
    return httpClient.post<void>(`/calls/group/${callId}/decline`, {});
  }

  public async rejoinGroupCall(callId: string): Promise<RelayCredentials> {
    return httpClient.post<RelayCredentials>(`/calls/group/${callId}/rejoin`, {});
  }

  public async refreshGroupCallToken(callId: string): Promise<RelayCredentials> {
    return httpClient.post<RelayCredentials>(`/calls/group/${callId}/refresh-token`, {});
  }

  public async endGroupCall(callId: string): Promise<void> {
    return httpClient.post<void>(`/calls/group/${callId}/end`, {});
  }

  public async getActiveGroupCall(conversationId: string): Promise<ActiveGroupCallResponse | null> {
    return httpClient.get<ActiveGroupCallResponse | null>(
      `/conversations/${conversationId}/active-call`
    );
  }

  public async updateGroupCallMute(callId: string, isMuted: boolean): Promise<void> {
    return httpClient.post<void>(`/calls/group/${callId}/mute`, { is_muted: isMuted });
  }

  public async sendSenderKey(
    callId: string,
    targetUserId: string,
    encryptedSenderKey: number[],
    senderIdentityPublic: number[],
    senderEphemeralPublic: number[]
  ): Promise<void> {
    return httpClient.post<void>(`/calls/group/${callId}/sender-key`, {
      target_user_id: targetUserId,
      encrypted_sender_key: encryptedSenderKey,
      sender_identity_public: senderIdentityPublic,
      sender_ephemeral_public: senderEphemeralPublic,
    });
  }
}

export const callService = new CallService();
