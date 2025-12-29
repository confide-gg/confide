import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GroupCallState } from "../types";
import { centralWebSocketService } from "../../../core/network/CentralWebSocketService";
import { callService } from "../../../features/calls/calls";

interface UseGroupCallEffectsParams {
  groupCallState: GroupCallState | null;
  setGroupCallState: React.Dispatch<React.SetStateAction<GroupCallState | null>>;
  leaveGroupCall: () => Promise<void>;
  rejoinGroupCall: (params: {
    identityPublicKey: number[];
    dsaSecretKey: number[];
  }) => Promise<void>;
  canRejoinGroupCall: () => Promise<boolean>;
  resetGroupCallState: () => void;
  identityPublicKey?: number[];
  dsaSecretKey?: number[];
}

export function useGroupCallEffects({
  groupCallState,
  setGroupCallState,
  leaveGroupCall,
  rejoinGroupCall,
  canRejoinGroupCall,
  resetGroupCallState,
  identityPublicKey,
  dsaSecretKey,
}: UseGroupCallEffectsParams) {
  const groupCallStateRef = useRef(groupCallState);
  groupCallStateRef.current = groupCallState;

  const isOnlineRef = useRef(navigator.onLine);
  const wasInCallBeforeOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = async () => {
      isOnlineRef.current = true;

      const currentState = groupCallStateRef.current;
      if (wasInCallBeforeOfflineRef.current && currentState?.call_id) {
        if (!identityPublicKey || !dsaSecretKey) {
          console.warn("[GroupCall] Cannot auto-rejoin: missing keys");
          wasInCallBeforeOfflineRef.current = false;
          return;
        }
        const canRejoin = await canRejoinGroupCall();
        if (canRejoin) {
          try {
            console.log("[GroupCall] Auto-rejoining after network recovery");
            await rejoinGroupCall({ identityPublicKey, dsaSecretKey });
          } catch (e) {
            console.error("[GroupCall] Auto-rejoin failed:", e);
          }
        }
        wasInCallBeforeOfflineRef.current = false;
      }
    };

    const handleOffline = async () => {
      isOnlineRef.current = false;

      const currentState = groupCallStateRef.current;
      if (currentState?.status === "active") {
        console.log("[GroupCall] Network offline, leaving call");
        wasInCallBeforeOfflineRef.current = true;
        await leaveGroupCall();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [leaveGroupCall, rejoinGroupCall, canRejoinGroupCall, identityPublicKey, dsaSecretKey]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      const currentState = groupCallStateRef.current;

      if (!document.hidden && currentState?.call_id) {
        if (currentState.status === "active") {
          try {
            const callInfo = await callService.getGroupCall(currentState.call_id);
            if (callInfo.status === "ended") {
              await invoke("stop_group_call_media_session").catch(() => {});
              resetGroupCallState();
            }
          } catch {
            console.error("[GroupCall] Failed to refresh on visibility change");
          }
        } else if (currentState.status === "left") {
          try {
            const callInfo = await callService.getGroupCall(currentState.call_id);
            if (callInfo.status === "ended") {
              resetGroupCallState();
              return;
            }
            const hasActiveParticipants = callInfo.participants.some(
              (p) => p.status === "active" && p.user_id !== currentState.initiator_id
            );
            if (!hasActiveParticipants) {
              resetGroupCallState();
              return;
            }
            setGroupCallState((prev) => {
              if (!prev || prev.call_id !== callInfo.id) return prev;
              return {
                ...prev,
                participants: callInfo.participants.map((p) => ({
                  user_id: p.user_id,
                  username: p.username,
                  display_name: p.display_name,
                  avatar_url: p.avatar_url,
                  status: p.status,
                  is_muted: p.is_muted,
                  is_speaking: false,
                  audio_level: 0,
                  joined_at: p.joined_at,
                })),
              };
            });
          } catch {
            resetGroupCallState();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [setGroupCallState, resetGroupCallState]);

  useEffect(() => {
    const unsubscribeConnect = centralWebSocketService.onConnect(async () => {
      const currentState = groupCallStateRef.current;
      if (currentState?.call_id && currentState.status === "left") {
        try {
          const callInfo = await callService.getGroupCall(currentState.call_id);
          if (callInfo.status === "ended") {
            resetGroupCallState();
            return;
          }
          const hasActiveParticipants = callInfo.participants.some((p) => p.status === "active");
          if (!hasActiveParticipants) {
            resetGroupCallState();
            return;
          }
          setGroupCallState((prev) => {
            if (!prev || prev.call_id !== callInfo.id) return prev;
            return {
              ...prev,
              participants: callInfo.participants.map((p) => ({
                user_id: p.user_id,
                username: p.username,
                display_name: p.display_name,
                avatar_url: p.avatar_url,
                status: p.status,
                is_muted: p.is_muted,
                is_speaking: false,
                audio_level: 0,
                joined_at: p.joined_at,
              })),
              can_rejoin: true,
            };
          });
        } catch {
          resetGroupCallState();
        }
      }
    });

    return () => {
      unsubscribeConnect();
    };
  }, [setGroupCallState, resetGroupCallState]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentState = groupCallStateRef.current;
      if (
        currentState &&
        (currentState.status === "active" ||
          currentState.status === "connecting" ||
          currentState.status === "ringing")
      ) {
        if (currentState.call_id) {
          callService.leaveGroupCall(currentState.call_id).catch(() => {});
        }
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
