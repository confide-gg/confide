import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePresence } from "../../context/PresenceContext";
import { useCall } from "../calls/CallContext";
import { AvatarRoot, AvatarImage, AvatarFallback } from "../ui/avatar";
import { profileService } from "../../features/profiles/profiles";
import { uploadService } from "../../features/uploads/UploadService";
import type { UserStatus, UserProfile as UserProfileType } from "../../types";
import { ActivityDisplay } from "../activity/ActivityDisplay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { LogOut, Pencil, Check, ChevronDown, Mic, MicOff, Headphones, Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: "online", label: "Online", color: "#22c55e" },
  { value: "away", label: "Away", color: "#f59e0b" },
  { value: "dnd", label: "Do Not Disturb", color: "#ef4444" },
  { value: "invisible", label: "Invisible", color: "#6b7280" },
];

export function UserProfile() {
  const navigate = useNavigate();
  const { user, logout, refreshProfile } = useAuth();
  const { updateMyPresence, getUserActivity } = usePresence();
  const { callState, setMuted, setDeafened } = useCall();
  const [status, setStatus] = useState<UserStatus>("online");
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const activity = user ? getUserActivity(user.id) : null;


  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await profileService.getMyProfile();
        if (data) {
          setProfile(data);
          setStatus(data.status || "online");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };
    loadProfile();
  }, []);

  if (!user) return null;

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  const handleStatusChange = async (newStatus: UserStatus) => {
    setStatus(newStatus);
    updateMyPresence(newStatus);
    try {
      await profileService.updateProfile({ status: newStatus });
      await refreshProfile();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };



  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const isInCall = callState.status === "active";

  return (
    <>
      <div className="flex flex-col gap-2">
        {isInCall && (
          <div className="flex items-center justify-center gap-1 px-2">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setMuted(!callState.is_muted)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                      callState.is_muted
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {callState.is_muted ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {callState.is_muted ? "Unmute" : "Mute"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDeafened(!callState.is_deafened)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                      callState.is_deafened
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    <Headphones className={`h-4 w-4 ${callState.is_deafened ? "line-through" : ""}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {callState.is_deafened ? "Undeafen" : "Deafen"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {activity && (
          <div className="px-2">
            <ActivityDisplay activity={activity} compact />
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-none transition-colors hover:bg-secondary">
            <div className="relative shrink-0">
              <AvatarRoot className="h-9 w-9">
                {profile?.avatar_url ? (
                  <AvatarImage src={uploadService.getUploadUrl(profile.avatar_url)} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary to-[#a8d15a] text-primary-foreground text-xs font-medium">
                  {getInitials(profile?.display_name || user.username)}
                </AvatarFallback>
              </AvatarRoot>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-secondary"
                style={{ background: currentStatus.color }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium text-foreground">
                {profile?.display_name || user.username}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {profile?.custom_status || currentStatus.label}
              </div>
            </div>
            <ChevronDown className="shrink-0 w-4 h-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Status
          </DropdownMenuLabel>
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className={status === option.value ? "bg-primary/10 text-primary" : ""}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: option.color }}
              />
              <span className="flex-1">{option.label}</span>
              {status === option.value && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <Pencil className="w-4 h-4" />
            <span>Edit Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </>
  );
}