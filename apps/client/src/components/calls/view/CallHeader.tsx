import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
}: CallHeaderProps) {
  const getQualityIcon = () => {
    const iconClass = "w-3.5 h-3.5";
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

  const getQualityColor = () => {
    switch (quality) {
      case "excellent":
      case "good":
        return "text-emerald-400";
      case "fair":
        return "text-amber-400";
      case "poor":
        return "text-red-400";
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
    <div className="flex items-center justify-start px-4 py-2 bg-zinc-900/50 border-b border-white/[0.04] flex-shrink-0">
      <div className="flex items-center gap-3">
        {isActive ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full cursor-default",
                    "bg-emerald-500/10 border border-emerald-500/20"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-emerald-400 text-xs font-medium tabular-nums tracking-tight">
                    {getStatusText()}
                  </span>
                  <div className="w-px h-3 bg-emerald-500/30" />
                  {getQualityIcon()}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="bg-zinc-900/95 backdrop-blur-xl border-white/[0.08] p-0 overflow-hidden"
              >
                <div className="px-4 py-3 space-y-2.5 min-w-[180px]">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-xs">Connection</span>
                    <span className={cn("text-xs font-medium", getQualityColor())}>
                      {getQualityLabel()}
                    </span>
                  </div>
                  {stats ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 text-xs">Latency</span>
                        <span className="text-zinc-200 text-xs font-medium tabular-nums">
                          {stats.round_trip_time_ms.toFixed(0)}ms
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 text-xs">Jitter</span>
                        <span className="text-zinc-200 text-xs font-medium tabular-nums">
                          {stats.jitter_ms.toFixed(1)}ms
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 text-xs">Packet Loss</span>
                        <span className="text-zinc-200 text-xs font-medium tabular-nums">
                          {stats.packets_sent > 0
                            ? ((stats.packets_lost / stats.packets_sent) * 100).toFixed(1)
                            : "0.0"}
                          %
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-zinc-500 text-xs text-center py-1">Gathering stats...</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full",
              "bg-amber-500/10 border border-amber-500/20"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-400 text-xs font-medium">{getStatusText()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
