import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Avatar } from "../ui/avatar";
import { profileService } from "../../features/profiles/profiles";
import { uploadService } from "../../features/uploads/UploadService";
import { usePresence } from "../../context/PresenceContext";
import { ActivityDisplay } from "@/features/shared-kernel";
import type { PublicProfile, UserStatus } from "../../types";
import type { ServerRole } from "../../features/servers/types";

interface MemberProfileCardProps {
  userId: string;
  username: string;
  status: string;
  roles: ServerRole[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function MemberProfileCard({
  userId,
  username,
  status,
  roles,
  position,
  onClose,
}: MemberProfileCardProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);
  const { getUserPresence, getUserActivity, subscribeToUsers, isWsConnected } = usePresence();

  useEffect(() => {
    if (isWsConnected) {
      subscribeToUsers([userId]);
    }
  }, [userId, isWsConnected, subscribeToUsers]);

  const presence = getUserPresence(userId);
  const userIsOnline = presence !== undefined;
  const displayStatus = (
    userIsOnline ? presence?.status || "online" : status || "offline"
  ) as UserStatus;
  const customStatus = presence?.customStatus || profile?.custom_status;
  const activity = getUserActivity(userId);

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

  const getImageUrl = (path: string | undefined | null) => {
    if (!path) return undefined;
    return uploadService.getUploadUrl(path);
  };

  const formatMemberSince = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const accentColor = profile?.accent_color || "#c9ed7b";

  const getPosition = () => {
    const popupWidth = 320;
    const popupHeight = 450;
    const padding = 16;

    let left = position.x - popupWidth - padding;
    let top = position.y;

    if (left < padding) {
      left = position.x + padding;
    }

    if (left + popupWidth > window.innerWidth - padding) {
      left = window.innerWidth - popupWidth - padding;
    }

    if (top + popupHeight > window.innerHeight - padding) {
      top = window.innerHeight - popupHeight - padding;
    }

    if (top < padding) {
      top = padding;
    }

    return { left, top };
  };

  const pos = getPosition();

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        ref={popupRef}
        className="fixed z-50 w-80 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ left: pos.left, top: pos.top }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
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
              <div>
                <h3 className="text-lg font-bold text-foreground truncate">
                  {profile?.display_name || username}
                </h3>
                <p className="text-sm text-muted-foreground">@{username}</p>
              </div>

              {roles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                    Roles
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {roles
                      .sort((a, b) => b.position - a.position)
                      .map((role) => (
                        <div
                          key={role.id}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: role.color || "#71717a" }}
                          />
                          <span
                            className="text-xs font-medium"
                            style={{ color: role.color || "inherit" }}
                          >
                            {role.name}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {activity && <ActivityDisplay activity={activity} />}

                {profile?.bio && (
                  <div className="p-3 rounded-xl bg-secondary/50">
                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1.5">
                      About Me
                    </h4>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-4">
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
        )}
      </div>
    </>
  );
}
