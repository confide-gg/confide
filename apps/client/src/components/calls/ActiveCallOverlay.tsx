import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PhoneOff, Mic, MicOff, Monitor, MonitorOff, Signal, SignalHigh, SignalLow, SignalZero, ArrowUpRight, PhoneIncoming } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { useCall } from "./context";
import { useChat } from "../../context/chat";
import { CallQuality, CallQualityStats } from "./types";
import { ScreenSharePicker } from "./ScreenSharePicker";
import { cn } from "@/lib/utils";

interface ActiveCallOverlayProps {
  onEnd?: () => void;
  onNavigateToCall?: () => void;
}

export function ActiveCallOverlay({ onNavigateToCall }: ActiveCallOverlayProps) {
  const { callState, peerHasLeft, leaveCall, endCall, rejoinCall, setMuted, startScreenShare, stopScreenShare } = useCall();
  const { activeChat, openChat, friendsList, setSidebarView } = useChat();
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<CallQuality>("good");
  const [showScreenPicker, setShowScreenPicker] = useState(false);
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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = dragStartRef.current.x - e.clientX;
      const deltaY = dragStartRef.current.y - e.clientY;

      const newX = Math.max(8, Math.min(window.innerWidth - 280, dragStartRef.current.posX + deltaX));
      const newY = Math.max(8, Math.min(window.innerHeight - 140, dragStartRef.current.posY + deltaY));

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

  const handleScreenShareToggle = async () => {
    if (callState.is_screen_sharing) {
      try {
        await stopScreenShare();
      } catch (e) {
        console.error("Failed to stop screen share:", e);
      }
    } else {
      setShowScreenPicker(true);
    }
  };

  const handleScreenShareStart = async (sourceId: string) => {
    try {
      await startScreenShare(sourceId);
    } catch (e) {
      console.error("Failed to start screen share:", e);
    }
  };

  const handleNavigateToCall = () => {
    if (callState.peer_id) {
      const friend = friendsList.find(f => f.id === callState.peer_id);
      if (friend) {
        openChat(friend);
        setSidebarView("dms");
      }
      onNavigateToCall?.();
    }
  };

  const getQualityIcon = () => {
    const iconClass = "h-3.5 w-3.5";
    switch (quality) {
      case "excellent":
        return <Signal className={cn(iconClass, "text-green-400")} />;
      case "good":
        return <SignalHigh className={cn(iconClass, "text-green-400")} />;
      case "fair":
        return <SignalLow className={cn(iconClass, "text-yellow-400")} />;
      case "poor":
        return <SignalZero className={cn(iconClass, "text-red-400")} />;
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

  const getStatusColor = () => {
    if (isLeft || peerHasLeft) return "text-yellow-400";
    if (isActive) return "text-green-400";
    return "text-yellow-400";
  };

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "fixed z-50 select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{
          right: position.x,
          bottom: position.y,
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="bg-background rounded-xl shadow-2xl border border-border overflow-hidden min-w-[240px]">
          <div className="flex items-center gap-3 p-3">
            <div className="relative">
              <Avatar
                src={callState.peer_avatar_url || undefined}
                fallback={callState.peer_display_name || callState.peer_username || "?"}
                size="md"
                className={cn(peerHasLeft && "opacity-50")}
              />
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                peerHasLeft ? "bg-red-500" :
                  isLeft ? "bg-yellow-500" :
                    isActive ? "bg-green-500" : "bg-yellow-500"
              )} />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-foreground truncate">
                {callState.peer_display_name || callState.peer_username}
              </h3>
              <div className="flex items-center gap-1.5 text-xs">
                {isActive && !peerHasLeft && getQualityIcon()}
                <span className={getStatusColor()}>
                  {getStatusText()}
                </span>
                {callState.is_screen_sharing && (
                  <span className="text-green-400 flex items-center gap-0.5 ml-1">
                    <Monitor className="w-3 h-3" />
                  </span>
                )}
                {callState.peer_is_screen_sharing && !callState.is_screen_sharing && (
                  <span className="text-blue-400 flex items-center gap-0.5 ml-1">
                    <Monitor className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleNavigateToCall();
              }}
            >
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 px-3 pb-3">
            {isLeft ? (
              <Button
                size="sm"
                className="h-9 px-4 rounded-full bg-green-600 hover:bg-green-700 text-foreground text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRejoin();
                }}
                disabled={isRejoining}
              >
                <PhoneIncoming className="w-3.5 h-3.5 mr-1.5" />
                {isRejoining ? "..." : "Rejoin"}
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
                          "h-9 w-9 rounded-full p-0",
                          callState.is_muted
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-secondary text-foreground hover:bg-secondary/80"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMute();
                        }}
                        disabled={!isActive}
                      >
                        {callState.is_muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs bg-popover border-border">
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
                          "h-9 w-9 rounded-full p-0",
                          callState.is_screen_sharing
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-secondary text-foreground hover:bg-secondary/80"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleScreenShareToggle();
                        }}
                        disabled={!isActive}
                      >
                        {callState.is_screen_sharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs bg-popover border-border">
                      {callState.is_screen_sharing ? "Stop Share" : "Share Screen"}
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
                        <PhoneOff className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs bg-popover border-border">
                      Leave Call
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </div>
      </div>

      <ScreenSharePicker
        open={showScreenPicker}
        onClose={() => setShowScreenPicker(false)}
        onSelect={handleScreenShareStart}
      />
    </>
  );
}