import { cn } from "@/lib/utils";
import { UserTile } from "../view/UserTile";
import type { GroupCallParticipant } from "../types";

interface GroupCallGridProps {
  participants: GroupCallParticipant[];
  currentUserId: string | undefined;
}

function getGridClass(count: number): string {
  if (count <= 2) return "grid-cols-2";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  if (count <= 6) return "grid-cols-3 grid-rows-2";
  if (count <= 9) return "grid-cols-3 grid-rows-3";
  return "grid-cols-4 grid-rows-3";
}

function getSizeForCount(count: number): "sm" | "md" | "lg" {
  if (count <= 2) return "lg";
  if (count <= 4) return "md";
  return "sm";
}

export function GroupCallGrid({ participants, currentUserId }: GroupCallGridProps) {
  const gridClass = getGridClass(participants.length);
  const size = getSizeForCount(participants.length);

  return (
    <div className={cn("flex-1 p-4 grid gap-3 place-items-center", gridClass)}>
      {participants.map((participant) => (
        <UserTile
          key={participant.user_id}
          name={participant.display_name || participant.username}
          avatarUrl={participant.avatar_url}
          isSpeaking={participant.is_speaking}
          isMuted={participant.is_muted}
          hasLeft={participant.status === "left"}
          isConnecting={participant.status === "connecting"}
          isSelf={participant.user_id === currentUserId}
          size={size}
        />
      ))}
    </div>
  );
}
