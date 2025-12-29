import { useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import type {
  GroupCallState,
  IncomingGroupCallInfo,
  ParticipantStatus,
  GroupCallParticipant,
  SenderKeyBundle,
} from "../types";
import { callService } from "../../../features/calls/calls";
import { GROUP_RING_TIMEOUT_MS } from "./types";

interface UseGroupCallLifecycleParams {
  setGroupCallState: React.Dispatch<React.SetStateAction<GroupCallState | null>>;
  setIncomingGroupCall: React.Dispatch<React.SetStateAction<IncomingGroupCallInfo | null>>;
  currentUserId?: string;
}

export function useGroupCallLifecycle({
  setGroupCallState,
  setIncomingGroupCall,
  currentUserId,
}: UseGroupCallLifecycleParams) {
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);
  const bringWindowToFront = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      await window.unminimize();
      await window.setFocus();
    } catch (e) {
      console.error("[GroupCall] Failed to bring window to front:", e);
    }
  }, []);

  const resetGroupCallState = useCallback(() => {
    setGroupCallState(null);
    setIncomingGroupCall(null);
  }, [setGroupCallState, setIncomingGroupCall]);

  const setGroupCallEnded = useCallback(() => {
    setGroupCallState((prev) => {
      if (!prev) return prev;
      return { ...prev, status: "ended" };
    });
  }, [setGroupCallState]);

  const startGroupCall = useCallback(
    async (params: {
      conversationId: string;
      userId: string;
      identityPublicKey: number[];
      dsaSecretKey: number[];
    }) => {
      if (!currentUserId) {
        throw new Error("Not authenticated");
      }

      try {
        const response = await callService.createGroupCall({
          conversation_id: params.conversationId,
          user_id: params.userId,
          identity_public_key: params.identityPublicKey,
          dsa_secret_key: params.dsaSecretKey,
        });

        const relayCredentials = await callService.joinGroupCallAsInitiator(response.id);

        const callInfo = await callService.getGroupCall(response.id);

        const existingSenderKeys: SenderKeyBundle[] = callInfo.participants
          .filter((p) => p.user_id !== currentUserId && p.status === "active")
          .map((p) => ({
            participant_id: p.user_id,
            encrypted_sender_key: [],
            identity_public: [],
          }));

        await invoke("start_group_call_media_session", {
          callId: response.id,
          relayEndpoint: relayCredentials.relay_endpoint,
          relayToken: relayCredentials.relay_token,
          ourParticipantId: currentUserId,
          existingSenderKeys,
        });

        setGroupCallState({
          call_type: "group",
          call_id: response.id,
          conversation_id: params.conversationId,
          initiator_id: currentUserId,
          status: "active",
          participants: callInfo.participants.map(
            (p): GroupCallParticipant => ({
              user_id: p.user_id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              status: p.status,
              is_muted: p.is_muted,
              is_speaking: false,
              audio_level: 0,
              joined_at: p.joined_at,
            })
          ),
          is_muted: false,
          is_deafened: false,
          started_at: callInfo.created_at,
          connected_at: new Date().toISOString(),
          connection_health: "good",
          our_identity_public: params.identityPublicKey,
          left_at: null,
          can_rejoin: false,
          rejoin_expires_at: null,
          announcement: response.announcement,
        });

        return response;
      } catch (e) {
        console.error("[GroupCall] Failed to start group call:", e);
        await invoke("stop_group_call_media_session").catch(() => {});
        resetGroupCallState();
        throw e;
      }
    },
    [currentUserId, setGroupCallState, resetGroupCallState]
  );

  const joinGroupCall = useCallback(
    async (params: {
      callId: string;
      userId: string;
      identityPublicKey: number[];
      dsaSecretKey: number[];
      announcement: number[];
    }) => {
      if (!currentUserId) {
        throw new Error("Not authenticated");
      }

      clearRingTimeout();

      try {
        const relayCredentials = await callService.joinGroupCall(params.callId, {
          user_id: params.userId,
          identity_public_key: params.identityPublicKey,
          dsa_secret_key: params.dsaSecretKey,
          announcement: params.announcement,
        });

        const callInfo = await callService.getGroupCall(params.callId);

        const existingSenderKeys: SenderKeyBundle[] = callInfo.participants
          .filter((p) => p.user_id !== currentUserId && p.status === "active")
          .map((p) => ({
            participant_id: p.user_id,
            encrypted_sender_key: [],
            identity_public: [],
          }));

        await invoke("start_group_call_media_session", {
          callId: params.callId,
          relayEndpoint: relayCredentials.relay_endpoint,
          relayToken: relayCredentials.relay_token,
          ourParticipantId: currentUserId,
          existingSenderKeys,
        });

        setGroupCallState({
          call_type: "group",
          call_id: params.callId,
          conversation_id: callInfo.conversation_id,
          initiator_id: callInfo.initiator_id,
          status: "active",
          participants: callInfo.participants.map(
            (p): GroupCallParticipant => ({
              user_id: p.user_id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              status: p.status,
              is_muted: p.is_muted,
              is_speaking: false,
              audio_level: 0,
              joined_at: p.joined_at,
            })
          ),
          is_muted: false,
          is_deafened: false,
          started_at: callInfo.created_at,
          connected_at: new Date().toISOString(),
          connection_health: "good",
          our_identity_public: params.identityPublicKey,
          left_at: null,
          can_rejoin: false,
          rejoin_expires_at: null,
          announcement: params.announcement,
        });

        setIncomingGroupCall(null);
      } catch (e) {
        console.error("[GroupCall] Failed to join group call:", e);
        await invoke("stop_group_call_media_session").catch(() => {});
        throw e;
      }
    },
    [currentUserId, setGroupCallState, setIncomingGroupCall, clearRingTimeout]
  );

  const handleIncomingGroupCall = useCallback(
    (info: IncomingGroupCallInfo) => {
      clearRingTimeout();
      setIncomingGroupCall(info);
      bringWindowToFront();

      ringTimeoutRef.current = setTimeout(() => {
        console.log("[GroupCall] Ring timeout - auto-dismissing incoming call");
        setIncomingGroupCall((prev) => {
          if (prev?.call_id === info.call_id) {
            return null;
          }
          return prev;
        });
      }, GROUP_RING_TIMEOUT_MS);
    },
    [setIncomingGroupCall, bringWindowToFront, clearRingTimeout]
  );

  const declineGroupCall = useCallback(
    async (callId?: string) => {
      clearRingTimeout();
      const targetCallId = callId;
      setIncomingGroupCall((prev) => {
        if (targetCallId || prev?.call_id) {
          callService.declineGroupCall(targetCallId || prev!.call_id).catch((e) => {
            console.error("[GroupCall] Failed to decline:", e);
          });
        }
        return null;
      });
    },
    [setIncomingGroupCall, clearRingTimeout]
  );

  const leaveGroupCall = useCallback(async () => {
    let callId: string | undefined;
    let conversationId: string | undefined;
    let initiatorId: string | undefined;
    let participantsCopy: GroupCallParticipant[] = [];
    let startedAt: string | null = null;
    let connectedAt: string | null = null;
    let ourIdentityPublic: number[] | undefined;
    let announcement: number[] | undefined;

    setGroupCallState((prev) => {
      if (!prev?.call_id) return null;
      callId = prev.call_id;
      conversationId = prev.conversation_id;
      initiatorId = prev.initiator_id;
      participantsCopy = [...prev.participants];
      startedAt = prev.started_at;
      connectedAt = prev.connected_at;
      ourIdentityPublic = prev.our_identity_public;
      announcement = prev.announcement;
      return prev;
    });

    await invoke("stop_group_call_media_session").catch((e) => {
      console.error("[GroupCall] Failed to stop media session:", e);
    });

    if (callId) {
      try {
        await callService.leaveGroupCall(callId);
      } catch (e) {
        console.error("[GroupCall] Failed to leave:", e);
      }
    }

    const hasActiveParticipants = participantsCopy.some(
      (p) => p.status === "active" && p.user_id !== currentUserId
    );

    if (!hasActiveParticipants) {
      setGroupCallState(null);
      return;
    }

    const leftAt = new Date().toISOString();
    if (callId && conversationId && initiatorId) {
      setGroupCallState({
        call_type: "group",
        call_id: callId,
        conversation_id: conversationId,
        initiator_id: initiatorId,
        status: "left",
        participants: participantsCopy,
        is_muted: false,
        is_deafened: false,
        started_at: startedAt,
        connected_at: connectedAt,
        connection_health: "disconnected",
        our_identity_public: ourIdentityPublic,
        left_at: leftAt,
        can_rejoin: true,
        rejoin_expires_at: null,
        announcement,
      });
    }
  }, [setGroupCallState, currentUserId]);

  const rejoinGroupCall = useCallback(
    async (params: { identityPublicKey: number[]; dsaSecretKey: number[] }) => {
      let callId: string | undefined;
      let conversationId: string | undefined;
      let initiatorId: string | undefined;
      let startedAt: string | null = null;
      let ourIdentityPublic: number[] | undefined;
      let participants: GroupCallParticipant[] = [];
      let announcement: number[] | undefined;

      setGroupCallState((prev) => {
        if (!prev?.call_id || prev.status !== "left") {
          console.error("[GroupCall] Cannot rejoin - not in left state");
          return prev;
        }
        callId = prev.call_id;
        conversationId = prev.conversation_id;
        initiatorId = prev.initiator_id;
        startedAt = prev.started_at;
        ourIdentityPublic = prev.our_identity_public;
        participants = prev.participants;
        announcement = prev.announcement;
        return prev;
      });

      if (!callId || !currentUserId) {
        throw new Error("No call to rejoin");
      }

      if (!announcement || announcement.length === 0) {
        throw new Error("No announcement available for rejoin");
      }

      try {
        await invoke("create_group_call_join", {
          callId: callId,
          userId: currentUserId,
          identityPublicKey: params.identityPublicKey,
          dsaSecretKey: params.dsaSecretKey,
          announcement: announcement,
        });

        const relayCredentials = await callService.rejoinGroupCall(callId);

        const callInfo = await callService.getGroupCall(callId);

        const existingSenderKeys: SenderKeyBundle[] = callInfo.participants
          .filter((p) => p.user_id !== currentUserId && p.status === "active")
          .map((p) => ({
            participant_id: p.user_id,
            encrypted_sender_key: [],
            identity_public: [],
          }));

        await invoke("start_group_call_media_session", {
          callId: callId,
          relayEndpoint: relayCredentials.relay_endpoint,
          relayToken: relayCredentials.relay_token,
          ourParticipantId: currentUserId,
          existingSenderKeys,
        });

        setGroupCallState({
          call_type: "group",
          call_id: callId,
          conversation_id: conversationId!,
          initiator_id: initiatorId!,
          status: "active",
          participants: callInfo.participants.map(
            (p): GroupCallParticipant => ({
              user_id: p.user_id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              status: p.status,
              is_muted: p.is_muted,
              is_speaking: false,
              audio_level: 0,
              joined_at: p.joined_at,
            })
          ),
          is_muted: false,
          is_deafened: false,
          started_at: startedAt,
          connected_at: new Date().toISOString(),
          connection_health: "good",
          our_identity_public: params.identityPublicKey,
          left_at: null,
          can_rejoin: false,
          rejoin_expires_at: null,
          announcement,
        });

        console.log("[GroupCall] Successfully rejoined call:", callId);
      } catch (e) {
        console.error("[GroupCall] Failed to rejoin:", e);
        await invoke("stop_group_call_media_session").catch(() => {});

        setGroupCallState((prev) => {
          if (!prev) {
            return {
              call_type: "group",
              call_id: callId!,
              conversation_id: conversationId!,
              initiator_id: initiatorId!,
              status: "left",
              participants,
              is_muted: false,
              is_deafened: false,
              started_at: startedAt,
              connected_at: null,
              connection_health: "disconnected",
              our_identity_public: ourIdentityPublic,
              left_at: new Date().toISOString(),
              can_rejoin: true,
              rejoin_expires_at: null,
              announcement,
            };
          }
          return { ...prev, status: "left", can_rejoin: true };
        });
        throw e;
      }
    },
    [currentUserId, setGroupCallState]
  );

  const canRejoinGroupCall = useCallback(async (): Promise<boolean> => {
    let canRejoin = false;
    setGroupCallState((prev) => {
      if (!prev?.call_id || prev.status !== "left") {
        canRejoin = false;
        return prev;
      }

      canRejoin = prev.can_rejoin;
      return prev;
    });
    return canRejoin;
  }, [setGroupCallState]);

  const endGroupCall = useCallback(async () => {
    await invoke("stop_group_call_media_session").catch((e) => {
      console.error("[GroupCall] Failed to stop media session:", e);
    });

    setGroupCallState((prev) => {
      if (!prev?.call_id) return prev;
      callService.endGroupCall(prev.call_id).catch(console.error);
      return null;
    });
  }, [setGroupCallState]);

  const setMuted = useCallback(
    async (muted: boolean) => {
      await invoke("set_group_call_muted", { muted }).catch((e) => {
        console.error("[GroupCall] Failed to set muted:", e);
      });

      setGroupCallState((prev) => {
        if (!prev?.call_id) return prev;
        callService.updateGroupCallMute(prev.call_id, muted).catch(console.error);
        return { ...prev, is_muted: muted };
      });
    },
    [setGroupCallState]
  );

  const setDeafened = useCallback(
    async (deafened: boolean) => {
      await invoke("set_group_call_deafened", { deafened }).catch((e) => {
        console.error("[GroupCall] Failed to set deafened:", e);
      });

      setGroupCallState((prev) => {
        if (!prev) return prev;
        return { ...prev, is_deafened: deafened };
      });
    },
    [setGroupCallState]
  );

  const updateParticipant = useCallback(
    (
      userId: string,
      update: Partial<{
        status: ParticipantStatus;
        is_muted: boolean;
        is_speaking: boolean;
        audio_level: number;
      }>
    ) => {
      setGroupCallState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.user_id === userId ? { ...p, ...update } : p
          ),
        };
      });
    },
    [setGroupCallState]
  );

  const addParticipant = useCallback(
    (participant: {
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    }) => {
      setGroupCallState((prev) => {
        if (!prev) return prev;
        if (prev.participants.some((p) => p.user_id === participant.user_id)) {
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p.user_id === participant.user_id
                ? { ...p, status: "active" as ParticipantStatus }
                : p
            ),
          };
        }
        const newParticipant: GroupCallParticipant = {
          ...participant,
          status: "active",
          is_muted: false,
          is_speaking: false,
          audio_level: 0,
          joined_at: new Date().toISOString(),
        };
        return {
          ...prev,
          participants: [...prev.participants, newParticipant],
        };
      });
    },
    [setGroupCallState]
  );

  const removeParticipant = useCallback(
    (userId: string) => {
      setGroupCallState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.user_id === userId ? { ...p, status: "left" as ParticipantStatus } : p
          ),
        };
      });
    },
    [setGroupCallState]
  );

  return {
    bringWindowToFront,
    resetGroupCallState,
    setGroupCallEnded,
    startGroupCall,
    joinGroupCall,
    handleIncomingGroupCall,
    declineGroupCall,
    leaveGroupCall,
    rejoinGroupCall,
    canRejoinGroupCall,
    endGroupCall,
    setMuted,
    setDeafened,
    updateParticipant,
    addParticipant,
    removeParticipant,
  };
}
