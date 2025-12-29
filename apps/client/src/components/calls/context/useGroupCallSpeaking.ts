import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GroupCallState, ParticipantStatus, SpeakingStateInfo } from "../types";

interface UseGroupCallSpeakingParams {
  groupCallState: GroupCallState | null;
  updateParticipant: (
    userId: string,
    update: Partial<{
      status: ParticipantStatus;
      is_muted: boolean;
      is_speaking: boolean;
      audio_level: number;
    }>
  ) => void;
}

const POLL_INTERVAL_MS = 500;

export function useGroupCallSpeaking({
  groupCallState,
  updateParticipant,
}: UseGroupCallSpeakingParams) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!groupCallState || groupCallState.status !== "active") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const pollSpeakingStates = async () => {
      try {
        const states = await invoke<SpeakingStateInfo[]>("get_group_call_speaking_states");

        for (const state of states) {
          updateParticipant(state.participant_id, {
            is_speaking: state.is_speaking,
            audio_level: state.audio_level,
          });
        }
      } catch (e) {
        console.error("[GroupCall] Failed to get speaking states:", e);
      }
    };

    intervalRef.current = setInterval(pollSpeakingStates, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [groupCallState?.call_id, groupCallState?.status, updateParticipant]);
}
