import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UserTile } from "./UserTile";
import { ControlButton } from "./ControlButton";

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
    <div className="flex flex-col bg-card text-white overflow-hidden h-full">
      <div className="flex-1 flex items-center justify-center p-4">
        <UserTile
          name={peerName}
          avatarUrl={peerAvatarUrl}
          isSpeaking={false}
          isMuted={false}
          hasLeft={!callStillActive}
          size="md"
        />
      </div>

      {showRejoin && (
        <div className="px-3 py-2 bg-background border-t border-border flex-shrink-0">
          <div className="flex items-center justify-center gap-1.5">
            <ControlButton
              icon={<FontAwesomeIcon icon="phone" className="w-4 h-4" />}
              onClick={onRejoin}
              active
              activeColor="green"
              disabled={isRejoining}
              tooltip={callStillActive ? "Rejoin" : "Call Back"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
