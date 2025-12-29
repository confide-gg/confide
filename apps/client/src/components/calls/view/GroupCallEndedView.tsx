import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UserTile } from "./UserTile";
import { ControlButton } from "./ControlButton";
import type { GroupCallParticipant } from "../types";

interface GroupCallEndedViewProps {
  participants: GroupCallParticipant[];
  currentUserId?: string;
  onRejoin?: () => void;
  isRejoining?: boolean;
  canRejoin?: boolean;
}

export function GroupCallEndedView({
  participants,
  currentUserId,
  onRejoin,
  isRejoining = false,
  canRejoin = true,
}: GroupCallEndedViewProps) {
  const activeParticipants = participants.filter(
    (p) => p.status === "active" && p.user_id !== currentUserId
  );
  const hasActiveParticipants = activeParticipants.length > 0;
  const showRejoin = canRejoin && onRejoin && hasActiveParticipants;

  return (
    <div className="flex flex-col bg-card text-white overflow-hidden h-full">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {activeParticipants.slice(0, 6).map((participant) => (
            <UserTile
              key={participant.user_id}
              name={participant.display_name || participant.username}
              avatarUrl={participant.avatar_url}
              isSpeaking={false}
              isMuted={participant.is_muted}
              hasLeft={false}
              size="md"
            />
          ))}
          {activeParticipants.length > 6 && (
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/10 text-white text-sm font-medium">
              +{activeParticipants.length - 6}
            </div>
          )}
        </div>
      </div>

      {showRejoin && (
        <div className="px-3 py-2 bg-background border-t border-border flex-shrink-0">
          <div className="flex items-center justify-center">
            <ControlButton
              icon={<FontAwesomeIcon icon="phone" className="w-4 h-4" />}
              onClick={onRejoin}
              active
              activeColor="green"
              disabled={isRejoining}
              tooltip="Join"
            />
          </div>
        </div>
      )}
    </div>
  );
}
