import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { UserTile } from "../view/UserTile";
import { ControlButton } from "../view/ControlButton";
import type { GroupCallState } from "../types";

interface GroupCallViewProps {
  groupCallState: GroupCallState;
  currentUserId: string | undefined;
  onLeave: () => void;
  onMuteToggle: () => void;
  onDeafenToggle: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function GroupCallView({
  groupCallState,
  currentUserId,
  onLeave,
  onMuteToggle,
  onDeafenToggle,
}: GroupCallViewProps) {
  const [duration, setDuration] = useState(0);

  const visibleParticipants = groupCallState.participants.filter(
    (p) => p.status === "active" || p.status === "connecting"
  );
  const activeParticipantCount = groupCallState.participants.filter(
    (p) => p.status === "active" || p.status === "connecting"
  ).length;
  const isActive = groupCallState.status === "active";
  const isConnecting =
    groupCallState.status === "connecting" || groupCallState.status === "ringing";

  useEffect(() => {
    if (!isActive || !groupCallState.connected_at) return;

    const startTime = new Date(groupCallState.connected_at).getTime();
    setDuration(Math.floor((Date.now() - startTime) / 1000));

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, groupCallState.connected_at]);

  const getStatusText = () => {
    if (isConnecting) return "Connecting...";
    if (isActive) return formatDuration(duration);
    return groupCallState.status;
  };

  const getParticipantSize = (): "sm" | "md" | "lg" => {
    const count = visibleParticipants.length;
    if (count <= 2) return "lg";
    if (count <= 4) return "md";
    return "sm";
  };

  return (
    <div className="flex flex-col bg-card text-white overflow-hidden h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-background border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {isActive && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-medium cursor-default">
                    <FontAwesomeIcon icon="signal" className="w-4 h-4" />
                    <span>{getStatusText()}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs bg-card border-border">
                  {activeParticipantCount} participant{activeParticipantCount !== 1 ? "s" : ""} in
                  call
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isActive && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-medium">
              <span>{getStatusText()}</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            • {activeParticipantCount} participant{activeParticipantCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden min-h-0">
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-6",
            visibleParticipants.length > 4 && "gap-4"
          )}
        >
          {visibleParticipants.map((participant) => (
            <UserTile
              key={participant.user_id}
              name={participant.display_name || participant.username}
              avatarUrl={participant.avatar_url}
              isSpeaking={participant.is_speaking}
              isMuted={participant.is_muted}
              hasLeft={participant.status === "left"}
              isConnecting={participant.status === "connecting"}
              isSelf={participant.user_id === currentUserId}
              size={getParticipantSize()}
            />
          ))}
        </div>
      </div>

      <div className="px-3 py-2 bg-background border-t border-border flex-shrink-0">
        <div className="flex items-center justify-center gap-1.5">
          <ControlButton
            icon={
              groupCallState.is_muted ? (
                <FontAwesomeIcon icon="microphone-slash" className="w-4 h-4" />
              ) : (
                <FontAwesomeIcon icon="microphone" className="w-4 h-4" />
              )
            }
            onClick={onMuteToggle}
            active={groupCallState.is_muted}
            disabled={!isActive}
            tooltip={groupCallState.is_muted ? "Unmute" : "Mute"}
          />
          <ControlButton
            icon={<FontAwesomeIcon icon="headphones" className="w-4 h-4" />}
            onClick={onDeafenToggle}
            active={groupCallState.is_deafened}
            disabled={!isActive}
            tooltip={groupCallState.is_deafened ? "Undeafen" : "Deafen"}
          />
          <div className="w-px h-6 bg-white/10 mx-1" />
          <ControlButton
            icon={<FontAwesomeIcon icon="phone-slash" className="w-4 h-4" />}
            onClick={onLeave}
            variant="danger"
            tooltip="Leave Call"
          />
        </div>
      </div>
    </div>
  );
}
