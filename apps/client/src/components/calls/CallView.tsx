import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  PhoneOff,
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  Monitor,
  MonitorOff,
  Maximize2,
  Minimize2,
  PhoneIncoming,
  Signal,
  SignalHigh,
  SignalLow,
  SignalZero,
  ChevronUp,
} from "lucide-react";
import { Button } from "../ui/button";
import { Avatar } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { useCall } from "./CallContext";
import { useAuth } from "@/context/AuthContext";
import { CallQuality, CallQualityStats } from "./types";
import { ScreenSharePicker } from "./ScreenSharePicker";
import { cn } from "@/lib/utils";

interface CallViewProps {
  onMinimize?: () => void;
  isMinimized?: boolean;
}

export function CallView({ onMinimize, isMinimized: _isMinimized = false }: CallViewProps) {
  const {
    callState,
    peerHasLeft,
    leaveCall,
    rejoinCall,
    setMuted,
    setDeafened,
    startScreenShare,
    stopScreenShare
  } = useCall();
  const { user, profile } = useAuth();

  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<CallQuality>("good");
  const [stats, setStats] = useState<CallQualityStats | null>(null);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [isRejoining, setIsRejoining] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isLeft = callState.status === "left";
  const isActive = callState.status === "active";
  const isConnecting = callState.status === "connecting" || callState.status === "ringing" || callState.status === "initiating";

  useEffect(() => {
    if (!isActive || !callState.connected_at) return;

    const startTime = new Date(callState.connected_at).getTime();
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, callState.connected_at]);

  useEffect(() => {
    if (!isActive) return;

    const fetchStats = async () => {
      try {
        const s = await invoke<CallQualityStats>("get_call_stats");
        setStats(s);

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
  }, [isActive]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLeave = async () => {
    try {
      await leaveCall();
    } catch (e) {
      console.error("Failed to leave call:", e);
    }
  };

  const handleRejoin = async () => {
    setIsRejoining(true);
    try {
      await rejoinCall();
    } catch (e) {
      console.error("Failed to rejoin:", e);
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

  const handleToggleDeafen = async () => {
    try {
      await setDeafened(!callState.is_deafened);
    } catch (e) {
      console.error("Failed to toggle deafen:", e);
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

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (isFullscreen) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen toggle failed:", e);
    }
  }, [isFullscreen]);

  const getQualityIcon = () => {
    const iconClass = "w-4 h-4";
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

  const getQualityLabel = () => {
    switch (quality) {
      case "excellent": return "Excellent";
      case "good": return "Good";
      case "fair": return "Fair";
      case "poor": return "Poor";
    }
  };

  const getStatusText = () => {
    if (isLeft) return "You left the call";
    if (peerHasLeft) return "Waiting for peer...";
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

  const myDisplayName = profile?.display_name || user?.username || "You";
  const myAvatarUrl = profile?.avatar_url;
  const peerDisplayName = callState.peer_display_name || callState.peer_username || "User";
  const peerAvatarUrl = callState.peer_avatar_url;

  if (callState.status === "idle" || callState.status === "ended") return null;

  const hasScreenShare = callState.peer_is_screen_sharing || callState.is_screen_sharing;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-card text-white overflow-hidden h-full",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-background border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {isActive && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-medium cursor-default">
                    {getQualityIcon()}
                    <span>{getStatusText()}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs bg-card border-border p-3">
                  <div className="space-y-1.5 min-w-[140px]">
                    <div className="flex justify-between">
                      <span className="text-white/60">Connection</span>
                      <span className={cn(
                        "font-medium",
                        quality === "excellent" || quality === "good" ? "text-green-400" :
                          quality === "fair" ? "text-yellow-400" : "text-red-400"
                      )}>
                        {getQualityLabel()}
                      </span>
                    </div>
                    {stats && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-white/60">Latency</span>
                          <span className="text-white">{stats.round_trip_time_ms.toFixed(0)}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Jitter</span>
                          <span className="text-white">{stats.jitter_ms.toFixed(1)}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Packet Loss</span>
                          <span className="text-white">
                            {stats.packets_sent > 0
                              ? ((stats.packets_lost / stats.packets_sent) * 100).toFixed(1)
                              : "0.0"}%
                          </span>
                        </div>
                      </>
                    )}
                    {!stats && (
                      <div className="text-white/40 text-center py-1">
                        Gathering stats...
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isActive && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-medium">
              <span>{getStatusText()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs bg-card border-border">
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {onMinimize && !isFullscreen && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-white/60 hover:text-white hover:bg-white/10"
                    onClick={onMinimize}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs bg-card border-border">
                  Minimize
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div ref={contentRef} className="flex-1 flex flex-col relative overflow-hidden min-h-0">
        {hasScreenShare ? (
          <ScreenShareLayout
            isSharing={callState.is_screen_sharing}
            peerIsSharing={callState.peer_is_screen_sharing}
            peerName={peerDisplayName}
            myName={myDisplayName}
            myAvatarUrl={myAvatarUrl}
            peerAvatarUrl={peerAvatarUrl}
            isMuted={callState.is_muted}
            peerIsMuted={callState.peer_is_muted}
            peerHasLeft={peerHasLeft}
            isLeft={isLeft}
          />
        ) : (
          <DefaultCallLayout
            myName={myDisplayName}
            myAvatarUrl={myAvatarUrl}
            peerName={peerDisplayName}
            peerAvatarUrl={peerAvatarUrl}
            isMuted={callState.is_muted}
            isDeafened={callState.is_deafened}
            peerIsMuted={callState.peer_is_muted}
            peerHasLeft={peerHasLeft}
            isLeft={isLeft}
            isConnecting={isConnecting}
          />
        )}
      </div>

      <div className="px-3 py-2 bg-background border-t border-border flex-shrink-0">
        <div className="flex items-center justify-center gap-1.5">
          {isLeft ? (
            <Button
              onClick={handleRejoin}
              disabled={isRejoining}
              size="sm"
              className="h-9 px-4 rounded-full bg-green-600 hover:bg-green-700 text-white font-medium text-xs"
            >
              <PhoneIncoming className="w-4 h-4 mr-1.5" />
              {isRejoining ? "Rejoining..." : "Rejoin"}
            </Button>
          ) : (
            <>
              <ControlButton
                icon={callState.is_muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                onClick={handleToggleMute}
                active={callState.is_muted}
                disabled={!isActive}
                tooltip={callState.is_muted ? "Unmute" : "Mute"}
              />
              <ControlButton
                icon={callState.is_deafened ? <HeadphoneOff className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
                onClick={handleToggleDeafen}
                active={callState.is_deafened}
                disabled={!isActive}
                tooltip={callState.is_deafened ? "Undeafen" : "Deafen"}
              />
              <ControlButton
                icon={callState.is_screen_sharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                onClick={handleScreenShareToggle}
                active={callState.is_screen_sharing}
                activeColor="green"
                disabled={!isActive}
                tooltip={callState.is_screen_sharing ? "Stop Sharing" : "Share Screen"}
              />
              <div className="w-px h-6 bg-white/10 mx-1" />
              <ControlButton
                icon={<PhoneOff className="w-4 h-4" />}
                onClick={handleLeave}
                variant="danger"
                tooltip="Leave Call"
              />
            </>
          )}
        </div>
      </div>

      <ScreenSharePicker
        open={showScreenPicker}
        onClose={() => setShowScreenPicker(false)}
        onSelect={handleScreenShareStart}
      />
    </div>
  );
}

interface ControlButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  activeColor?: "red" | "green";
  disabled?: boolean;
  variant?: "default" | "danger";
  tooltip: string;
}

function ControlButton({ icon, onClick, active, activeColor = "red", disabled, variant, tooltip }: ControlButtonProps) {
  const getButtonClass = () => {
    if (variant === "danger") {
      return "bg-red-500 hover:bg-red-600 text-white";
    }
    if (active) {
      if (activeColor === "green") {
        return "bg-green-500/20 text-green-400 hover:bg-green-500/30";
      }
      return "bg-red-500/20 text-red-400 hover:bg-red-500/30";
    }
    return "bg-white/10 text-white/90 hover:bg-white/20";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "h-9 w-9 rounded-full p-0 transition-all",
              getButtonClass(),
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-card border-border text-white text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface DefaultCallLayoutProps {
  myName: string;
  myAvatarUrl?: string | null;
  peerName: string;
  peerAvatarUrl?: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  peerIsMuted?: boolean;
  peerHasLeft: boolean;
  isLeft: boolean;
  isConnecting: boolean;
}

function DefaultCallLayout({
  myName,
  myAvatarUrl,
  peerName,
  peerAvatarUrl,
  isMuted,
  peerIsMuted,
  peerHasLeft,
  isLeft,
  isConnecting
}: DefaultCallLayoutProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="flex items-center gap-8">
        <UserTile
          name={peerName}
          avatarUrl={peerAvatarUrl}
          isSpeaking={!peerHasLeft && !isLeft && !peerIsMuted}
          isMuted={peerIsMuted}
          hasLeft={peerHasLeft}
          isConnecting={isConnecting}
          size="md"
        />

        <UserTile
          name={myName}
          avatarUrl={myAvatarUrl}
          isSpeaking={!isMuted && !isLeft}
          isMuted={isMuted}
          hasLeft={isLeft}
          size="md"
          isSelf
        />
      </div>
    </div>
  );
}

interface ScreenShareLayoutProps {
  isSharing: boolean;
  peerIsSharing: boolean;
  peerName: string;
  myName: string;
  myAvatarUrl?: string | null;
  peerAvatarUrl?: string | null;
  isMuted: boolean;
  peerIsMuted?: boolean;
  peerHasLeft: boolean;
  isLeft: boolean;
}

function ScreenShareLayout({
  isSharing,
  peerIsSharing,
  peerName,
  myName,
  myAvatarUrl,
  peerAvatarUrl,
  isMuted,
  peerIsMuted,
  peerHasLeft,
  isLeft,
}: ScreenShareLayoutProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full w-full flex flex-col md:flex-row min-h-0">
        <div className="relative bg-black flex-1 min-h-[180px] md:min-h-0">
          {peerIsSharing ? (
            <ScreenShareCanvas peerName={peerName} />
          ) : isSharing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
              <Monitor className="w-12 h-12 mb-3 text-green-400" />
              <p className="text-base font-medium text-green-400">You are sharing your screen</p>
              <p className="text-xs text-white/50 mt-1">Others can see your screen</p>
            </div>
          ) : null}
        </div>

        <div className="w-full md:w-[280px] bg-background border-t md:border-t-0 md:border-l border-border flex-shrink-0 min-h-0">
          <div className="p-3 border-b border-border">
            <div className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
              In Call
            </div>
          </div>

          <div className="p-3 overflow-y-auto min-h-0">
            <div className="flex flex-col gap-1.5">
              <UserTile
                name={peerName}
                avatarUrl={peerAvatarUrl}
                isSpeaking={!peerHasLeft && !isLeft && !peerIsMuted}
                isMuted={peerIsMuted}
                hasLeft={peerHasLeft}
                size="sm"
                horizontal
                isScreenSharing={peerIsSharing}
              />

              <UserTile
                name={myName}
                avatarUrl={myAvatarUrl}
                isSpeaking={!isMuted && !isLeft}
                isMuted={isMuted}
                hasLeft={isLeft}
                size="sm"
                horizontal
                isSelf
                isScreenSharing={isSharing}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface UserTileProps {
  name: string;
  avatarUrl?: string | null;
  isSpeaking: boolean;
  isMuted?: boolean;
  hasLeft?: boolean;
  isConnecting?: boolean;
  size?: "sm" | "md" | "lg";
  isSelf?: boolean;
  horizontal?: boolean;
  isScreenSharing?: boolean;
}

function UserTile({
  name,
  avatarUrl,
  isSpeaking,
  isMuted,
  hasLeft,
  isConnecting,
  size = "md",
  isSelf,
  horizontal,
  isScreenSharing
}: UserTileProps) {
  const avatarSizeMap = {
    sm: "sm" as const,
    md: "lg" as const,
    lg: "xl" as const
  };

  const containerSizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-20 h-20"
  };

  const ringSize = {
    sm: "ring-2",
    md: "ring-[3px]",
    lg: "ring-4"
  };

  const getRingColor = () => {
    if (hasLeft) return "ring-red-500/60";
    if (isConnecting) return "ring-yellow-500/60 animate-pulse";
    if (isSpeaking && !isMuted) return "ring-green-500";
    return "ring-transparent";
  };

  if (horizontal) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-1.5 rounded-lg",
        isSelf ? "bg-white/5" : "bg-transparent"
      )}>
        <div className={cn(
          "relative rounded-full flex-shrink-0",
          containerSizeClasses.sm,
          ringSize.sm,
          getRingColor()
        )}>
          <Avatar
            src={avatarUrl || undefined}
            fallback={name}
            size={avatarSizeMap.sm}
            className={cn(containerSizeClasses.sm, hasLeft && "opacity-50")}
          />
          {isMuted && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center">
              <MicOff className="w-2 h-2 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-xs font-medium truncate",
            hasLeft ? "text-white/50" : "text-white"
          )}>
            {name} {isSelf && "(You)"}
          </div>
          {isScreenSharing && (
            <div className="text-[10px] text-green-400 flex items-center gap-1">
              <Monitor className="w-2.5 h-2.5" />
              Sharing
            </div>
          )}
          {hasLeft && <div className="text-[10px] text-red-400">Left</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(
        "relative rounded-full transition-all duration-200 flex items-center justify-center",
        containerSizeClasses[size],
        ringSize[size],
        getRingColor()
      )}>
        <Avatar
          src={avatarUrl || undefined}
          fallback={name}
          size={avatarSizeMap[size]}
          className={cn(
            containerSizeClasses[size],
            hasLeft && "opacity-50 grayscale"
          )}
        />
        {isMuted && (
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full bg-red-500 flex items-center justify-center",
            size === "lg" ? "w-6 h-6" : size === "md" ? "w-5 h-5" : "w-4 h-4"
          )}>
            <MicOff className={cn(
              "text-white",
              size === "lg" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"
            )} />
          </div>
        )}
      </div>
      <div className="text-center">
        <div className={cn(
          "font-medium",
          size === "lg" ? "text-sm" : "text-xs",
          hasLeft ? "text-white/50" : "text-white"
        )}>
          {name}
        </div>
        {isSelf && <div className="text-[10px] text-white/50">(You)</div>}
        {hasLeft && <div className="text-[10px] text-red-400">Left</div>}
        {isConnecting && <div className="text-[10px] text-yellow-400">Connecting...</div>}
      </div>
    </div>
  );
}

interface ScreenShareCanvasProps {
  peerName: string;
}

function ScreenShareCanvas({ peerName }: ScreenShareCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const isPollingRef = useRef(true);
  const usingWebCodecsRef = useRef(false);
  const webCodecsFailedRef = useRef(false);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const lastDrawTsRef = useRef<number>(0);
  const lastFetchRef = useRef<{ queued_at_ms: number; drained: number; frame_id: number; is_keyframe: boolean } | null>(null);
  const needKeyframeRef = useRef(false);

  useEffect(() => {
    isPollingRef.current = true;

    usingWebCodecsRef.current = typeof (window as unknown as { VideoDecoder?: unknown }).VideoDecoder !== "undefined";
    webCodecsFailedRef.current = false;

    const drawToCanvas = (source: CanvasImageSource, codedWidth: number, codedHeight: number) => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scale = Math.min(canvas.width / codedWidth, canvas.height / codedHeight);
      const drawW = Math.max(1, Math.floor(codedWidth * scale));
      const drawH = Math.max(1, Math.floor(codedHeight * scale));
      const x = Math.floor((canvas.width - drawW) / 2);
      const y = Math.floor((canvas.height - drawH) / 2);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(source, x, y, drawW, drawH);
    };

    const pollFrames = async () => {
      if (!isPollingRef.current) return;

      try {
        if (usingWebCodecsRef.current && !webCodecsFailedRef.current) {
          const chunk = await invoke<{ width: number; height: number; timestamp: number; frame_id: number; is_keyframe: boolean; data_b64: string; queued_at_ms: number; age_ms: number; drained: number; reasm_ms: number } | null>("get_h264_chunk");
          if (chunk) {
            setDimensions({ width: chunk.width, height: chunk.height });
            lastFetchRef.current = { queued_at_ms: chunk.queued_at_ms, drained: chunk.drained, frame_id: chunk.frame_id, is_keyframe: chunk.is_keyframe };

            if (needKeyframeRef.current && chunk.is_keyframe) {
              needKeyframeRef.current = false;
            }

            const bin = atob(chunk.data_b64);
            const data = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);

            if (!decoderRef.current) {
              if (!chunk.is_keyframe) {
                return;
              }
              try {
                const decoder = new VideoDecoder({
                  output: (frame) => {
                    const ts = performance.now();
                    if (ts - lastDrawTsRef.current < 5) {
                      frame.close();
                      return;
                    }
                    lastDrawTsRef.current = ts;
                    drawToCanvas(frame, frame.codedWidth, frame.codedHeight);
                    const queuedAtMs = Math.floor(frame.timestamp / 1000);
                    const displayAge = Date.now() - queuedAtMs;
                    const dq = decoderRef.current ? decoderRef.current.decodeQueueSize : 0;
                    if (displayAge > 220 || dq > 2) {
                      needKeyframeRef.current = true;
                      try {
                        decoderRef.current?.close();
                      } catch {}
                      decoderRef.current = null;
                    }
                    frame.close();
                  },
                  error: () => {
                    webCodecsFailedRef.current = true;
                    decoderRef.current?.close();
                    decoderRef.current = null;
                  },
                });

                decoder.configure({
                  codec: "avc1.42E01E",
                  codedWidth: chunk.width,
                  codedHeight: chunk.height,
                  hardwareAcceleration: "prefer-hardware",
                  optimizeForLatency: true,
                  avc: { format: "annexb" },
                } as unknown as VideoDecoderConfig);

                decoderRef.current = decoder;
              } catch {
                webCodecsFailedRef.current = true;
              }
            }

            if (decoderRef.current && !webCodecsFailedRef.current) {
              try {
                const dq = decoderRef.current.decodeQueueSize;
                if (dq > 2 && !chunk.is_keyframe) {
                  return;
                }
                const tsUs = chunk.queued_at_ms * 1000;
                const encoded = new EncodedVideoChunk({
                  type: chunk.is_keyframe ? "key" : "delta",
                  timestamp: tsUs,
                  data,
                });
                decoderRef.current.decode(encoded);
              } catch {
                webCodecsFailedRef.current = true;
                decoderRef.current?.close();
                decoderRef.current = null;
              }
            }
          }
        } else {
          const frame = await invoke<{ width: number; height: number; rgba_data: number[] } | null>("get_video_frame");
          if (frame && canvasRef.current) {
            setDimensions({ width: frame.width, height: frame.height });
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              if (canvas.width !== frame.width || canvas.height !== frame.height) {
                canvas.width = frame.width;
                canvas.height = frame.height;
              }
              const imageData = ctx.createImageData(frame.width, frame.height);
              imageData.data.set(new Uint8ClampedArray(frame.rgba_data));
              ctx.putImageData(imageData, 0, 0);
            }
          }
        }
      } catch (e) {
        console.error("Failed to get video frame:", e);
      }

      if (isPollingRef.current) {
        animationFrameRef.current = requestAnimationFrame(pollFrames);
      }
    };

    pollFrames();

    return () => {
      isPollingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (decoderRef.current) {
        try {
          decoderRef.current.close();
        } catch {}
        decoderRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={wrapperRef} className="absolute inset-0 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: "auto" }}
      />

      {dimensions.width === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
          <Monitor className="w-10 h-10 mb-2 animate-pulse" />
          <p className="text-sm">Waiting for {peerName}'s screen...</p>
        </div>
      )}

      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/80">
        {peerName}'s screen
      </div>

      {dimensions.width > 0 && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/60">
          {dimensions.width} x {dimensions.height}
        </div>
      )}
    </div>
  );
}