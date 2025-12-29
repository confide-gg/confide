import { useCallback, useState } from "react";
import { useCall } from "../context";
import { useAuth } from "@/context/AuthContext";
import { GroupCallView } from "./GroupCallView";
import { GroupCallEndedView } from "../view/GroupCallEndedView";

const DEFAULT_HEIGHT = 360;
const LEFT_HEIGHT = 180;

interface GroupCallHeaderProps {
  conversationId: string;
}

export function GroupCallHeader({ conversationId }: GroupCallHeaderProps) {
  const { user, keys } = useAuth();
  const { groupCallState, leaveGroupCall, rejoinGroupCall, setGroupMuted, setGroupDeafened } =
    useCall();
  const [isRejoining, setIsRejoining] = useState(false);

  const handleLeave = useCallback(async () => {
    try {
      await leaveGroupCall();
    } catch (e) {
      console.error("Failed to leave group call:", e);
    }
  }, [leaveGroupCall]);

  const handleRejoin = useCallback(async () => {
    if (!keys?.dsa_public_key || !keys?.dsa_secret_key) {
      console.error("Missing keys for rejoin");
      return;
    }
    setIsRejoining(true);
    try {
      await rejoinGroupCall({
        identityPublicKey: Array.from(keys.dsa_public_key),
        dsaSecretKey: Array.from(keys.dsa_secret_key),
      });
    } catch (e) {
      console.error("Failed to rejoin group call:", e);
    } finally {
      setIsRejoining(false);
    }
  }, [rejoinGroupCall, keys]);

  const handleToggleMute = async () => {
    if (!groupCallState) return;
    try {
      await setGroupMuted(!groupCallState.is_muted);
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  };

  const handleToggleDeafen = async () => {
    if (!groupCallState) return;
    try {
      await setGroupDeafened(!groupCallState.is_deafened);
    } catch (e) {
      console.error("Failed to toggle deafen:", e);
    }
  };

  if (!groupCallState) return null;
  if (groupCallState.status === "ended") return null;
  if (groupCallState.conversation_id !== conversationId) return null;

  if (groupCallState.status === "left") {
    return (
      <div
        className="flex flex-col bg-card border-b border-border"
        style={{ height: `min(${LEFT_HEIGHT}px, 40vh)` }}
      >
        <div className="flex-1 overflow-hidden">
          <GroupCallEndedView
            participants={groupCallState.participants}
            currentUserId={user?.id}
            onRejoin={handleRejoin}
            isRejoining={isRejoining}
            canRejoin={groupCallState.can_rejoin}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-card border-b border-border"
      style={{ height: `min(${DEFAULT_HEIGHT}px, 70vh)` }}
    >
      <div className="flex-1 overflow-hidden">
        <GroupCallView
          groupCallState={groupCallState}
          currentUserId={user?.id}
          onLeave={handleLeave}
          onMuteToggle={handleToggleMute}
          onDeafenToggle={handleToggleDeafen}
        />
      </div>
    </div>
  );
}
