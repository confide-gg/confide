import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "../ui/button";
import { useCall } from "./context";
import {
  checkMicrophonePermission,
  requestMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";
import { platform } from "@tauri-apps/plugin-os";

interface CallButtonProps {
  callerId: string;
  calleeId: string;
  calleeIdentityKey: number[];
  dsaSecretKey: number[];
  peerUsername: string;
  peerDisplayName?: string | null;
  peerAvatarUrl?: string | null;
  onCallInitiated?: (offer: {
    call_id: string;
    ephemeral_kem_public: number[];
    signature: number[];
  }) => void;
  disabled?: boolean;
}

export function CallButton({
  callerId,
  calleeId,
  calleeIdentityKey,
  dsaSecretKey,
  peerUsername,
  peerDisplayName,
  peerAvatarUrl,
  onCallInitiated,
  disabled,
}: CallButtonProps) {
  const { callState, initiateCall } = useCall();

  const isInCall = callState.status !== "idle";

  const handleClick = async () => {
    try {
      const currentPlatform = await platform();
      if (currentPlatform === "macos") {
        const hasPermission = await checkMicrophonePermission();
        if (!hasPermission) {
          const granted = await requestMicrophonePermission();
          if (!granted) {
            console.error("Microphone permission denied");
            return;
          }
        }
      }

      const offer = await initiateCall(callerId, calleeId, calleeIdentityKey, dsaSecretKey, {
        username: peerUsername,
        displayName: peerDisplayName,
        avatarUrl: peerAvatarUrl,
      });
      onCallInitiated?.(offer);
    } catch (e) {
      console.error("Failed to initiate call:", e);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={disabled || isInCall}
      title={isInCall ? "Already in a call" : "Start voice call"}
    >
      <FontAwesomeIcon icon="phone" className="h-5 w-5" />
    </Button>
  );
}
