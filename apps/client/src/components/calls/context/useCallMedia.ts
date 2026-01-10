import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CallState, AudioSettings } from "../types";
import { centralWebSocketService } from "../../../core/network/CentralWebSocketService";
import { audioSettingsService } from "../../../features/calls/audioSettings";
import type { CallRefs } from "./types";

interface UseCallMediaParams {
  refs: CallRefs;
  callState: CallState;
  currentUserId?: string;
  setIsPTTEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setPttKey: React.Dispatch<React.SetStateAction<string | null>>;
  refreshState: () => Promise<void>;
}

export function useCallMedia({
  refs,
  callState,
  currentUserId,
  setIsPTTEnabled,
  setPttKey,
  refreshState,
}: UseCallMediaParams) {
  const setMuted = useCallback(
    async (muted: boolean) => {
      await invoke("set_call_muted", { muted });
      await refreshState();

      const currentState = refs.callStateRef.current;
      if (currentState.call_id && currentState.peer_id && currentUserId) {
        centralWebSocketService.send({
          type: "call_mute_update",
          data: {
            call_id: currentState.call_id,
            user_id: currentUserId,
            is_muted: muted,
          },
        });
      }
    },
    [refs, refreshState, currentUserId]
  );

  const setDeafened = useCallback(
    async (deafened: boolean) => {
      await invoke("set_call_deafened", { deafened });
      await refreshState();
    },
    [refreshState]
  );

  const startMediaSession = useCallback(
    async (relayEndpoint: string, relayToken: number[]) => {
      await invoke("start_call_media_session", { relayEndpoint, relayToken });
      refs.callStartTimeRef.current = Date.now();
      await refreshState();
    },
    [refs, refreshState]
  );

  const refreshAudioSettings = useCallback(async () => {
    try {
      const dbSettings = await audioSettingsService.getAudioSettings().catch(() => null);
      if (dbSettings) {
        setIsPTTEnabled(dbSettings.push_to_talk_enabled);
        setPttKey(dbSettings.push_to_talk_key);
      } else {
        const tauriSettings = await invoke<AudioSettings>("get_audio_settings");
        setIsPTTEnabled(tauriSettings.push_to_talk_enabled);
        setPttKey(tauriSettings.push_to_talk_key);
      }
    } catch (e) {
      console.error("[CallContext] Failed to refresh audio settings:", e);
    }
  }, [setIsPTTEnabled, setPttKey]);

  return {
    setMuted,
    setDeafened,
    startMediaSession,
    refreshAudioSettings,
  };
}
