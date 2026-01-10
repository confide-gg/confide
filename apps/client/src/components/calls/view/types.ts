import type { CallQuality, CallQualityStats } from "../types";

export interface CallViewProps {}

export interface ControlButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  activeColor?: "red" | "green";
  disabled?: boolean;
  variant?: "default" | "danger";
  tooltip: string;
}

export interface UserTileProps {
  name: string;
  avatarUrl?: string | null;
  isSpeaking: boolean;
  isMuted?: boolean;
  hasLeft?: boolean;
  isConnecting?: boolean;
  size?: "sm" | "md" | "lg";
  isSelf?: boolean;
  horizontal?: boolean;
}

export interface DefaultCallLayoutProps {
  myName: string;
  myAvatarUrl?: string | null;
  peerName: string;
  peerAvatarUrl?: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  peerIsMuted?: boolean;
  peerHasLeft: boolean;
  isLeft: boolean;
  isConnecting: boolean;
}

export interface CallViewState {
  duration: number;
  quality: CallQuality;
  stats: CallQualityStats | null;
  isRejoining: boolean;
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
