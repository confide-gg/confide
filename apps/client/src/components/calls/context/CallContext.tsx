import { createContext, useContext, useState, useRef } from "react";
import { CallState, IncomingCallInfo } from "../types";
import { defaultCallState, CallProviderProps, CallContextValue, CallRefs } from "./types";
import { useCallLifecycle } from "./useCallLifecycle";
import { useCallMedia } from "./useCallMedia";
import { useCallKeyExchange } from "./useCallKeyExchange";
import { useCallWebSocket } from "./useCallWebSocket";
import { useCallEffects } from "./useCallEffects";

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({
  children,
  currentUserId,
  onCallAnswerReceived,
  onKeyCompleteReceived,
  onMediaReadyReceived,
}: CallProviderProps) {
  const [callState, setCallState] = useState<CallState>(defaultCallState);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [incomingCallQueue, setIncomingCallQueue] = useState<IncomingCallInfo[]>([]);
  const [peerHasLeft, setPeerHasLeft] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isPTTEnabled, setIsPTTEnabled] = useState(false);
  const [pttKey, setPttKey] = useState<string | null>(null);

  const peerIdentityKeyRef = useRef<number[] | null>(null);
  const pendingMediaReadyRef = useRef<{ relay_endpoint: string; relay_token: number[] } | null>(
    null
  );
  const calleeKeyExchangeDoneRef = useRef<boolean>(false);
  const peerLeftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  const callPeerIdRef = useRef<string | null>(null);
  const isPTTActiveRef = useRef(false);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyExchangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnlineRef = useRef(navigator.onLine);
  const wasInCallBeforeOfflineRef = useRef(false);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  const refs: CallRefs = {
    peerIdentityKeyRef,
    pendingMediaReadyRef,
    calleeKeyExchangeDoneRef,
    peerLeftTimeoutRef,
    callStartTimeRef,
    callPeerIdRef,
    isPTTActiveRef,
    ringTimeoutRef,
    keyExchangeTimeoutRef,
    isOnlineRef,
    wasInCallBeforeOfflineRef,
    callStateRef,
  };

  const {
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
  } = useCallLifecycle({
    refs,
    setCallState,
    setIncomingCall,
    setIncomingCallQueue,
    setPeerHasLeft,
    incomingCall,
    currentUserId,
  });

  const {
    setMuted,
    setDeafened,
    startMediaSession,
    refreshAudioSettings,
    getScreenSources,
    startScreenShare,
    stopScreenShare,
    checkScreenPermission,
  } = useCallMedia({
    refs,
    callState,
    currentUserId,
    setIsPTTEnabled,
    setPttKey,
    refreshState,
  });

  const { completeKeyExchangeAsCaller, completeKeyExchangeAsCallee } = useCallKeyExchange({
    refreshState,
  });

  useCallWebSocket({
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
  });

  useCallEffects({
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
  });

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
