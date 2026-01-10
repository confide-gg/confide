import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UserTile } from "./UserTile";
import { Button } from "../../ui/button";
import { cn } from "@/lib/utils";

interface CallEndedViewProps {
  peerName: string;
  peerAvatarUrl?: string | null;
  duration?: number;
  onRejoin?: () => void;
  isRejoining?: boolean;
  canRejoin?: boolean;
  callStillActive?: boolean;
}

export function CallEndedView({
  peerName,
  peerAvatarUrl,
  onRejoin,
  isRejoining = false,
  canRejoin = true,
  callStillActive = false,
}: CallEndedViewProps) {
  const showRejoin = canRejoin && onRejoin;

  return (
    <div className="flex flex-col bg-zinc-950 text-white overflow-hidden h-full">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6">
          <UserTile
            name={peerName}
            avatarUrl={peerAvatarUrl}
            isSpeaking={false}
            isMuted={false}
            hasLeft={!callStillActive}
            size="lg"
          />

          <p className="text-zinc-500 text-sm font-medium">
            {callStillActive ? "You left the call" : "Call ended"}
          </p>

          {showRejoin && (
            <Button
              onClick={onRejoin}
              disabled={isRejoining}
              className={cn(
                "h-12 px-8 rounded-full text-sm font-medium mt-2",
                "bg-emerald-500 hover:bg-emerald-400 text-white",
                "border border-emerald-400/50",
                "shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40",
                "transition-all duration-200 hover:scale-105 active:scale-95",
                isRejoining && "opacity-70 cursor-not-allowed hover:scale-100"
              )}
            >
              <FontAwesomeIcon
                icon={callStillActive ? "phone-flip" : "phone"}
                className="w-4 h-4 mr-2.5"
              />
              {isRejoining ? "Connecting..." : callStillActive ? "Rejoin Call" : "Call Back"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
