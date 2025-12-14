import { useState, useEffect } from "react";
import { profiles, uploads } from "../../api";
import { usePresence } from "../../context/PresenceContext";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import type { PublicProfile, UserStatus } from "../../types";

interface ProfileCardProps {
  userId: string;
  username: string;
  onViewFullProfile: () => void;
}

const STATUS_COLORS: Record<UserStatus, string> = {
  online: "#22c55e",
  away: "#f59e0b",
  dnd: "#ef4444",
  invisible: "#6b7280",
  offline: "#6b7280",
};

const STATUS_LABELS: Record<UserStatus, string> = {
  online: "Online",
  away: "Away",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
  offline: "Offline",
};

export function ProfileCard({ userId, username, onViewFullProfile }: ProfileCardProps) {
  const { getUserPresence, subscribeToUsers, isWsConnected } = usePresence();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isWsConnected) {
      subscribeToUsers([userId]);
    }
  }, [userId, isWsConnected, subscribeToUsers]);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const data = await profiles.getUserProfile(userId);
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [userId]);

  const presence = getUserPresence(userId);
  const userIsOnline = presence !== undefined;
  const displayStatus = (userIsOnline ? (presence?.status || "online") : "offline") as UserStatus;
  const customStatus = presence?.customStatus || profile?.custom_status;
  const accentColor = profile?.accent_color || "#c9ed7b";

  const getImageUrl = (path: string | undefined | null) => {
    if (!path) return undefined;
    return uploads.getUploadUrl(path);
  };

  if (isLoading) {
    return (
      <div className="w-80 h-[400px] flex items-center justify-center bg-card rounded-2xl border border-border shadow-2xl">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-80 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
      <div
        className="h-24 relative"
        style={{
          background: profile?.banner_url
            ? `url(${getImageUrl(profile.banner_url)}) center/cover`
            : `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}99 100%)`,
        }}
      />

      <div className="px-4 -mt-10 relative">
        <div className="flex items-end gap-3">
          <div className="rounded-full p-1 bg-card shrink-0">
            <Avatar
              src={getImageUrl(profile?.avatar_url)}
              fallback={profile?.display_name || username}
              size="xl"
              className="w-20 h-20 text-2xl ring-4 ring-card"
              status={displayStatus}
            />
          </div>
          
          {customStatus && (
            <div className="relative mb-2 flex-1 min-w-0">
              <div className="relative bg-secondary/80 backdrop-blur-sm rounded-xl px-3 py-2 text-sm">
                <div className="absolute -left-2 bottom-2 w-3 h-3 bg-secondary/80 rounded-full" />
                <div className="absolute -left-3.5 bottom-0 w-2 h-2 bg-secondary/80 rounded-full" />
                <p className="text-foreground/90 italic truncate">"{customStatus}"</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pt-3 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-foreground truncate">
              {profile?.display_name || username}
            </h3>
            <p className="text-sm text-muted-foreground">@{username}</p>
          </div>
          
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
            style={{
              backgroundColor: `${STATUS_COLORS[displayStatus]}20`,
              color: STATUS_COLORS[displayStatus],
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[displayStatus] }}
            />
            {STATUS_LABELS[displayStatus]}
          </div>
        </div>

        {profile?.bio && (
          <div className="p-3 rounded-xl bg-secondary/50">
            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1.5">
              About Me
            </h4>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-3">
              {profile.bio}
            </p>
          </div>
        )}

        <Button variant="secondary" className="w-full" onClick={onViewFullProfile}>
          View Full Profile
        </Button>
      </div>
    </div>
  );
}
