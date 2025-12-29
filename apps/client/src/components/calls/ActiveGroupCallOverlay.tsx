import { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { useCall } from "./context";
import { useChat } from "../../context/chat";
import { cn } from "@/lib/utils";
import { AvatarPile } from "../ui/avatar-pile";

export function ActiveGroupCallOverlay() {
  const { groupCallState, leaveGroupCall, setGroupMuted, setGroupDeafened } = useCall();
  const { activeChat } = useChat();

  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (groupCallState?.status !== "active" || !groupCallState.connected_at) return;

    const startTime = new Date(groupCallState.connected_at).getTime();

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [groupCallState?.status, groupCallState?.connected_at]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;

      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const containerWidth = containerRef.current?.offsetWidth ?? 280;
      const containerHeight = containerRef.current?.offsetHeight ?? 150;

      const deltaX = dragStartRef.current.x - e.clientX;
      const deltaY = dragStartRef.current.y - e.clientY;

      const newX = Math.max(
        8,
        Math.min(window.innerWidth - containerWidth - 8, dragStartRef.current.posX + deltaX)
      );
      const newY = Math.max(
        8,
        Math.min(window.innerHeight - containerHeight - 8, dragStartRef.current.posY + deltaY)
      );

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  if (!groupCallState || groupCallState.status === "ended") return null;

  const isViewingCallConversation =
    activeChat?.isGroup && activeChat.conversationId === groupCallState.conversation_id;

  if (isViewingCallConversation) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLeave = async () => {
    try {
      await leaveGroupCall();
    } catch (e) {
      console.error("Failed to leave group call:", e);
    }
  };

  const handleToggleMute = async () => {
    try {
      await setGroupMuted(!groupCallState.is_muted);
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  };

  const handleToggleDeafen = async () => {
    try {
      await setGroupDeafened(!groupCallState.is_deafened);
    } catch (e) {
      console.error("Failed to toggle deafen:", e);
    }
  };

  const getStatusText = () => {
    switch (groupCallState.status) {
      case "connecting":
        return "Connecting...";
      case "ringing":
        return "Ringing...";
      case "active":
        return formatDuration(duration);
      default:
        return groupCallState.status;
    }
  };

  const activeParticipants = groupCallState.participants.filter(
    (p) => p.status === "active" || p.status === "connecting"
  );

  const isActive = groupCallState.status === "active";

  return (
    <div
      ref={containerRef}
      className={cn("fixed z-50 select-none", isDragging ? "cursor-grabbing" : "cursor-grab")}
      style={{
        right: position.x,
        bottom: position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-background rounded-xl shadow-2xl border border-border overflow-hidden min-w-[260px]">
        <div className="flex items-center gap-3 p-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <FontAwesomeIcon icon="users" className="w-5 h-5 text-primary" />
            </div>
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                isActive ? "bg-green-500" : "bg-yellow-500"
              )}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-foreground truncate">Group Call</h3>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={isActive ? "text-green-400" : "text-yellow-400"}>
                {getStatusText()}
              </span>
              <span className="text-muted-foreground">• {activeParticipants.length} in call</span>
            </div>
          </div>
        </div>

        {activeParticipants.length > 0 && (
          <div className="px-3 pb-2">
            <AvatarPile
              users={activeParticipants.map((p) => ({
                id: p.user_id,
                name: p.display_name || p.username,
                avatarUrl: p.avatar_url || undefined,
              }))}
              size="xs"
              max={5}
            />
          </div>
        )}

        <div className="flex items-center justify-center gap-2 px-3 pb-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 w-9 rounded-full p-0",
                    groupCallState.is_muted
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleMute();
                  }}
                  disabled={!isActive}
                >
                  <FontAwesomeIcon
                    icon={groupCallState.is_muted ? "microphone-slash" : "microphone"}
                    className="h-4 w-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs bg-popover border-border">
                {groupCallState.is_muted ? "Unmute" : "Mute"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 w-9 rounded-full p-0",
                    groupCallState.is_deafened
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleDeafen();
                  }}
                  disabled={!isActive}
                >
                  <FontAwesomeIcon
                    icon={groupCallState.is_deafened ? "volume-xmark" : "headphones"}
                    className="h-4 w-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs bg-popover border-border">
                {groupCallState.is_deafened ? "Undeafen" : "Deafen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full p-0 bg-red-500 hover:bg-red-600 text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLeave();
                  }}
                >
                  <FontAwesomeIcon icon="phone-slash" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs bg-popover border-border">
                Leave Call
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
