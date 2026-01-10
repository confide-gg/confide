import { useCall } from "../context";
import { useAuth } from "@/context/AuthContext";
import { useCallViewState } from "./useCallViewState";
import { CallHeader } from "./CallHeader";
import { CallControls } from "./CallControls";
import { DefaultCallLayout } from "./DefaultCallLayout";
import { CallEndedView } from "./CallEndedView";

export function CallView() {
  const { callState, peerHasLeft, leaveCall, rejoinCall, setMuted, setDeafened } = useCall();
  const { user, profile } = useAuth();

  const isLeft = callState.status === "left";
  const isActive = callState.status === "active";
  const isConnecting =
    callState.status === "connecting" ||
    callState.status === "ringing" ||
    callState.status === "initiating";

  const {
    duration,
    quality,
    stats,
    showScreenPicker,
    setShowScreenPicker,
    isRejoining,
    setIsRejoining,
    contentRef,
  } = useCallViewState({
    isActive,
    connectedAt: callState.connected_at,
  });

  const handleLeave = async () => {
    try {
      await leaveCall();
    } catch (e) {
      console.error("Failed to leave call:", e);
    }
  };

  const handleRejoin = async () => {
    setIsRejoining(true);
    try {
      await rejoinCall();
    } catch (e) {
      console.error("Failed to rejoin:", e);
    } finally {
      setIsRejoining(false);
    }
  };

  const handleToggleMute = async () => {
    try {
      await setMuted(!callState.is_muted);
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  };

  const handleToggleDeafen = async () => {
    try {
      await setDeafened(!callState.is_deafened);
    } catch (e) {
      console.error("Failed to toggle deafen:", e);
    }
  };

  const myDisplayName = profile?.display_name || user?.username || "You";
  const myAvatarUrl = profile?.avatar_url;
  const peerDisplayName = callState.peer_display_name || callState.peer_username || "User";
  const peerAvatarUrl = callState.peer_avatar_url;

  if (callState.status === "idle" || callState.status === "ended") return null;

  if (isLeft) {
    return (
      <CallEndedView
        peerName={peerDisplayName}
        peerAvatarUrl={peerAvatarUrl}
        duration={duration}
        onRejoin={handleRejoin}
        canRejoin={callState.can_rejoin}
        isRejoining={isRejoining}
        callStillActive={!peerHasLeft}
      />
    );
  }

  return (
    <div className="flex flex-col bg-card text-white overflow-hidden h-full">
      <CallHeader
        isActive={isActive}
        isLeft={isLeft}
        peerHasLeft={peerHasLeft}
        status={callState.status}
        isCaller={callState.is_caller}
        duration={duration}
        quality={quality}
        stats={stats}
      />

      <div ref={contentRef} className="flex-1 flex flex-col relative overflow-hidden min-h-0">
        <DefaultCallLayout
          myName={myDisplayName}
          myAvatarUrl={myAvatarUrl}
          peerName={peerDisplayName}
          peerAvatarUrl={peerAvatarUrl}
          isMuted={callState.is_muted}
          isDeafened={callState.is_deafened}
          peerIsMuted={callState.peer_is_muted}
          peerHasLeft={peerHasLeft}
          isLeft={isLeft}
          isConnecting={isConnecting}
        />
      </div>

      <CallControls
        isActive={isActive}
        isLeft={isLeft}
        isMuted={callState.is_muted}
        isDeafened={callState.is_deafened}
        isRejoining={isRejoining}
        onToggleMute={handleToggleMute}
        onToggleDeafen={handleToggleDeafen}
        onLeave={handleLeave}
        onRejoin={handleRejoin}
      />
    </div>
  );
}
