import { Avatar } from "./avatar";
import { cn } from "../../lib/utils";

// Define a union type that covers Member, PublicUser, and basic user objects
type UserLike = {
  username: string;
  display_name?: string;
  avatar_url?: string;
};

interface UserAvatarProps {
  user: UserLike;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
  isOnline?: boolean;
  status?: string; // Explicit status string
  onClick?: (e: React.MouseEvent) => void;
}

export function UserAvatar({
  user,
  className,
  size = "md",
  showStatus,
  isOnline,
  status,
  onClick,
}: UserAvatarProps) {
  const name = user.display_name || user.username;

  // Determine status to show:
  // 1. explicit 'status' prop
  // 2. derived from 'isOnline'
  // 3. undefined
  const displayStatus = status
    ? status
    : showStatus
      ? isOnline
        ? "online"
        : "offline"
      : undefined;

  return (
    <Avatar
      src={user.avatar_url}
      fallback={name}
      className={cn("cursor-pointer transition-opacity hover:opacity-90", className)}
      size={size}
      status={displayStatus as any}
      onClick={onClick}
    />
  );
}
