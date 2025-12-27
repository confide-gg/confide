import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/lib/utils";
import type { UserActivity } from "@/features/profiles/types";
import { open } from "@tauri-apps/plugin-shell";

interface ActivityDisplayProps {
  activity: UserActivity | null;
  compact?: boolean;
  className?: string;
}

export function ActivityDisplay({ activity, compact = false, className }: ActivityDisplayProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!activity?.start_timestamp || !activity?.end_timestamp) {
      return;
    }

    const updateProgress = () => {
      const now = Date.now();
      const start = activity.start_timestamp!;
      const end = activity.end_timestamp!;
      const duration = end - start;
      const elapsed = now - start;
      const progressPercent = Math.min(100, Math.max(0, (elapsed / duration) * 100));
      setProgress(progressPercent);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);

    return () => clearInterval(interval);
  }, [activity?.start_timestamp, activity?.end_timestamp]);

  if (!activity) {
    return null;
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getElapsedTime = () => {
    if (!activity.start_timestamp) return "0:00";
    const elapsed = Date.now() - activity.start_timestamp;
    return formatTime(elapsed);
  };

  const getTotalDuration = () => {
    if (!activity.start_timestamp || !activity.end_timestamp) return "0:00";
    const duration = activity.end_timestamp - activity.start_timestamp;
    return formatTime(duration);
  };

  if (activity.activity_type !== "listening") {
    return null;
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-xs", className)}>
        <div className="w-5 h-5 bg-[#1DB954] rounded flex items-center justify-center flex-shrink-0">
          <FontAwesomeIcon icon="music" className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium">{activity.details}</p>
          <p className="truncate text-muted-foreground">{activity.state}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-3 bg-card rounded-lg border", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 bg-[#1DB954] rounded-sm flex items-center justify-center flex-shrink-0">
          <FontAwesomeIcon icon="music" className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          Listening to {activity.name}
        </span>
      </div>

      <div className="flex items-start gap-3">
        {activity.large_image_url && (
          <img
            src={activity.large_image_url}
            alt={activity.large_image_text || "Album art"}
            className="w-16 h-16 rounded object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {activity.track_url ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activity.track_url) {
                  open(activity.track_url);
                }
              }}
              className="text-sm font-semibold truncate hover:underline cursor-pointer text-left"
            >
              {activity.details}
            </button>
          ) : (
            <p className="text-sm font-semibold truncate">{activity.details}</p>
          )}
          <p className="text-xs text-muted-foreground truncate mb-2">{activity.state}</p>

          {activity.start_timestamp && activity.end_timestamp && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="shrink-0">{getElapsedTime()}</span>
              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1DB954] transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="shrink-0">{getTotalDuration()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
