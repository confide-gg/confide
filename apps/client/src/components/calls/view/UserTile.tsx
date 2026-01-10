import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
    sm: "w-10 h-10",
    md: "w-20 h-20",
    lg: "w-28 h-28",
  };

  const avatarClasses = {
    sm: "w-10 h-10",
    md: "w-20 h-20",
    lg: "w-28 h-28",
  };

  const getRingStyle = () => {
    if (hasLeft) return "ring-red-500/50";
    if (isConnecting) return "ring-amber-500/50";
    if (isSpeaking && !isMuted) return "ring-emerald-400 ring-[3px]";
    return "ring-white/[0.08] ring-2";
  };

  if (horizontal) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-xl transition-colors duration-200",
          isSelf ? "bg-white/[0.04]" : "bg-transparent hover:bg-white/[0.02]"
        )}
      >
        <div className="relative flex-shrink-0">
          <Avatar
            src={avatarUrl || undefined}
            fallback={name}
            size={avatarSizeMap.sm}
            className={cn(
              "w-9 h-9 rounded-full transition-all duration-200",
              getRingStyle(),
              hasLeft && "opacity-40 grayscale"
            )}
          />
          {isMuted && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center border-2 border-zinc-900">
              <FontAwesomeIcon icon="microphone-slash" className="w-2 h-2 text-white" />
            </div>
          )}
          {!isMuted && !hasLeft && (
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-zinc-900 transition-colors duration-200",
                isSpeaking ? "bg-emerald-500" : "bg-zinc-700"
              )}
            >
              <FontAwesomeIcon
                icon="microphone"
                className={cn(
                  "w-2 h-2 transition-colors duration-200",
                  isSpeaking ? "text-white" : "text-zinc-400"
                )}
              />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-sm font-medium truncate tracking-tight",
              hasLeft ? "text-zinc-500" : "text-zinc-200"
            )}
          >
            {name}
            {isSelf && <span className="text-zinc-500 font-normal ml-1">(You)</span>}
          </div>
          {isScreenSharing && (
            <div className="text-xs text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <FontAwesomeIcon icon="desktop" className="w-3 h-3" />
              <span>Sharing screen</span>
            </div>
          )}
          {hasLeft && <div className="text-xs text-red-400/80 mt-0.5">Left the call</div>}
          {isConnecting && <div className="text-xs text-amber-400/80 mt-0.5">Connecting...</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 group">
      <div className="relative">
        <div
          className={cn(
            "relative rounded-full transition-all duration-300 flex items-center justify-center",
            containerSizeClasses[size],
            "ring-offset-0",
            hasLeft
              ? "ring-2 ring-red-500/40"
              : isConnecting
                ? "ring-2 ring-amber-500/50"
                : isSpeaking && !isMuted
                  ? "ring-[3px] ring-emerald-400"
                  : "ring-2 ring-white/[0.08] group-hover:ring-white/[0.15]"
          )}
        >
          <Avatar
            src={avatarUrl || undefined}
            fallback={name}
            size={avatarSizeMap[size]}
            className={cn(
              avatarClasses[size],
              "transition-all duration-300",
              hasLeft && "opacity-40 grayscale"
            )}
          />

          {isMuted && (
            <div
              className={cn(
                "absolute -bottom-1 -right-1 rounded-full bg-red-500 flex items-center justify-center border-[3px] border-zinc-900",
                size === "lg" ? "w-8 h-8" : size === "md" ? "w-7 h-7" : "w-5 h-5"
              )}
            >
              <FontAwesomeIcon
                icon="microphone-slash"
                className={cn(
                  "text-white",
                  size === "lg" ? "w-4 h-4" : size === "md" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"
                )}
              />
            </div>
          )}

          {!isMuted && !hasLeft && !isConnecting && (
            <div
              className={cn(
                "absolute -bottom-1 -right-1 rounded-full flex items-center justify-center border-[3px] border-zinc-900 transition-colors duration-200",
                isSpeaking ? "bg-emerald-500" : "bg-zinc-700",
                size === "lg" ? "w-8 h-8" : size === "md" ? "w-7 h-7" : "w-5 h-5"
              )}
            >
              <FontAwesomeIcon
                icon="microphone"
                className={cn(
                  "transition-colors duration-200",
                  isSpeaking ? "text-white" : "text-zinc-400",
                  size === "lg" ? "w-4 h-4" : size === "md" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"
                )}
              />
            </div>
          )}
        </div>
      </div>

      <div className="text-center space-y-0.5">
        <div
          className={cn(
            "font-medium tracking-tight",
            size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs",
            hasLeft ? "text-zinc-500" : "text-zinc-100"
          )}
        >
          {name}
        </div>
        {isSelf && (
          <div className={cn("text-zinc-500", size === "lg" ? "text-xs" : "text-[10px]")}>You</div>
        )}
        {hasLeft && (
          <div className={cn("text-red-400/80", size === "lg" ? "text-xs" : "text-[10px]")}>
            Left the call
          </div>
        )}
        {isConnecting && (
          <div
            className={cn(
              "text-amber-400/80 flex items-center justify-center gap-1",
              size === "lg" ? "text-xs" : "text-[10px]"
            )}
          >
            <span>Connecting...</span>
          </div>
        )}
      </div>
    </div>
  );
}
