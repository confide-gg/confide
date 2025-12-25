"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

const AvatarRoot = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
AvatarRoot.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export interface LegacyAvatarProps {
  src?: string;
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
  status?: "online" | "away" | "dnd" | "offline" | "invisible";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

const statusColors: Record<string, string> = {
  online: "#22c55e",
  away: "#f59e0b",
  dnd: "#ef4444",
  offline: "#6b7280",
  invisible: "#6b7280",
};

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const Avatar = React.forwardRef<HTMLSpanElement, LegacyAvatarProps>(
  ({ src, fallback = "", size = "md", online, status, className, onClick }, ref) => {
    const displayStatus = status || (online ? "online" : undefined);

    return (
      <div className="relative inline-block" onClick={onClick}>
        <AvatarRoot ref={ref} className={cn(sizeClasses[size], className)}>
          {src && <AvatarImage src={src} />}
          <AvatarFallback className="bg-gradient-to-br from-primary to-[#a8d15a] text-primary-foreground font-medium">
            {getInitials(fallback)}
          </AvatarFallback>
        </AvatarRoot>
        {displayStatus && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card"
            style={{ background: statusColors[displayStatus] }}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar, AvatarRoot, AvatarImage, AvatarFallback };
