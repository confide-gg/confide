import { useState, useEffect, useRef } from "react";
import {
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Monitor,
  MonitorOff,
  ChevronDown,
} from "lucide-react";
import { Button } from "../ui/button";
import { Avatar } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { useCall } from "./context";

import { ScreenSharePicker } from "./ScreenSharePicker";
import { ScreenShareViewer } from "./ScreenShareViewer";
import { CallView } from "./view";
import { cn } from "@/lib/utils";

const DEFAULT_HEIGHT = 360;

export function CallHeader() {
  const {
    callState,
    peerHasLeft,
    leaveCall,
    rejoinCall,
    endCall,
    setMuted,
    setDeafened,
    startScreenShare,
    stopScreenShare,
  } = useCall();
  const [duration, setDuration] = useState(0);
  const [rejoinTimeRemaining, setRejoinTimeRemaining] = useState<number | null>(null);
  const [isRejoining, setIsRejoining] = useState(false);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (callState.status !== "active" || !callState.connected_at) return;

    const startTime = new Date(callState.connected_at).getTime();

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [callState.status, callState.connected_at]);

  useEffect(() => {
    if (callState.status === "left" && callState.rejoin_time_remaining_seconds) {
      setRejoinTimeRemaining(callState.rejoin_time_remaining_seconds);
    } else {
      setRejoinTimeRemaining(null);
    }
  }, [callState.status, callState.rejoin_time_remaining_seconds]);

  useEffect(() => {
    if (rejoinTimeRemaining === null || rejoinTimeRemaining <= 0) return;

    const interval = setInterval(() => {
      setRejoinTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rejoinTimeRemaining]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatRejoinTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLeave = async () => {
    try {
      await leaveCall();
    } catch (e) {
      console.error("Failed to leave call:", e);
    }
  };

  const handleToggleMute = async () => {
    try {
      await setMuted(!callState.is_muted);
    } catch (e) {
      console.error("Failed to toggle mute:", e);
    }
  };

  const handleToggleDeafen = async () => {
    try {
      await setDeafened(!callState.is_deafened);
    } catch (e) {
      console.error("Failed to toggle deafen:", e);
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

  const handleEndCall = async () => {
    try {
      await endCall();
    } catch (e) {
      console.error("Failed to end call:", e);
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

  if (callState.status !== "active" && callState.status !== "left") return null;

  const isLeft = callState.status === "left";
  const peerDisplayName = callState.peer_display_name || callState.peer_username || "Peer";
  const peerAvatarUrl = callState.peer_avatar_url;

  if (!isMinimized) {
    return (
      <div
        ref={containerRef}
        className="flex flex-col bg-card border-b border-border"
        style={{ height: `min(${DEFAULT_HEIGHT}px, 70vh)` }}
      >
        <div className="flex-1 overflow-hidden">
          <CallView onMinimize={() => setIsMinimized(true)} isMinimized={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar
              src={peerAvatarUrl || undefined}
              fallback={peerDisplayName}
              size="md"
              className={cn(peerHasLeft && "opacity-50")}
            />
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a1a1d]",
                peerHasLeft ? "bg-red-500" : "bg-green-500"
              )}
            />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">{peerDisplayName}</span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs",
                  isLeft ? "text-yellow-400" : peerHasLeft ? "text-red-400" : "text-green-400"
                )}
              >
                {isLeft
                  ? rejoinTimeRemaining && rejoinTimeRemaining > 0
                    ? `${formatRejoinTime(rejoinTimeRemaining)} to rejoin`
                    : "You left"
                  : peerHasLeft
                    ? "Peer left"
                    : formatDuration(duration)}
              </span>
              {callState.is_screen_sharing && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <Monitor className="w-3 h-3" />
                  Sharing
                </span>
              )}
              {callState.peer_is_screen_sharing && (
                <span className="text-xs text-blue-400 flex items-center gap-1">
                  <Monitor className="w-3 h-3" />
                  Viewing
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isLeft ? (
            <>
              {callState.can_rejoin && rejoinTimeRemaining && rejoinTimeRemaining > 0 ? (
                <Button
                  size="sm"
                  className="h-8 px-3 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs"
                  onClick={handleRejoin}
                  disabled={isRejoining}
                >
                  <PhoneIncoming className="w-3.5 h-3.5 mr-1.5" />
                  {isRejoining ? "..." : "Rejoin"}
                </Button>
              ) : null}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      onClick={handleEndCall}
                    >
                      <PhoneOff className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs bg-card border-border">
                    End Call
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 rounded-full",
                        callState.is_muted
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      )}
                      onClick={handleToggleMute}
                    >
                      {callState.is_muted ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs bg-card border-border">
                    {callState.is_muted ? "Unmute" : "Mute"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 rounded-full",
                        callState.is_deafened
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      )}
                      onClick={handleToggleDeafen}
                    >
                      {callState.is_deafened ? (
                        <HeadphoneOff className="w-4 h-4" />
                      ) : (
                        <Headphones className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs bg-card border-border">
                    {callState.is_deafened ? "Undeafen" : "Deafen"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 rounded-full",
                        callState.is_screen_sharing
                          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      )}
                      onClick={handleScreenShareToggle}
                    >
                      {callState.is_screen_sharing ? (
                        <MonitorOff className="w-4 h-4" />
                      ) : (
                        <Monitor className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs bg-card border-border">
                    {callState.is_screen_sharing ? "Stop Share" : "Share Screen"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full bg-white/10 text-white/80 hover:bg-white/20"
                      onClick={() => setIsMinimized(false)}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs bg-card border-border">
                    Expand
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full bg-red-500 hover:bg-red-600 text-white"
                      onClick={handleLeave}
                    >
                      <PhoneOff className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs bg-card border-border">
                    Leave Call
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>

      {callState.peer_is_screen_sharing && isMinimized && (
        <div className="px-4 pb-3 cursor-pointer" onClick={() => setIsMinimized(false)}>
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-32">
            <ScreenShareViewer
              isActive={callState.peer_is_screen_sharing}
              peerUsername={peerDisplayName}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-2 text-white text-sm">
                <ChevronDown className="w-5 h-5" />
                Click to expand
              </div>
            </div>
          </div>
        </div>
      )}

      <ScreenSharePicker
        open={showScreenPicker}
        onClose={() => setShowScreenPicker(false)}
        onSelect={handleScreenShareStart}
      />
    </div>
  );
}
