import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "../../ui/button";
import { ControlButton } from "./ControlButton";

interface CallControlsProps {
  isActive: boolean;
  isLeft: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isRejoining: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onLeave: () => void;
  onRejoin: () => void;
}

export function CallControls({
  isActive,
  isLeft,
  isMuted,
  isDeafened,
  isRejoining,
  onToggleMute,
  onToggleDeafen,
  onLeave,
  onRejoin,
}: CallControlsProps) {
  return (
    <div className="px-3 py-2 bg-background border-t border-border flex-shrink-0">
      <div className="flex items-center justify-center gap-1.5">
        {isLeft ? (
          <Button
            onClick={onRejoin}
            disabled={isRejoining}
            size="sm"
            className="h-9 px-4 rounded-full bg-green-600 hover:bg-green-700 text-white font-medium text-xs"
          >
            <FontAwesomeIcon icon="phone-flip" className="w-4 h-4 mr-1.5" />
            {isRejoining ? "Rejoining..." : "Rejoin"}
          </Button>
        ) : (
          <>
            <ControlButton
              icon={
                isMuted ? (
                  <FontAwesomeIcon icon="microphone-slash" className="w-4 h-4" />
                ) : (
                  <FontAwesomeIcon icon="microphone" className="w-4 h-4" />
                )
              }
              onClick={onToggleMute}
              active={isMuted}
              disabled={!isActive}
              tooltip={isMuted ? "Unmute" : "Mute"}
            />
            <ControlButton
              icon={
                isDeafened ? (
                  <FontAwesomeIcon icon="headphones" className="w-4 h-4" />
                ) : (
                  <FontAwesomeIcon icon="headphones" className="w-4 h-4" />
                )
              }
              onClick={onToggleDeafen}
              active={isDeafened}
              disabled={!isActive}
              tooltip={isDeafened ? "Undeafen" : "Deafen"}
            />
            <div className="w-px h-6 bg-white/10 mx-1" />
            <ControlButton
              icon={<FontAwesomeIcon icon="phone-slash" className="w-4 h-4" />}
              onClick={onLeave}
              variant="danger"
              tooltip="Leave Call"
            />
          </>
        )}
      </div>
    </div>
  );
}
