import { httpClient } from "../../core/network/HttpClient";
import {
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
}

export const callService = new CallService();
