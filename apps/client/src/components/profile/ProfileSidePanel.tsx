import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { profileService } from "../../features/profiles/profiles";
import { uploadService } from "../../features/uploads/UploadService";
import { usePresence } from "../../context/PresenceContext";
import type { PublicProfile, UserStatus } from "../../types";
import { Avatar } from "../ui/avatar";

interface ProfileSidePanelProps {
  userId: string;
  username: string;
  onClose: () => void;
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

export function ProfileSidePanel({ userId, username, onClose }: ProfileSidePanelProps) {
  const { getUserPresence, subscribeToUsers, isWsConnected } = usePresence();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isWsConnected) {
      subscribeToUsers([userId]);
    }
  }, [userId, isWsConnected, subscribeToUsers]);

  const presence = getUserPresence(userId);
  const userIsOnline = presence !== undefined;
  const displayStatus = (userIsOnline ? (presence?.status || "online") : "offline") as UserStatus;
  const customStatus = presence?.customStatus || profile?.custom_status;

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const data = await profileService.getUserProfile(userId);
        setProfile(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [userId]);

  const accentColor = profile?.accent_color || "#c9ed7b";

  const getImageUrl = (path: string | undefined | null) => {
    if (!path) return "";
    return uploadService.getUploadUrl(path);
  };

  const formatMemberSince = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const renderDefaultProfile = () => {
    return (
      <div className="flex flex-col">
        <div
          className="h-28 relative shrink-0"
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
                src={profile?.avatar_url ? getImageUrl(profile.avatar_url) : undefined}
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

          <div className="space-y-3">
            {profile?.bio && (
              <div className="p-3 rounded-xl bg-secondary/50">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1.5">
                  About Me
                </h4>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            )}

            {profile?.member_since && (
              <div className="p-3 rounded-xl bg-secondary/50">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1.5">
                  Member Since
                </h4>
                <p className="text-sm font-medium text-foreground">
                  {formatMemberSince(profile.member_since)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 h-full bg-background border-l border-border flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between px-4 h-14 border-b border-border">
        <h3 className="font-semibold text-base">User Profile</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          renderDefaultProfile()
        )}
      </div>
    </div>
  );
}