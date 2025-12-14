import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CallState, IncomingCallInfo, CallOfferResult, CallAnswerResult, KeyCompleteResult, AudioSettings, ScreenCaptureSource } from "./types";
import { wsService } from "@/api/websocket";
import * as callsApi from "@/api/calls";
import { audioSettings } from "@/api";
import type { WsMessage, WsCallOffer, WsCallAnswer, WsCallKeyComplete, WsCallReject, WsCallCancel, WsCallEnd, WsCallMediaReady, WsCallLeave, WsCallRejoin, WsCallMuteUpdate } from "@/api/types";

const MAX_INCOMING_CALL_QUEUE = 3;
const RING_TIMEOUT_MS = 30000;
const KEY_EXCHANGE_TIMEOUT_MS = 30000;

interface PeerInfo {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

interface CallContextValue {
  callState: CallState;
  incomingCall: IncomingCallInfo | null;
  incomingCallQueue: IncomingCallInfo[];
  peerHasLeft: boolean;
  isPTTActive: boolean;
  isPTTEnabled: boolean;
  initiateCall: (callerId: string, calleeId: string, calleeIdentityKey: number[], dsaSecretKey: number[], peerInfo: PeerInfo) => Promise<CallOfferResult>;
  handleIncomingCall: (info: IncomingCallInfo) => void;
  acceptCall: (
    callerIdentityPublic: number[],
    dsaSecretKey: number[]
  ) => Promise<CallAnswerResult>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  leaveCall: () => Promise<void>;
  rejoinCall: () => Promise<void>;
  canRejoin: () => Promise<boolean>;
  setMuted: (muted: boolean) => Promise<void>;
  setDeafened: (deafened: boolean) => Promise<void>;
  completeKeyExchangeAsCaller: (
    calleeEphemeralPublic: number[],
    calleeKemCiphertext: number[],
    calleeSignature: number[],
    calleeIdentityPublic: number[]
  ) => Promise<KeyCompleteResult>;
  completeKeyExchangeAsCallee: (callerKemCiphertext: number[]) => Promise<void>;
  startMediaSession: (relayEndpoint: string, relayToken: number[]) => Promise<void>;
  refreshState: () => Promise<void>;
  refreshAudioSettings: () => Promise<void>;
  getScreenSources: () => Promise<ScreenCaptureSource[]>;
  startScreenShare: (sourceId: string) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  checkScreenPermission: () => Promise<boolean>;
}

const defaultCallState: CallState = {
  call_id: null,
  peer_id: null,
  peer_username: null,
  peer_display_name: null,
  peer_avatar_url: null,
  status: "idle",
  is_caller: false,
  is_muted: false,
  is_deafened: false,
  peer_is_muted: false,
  started_at: null,
  connected_at: null,
  is_screen_sharing: false,
  peer_is_screen_sharing: false,
  screen_share_source: null,
  connection_health: "good",
  last_audio_received_at: null,
  relay_token_expires_at: null,
  relay_token_expires_soon: false,
  left_at: null,
  can_rejoin: false,
  rejoin_time_remaining_seconds: null,
};

const CallContext = createContext<CallContextValue | null>(null);

interface CallProviderProps {
  children: ReactNode;
  currentUserId?: string;
  onCallAnswerReceived?: (data: { call_id: string; callee_id: string; ephemeral_kem_public: number[]; kem_ciphertext: number[]; signature: number[] }) => void;
  onKeyCompleteReceived?: (data: { call_id: string; kem_ciphertext: number[] }) => void;
  onMediaReadyReceived?: (data: { call_id: string; relay_endpoint: string; relay_token: number[]; expires_at: string }) => void;
}

export function CallProvider({ children, currentUserId, onCallAnswerReceived, onKeyCompleteReceived, onMediaReadyReceived }: CallProviderProps) {
  const [callState, setCallState] = useState<CallState>(defaultCallState);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [incomingCallQueue, setIncomingCallQueue] = useState<IncomingCallInfo[]>([]);
  const [peerHasLeft, setPeerHasLeft] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isPTTEnabled, setIsPTTEnabled] = useState(false);
  const [pttKey, setPttKey] = useState<string | null>(null);
  const peerIdentityKeyRef = useRef<number[] | null>(null);
  const pendingMediaReadyRef = useRef<{ relay_endpoint: string; relay_token: number[] } | null>(null);
  const calleeKeyExchangeDoneRef = useRef<boolean>(false);
  const peerLeftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callPeerIdRef = useRef<string | null>(null);
  const isPTTActiveRef = useRef(false);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyExchangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnlineRef = useRef(navigator.onLine);
  const wasInCallBeforeOfflineRef = useRef(false);

  const PEER_LEFT_TIMEOUT_MS = 300000; // 5 minutes

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
  }, []);

  const resetState = useCallback(async () => {
    try {
      const currentState = await invoke<CallState>("get_call_state");
      if (currentState.status !== "idle" && currentState.status !== "left") {
        return;
      }
      peerIdentityKeyRef.current = null;
      pendingMediaReadyRef.current = null;
      calleeKeyExchangeDoneRef.current = false;
      setPeerHasLeft(false);
      await invoke("reset_call_state");
      setCallState(defaultCallState);
      setIncomingCall(null);
    } catch (e) {
      console.error("[CallContext] Failed to reset call state:", e);
    }
  }, []);

  const initiateCall = useCallback(async (callerId: string, calleeId: string, calleeIdentityKey: number[], dsaSecretKey: number[], peerInfo: PeerInfo) => {
    const currentState = await invoke<CallState>("get_call_state");
    if (currentState.status === "active") {
      const leaveCallId = await invoke<string | null>("leave_call");
      if (leaveCallId) {
        await callsApi.leaveCall(leaveCallId).catch(console.error);
      }
    }

    peerIdentityKeyRef.current = calleeIdentityKey;
    callPeerIdRef.current = calleeId;
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
      peerIdentityKeyRef.current = null;
      await invoke("end_call");
      await refreshState();
      throw e;
    }

    await refreshState();
    return result;
  }, [refreshState]);

  const handleIncomingCall = useCallback((info: IncomingCallInfo) => {
    const currentState = callStateRef.current;
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
    callPeerIdRef.current = info.caller_id;
    bringWindowToFront();
    invoke("handle_incoming_call", { info }).then(() => refreshState());
  }, [refreshState, incomingCall, bringWindowToFront]);

  const acceptCall = useCallback(async (
    callerIdentityPublic: number[],
    dsaSecretKey: number[]
  ) => {
    const result = await invoke<CallAnswerResult>("accept_incoming_call", {
      callerIdentityPublic,
      dsaSecretKey,
    });
    setIncomingCall(null);
    await refreshState();
    return result;
  }, [refreshState]);

  const processNextQueuedCall = useCallback(() => {
    setIncomingCallQueue((prev) => {
      if (prev.length === 0) return prev;
      const [nextCall, ...rest] = prev;
      setIncomingCall(nextCall);
      bringWindowToFront();
      invoke("handle_incoming_call", { info: nextCall }).then(() => refreshState());
      return rest;
    });
  }, [refreshState, bringWindowToFront]);

  const rejectCall = useCallback(async () => {
    const currentIncoming = incomingCall;
    await invoke("reject_incoming_call");
    setIncomingCall(null);
    if (currentIncoming) {
      await callsApi.rejectCall(currentIncoming.call_id).catch(console.error);
    }
    callPeerIdRef.current = null;
    await refreshState();
    processNextQueuedCall();
  }, [refreshState, incomingCall, processNextQueuedCall]);

  const endCall = useCallback(async () => {
    const currentState = callStateRef.current;

    peerIdentityKeyRef.current = null;
    pendingMediaReadyRef.current = null;
    calleeKeyExchangeDoneRef.current = false;
    callStartTimeRef.current = null;
    setPeerHasLeft(false);
    await invoke("end_call");

    if (currentState.call_id && currentState.status !== "left") {
      const isPreConnectedOutgoing = currentState.is_caller &&
        (currentState.status === "initiating" || currentState.status === "ringing" || currentState.status === "connecting");

      if (isPreConnectedOutgoing) {
        await callsApi.cancelCall(currentState.call_id).catch(console.error);
      } else {
        await callsApi.endCall(currentState.call_id).catch(console.error);
      }
    }

    await refreshState();
    processNextQueuedCall();
  }, [refreshState, processNextQueuedCall]);

  const leaveCall = useCallback(async () => {
    const callId = await invoke<string | null>("leave_call");
    if (callId) {
      await callsApi.leaveCall(callId).catch(console.error);
    }

    await refreshState();
  }, [refreshState]);

  const rejoinCall = useCallback(async () => {
    const currentState = callStateRef.current;
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

      const newState = callStateRef.current;
      if (newState.is_screen_sharing && currentUserId && newState.call_id && newState.peer_id) {
        wsService.send({
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
  }, [refreshState, currentUserId]);

  const canRejoin = useCallback(async () => {
    return invoke<boolean>("can_rejoin_call");
  }, []);

  const setMuted = useCallback(async (muted: boolean) => {
    await invoke("set_call_muted", { muted });
    await refreshState();

    const currentState = callStateRef.current;
    if (currentState.call_id && currentState.peer_id && currentUserId) {
      wsService.send({
        type: "call_mute_update",
        data: {
          call_id: currentState.call_id,
          user_id: currentUserId,
          is_muted: muted,
        },
      });
    }
  }, [refreshState, currentUserId]);

  const setDeafened = useCallback(async (deafened: boolean) => {
    await invoke("set_call_deafened", { deafened });
    await refreshState();
  }, [refreshState]);

  const completeKeyExchangeAsCaller = useCallback(async (
    calleeEphemeralPublic: number[],
    calleeKemCiphertext: number[],
    calleeSignature: number[],
    calleeIdentityPublic: number[]
  ) => {
    const result = await invoke<KeyCompleteResult>("complete_call_key_exchange_as_caller", {
      calleeEphemeralPublic,
      calleeKemCiphertext,
      calleeSignature,
      calleeIdentityPublic,
    });
    await refreshState();
    return result;
  }, [refreshState]);

  const completeKeyExchangeAsCallee = useCallback(async (callerKemCiphertext: number[]) => {
    await invoke("complete_call_key_exchange_as_callee", { callerKemCiphertext });
    await refreshState();
  }, [refreshState]);

  const startMediaSession = useCallback(async (relayEndpoint: string, relayToken: number[]) => {
    await invoke("start_call_media_session", { relayEndpoint, relayToken });
    callStartTimeRef.current = Date.now();
    await refreshState();
  }, [refreshState]);

  const refreshAudioSettings = useCallback(async () => {
    try {
      const dbSettings = await audioSettings.getAudioSettings().catch(() => null);
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
  }, []);

  const getScreenSources = useCallback(async (): Promise<ScreenCaptureSource[]> => {
    return await invoke<ScreenCaptureSource[]>("get_screen_sources");
  }, []);

  const startScreenShare = useCallback(async (sourceId: string): Promise<void> => {
    await invoke("start_screen_share", { sourceId });
    await refreshState();

    if (callState.call_id && callState.peer_id && currentUserId) {
      wsService.send({
        type: "screen_share_start",
        data: {
          call_id: callState.call_id,
          user_id: currentUserId,
          width: 1920,
          height: 1080,
        },
      });
    }
  }, [refreshState, callState.call_id, callState.peer_id, currentUserId]);

  const stopScreenShare = useCallback(async (): Promise<void> => {
    await invoke("stop_screen_share");
    await refreshState();

    if (callState.call_id && callState.peer_id && currentUserId) {
      wsService.send({
        type: "screen_share_stop",
        data: {
          call_id: callState.call_id,
          user_id: currentUserId,
        },
      });
    }
  }, [refreshState, callState.call_id, callState.peer_id, currentUserId]);

  const checkScreenPermission = useCallback(async (): Promise<boolean> => {
    return await invoke<boolean>("check_screen_recording_permission");
  }, []);

  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      resetState();
      refreshAudioSettings();
    }
  }, [resetState, refreshAudioSettings]);

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
        else if (lowerPart === "cmd" || lowerPart === "meta" || lowerPart === "command") modifiers.meta = true;
        else key = part.toLowerCase();
      }
      return { key, modifiers };
    };

    const { key: targetKey, modifiers } = parseKeyCombo(pttKey);

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isPTTActiveRef.current) return;

      let eventKey = e.key.toLowerCase();
      if (eventKey === " ") eventKey = "space";

      const keyMatches = eventKey === targetKey;
      const modifiersMatch = e.ctrlKey === modifiers.ctrl && e.altKey === modifiers.alt &&
        e.shiftKey === modifiers.shift && e.metaKey === modifiers.meta;

      if (keyMatches && modifiersMatch) {
        e.preventDefault();
        isPTTActiveRef.current = true;
        setIsPTTActive(true);
        await invoke("set_call_muted", { muted: false });
        await refreshState();
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (!isPTTActiveRef.current) return;

      let eventKey = e.key.toLowerCase();
      if (eventKey === " ") eventKey = "space";

      if (eventKey === targetKey) {
        e.preventDefault();
        isPTTActiveRef.current = false;
        setIsPTTActive(false);
        await invoke("set_call_muted", { muted: true });
        await refreshState();
      }
    };

    const handleBlur = async () => {
      if (isPTTActiveRef.current) {
        isPTTActiveRef.current = false;
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
  }, [isPTTEnabled, pttKey, callState.status, refreshState]);

  useEffect(() => {
    if (isPTTEnabled && callState.status === "active" && !isPTTActiveRef.current) {
      invoke("set_call_muted", { muted: true }).catch(console.error);
    }
  }, [isPTTEnabled, callState.status]);

  useEffect(() => {
    const handleWsMessage = (msg: WsMessage) => {
      switch (msg.type) {
        case "call_offer": {
          const data = (msg as WsCallOffer).data;
          if (currentUserId && data.caller_id === currentUserId) {
            break;
          }
          const info: IncomingCallInfo = {
            call_id: data.call_id,
            caller_id: data.caller_id,
            callee_id: data.callee_id,
            caller_username: data.caller_username,
            caller_display_name: data.caller_display_name,
            caller_avatar_url: data.caller_avatar_url,
            caller_identity_key: data.caller_identity_key,
            ephemeral_kem_public: data.ephemeral_kem_public,
            signature: data.signature,
            created_at: data.created_at,
          };
          handleIncomingCall(info);
          break;
        }
        case "call_answer": {
          const data = (msg as WsCallAnswer).data;
          if (callStateRef.current.call_id === data.call_id && callStateRef.current.is_caller) {
            (async () => {
              try {
                if (!peerIdentityKeyRef.current) {
                  console.error("[CallContext] No peer identity key stored for key exchange");
                  return;
                }
                const keyComplete = await invoke<KeyCompleteResult>("complete_call_key_exchange_as_caller", {
                  calleeEphemeralPublic: data.ephemeral_kem_public,
                  calleeKemCiphertext: data.kem_ciphertext,
                  calleeSignature: data.signature,
                  calleeIdentityPublic: peerIdentityKeyRef.current,
                });

                const relayCredentials = await callsApi.completeKeyExchange(data.call_id, {
                  kem_ciphertext: keyComplete.kem_ciphertext,
                });

                await invoke("start_call_media_session", {
                  relayEndpoint: relayCredentials.relay_endpoint,
                  relayToken: relayCredentials.relay_token,
                });
                callStartTimeRef.current = Date.now();
                await refreshState();
              } catch (e) {
                console.error("[CallContext] Failed to complete key exchange as caller:", e);
              }
            })();
            onCallAnswerReceived?.(data);
          }
          break;
        }
        case "call_key_complete": {
          const data = (msg as WsCallKeyComplete).data;
          if (callStateRef.current.call_id === data.call_id && !callStateRef.current.is_caller) {
            (async () => {
              try {
                await invoke("complete_call_key_exchange_as_callee", {
                  callerKemCiphertext: data.kem_ciphertext,
                });

                if (pendingMediaReadyRef.current) {
                  const { relay_endpoint, relay_token } = pendingMediaReadyRef.current;
                  pendingMediaReadyRef.current = null;
                  await invoke("start_call_media_session", {
                    relayEndpoint: relay_endpoint,
                    relayToken: relay_token,
                  });
                  callStartTimeRef.current = Date.now();
                }

                calleeKeyExchangeDoneRef.current = true;
                await refreshState();
              } catch (e) {
                console.error("[CallContext] Failed to complete key exchange as callee:", e);
              }
            })();
            onKeyCompleteReceived?.(data);
          }
          break;
        }
        case "call_reject": {
          const data = (msg as WsCallReject).data;
          if (callStateRef.current.call_id === data.call_id) {
            (async () => {
              peerIdentityKeyRef.current = null;
              pendingMediaReadyRef.current = null;
              calleeKeyExchangeDoneRef.current = false;
              callPeerIdRef.current = null;
              await invoke("end_call");
              await refreshState();
              processNextQueuedCall();
            })();
          }
          break;
        }
        case "call_cancel": {
          const data = (msg as WsCallCancel).data;
          const matchesCurrentCall = callStateRef.current.call_id === data.call_id;
          const matchesIncomingCall = incomingCall?.call_id === data.call_id;

          if (matchesIncomingCall && incomingCall) {
            setIncomingCall(null);
            callPeerIdRef.current = null;
            invoke("reject_incoming_call").catch(console.error);
            processNextQueuedCall();
          }
          if (matchesCurrentCall) {
            (async () => {
              peerIdentityKeyRef.current = null;
              pendingMediaReadyRef.current = null;
              calleeKeyExchangeDoneRef.current = false;
              callPeerIdRef.current = null;
              await invoke("end_call");
              await refreshState();
              processNextQueuedCall();
            })();
          }
          break;
        }
        case "call_end": {
          const data = (msg as WsCallEnd).data;
          if (callStateRef.current.call_id === data.call_id) {
            (async () => {
              peerIdentityKeyRef.current = null;
              pendingMediaReadyRef.current = null;
              calleeKeyExchangeDoneRef.current = false;
              callStartTimeRef.current = null;
              callPeerIdRef.current = null;
              setPeerHasLeft(false);
              await invoke("end_call");
              await refreshState();
              processNextQueuedCall();
            })();
          }
          break;
        }
        case "call_missed": {
          break;
        }
        case "call_media_ready": {
          const data = (msg as WsCallMediaReady).data;
          if (callStateRef.current.call_id === data.call_id && !callStateRef.current.is_caller) {
            (async () => {
              try {
                if (!calleeKeyExchangeDoneRef.current) {
                  pendingMediaReadyRef.current = {
                    relay_endpoint: data.relay_endpoint,
                    relay_token: data.relay_token,
                  };
                  return;
                }

                await invoke("start_call_media_session", {
                  relayEndpoint: data.relay_endpoint,
                  relayToken: data.relay_token,
                });
                callStartTimeRef.current = Date.now();
                await refreshState();
              } catch (e) {
                console.error("[CallContext] Failed to start media session (callee):", e);
              }
            })();
            onMediaReadyReceived?.(data);
          }
          break;
        }
        case "call_leave": {
          const data = (msg as WsCallLeave).data;
          if (callStateRef.current.call_id === data.call_id && data.user_id !== currentUserId) {
            setPeerHasLeft(true);
          }
          break;
        }
        case "call_rejoin": {
          const data = (msg as WsCallRejoin).data;
          if (callStateRef.current.call_id === data.call_id) {
            setPeerHasLeft(false);
            (async () => {
              try {
                await invoke("start_call_media_session", {
                  relayEndpoint: data.relay_endpoint,
                  relayToken: data.relay_token,
                });
                await refreshState();

                const currentState = callStateRef.current;
                if (currentState.is_screen_sharing && currentUserId) {
                  wsService.send({
                    type: "screen_share_start",
                    data: {
                      call_id: currentState.call_id!,
                      user_id: currentUserId,
                      width: 1920,
                      height: 1080,
                    },
                  });
                }
              } catch (e) {
                console.error("[CallContext] Failed to restart media session after peer rejoin:", e);
              }
            })();
          }
          break;
        }
        case "screen_share_start": {
          const data = (msg as { type: "screen_share_start"; data: { call_id: string; user_id: string; width: number; height: number } }).data;
          if (callStateRef.current.call_id === data.call_id && data.user_id !== currentUserId) {
            invoke("set_peer_screen_sharing", { isSharing: true })
              .then(() => {
                refreshState();
              })
              .catch((e) => {
                console.error("[CallContext] set_peer_screen_sharing failed:", e);
              });
          }
          break;
        }
        case "screen_share_stop": {
          const data = (msg as { type: "screen_share_stop"; data: { call_id: string; user_id: string } }).data;
          if (callStateRef.current.call_id === data.call_id && data.user_id !== currentUserId) {
            invoke("set_peer_screen_sharing", { isSharing: false }).then(() => refreshState());
          }
          break;
        }
        case "call_mute_update": {
          const data = (msg as WsCallMuteUpdate).data;
          if (callStateRef.current.call_id === data.call_id && data.user_id !== currentUserId) {
            invoke("set_peer_muted", { isMuted: data.is_muted }).then(() => refreshState());
          }
          break;
        }
      }
    };

    const unsubscribe = wsService.onMessage(handleWsMessage);
    return () => {
      unsubscribe();
    };
  }, [refreshState, handleIncomingCall, incomingCall, currentUserId, onCallAnswerReceived, onKeyCompleteReceived, onMediaReadyReceived, processNextQueuedCall]);

  useEffect(() => {
    if (peerHasLeft && callState.status === "active") {
      peerLeftTimeoutRef.current = setTimeout(() => {
        endCall();
      }, PEER_LEFT_TIMEOUT_MS);
    } else if (callState.status === "left" && callState.can_rejoin) {
      const timeRemaining = (callState.rejoin_time_remaining_seconds || 0) * 1000;

      if (timeRemaining > 0) {
        peerLeftTimeoutRef.current = setTimeout(() => {
          endCall();
        }, timeRemaining);
      }
    } else {
      if (peerLeftTimeoutRef.current) {
        clearTimeout(peerLeftTimeoutRef.current);
        peerLeftTimeoutRef.current = null;
      }
    }

    return () => {
      if (peerLeftTimeoutRef.current) {
        clearTimeout(peerLeftTimeoutRef.current);
        peerLeftTimeoutRef.current = null;
      }
    };
  }, [peerHasLeft, callState.status, callState.can_rejoin, callState.rejoin_time_remaining_seconds, endCall]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentState = callStateRef.current;
      if (currentState.status === "active" || currentState.status === "connecting" || currentState.status === "ringing") {
        if (currentState.call_id) {
          navigator.sendBeacon?.(
            `/api/calls/${currentState.call_id}/leave-sync`,
            JSON.stringify({ reason: "app_closed" })
          );

          callsApi.leaveCall(currentState.call_id).catch(() => { });
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

  useEffect(() => {
    const handleOnline = async () => {
      isOnlineRef.current = true;

      if (wasInCallBeforeOfflineRef.current) {
        const canRejoinCall = await canRejoin();
        if (canRejoinCall) {
          try {
            await rejoinCall();
          } catch (e) {
            console.error("[CallContext] Auto-rejoin failed:", e);
          }
        }
        wasInCallBeforeOfflineRef.current = false;
      }
    };

    const handleOffline = async () => {
      isOnlineRef.current = false;

      const currentState = callStateRef.current;
      if (currentState.status === "active") {
        wasInCallBeforeOfflineRef.current = true;
        await leaveCall();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [canRejoin, rejoinCall, leaveCall]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentState = callStateRef.current;

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
  }, [refreshState]);

  useEffect(() => {
    const unsubscribeConnect = wsService.onConnect(() => {
      const currentState = callStateRef.current;
      if (currentState.status === "active" || currentState.status === "left") {
        refreshState();
      }
    });

    const unsubscribeDisconnect = wsService.onDisconnect(() => {
    });

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, [refreshState]);

  useEffect(() => {
    const currentState = callStateRef.current;

    if (currentState.status === "initiating" && currentState.is_caller) {
      ringTimeoutRef.current = setTimeout(() => {
        endCall();
      }, RING_TIMEOUT_MS);
    } else {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    }

    return () => {
      if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
      }
    };
  }, [callState.status, callState.is_caller, endCall]);

  useEffect(() => {
    const currentState = callStateRef.current;

    if (currentState.status === "connecting") {
      keyExchangeTimeoutRef.current = setTimeout(() => {
        endCall();
      }, KEY_EXCHANGE_TIMEOUT_MS);
    } else {
      if (keyExchangeTimeoutRef.current) {
        clearTimeout(keyExchangeTimeoutRef.current);
        keyExchangeTimeoutRef.current = null;
      }
    }

    return () => {
      if (keyExchangeTimeoutRef.current) {
        clearTimeout(keyExchangeTimeoutRef.current);
        keyExchangeTimeoutRef.current = null;
      }
    };
  }, [callState.status, endCall]);

  useEffect(() => {
    if (callState.status !== "active") return;

    const healthCheckInterval = setInterval(async () => {
      await refreshState();

      const currentState = callStateRef.current;

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
  }, [callState.status, refreshState, leaveCall, canRejoin, rejoinCall]);

  return (
    <CallContext.Provider
      value={{
        callState,
        incomingCall,
        incomingCallQueue,
        peerHasLeft,
        isPTTActive,
        isPTTEnabled,
        initiateCall,
        handleIncomingCall,
        acceptCall,
        rejectCall,
        endCall,
        leaveCall,
        rejoinCall,
        canRejoin,
        setMuted,
        setDeafened,
        completeKeyExchangeAsCaller,
        completeKeyExchangeAsCallee,
        startMediaSession,
        refreshState,
        refreshAudioSettings,
        getScreenSources,
        startScreenShare,
        stopScreenShare,
        checkScreenPermission,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
