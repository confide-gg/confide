import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IncomingCallInfo, KeyCompleteResult } from "../types";
import { centralWebSocketService } from "../../../core/network/CentralWebSocketService";
import { callService as callsApi } from "../../../features/calls/calls";
import type { WsMessage } from "../../../core/network/wsTypes";
import type {
  WsCallOffer,
  WsCallAnswer,
  WsCallKeyComplete,
  WsCallReject,
  WsCallCancel,
  WsCallEnd,
  WsCallMediaReady,
  WsCallLeave,
  WsCallRejoin,
  WsCallMuteUpdate,
} from "../../../features/calls/types";
import type { CallRefs, CallProviderProps } from "./types";

interface UseCallWebSocketParams {
  refs: CallRefs;
  currentUserId?: string;
  incomingCall: IncomingCallInfo | null;
  setIncomingCall: React.Dispatch<React.SetStateAction<IncomingCallInfo | null>>;
  setPeerHasLeft: React.Dispatch<React.SetStateAction<boolean>>;
  refreshState: () => Promise<void>;
  handleIncomingCall: (info: IncomingCallInfo) => void;
  processNextQueuedCall: () => void;
  onCallAnswerReceived?: CallProviderProps["onCallAnswerReceived"];
  onKeyCompleteReceived?: CallProviderProps["onKeyCompleteReceived"];
  onMediaReadyReceived?: CallProviderProps["onMediaReadyReceived"];
}

export function useCallWebSocket({
  refs,
  currentUserId,
  incomingCall,
  setIncomingCall,
  setPeerHasLeft,
  refreshState,
  handleIncomingCall,
  processNextQueuedCall,
  onCallAnswerReceived,
  onKeyCompleteReceived,
  onMediaReadyReceived,
}: UseCallWebSocketParams) {
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
          if (
            refs.callStateRef.current.call_id === data.call_id &&
            refs.callStateRef.current.is_caller
          ) {
            (async () => {
              try {
                if (!refs.peerIdentityKeyRef.current) {
                  console.error("[CallContext] No peer identity key stored for key exchange");
                  return;
                }
                const keyComplete = await invoke<KeyCompleteResult>(
                  "complete_call_key_exchange_as_caller",
                  {
                    calleeEphemeralPublic: data.ephemeral_kem_public,
                    calleeKemCiphertext: data.kem_ciphertext,
                    calleeSignature: data.signature,
                    calleeIdentityPublic: refs.peerIdentityKeyRef.current,
                  }
                );

                const relayCredentials = await callsApi.completeKeyExchange(data.call_id, {
                  kem_ciphertext: keyComplete.kem_ciphertext,
                });

                await invoke("start_call_media_session", {
                  relayEndpoint: relayCredentials.relay_endpoint,
                  relayToken: relayCredentials.relay_token,
                });
                refs.callStartTimeRef.current = Date.now();
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
          if (
            refs.callStateRef.current.call_id === data.call_id &&
            !refs.callStateRef.current.is_caller
          ) {
            (async () => {
              try {
                await invoke("complete_call_key_exchange_as_callee", {
                  callerKemCiphertext: data.kem_ciphertext,
                });

                if (refs.pendingMediaReadyRef.current) {
                  const { relay_endpoint, relay_token } = refs.pendingMediaReadyRef.current;
                  refs.pendingMediaReadyRef.current = null;
                  await invoke("start_call_media_session", {
                    relayEndpoint: relay_endpoint,
                    relayToken: relay_token,
                  });
                  refs.callStartTimeRef.current = Date.now();
                }

                refs.calleeKeyExchangeDoneRef.current = true;
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
          if (refs.callStateRef.current.call_id === data.call_id) {
            (async () => {
              refs.peerIdentityKeyRef.current = null;
              refs.pendingMediaReadyRef.current = null;
              refs.calleeKeyExchangeDoneRef.current = false;
              refs.callPeerIdRef.current = null;
              await invoke("end_call");
              await refreshState();
              processNextQueuedCall();
            })();
          }
          break;
        }
        case "call_cancel": {
          const data = (msg as WsCallCancel).data;
          const matchesCurrentCall = refs.callStateRef.current.call_id === data.call_id;
          const matchesIncomingCall = incomingCall?.call_id === data.call_id;

          if (matchesIncomingCall && incomingCall) {
            setIncomingCall(null);
            refs.callPeerIdRef.current = null;
            invoke("reject_incoming_call").catch(console.error);
            processNextQueuedCall();
          }
          if (matchesCurrentCall) {
            (async () => {
              refs.peerIdentityKeyRef.current = null;
              refs.pendingMediaReadyRef.current = null;
              refs.calleeKeyExchangeDoneRef.current = false;
              refs.callPeerIdRef.current = null;
              await invoke("end_call");
              await refreshState();
              processNextQueuedCall();
            })();
          }
          break;
        }
        case "call_end": {
          const data = (msg as WsCallEnd).data;
          if (refs.callStateRef.current.call_id === data.call_id) {
            (async () => {
              refs.peerIdentityKeyRef.current = null;
              refs.pendingMediaReadyRef.current = null;
              refs.calleeKeyExchangeDoneRef.current = false;
              refs.callStartTimeRef.current = null;
              refs.callPeerIdRef.current = null;
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
          if (
            refs.callStateRef.current.call_id === data.call_id &&
            !refs.callStateRef.current.is_caller
          ) {
            (async () => {
              try {
                if (!refs.calleeKeyExchangeDoneRef.current) {
                  refs.pendingMediaReadyRef.current = {
                    relay_endpoint: data.relay_endpoint,
                    relay_token: data.relay_token,
                  };
                  return;
                }

                await invoke("start_call_media_session", {
                  relayEndpoint: data.relay_endpoint,
                  relayToken: data.relay_token,
                });
                refs.callStartTimeRef.current = Date.now();
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
          if (
            refs.callStateRef.current.call_id === data.call_id &&
            data.user_id !== currentUserId
          ) {
            setPeerHasLeft(true);
          }
          break;
        }
        case "call_rejoin": {
          const data = (msg as WsCallRejoin).data;
          if (refs.callStateRef.current.call_id === data.call_id) {
            setPeerHasLeft(false);
            (async () => {
              try {
                await invoke("start_call_media_session", {
                  relayEndpoint: data.relay_endpoint,
                  relayToken: data.relay_token,
                });
                await refreshState();

                const currentState = refs.callStateRef.current;
                if (currentState.is_screen_sharing && currentUserId) {
                  centralWebSocketService.send({
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
                console.error(
                  "[CallContext] Failed to restart media session after peer rejoin:",
                  e
                );
              }
            })();
          }
          break;
        }
        case "screen_share_start": {
          const data = (
            msg as {
              type: "screen_share_start";
              data: { call_id: string; user_id: string; width: number; height: number };
            }
          ).data;
          if (
            refs.callStateRef.current.call_id === data.call_id &&
            data.user_id !== currentUserId
          ) {
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
          const data = (
            msg as { type: "screen_share_stop"; data: { call_id: string; user_id: string } }
          ).data;
          if (
            refs.callStateRef.current.call_id === data.call_id &&
            data.user_id !== currentUserId
          ) {
            invoke("set_peer_screen_sharing", { isSharing: false }).then(() => refreshState());
          }
          break;
        }
        case "call_mute_update": {
          const data = (msg as WsCallMuteUpdate).data;
          if (
            refs.callStateRef.current.call_id === data.call_id &&
            data.user_id !== currentUserId
          ) {
            invoke("set_peer_muted", { isMuted: data.is_muted }).then(() => refreshState());
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
    refs,
    refreshState,
    handleIncomingCall,
    incomingCall,
    currentUserId,
    onCallAnswerReceived,
    onKeyCompleteReceived,
    onMediaReadyReceived,
    processNextQueuedCall,
    setIncomingCall,
    setPeerHasLeft,
  ]);
}
