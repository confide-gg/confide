import {
  Signal,
  SignalHigh,
  SignalLow,
  SignalZero,
  Maximize2,
  Minimize2,
  ChevronUp,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../../ui/tooltip";
import { cn } from "@/lib/utils";
import type { CallQuality, CallQualityStats } from "../types";
import { formatDuration } from "./types";

interface CallHeaderProps {
  isActive: boolean;
  isLeft: boolean;
  peerHasLeft: boolean;
  status: string;
  isCaller: boolean;
  duration: number;
  quality: CallQuality;
  stats: CallQualityStats | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onMinimize?: () => void;
}

export function CallHeader({
  isActive,
  isLeft,
  peerHasLeft,
  status,
  isCaller,
  duration,
  quality,
  stats,
  isFullscreen,
  onToggleFullscreen,
  onMinimize,
}: CallHeaderProps) {
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
      case "excellent":
        return "Excellent";
      case "good":
        return "Good";
      case "fair":
        return "Fair";
      case "poor":
        return "Poor";
    }
  };

  const getStatusText = () => {
    if (isLeft) return "You left the call";
    if (peerHasLeft) return "Waiting for peer...";
    switch (status) {
      case "initiating":
        return "Starting...";
      case "ringing":
        return isCaller ? "Ringing..." : "Incoming...";
      case "connecting":
        return "Connecting...";
      case "active":
        return formatDuration(duration);
      default:
        return "";
    }
  };

  return (
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
                    <span
                      className={cn(
                        "font-medium",
                        quality === "excellent" || quality === "good"
                          ? "text-green-400"
                          : quality === "fair"
                            ? "text-yellow-400"
                            : "text-red-400"
                      )}
                    >
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
                            : "0.0"}
                          %
                        </span>
                      </div>
                    </>
                  )}
                  {!stats && (
                    <div className="text-white/40 text-center py-1">Gathering stats...</div>
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
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
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
  );
}
