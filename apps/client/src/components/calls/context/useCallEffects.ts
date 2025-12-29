import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CallState } from "../types";
import { centralWebSocketService } from "../../../core/network/CentralWebSocketService";
import { callService as callsApi } from "../../../features/calls/calls";
import type { CallRefs } from "./types";
import { RING_TIMEOUT_MS, KEY_EXCHANGE_TIMEOUT_MS, PEER_LEFT_TIMEOUT_MS } from "./types";

interface UseCallEffectsParams {
  refs: CallRefs;
  callState: CallState;
  peerHasLeft: boolean;
  isPTTEnabled: boolean;
  pttKey: string | null;
  setIsPTTActive: React.Dispatch<React.SetStateAction<boolean>>;
  refreshState: () => Promise<void>;
  resetState: () => Promise<void>;
  refreshAudioSettings: () => Promise<void>;
  endCall: () => Promise<void>;
  leaveCall: () => Promise<void>;
  canRejoin: () => Promise<boolean>;
  rejoinCall: () => Promise<void>;
}

export function useCallEffects({
  refs,
  callState,
  peerHasLeft,
  isPTTEnabled,
  pttKey,
  setIsPTTActive,
  refreshState,
  resetState,
  refreshAudioSettings,
  endCall,
  leaveCall,
  canRejoin,
  rejoinCall,
}: UseCallEffectsParams) {
  useEffect(() => {
    resetState();
    refreshAudioSettings();
  }, []);

  useEffect(() => {
    if (!isPTTEnabled || !pttKey || callState.status !== "active") return;

    const parseKeyCombo = (keyCombo: string) => {
      const parts = keyCombo.split(" + ");
      const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
      let key = "";
      for (const part of parts) {
        const lowerPart = part.toLowerCase();
        if (lowerPart === "ctrl" || lowerPart === "control") modifiers.ctrl = true;
        else if (lowerPart === "alt") modifiers.alt = true;
        else if (lowerPart === "shift") modifiers.shift = true;
        else if (lowerPart === "cmd" || lowerPart === "meta" || lowerPart === "command")
          modifiers.meta = true;
        else key = part.toLowerCase();
      }
      return { key, modifiers };
    };

    const { key: targetKey, modifiers } = parseKeyCombo(pttKey);

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (refs.isPTTActiveRef.current) return;

      let eventKey = e.key.toLowerCase();
      if (eventKey === " ") eventKey = "space";

      const keyMatches = eventKey === targetKey;
      const modifiersMatch =
        e.ctrlKey === modifiers.ctrl &&
        e.altKey === modifiers.alt &&
        e.shiftKey === modifiers.shift &&
        e.metaKey === modifiers.meta;

      if (keyMatches && modifiersMatch) {
        e.preventDefault();
        refs.isPTTActiveRef.current = true;
        setIsPTTActive(true);
        await invoke("set_call_muted", { muted: false });
        await refreshState();
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (!refs.isPTTActiveRef.current) return;

      let eventKey = e.key.toLowerCase();
      if (eventKey === " ") eventKey = "space";

      if (eventKey === targetKey) {
        e.preventDefault();
        refs.isPTTActiveRef.current = false;
        setIsPTTActive(false);
        await invoke("set_call_muted", { muted: true });
        await refreshState();
      }
    };

    const handleBlur = async () => {
      if (refs.isPTTActiveRef.current) {
        refs.isPTTActiveRef.current = false;
        setIsPTTActive(false);
        await invoke("set_call_muted", { muted: true });
        await refreshState();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [refs, isPTTEnabled, pttKey, callState.status, refreshState, setIsPTTActive]);

  useEffect(() => {
    if (isPTTEnabled && callState.status === "active" && !refs.isPTTActiveRef.current) {
      invoke("set_call_muted", { muted: true }).catch(console.error);
    }
  }, [refs, isPTTEnabled, callState.status]);

  useEffect(() => {
    if (callState.status === "left" && peerHasLeft) {
      endCall();
    } else if (peerHasLeft && callState.status === "active") {
      refs.peerLeftTimeoutRef.current = setTimeout(() => {
        endCall();
      }, PEER_LEFT_TIMEOUT_MS);
    } else if (callState.status === "left" && callState.can_rejoin) {
      const timeRemaining = (callState.rejoin_time_remaining_seconds || 0) * 1000;

      if (timeRemaining > 0) {
        refs.peerLeftTimeoutRef.current = setTimeout(() => {
          endCall();
        }, timeRemaining);
      }
    } else {
      if (refs.peerLeftTimeoutRef.current) {
        clearTimeout(refs.peerLeftTimeoutRef.current);
        refs.peerLeftTimeoutRef.current = null;
      }
    }

    return () => {
      if (refs.peerLeftTimeoutRef.current) {
        clearTimeout(refs.peerLeftTimeoutRef.current);
        refs.peerLeftTimeoutRef.current = null;
      }
    };
  }, [
    refs,
    peerHasLeft,
    callState.status,
    callState.can_rejoin,
    callState.rejoin_time_remaining_seconds,
    endCall,
  ]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentState = refs.callStateRef.current;
      if (
        currentState.status === "active" ||
        currentState.status === "connecting" ||
        currentState.status === "ringing"
      ) {
        if (currentState.call_id) {
          navigator.sendBeacon?.(
            `/api/calls/${currentState.call_id}/leave-sync`,
            JSON.stringify({ reason: "app_closed" })
          );

          callsApi.leaveCall(currentState.call_id).catch(() => {});
        }
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [refs]);

  useEffect(() => {
    const handleOnline = async () => {
      refs.isOnlineRef.current = true;

      if (refs.wasInCallBeforeOfflineRef.current) {
        const canRejoinCall = await canRejoin();
        if (canRejoinCall) {
          try {
            await rejoinCall();
          } catch (e) {
            console.error("[CallContext] Auto-rejoin failed:", e);
          }
        }
        refs.wasInCallBeforeOfflineRef.current = false;
      }
    };

    const handleOffline = async () => {
      refs.isOnlineRef.current = false;

      const currentState = refs.callStateRef.current;
      if (currentState.status === "active") {
        refs.wasInCallBeforeOfflineRef.current = true;
        await leaveCall();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refs, canRejoin, rejoinCall, leaveCall]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentState = refs.callStateRef.current;

      if (!document.hidden) {
        if (currentState.status === "active" || currentState.status === "left") {
          refreshState();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refs, refreshState]);

  useEffect(() => {
    const unsubscribeConnect = centralWebSocketService.onConnect(() => {
      const currentState = refs.callStateRef.current;
      if (currentState.status === "active" || currentState.status === "left") {
        refreshState();
      }
    });

    const unsubscribeDisconnect = centralWebSocketService.onDisconnect(() => {});

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, [refs, refreshState]);

  useEffect(() => {
    const currentState = refs.callStateRef.current;

    if (currentState.status === "initiating" && currentState.is_caller) {
      refs.ringTimeoutRef.current = setTimeout(() => {
        endCall();
      }, RING_TIMEOUT_MS);
    } else {
      if (refs.ringTimeoutRef.current) {
        clearTimeout(refs.ringTimeoutRef.current);
        refs.ringTimeoutRef.current = null;
      }
    }

    return () => {
      if (refs.ringTimeoutRef.current) {
        clearTimeout(refs.ringTimeoutRef.current);
        refs.ringTimeoutRef.current = null;
      }
    };
  }, [refs, callState.status, callState.is_caller, endCall]);

  useEffect(() => {
    const currentState = refs.callStateRef.current;

    if (currentState.status === "connecting") {
      refs.keyExchangeTimeoutRef.current = setTimeout(() => {
        endCall();
      }, KEY_EXCHANGE_TIMEOUT_MS);
    } else {
      if (refs.keyExchangeTimeoutRef.current) {
        clearTimeout(refs.keyExchangeTimeoutRef.current);
        refs.keyExchangeTimeoutRef.current = null;
      }
    }

    return () => {
      if (refs.keyExchangeTimeoutRef.current) {
        clearTimeout(refs.keyExchangeTimeoutRef.current);
        refs.keyExchangeTimeoutRef.current = null;
      }
    };
  }, [refs, callState.status, endCall]);

  useEffect(() => {
    if (callState.status !== "active") return;

    const healthCheckInterval = setInterval(async () => {
      await refreshState();

      const currentState = refs.callStateRef.current;

      if (currentState.relay_token_expires_soon) {
        await leaveCall();
        setTimeout(async () => {
          const canRejoinCall = await canRejoin();
          if (canRejoinCall) {
            await rejoinCall();
          }
        }, 500);
      }
    }, 30000);

    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [refs, callState.status, refreshState, leaveCall, canRejoin, rejoinCall]);
}
