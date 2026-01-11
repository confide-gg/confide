import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "../ui/button";
import { Avatar } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { useCall } from "./context";
import { useChat } from "../../context/chat";
import { CallQuality, CallQualityStats } from "./types";
import { cn } from "@/lib/utils";

interface ActiveCallOverlayProps {
  onEnd?: () => void;
  onNavigateToCall?: () => void;
}

export function ActiveCallOverlay({ onNavigateToCall }: ActiveCallOverlayProps) {
  const { callState, peerHasLeft, leaveCall, endCall, rejoinCall, setMuted } = useCall();
  const { activeChat, openChat, friendsList, setSidebarView } = useChat();
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<CallQuality>("good");
  const [isRejoining, setIsRejoining] = useState(false);

  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isInCallWithActiveChat =
    (callState.status === "active" || callState.status === "left") &&
    activeChat &&
    callState.peer_id === activeChat.visitorId;

  const isLeft = callState.status === "left";
  const isActive = callState.status === "active";

  useEffect(() => {
    if (callState.status !== "active" || !callState.connected_at) return;

    const startTime = new Date(callState.connected_at).getTime();

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [callState.status, callState.connected_at]);

  useEffect(() => {
    if (callState.status !== "active") return;

    const fetchStats = async () => {
      try {
        const s = await invoke<CallQualityStats>("get_call_stats");
        const lossRate = s.packets_sent > 0 ? s.packets_lost / s.packets_sent : 0;
        if (lossRate < 0.01 && s.jitter_ms < 20) {
          setQuality("excellent");
        } else if (lossRate < 0.03 && s.jitter_ms < 50) {
          setQuality("good");
        } else if (lossRate < 0.08 && s.jitter_ms < 100) {
          setQuality("fair");
        } else {
          setQuality("poor");
        }
      } catch (e) {
        console.error("Failed to get call stats:", e);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [callState.status]);

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

      const deltaX = dragStartRef.current.x - e.clientX;
      const deltaY = dragStartRef.current.y - e.clientY;

      const newX = Math.max(
        8,
        Math.min(window.innerWidth - 280, dragStartRef.current.posX + deltaX)
      );
      const newY = Math.max(
        8,
        Math.min(window.innerHeight - 140, dragStartRef.current.posY + deltaY)
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

  if (callState.status === "idle" || callState.status === "ended") return null;
  if (isInCallWithActiveChat) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLeave = async () => {
    try {
      if (callState.status === "active") {
        await leaveCall();
      } else {
        await endCall();
      }
    } catch (e) {
      console.error("Failed to leave call:", e);
    }
  };

  const handleRejoin = async () => {
    setIsRejoining(true);
    try {
      await rejoinCall();
    } catch (e) {
      console.error("Failed to rejoin call:", e);
    } finally {
      setIsRejoining(false);
    }
  };

  const handleToggleMute = async () => {
    try {
      await setMuted(!callState.is_muted);
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  };

  const handleNavigateToCall = () => {
    if (callState.peer_id) {
      const friend = friendsList.find((f) => f.id === callState.peer_id);
      if (friend) {
        openChat(friend);
        setSidebarView("dms");
      }
      onNavigateToCall?.();
    }
  };

  const getQualityIcon = () => {
    const iconClass = "h-3 w-3";
    switch (quality) {
      case "excellent":
      case "good":
        return <FontAwesomeIcon icon="signal" className={cn(iconClass, "text-emerald-400")} />;
      case "fair":
        return <FontAwesomeIcon icon="signal" className={cn(iconClass, "text-amber-400")} />;
      case "poor":
        return <FontAwesomeIcon icon="signal" className={cn(iconClass, "text-red-400")} />;
    }
  };

  const getStatusText = () => {
    if (isLeft) return "You left";
    if (peerHasLeft) return "Peer left";
    switch (callState.status) {
      case "initiating":
        return "Starting...";
      case "ringing":
        return callState.is_caller ? "Ringing..." : "Incoming...";
      case "connecting":
        return "Connecting...";
      case "active":
        return formatDuration(duration);
      default:
        return "";
    }
  };

  const getStatusIndicatorColor = () => {
    if (peerHasLeft) return "bg-red-500";
    if (isLeft) return "bg-amber-500";
    if (isActive) return "bg-emerald-500";
    return "bg-amber-500";
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-50 select-none transition-shadow duration-200",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        right: position.x,
        bottom: position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={cn(
          "bg-zinc-900/95 backdrop-blur-xl rounded-2xl overflow-hidden min-w-[260px]",
          "border border-white/[0.08] shadow-2xl shadow-black/40",
          "transition-all duration-200",
          isDragging && "scale-[1.02] shadow-black/50"
        )}
      >
        {isActive && !peerHasLeft && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-20 bg-emerald-500/10 blur-[60px] pointer-events-none" />
        )}

        <div className="relative flex items-center gap-3 p-3.5">
          <div className="relative">
            <Avatar
              src={callState.peer_avatar_url || undefined}
              fallback={callState.peer_display_name || callState.peer_username || "?"}
              size="md"
              className={cn(
                "w-11 h-11 ring-2 transition-all duration-200",
                peerHasLeft
                  ? "ring-red-500/40 opacity-50 grayscale"
                  : isActive
                    ? "ring-emerald-500/50"
                    : "ring-amber-500/50"
              )}
            />
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-[2.5px] border-zinc-900 transition-colors duration-200",
                getStatusIndicatorColor()
              )}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-zinc-100 truncate tracking-tight">
              {callState.peer_display_name || callState.peer_username}
            </h3>
            <div className="flex items-center gap-1.5 text-xs mt-0.5">
              {isActive && !peerHasLeft && getQualityIcon()}
              <span
                className={cn(
                  "font-medium tabular-nums",
                  isLeft || peerHasLeft
                    ? "text-amber-400"
                    : isActive
                      ? "text-emerald-400"
                      : "text-amber-400"
                )}
              >
                {getStatusText()}
              </span>
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0 rounded-lg",
                    "text-zinc-500 hover:text-zinc-200",
                    "bg-transparent hover:bg-white/[0.06]",
                    "transition-all duration-200"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigateToCall();
                  }}
                >
                  <FontAwesomeIcon icon="arrow-up-right-from-square" className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-zinc-900/95 backdrop-blur-sm border-white/[0.08] text-zinc-200 text-xs font-medium"
              >
                Go to call
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center justify-center gap-2 px-3.5 pb-3.5 pt-1">
          {isLeft ? (
            <Button
              size="sm"
              className={cn(
                "h-9 px-5 rounded-full text-xs font-medium",
                "bg-emerald-500 hover:bg-emerald-400 text-white",
                "border border-emerald-400/50",
                "shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30",
                "transition-all duration-200 hover:scale-105 active:scale-95"
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleRejoin();
              }}
              disabled={isRejoining}
            >
              <FontAwesomeIcon icon="phone-flip" className="w-3.5 h-3.5 mr-2" />
              {isRejoining ? "Rejoining..." : "Rejoin"}
            </Button>
          ) : (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-10 w-10 rounded-full p-0",
                        "transition-all duration-200 hover:scale-105 active:scale-95",
                        callState.is_muted
                          ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30"
                          : "bg-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/[0.12] border border-white/[0.08]"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMute();
                      }}
                      disabled={!isActive}
                    >
                      {callState.is_muted ? (
                        <FontAwesomeIcon icon="microphone-slash" className="h-4 w-4" />
                      ) : (
                        <FontAwesomeIcon icon="microphone" className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-zinc-900/95 backdrop-blur-sm border-white/[0.08] text-zinc-200 text-xs font-medium"
                  >
                    {callState.is_muted ? "Unmute" : "Mute"}
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
                        "h-10 w-10 rounded-full p-0",
                        "bg-red-500 hover:bg-red-400 text-white",
                        "border border-red-400/50",
                        "shadow-lg shadow-red-500/20 hover:shadow-red-500/30",
                        "transition-all duration-200 hover:scale-105 active:scale-95"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeave();
                      }}
                    >
                      <FontAwesomeIcon icon="phone-slash" className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-zinc-900/95 backdrop-blur-sm border-white/[0.08] text-zinc-200 text-xs font-medium"
                  >
                    Leave Call
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
