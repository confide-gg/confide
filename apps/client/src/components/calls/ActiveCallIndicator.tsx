import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PhoneCall, Timer, Volume2, VolumeX, Video, VideoOff, Monitor } from "lucide-react";
import { useCall } from "./context";

interface ActiveCallIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function ActiveCallIndicator({ compact = false, className }: ActiveCallIndicatorProps) {
  const { callState, setMuted, setDeafened } = useCall();
  const [callDuration, setCallDuration] = useState<string>("00:00");

  useEffect(() => {
    if (callState.status !== "active" || !callState.connected_at) {
      return;
    }

    const updateDuration = () => {
      const start = new Date(callState.connected_at!);
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);

      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;

      if (hours > 0) {
        setCallDuration(
          `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      } else {
        setCallDuration(
          `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      }
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [callState.status, callState.connected_at]);

  if (callState.status !== "active") {
    return null;
  }

  const handleToggleMute = () => {
    setMuted(!callState.is_muted);
  };

  const handleToggleDeafen = () => {
    setDeafened(!callState.is_deafened);
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg ${className}`}
      >
        <div className="relative">
          <Avatar
            src={callState.peer_avatar_url || undefined}
            fallback={callState.peer_display_name || callState.peer_username || "?"}
            size="xs"
            className="h-6 w-6"
          />
          <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border border-card" />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-foreground truncate">
            {callState.peer_display_name || callState.peer_username || "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">{callDuration}</span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {callState.is_screen_sharing && <Monitor className="h-3 w-3 text-green-400" />}
          {callState.peer_is_screen_sharing && <Video className="h-3 w-3 text-blue-400" />}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar
              src={callState.peer_avatar_url || undefined}
              fallback={callState.peer_display_name || callState.peer_username || "?"}
              size="md"
              className="h-10 w-10"
            />
            <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-card flex items-center justify-center">
              <PhoneCall className="h-2 w-2 text-white" />
            </div>
          </div>

          <div>
            <h4 className="font-medium text-sm text-foreground">
              {callState.peer_display_name || callState.peer_username || "Unknown"}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>{callDuration}</span>
              {callState.is_screen_sharing && (
                <div className="flex items-center gap-1 text-green-400">
                  <Monitor className="h-3 w-3" />
                  <span>Sharing screen</span>
                </div>
              )}
              {callState.peer_is_screen_sharing && (
                <div className="flex items-center gap-1 text-blue-400">
                  <Video className="h-3 w-3" />
                  <span>Peer sharing</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleMute}
            className={`h-8 w-8 p-0 ${
              callState.is_muted
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {callState.is_muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleDeafen}
            className={`h-8 w-8 p-0 ${
              callState.is_deafened
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            {callState.is_deafened ? (
              <VideoOff className="h-4 w-4" />
            ) : (
              <Video className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
