import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { profileService } from "../../features/profiles/profiles";
import { uploadService } from "../../features/uploads/UploadService";
import type { PublicProfile, UserStatus } from "../../types";
import { usePresence } from "../../context/PresenceContext";
import { Avatar } from "../ui/avatar";
import { useUserActivity } from "../../hooks/useUserActivity";
import { ActivityDisplay } from "../activity/ActivityDisplay";

interface ProfileModalProps {
  userId: string;
  username: string;
  isOnline: boolean;
  onClose: () => void;
}

export function ProfileModal({
  userId,
  username,
  isOnline: _isOnline,
  onClose,
}: ProfileModalProps) {
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const presence = getUserPresence(userId);
  const userIsOnline = presence !== undefined;
  const displayStatus = (userIsOnline ? presence?.status || "online" : "offline") as UserStatus;
  const customStatus = presence?.customStatus || profile?.custom_status;
  const accentColor = profile?.accent_color || "#c9ed7b";
  const activity = useUserActivity(userId);

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
      <>
        <div
          className="h-24 relative"
          style={{
            background: profile?.banner_url
              ? `url(${getImageUrl(profile.banner_url)}) center/cover`
              : `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}99 100%)`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
          >
            <FontAwesomeIcon icon="xmark" className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 -mt-10 relative">
          <div className="flex items-end gap-3">
            <div className="rounded-full p-1 bg-card shrink-0">
              <Avatar
                src={getImageUrl(profile?.avatar_url) || undefined}
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
          <div>
            <h3 className="text-lg font-bold text-foreground truncate">
              {profile?.display_name || username}
            </h3>
            <p className="text-sm text-muted-foreground">@{username}</p>
          </div>

          <div className="space-y-3">
            {activity && <ActivityDisplay activity={activity} />}

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
      </>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          renderDefaultProfile()
        )}
      </div>
    </>
  );
}
