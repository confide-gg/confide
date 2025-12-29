import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  GroupCallState,
  IncomingGroupCallInfo,
  ParticipantStatus,
  GroupCallParticipant,
} from "../types";
import { centralWebSocketService } from "../../../core/network/CentralWebSocketService";
import { callService } from "../../../features/calls/calls";

interface SenderKeyDistributionResult {
  encrypted_sender_key: number[];
  our_ephemeral_public: number[];
}

interface UseGroupCallWebSocketParams {
  groupCallState: GroupCallState | null;
  setGroupCallState: React.Dispatch<React.SetStateAction<GroupCallState | null>>;
  currentUserId?: string;
  currentUserIdentityPublic?: number[];
  handleIncomingGroupCall: (info: IncomingGroupCallInfo) => void;
  addParticipant: (participant: {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (
    userId: string,
    update: Partial<{
      status: ParticipantStatus;
      is_muted: boolean;
      is_speaking: boolean;
      audio_level: number;
    }>
  ) => void;
  resetGroupCallState: () => void;
  setGroupCallEnded: () => void;
}

interface WsGroupCallRing {
  type: "group_call_ring";
  data: {
    call_id: string;
    conversation_id: string;
    initiator_id: string;
    initiator_username: string;
    initiator_display_name: string | null;
    initiator_avatar_url: string | null;
    participant_count: number;
    encrypted_group_metadata: number[] | null;
    announcement: number[];
    signature: number[];
    created_at: string;
  };
}

interface WsGroupCallStarted {
  type: "group_call_started";
  data: {
    call_id: string;
    conversation_id: string;
    initiator_id: string;
    initiator_username: string;
  };
}

interface WsGroupCallParticipantJoined {
  type: "group_call_participant_joined";
  data: {
    call_id: string;
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    encrypted_sender_key: number[];
    joiner_ephemeral_public: number[];
    identity_public: number[];
  };
}

interface WsGroupCallParticipantLeft {
  type: "group_call_participant_left";
  data: {
    call_id: string;
    user_id: string;
  };
}

interface WsGroupCallEnded {
  type: "group_call_ended";
  data: {
    call_id: string;
    conversation_id: string;
  };
}

interface WsGroupCallMuteUpdate {
  type: "group_call_mute_update";
  data: {
    call_id: string;
    user_id: string;
    is_muted: boolean;
  };
}

interface WsGroupCallSpeakingUpdate {
  type: "group_call_speaking_update";
  data: {
    call_id: string;
    user_id: string;
    is_speaking: boolean;
    audio_level: number;
  };
}

interface WsGroupCallSenderKey {
  type: "group_call_sender_key";
  data: {
    call_id: string;
    from_user_id: string;
    encrypted_sender_key: number[];
    sender_identity_public: number[];
    sender_ephemeral_public: number[];
  };
}

type GroupCallWsMessage =
  | WsGroupCallRing
  | WsGroupCallStarted
  | WsGroupCallParticipantJoined
  | WsGroupCallParticipantLeft
  | WsGroupCallEnded
  | WsGroupCallMuteUpdate
  | WsGroupCallSpeakingUpdate
  | WsGroupCallSenderKey;

export function useGroupCallWebSocket({
  groupCallState,
  setGroupCallState,
  currentUserId,
  currentUserIdentityPublic,
  handleIncomingGroupCall,
  addParticipant,
  removeParticipant,
  updateParticipant,
  resetGroupCallState,
  setGroupCallEnded,
}: UseGroupCallWebSocketParams) {
  const wasConnectedRef = useRef(false);
  const groupCallStateRef = useRef(groupCallState);
  groupCallStateRef.current = groupCallState;

  const refreshGroupCallState = useCallback(async () => {
    const currentCallState = groupCallStateRef.current;
    if (!currentCallState?.call_id) return;

    try {
      console.log("[GroupCall] Refreshing call state after WebSocket reconnect");
      const callInfo = await callService.getGroupCall(currentCallState.call_id);

      if (callInfo.status === "ended") {
        resetGroupCallState();
        return;
      }

      setGroupCallState((prev) => {
        if (!prev || prev.call_id !== callInfo.id) return prev;
        return {
          ...prev,
          status: callInfo.status as GroupCallState["status"],
          participants: callInfo.participants.map(
            (p): GroupCallParticipant => ({
              user_id: p.user_id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              status: p.status,
              is_muted: p.is_muted,
              is_speaking:
                prev.participants.find((pp) => pp.user_id === p.user_id)?.is_speaking ?? false,
              audio_level:
                prev.participants.find((pp) => pp.user_id === p.user_id)?.audio_level ?? 0,
              joined_at: p.joined_at,
            })
          ),
        };
      });
      console.log("[GroupCall] Call state refreshed successfully");
    } catch (e) {
      console.error("[GroupCall] Failed to refresh call state:", e);
    }
  }, [setGroupCallState, resetGroupCallState]);
  useEffect(() => {
    const handleWsMessage = async (msg: unknown) => {
      const groupMsg = msg as GroupCallWsMessage;

      switch (groupMsg.type) {
        case "group_call_ring": {
          const data = groupMsg.data;
          if (data.initiator_id === currentUserId) {
            break;
          }
          const info: IncomingGroupCallInfo = {
            call_id: data.call_id,
            conversation_id: data.conversation_id,
            initiator_id: data.initiator_id,
            initiator_username: data.initiator_username,
            initiator_display_name: data.initiator_display_name,
            initiator_avatar_url: data.initiator_avatar_url,
            participant_count: data.participant_count,
            encrypted_group_metadata: data.encrypted_group_metadata,
            announcement: data.announcement,
            signature: data.signature,
            created_at: data.created_at,
          };
          handleIncomingGroupCall(info);
          break;
        }

        case "group_call_started": {
          break;
        }

        case "group_call_participant_joined": {
          const data = groupMsg.data;
          if (groupCallState?.call_id === data.call_id && data.user_id !== currentUserId) {
            if (groupCallState.status === "left") {
              addParticipant({
                user_id: data.user_id,
                username: data.username,
                display_name: data.display_name,
                avatar_url: data.avatar_url,
              });
              break;
            }

            if (data.encrypted_sender_key?.length > 0) {
              invoke("handle_group_call_sender_key", {
                participantId: data.user_id,
                encryptedSenderKey: data.encrypted_sender_key,
                senderIdentityPublic: data.identity_public ?? [],
                senderEphemeralPublic: data.joiner_ephemeral_public ?? [],
              }).catch((e) => {
                console.error("[GroupCall] Failed to handle sender key:", e);
              });
            }

            if (
              data.joiner_ephemeral_public?.length > 0 &&
              data.identity_public?.length > 0 &&
              currentUserIdentityPublic?.length
            ) {
              const sendSenderKeyWithRetry = async (retries = 3) => {
                try {
                  const result = await invoke<SenderKeyDistributionResult>(
                    "create_sender_key_for_participant",
                    {
                      participantId: data.user_id,
                      participantIdentityPublic: data.identity_public,
                      participantEphemeralPublic: data.joiner_ephemeral_public,
                    }
                  );

                  for (let attempt = 0; attempt < retries; attempt++) {
                    try {
                      await callService.sendSenderKey(
                        groupCallState.call_id,
                        data.user_id,
                        Array.from(result.encrypted_sender_key),
                        Array.from(currentUserIdentityPublic),
                        Array.from(result.our_ephemeral_public)
                      );
                      console.log(
                        "[GroupCall] Sent our sender key to new participant:",
                        data.user_id
                      );
                      return;
                    } catch (sendError) {
                      console.error(
                        `[GroupCall] Failed to send sender key (attempt ${attempt + 1}/${retries}):`,
                        sendError
                      );
                      if (attempt < retries - 1) {
                        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
                      }
                    }
                  }
                  console.error("[GroupCall] Failed to send sender key after all retries");
                } catch (e) {
                  console.error("[GroupCall] Failed to create sender key:", e);
                }
              };
              sendSenderKeyWithRetry();
            }

            addParticipant({
              user_id: data.user_id,
              username: data.username,
              display_name: data.display_name,
              avatar_url: data.avatar_url,
            });
          }
          break;
        }

        case "group_call_participant_left": {
          const data = groupMsg.data;
          if (groupCallState?.call_id === data.call_id && data.user_id !== currentUserId) {
            if (groupCallState.status !== "left") {
              invoke("remove_group_call_participant", {
                participantId: data.user_id,
              }).catch((e) => {
                console.error("[GroupCall] Failed to remove participant:", e);
              });
            }

            removeParticipant(data.user_id);

            if (groupCallState.status === "left") {
              const remainingActive = groupCallState.participants.filter(
                (p) =>
                  p.user_id !== data.user_id && p.user_id !== currentUserId && p.status === "active"
              );
              if (remainingActive.length === 0) {
                resetGroupCallState();
              }
            }
          }
          break;
        }

        case "group_call_ended": {
          const data = groupMsg.data;
          if (groupCallState?.call_id === data.call_id) {
            if (groupCallState.status === "left") {
              resetGroupCallState();
            } else {
              invoke("stop_group_call_media_session").catch((e) => {
                console.error("[GroupCall] Failed to stop media session:", e);
              });
              resetGroupCallState();
            }
          }
          break;
        }

        case "group_call_mute_update": {
          const data = groupMsg.data;
          if (groupCallState?.call_id === data.call_id && data.user_id !== currentUserId) {
            updateParticipant(data.user_id, { is_muted: data.is_muted });
          }
          break;
        }

        case "group_call_speaking_update": {
          const data = groupMsg.data;
          if (groupCallState?.call_id === data.call_id && data.user_id !== currentUserId) {
            updateParticipant(data.user_id, { is_speaking: data.is_speaking });
          }
          break;
        }

        case "group_call_sender_key": {
          const data = groupMsg.data;
          if (groupCallState?.call_id === data.call_id && data.from_user_id !== currentUserId) {
            invoke("handle_group_call_sender_key", {
              participantId: data.from_user_id,
              encryptedSenderKey: data.encrypted_sender_key,
              senderIdentityPublic: data.sender_identity_public,
              senderEphemeralPublic: data.sender_ephemeral_public ?? [],
            }).catch((e) => {
              console.error("[GroupCall] Failed to handle incoming sender key:", e);
            });
            console.log("[GroupCall] Received sender key from:", data.from_user_id);
          }
          break;
        }
      }
    };

    const unsubscribe = centralWebSocketService.onMessage(handleWsMessage);
    return () => {
      unsubscribe();
    };
  }, [
    groupCallState,
    currentUserId,
    currentUserIdentityPublic,
    handleIncomingGroupCall,
    addParticipant,
    removeParticipant,
    updateParticipant,
    resetGroupCallState,
    setGroupCallEnded,
  ]);

  useEffect(() => {
    const handleConnect = () => {
      if (wasConnectedRef.current && groupCallStateRef.current?.call_id) {
        refreshGroupCallState();
      }
      wasConnectedRef.current = true;
    };

    const handleDisconnect = () => {
      if (groupCallStateRef.current?.call_id) {
        console.log("[GroupCall] WebSocket disconnected during active call");
      }
    };

    const unsubscribeConnect = centralWebSocketService.onConnect(handleConnect);
    const unsubscribeDisconnect = centralWebSocketService.onDisconnect(handleDisconnect);

    if (centralWebSocketService.isConnected()) {
      wasConnectedRef.current = true;
    }

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, [refreshGroupCallState]);
}
