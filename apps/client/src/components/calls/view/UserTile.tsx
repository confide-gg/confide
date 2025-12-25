import { MicOff, Monitor } from "lucide-react";
import { Avatar } from "../../ui/avatar";
import { cn } from "@/lib/utils";
import type { UserTileProps } from "./types";

export function UserTile({
  name,
  avatarUrl,
  isSpeaking,
  isMuted,
  hasLeft,
  isConnecting,
  size = "md",
  isSelf,
  horizontal,
  isScreenSharing,
}: UserTileProps) {
  const avatarSizeMap = {
    sm: "sm" as const,
    md: "lg" as const,
    lg: "xl" as const,
  };

  const containerSizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };

  const ringSize = {
    sm: "ring-2",
    md: "ring-[3px]",
    lg: "ring-4",
  };

  const getRingColor = () => {
    if (hasLeft) return "ring-red-500/60";
    if (isConnecting) return "ring-yellow-500/60 animate-pulse";
    if (isSpeaking && !isMuted) return "ring-green-500";
    return "ring-transparent";
  };

  if (horizontal) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-1.5 rounded-lg",
          isSelf ? "bg-white/5" : "bg-transparent"
        )}
      >
        <div
          className={cn(
            "relative rounded-full flex-shrink-0",
            containerSizeClasses.sm,
            ringSize.sm,
            getRingColor()
          )}
        >
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
          <div
            className={cn("text-xs font-medium truncate", hasLeft ? "text-white/50" : "text-white")}
          >
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
      <div
        className={cn(
          "relative rounded-full transition-all duration-200 flex items-center justify-center",
          containerSizeClasses[size],
          ringSize[size],
          getRingColor()
        )}
      >
        <Avatar
          src={avatarUrl || undefined}
          fallback={name}
          size={avatarSizeMap[size]}
          className={cn(containerSizeClasses[size], hasLeft && "opacity-50 grayscale")}
        />
        {isMuted && (
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 rounded-full bg-red-500 flex items-center justify-center",
              size === "lg" ? "w-6 h-6" : size === "md" ? "w-5 h-5" : "w-4 h-4"
            )}
          >
            <MicOff className={cn("text-white", size === "lg" ? "w-3.5 h-3.5" : "w-2.5 h-2.5")} />
          </div>
        )}
      </div>
      <div className="text-center">
        <div
          className={cn(
            "font-medium",
            size === "lg" ? "text-sm" : "text-xs",
            hasLeft ? "text-white/50" : "text-white"
          )}
        >
          {name}
        </div>
        {isSelf && <div className="text-[10px] text-white/50">(You)</div>}
        {hasLeft && <div className="text-[10px] text-red-400">Left</div>}
        {isConnecting && <div className="text-[10px] text-yellow-400">Connecting...</div>}
      </div>
    </div>
  );
}
