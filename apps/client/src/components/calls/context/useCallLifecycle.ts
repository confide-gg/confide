import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CallState, IncomingCallInfo, CallOfferResult, CallAnswerResult } from "../types";
import { callService as callsApi } from "../../../features/calls/calls";
import { centralWebSocketService } from "../../../core/network/CentralWebSocketService";
import type { PeerInfo, CallRefs } from "./types";
import { MAX_INCOMING_CALL_QUEUE, defaultCallState } from "./types";

interface UseCallLifecycleParams {
  refs: CallRefs;
  setCallState: React.Dispatch<React.SetStateAction<CallState>>;
  setIncomingCall: React.Dispatch<React.SetStateAction<IncomingCallInfo | null>>;
  setIncomingCallQueue: React.Dispatch<React.SetStateAction<IncomingCallInfo[]>>;
  setPeerHasLeft: React.Dispatch<React.SetStateAction<boolean>>;
  incomingCall: IncomingCallInfo | null;
  currentUserId?: string;
}

export function useCallLifecycle({
  refs,
  setCallState,
  setIncomingCall,
  setIncomingCallQueue,
  setPeerHasLeft,
  incomingCall,
  currentUserId,
}: UseCallLifecycleParams) {
  const bringWindowToFront = useCallback(async () => {
    try {
      const window = getCurrentWindow();
      await window.unminimize();
      await window.setFocus();
    } catch (e) {
      console.error("[CallContext] Failed to bring window to front:", e);
    }
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const state = await invoke<CallState>("get_call_state");
      setCallState(state);
    } catch (e) {
      console.error("[CallContext] Failed to get call state:", e);
    }
  }, [setCallState]);

  const resetState = useCallback(async () => {
    try {
      const currentState = await invoke<CallState>("get_call_state");
      if (currentState.status !== "idle" && currentState.status !== "left") {
        return;
      }
      refs.peerIdentityKeyRef.current = null;
      refs.pendingMediaReadyRef.current = null;
      refs.calleeKeyExchangeDoneRef.current = false;
      setPeerHasLeft(false);
      await invoke("reset_call_state");
      setCallState(defaultCallState);
      setIncomingCall(null);
    } catch (e) {
      console.error("[CallContext] Failed to reset call state:", e);
    }
  }, [refs, setPeerHasLeft, setCallState, setIncomingCall]);

  const processNextQueuedCall = useCallback(() => {
    setIncomingCallQueue((prev) => {
      if (prev.length === 0) return prev;
      const [nextCall, ...rest] = prev;
      setIncomingCall(nextCall);
      bringWindowToFront();
      invoke("handle_incoming_call", { info: nextCall }).then(() => refreshState());
      return rest;
    });
  }, [refreshState, bringWindowToFront, setIncomingCall, setIncomingCallQueue]);

  const initiateCall = useCallback(
    async (
      callerId: string,
      calleeId: string,
      calleeIdentityKey: number[],
      dsaSecretKey: number[],
      peerInfo: PeerInfo
    ) => {
      const currentState = await invoke<CallState>("get_call_state");
      if (currentState.status === "active") {
        const leaveCallId = await invoke<string | null>("leave_call");
        if (leaveCallId) {
          await callsApi.leaveCall(leaveCallId).catch(console.error);
        }
      }

      refs.peerIdentityKeyRef.current = calleeIdentityKey;
      refs.callPeerIdRef.current = calleeId;
      setPeerHasLeft(false);

      const result = await invoke<CallOfferResult>("create_call_offer", {
        callerId,
        calleeId,
        dsaSecretKey,
        peerUsername: peerInfo.username,
        peerDisplayName: peerInfo.displayName || null,
        peerAvatarUrl: peerInfo.avatarUrl || null,
      });

      try {
        await callsApi.initiateCall({
          call_id: result.call_id,
          callee_id: calleeId,
          ephemeral_kem_public: Array.from(result.ephemeral_kem_public),
          signature: Array.from(result.signature),
        });
      } catch (e) {
        console.error("[CallContext] Failed to initiate call on server:", e);
        refs.peerIdentityKeyRef.current = null;
        await invoke("end_call");
        await refreshState();
        throw e;
      }

      await refreshState();
      return result;
    },
    [refs, refreshState, setPeerHasLeft]
  );

  const handleIncomingCall = useCallback(
    (info: IncomingCallInfo) => {
      const currentState = refs.callStateRef.current;
      const hasCurrentIncomingCall = incomingCall !== null;

      if (currentState.status !== "idle" || hasCurrentIncomingCall) {
        setIncomingCallQueue((prev) => {
          if (prev.length >= MAX_INCOMING_CALL_QUEUE) {
            callsApi.rejectCall(info.call_id, "busy").catch(console.error);
            return prev;
          }
          if (prev.some((c) => c.call_id === info.call_id)) {
            return prev;
          }
          return [...prev, info];
        });
        return;
      }

      setIncomingCall(info);
      refs.callPeerIdRef.current = info.caller_id;
      bringWindowToFront();
      invoke("handle_incoming_call", { info }).then(() => refreshState());
    },
    [refs, refreshState, incomingCall, bringWindowToFront, setIncomingCall, setIncomingCallQueue]
  );

  const acceptCall = useCallback(
    async (callerIdentityPublic: number[], dsaSecretKey: number[]) => {
      const result = await invoke<CallAnswerResult>("accept_incoming_call", {
        callerIdentityPublic,
        dsaSecretKey,
      });
      setIncomingCall(null);
      setPeerHasLeft(false);
      await refreshState();
      return result;
    },
    [refreshState, setIncomingCall, setPeerHasLeft]
  );

  const rejectCall = useCallback(async () => {
    const currentIncoming = incomingCall;
    await invoke("reject_incoming_call");
    setIncomingCall(null);
    if (currentIncoming) {
      await callsApi.rejectCall(currentIncoming.call_id).catch(console.error);
    }
    refs.callPeerIdRef.current = null;
    await refreshState();
    processNextQueuedCall();
  }, [refs, refreshState, incomingCall, processNextQueuedCall, setIncomingCall]);

  const endCall = useCallback(async () => {
    const currentState = refs.callStateRef.current;

    refs.peerIdentityKeyRef.current = null;
    refs.pendingMediaReadyRef.current = null;
    refs.calleeKeyExchangeDoneRef.current = false;
    refs.callStartTimeRef.current = null;
    setPeerHasLeft(false);
    await invoke("end_call");

    if (currentState.call_id && currentState.status !== "left") {
      const isPreConnectedOutgoing =
        currentState.is_caller &&
        (currentState.status === "initiating" ||
          currentState.status === "ringing" ||
          currentState.status === "connecting");

      if (isPreConnectedOutgoing) {
        await callsApi.cancelCall(currentState.call_id).catch(console.error);
      } else {
        await callsApi.endCall(currentState.call_id).catch(console.error);
      }
    }

    await refreshState();
    processNextQueuedCall();
  }, [refs, refreshState, processNextQueuedCall, setPeerHasLeft]);

  const leaveCall = useCallback(async () => {
    const callId = await invoke<string | null>("leave_call");
    if (callId) {
      await callsApi.leaveCall(callId).catch(console.error);
    }

    await refreshState();
  }, [refreshState]);

  const rejoinCall = useCallback(async () => {
    const currentState = refs.callStateRef.current;
    if (!currentState.call_id || currentState.status !== "left") {
      console.error("[CallContext] Cannot rejoin - not in left state");
      return;
    }
    await invoke("prepare_rejoin_call");
    setPeerHasLeft(false);
    try {
      const relayCredentials = await callsApi.rejoinCall(currentState.call_id);
      await invoke("start_call_media_session", {
        relayEndpoint: relayCredentials.relay_endpoint,
        relayToken: relayCredentials.relay_token,
      });

      await refreshState();

      const newState = refs.callStateRef.current;
      if (newState.is_screen_sharing && currentUserId && newState.call_id && newState.peer_id) {
        centralWebSocketService.send({
          type: "screen_share_start",
          data: {
            call_id: newState.call_id,
            user_id: currentUserId,
            width: 1920,
            height: 1080,
          },
        });
      }
    } catch (e) {
      console.error("[CallContext] Failed to rejoin call:", e);
      await invoke("end_call");
      await refreshState();
    }
  }, [refs, refreshState, currentUserId, setPeerHasLeft]);

  const canRejoin = useCallback(async () => {
    return invoke<boolean>("can_rejoin_call");
  }, []);

  return {
    bringWindowToFront,
    refreshState,
    resetState,
    processNextQueuedCall,
    initiateCall,
    handleIncomingCall,
    acceptCall,
    rejectCall,
    endCall,
    leaveCall,
    rejoinCall,
    canRejoin,
  };
}
