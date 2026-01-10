import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "../../ui/button";
import { ControlButton } from "./ControlButton";
import { cn } from "@/lib/utils";

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
    <div className="px-4 py-3 bg-zinc-900/80 backdrop-blur-sm border-t border-white/[0.06] flex-shrink-0">
      <div className="flex items-center justify-center gap-2">
        {isLeft ? (
          <Button
            onClick={onRejoin}
            disabled={isRejoining}
            size="sm"
            className={cn(
              "h-11 px-6 rounded-full font-medium text-sm",
              "bg-emerald-500 hover:bg-emerald-400 text-white",
              "border border-emerald-400/50",
              "shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40",
              "transition-all duration-200 hover:scale-105 active:scale-95",
              isRejoining && "opacity-70 cursor-not-allowed hover:scale-100"
            )}
          >
            <FontAwesomeIcon icon="phone-flip" className="w-4 h-4 mr-2" />
            {isRejoining ? "Rejoining..." : "Rejoin Call"}
          </Button>
        ) : (
          <>
            <ControlButton
              icon={
                isMuted ? (
                  <FontAwesomeIcon icon="microphone-slash" />
                ) : (
                  <FontAwesomeIcon icon="microphone" />
                )
              }
              onClick={onToggleMute}
              active={isMuted}
              disabled={!isActive}
              tooltip={isMuted ? "Unmute" : "Mute"}
              size="md"
            />
            <ControlButton
              icon={<FontAwesomeIcon icon="headphones" />}
              onClick={onToggleDeafen}
              active={isDeafened}
              disabled={!isActive}
              tooltip={isDeafened ? "Undeafen" : "Deafen"}
              size="md"
            />

            <div className="w-px h-8 bg-white/[0.08] mx-2" />

            <ControlButton
              icon={<FontAwesomeIcon icon="phone-slash" />}
              onClick={onLeave}
              variant="danger"
              tooltip="Leave Call"
              size="md"
            />
          </>
        )}
      </div>
    </div>
  );
}
