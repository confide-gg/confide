interface AvatarProps {
  username: string;
  size?: "small" | "medium" | "large";
  showStatus?: boolean;
  isOnline?: boolean;
}

export function Avatar({
  username,
  size = "medium",
  showStatus = false,
  isOnline = false,
}: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase();
  const sizeClass = size === "small" ? "small" : "";

  return (
    <div className="avatar-wrapper">
      <div className={`avatar ${sizeClass}`}>{initials}</div>
      {showStatus && <span className={`status-dot ${isOnline ? "online" : "offline"}`} />}
    </div>
  );
}

export function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}
