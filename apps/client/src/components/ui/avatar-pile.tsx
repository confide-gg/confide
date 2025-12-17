import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

export interface AvatarPileUser {
  id?: string;
  name: string;
  avatarUrl?: string | null;
}

interface AvatarPileProps {
  users: AvatarPileUser[];
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  max?: number;
  className?: string;
}

export function AvatarPile({ users, size = "sm", max = 3, className }: AvatarPileProps) {
  const visible = users.slice(0, Math.max(0, max));
  const remaining = Math.max(0, users.length - visible.length);

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((u, idx) => (
        <div
          key={u.id || `${u.name}-${idx}`}
          className={cn("rounded-full ring-2 ring-card", idx === 0 ? "ml-0" : "-ml-2")}
        >
          <Avatar src={u.avatarUrl || undefined} fallback={u.name} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div className={cn("rounded-full ring-2 ring-card -ml-2")}>
          <div
            className={cn(
              "flex items-center justify-center rounded-full bg-secondary text-foreground font-medium",
              size === "xs"
                ? "h-6 w-6 text-[10px]"
                : size === "sm"
                  ? "h-8 w-8 text-xs"
                  : size === "md"
                    ? "h-10 w-10 text-sm"
                    : size === "lg"
                      ? "h-12 w-12 text-sm"
                      : "h-14 w-14 text-base"
            )}
          >
            +{remaining}
          </div>
        </div>
      )}
    </div>
  );
}

