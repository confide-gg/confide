import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { audioSettings } from "../api";

interface UsePushToTalkOptions {
  onPTTStart?: () => void;
  onPTTEnd?: () => void;
  enabled?: boolean;
}

interface PTTState {
  isPTTActive: boolean;
  isPTTEnabled: boolean;
  pttKey: string | null;
}

function parseKeyCombo(keyCombo: string): { key: string; modifiers: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean } } {
  const parts = keyCombo.split(" + ");
  const modifiers = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };

  let key = "";
  for (const part of parts) {
    const lowerPart = part.toLowerCase();
    if (lowerPart === "ctrl" || lowerPart === "control") {
      modifiers.ctrl = true;
    } else if (lowerPart === "alt") {
      modifiers.alt = true;
    } else if (lowerPart === "shift") {
      modifiers.shift = true;
    } else if (lowerPart === "cmd" || lowerPart === "meta" || lowerPart === "command") {
      modifiers.meta = true;
    } else {
      key = part.toLowerCase();
    }
  }

  return { key, modifiers };
}

function eventMatchesKeyCombo(e: KeyboardEvent, keyCombo: string): boolean {
  const { key, modifiers } = parseKeyCombo(keyCombo);

  let eventKey = e.key.toLowerCase();
  if (eventKey === " ") eventKey = "space";

  const keyMatches = eventKey === key.toLowerCase();
  const ctrlMatches = e.ctrlKey === modifiers.ctrl;
  const altMatches = e.altKey === modifiers.alt;
  const shiftMatches = e.shiftKey === modifiers.shift;
  const metaMatches = e.metaKey === modifiers.meta;

  return keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches;
}

export function usePushToTalk({ onPTTStart, onPTTEnd, enabled = true }: UsePushToTalkOptions = {}) {
  const [state, setState] = useState<PTTState>({
    isPTTActive: false,
    isPTTEnabled: false,
    pttKey: null,
  });

  const isPTTActiveRef = useRef(false);
  const settingsLoadedRef = useRef(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const dbSettings = await audioSettings.getAudioSettings().catch(() => null);
        if (dbSettings) {
          setState(prev => ({
            ...prev,
            isPTTEnabled: dbSettings.push_to_talk_enabled,
            pttKey: dbSettings.push_to_talk_key,
          }));
        } else {
          const tauriSettings = await invoke<{
            push_to_talk_enabled: boolean;
            push_to_talk_key: string | null;
          }>("get_audio_settings");
          setState(prev => ({
            ...prev,
            isPTTEnabled: tauriSettings.push_to_talk_enabled,
            pttKey: tauriSettings.push_to_talk_key,
          }));
        }
        settingsLoadedRef.current = true;
      } catch (e) {
        console.error("[PTT] Failed to load settings:", e);
      }
    };

    loadSettings();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled || !state.isPTTEnabled || !state.pttKey) return;
    if (isPTTActiveRef.current) return;

    if (eventMatchesKeyCombo(e, state.pttKey)) {
      e.preventDefault();
      isPTTActiveRef.current = true;
      setState(prev => ({ ...prev, isPTTActive: true }));
      onPTTStart?.();
    }
  }, [enabled, state.isPTTEnabled, state.pttKey, onPTTStart]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!enabled || !state.isPTTEnabled || !state.pttKey) return;
    if (!isPTTActiveRef.current) return;

    const { key } = parseKeyCombo(state.pttKey);
    let eventKey = e.key.toLowerCase();
    if (eventKey === " ") eventKey = "space";

    if (eventKey === key.toLowerCase()) {
      e.preventDefault();
      isPTTActiveRef.current = false;
      setState(prev => ({ ...prev, isPTTActive: false }));
      onPTTEnd?.();
    }
  }, [enabled, state.isPTTEnabled, state.pttKey, onPTTEnd]);

  const handleBlur = useCallback(() => {
    if (isPTTActiveRef.current) {
      isPTTActiveRef.current = false;
      setState(prev => ({ ...prev, isPTTActive: false }));
      onPTTEnd?.();
    }
  }, [onPTTEnd]);

  useEffect(() => {
    if (!enabled || !state.isPTTEnabled || !state.pttKey) return;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, state.isPTTEnabled, state.pttKey, handleKeyDown, handleKeyUp, handleBlur]);

  const refreshSettings = useCallback(async () => {
    try {
      const dbSettings = await audioSettings.getAudioSettings().catch(() => null);
      if (dbSettings) {
        setState(prev => ({
          ...prev,
          isPTTEnabled: dbSettings.push_to_talk_enabled,
          pttKey: dbSettings.push_to_talk_key,
        }));
      }
    } catch (e) {
      console.error("[PTT] Failed to refresh settings:", e);
    }
  }, []);

  return {
    isPTTActive: state.isPTTActive,
    isPTTEnabled: state.isPTTEnabled,
    pttKey: state.pttKey,
    refreshSettings,
  };
}
