import { memo } from "react";
import { Crown, LogOut, Phone, PhoneIncoming, PhoneMissed, PhoneOff, Pin, UserMinus, UserPlus } from "lucide-react";
import { formatDate } from "../../utils/formatters";
import type { DecryptedMessage } from "../../types";

interface SystemMessageProps {
  message: DecryptedMessage;
  peerName?: string;
  pinnedMessage?: DecryptedMessage;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export const SystemMessage = memo(function SystemMessage({ message, peerName }: SystemMessageProps) {
  const getIcon = () => {
    switch (message.systemType) {
      case "call_started":
        return <PhoneIncoming className="w-4 h-4" />;
      case "call_ended":
        return <Phone className="w-4 h-4" />;
      case "call_missed":
        return <PhoneMissed className="w-4 h-4" />;
      case "call_rejected":
        return <PhoneOff className="w-4 h-4" />;
      case "channel_pin":
        return <Pin className="w-4 h-4" />;
      case "group_member_added":
        return <UserPlus className="w-4 h-4" />;
      case "group_member_removed":
        return <UserMinus className="w-4 h-4" />;
      case "group_member_left":
        return <LogOut className="w-4 h-4" />;
      case "group_owner_changed":
        return <Crown className="w-4 h-4" />;
      default:
        return <Phone className="w-4 h-4" />;
    }
  };

  const getIconColor = () => {
    switch (message.systemType) {
      case "call_started":
      case "call_ended":
        return "text-green-500";
      case "call_missed":
        return "text-yellow-500";
      case "call_rejected":
        return "text-red-400";
      case "channel_pin":
        return "text-muted-foreground";
      case "group_member_added":
      case "group_member_removed":
      case "group_member_left":
      case "group_owner_changed":
        return "text-muted-foreground";
      default:
        return "text-muted-foreground";
    }
  };

  const getMessageText = () => {
    if (message.content) {
      return message.content;
    }

    const actor = message.isMine ? "You" : (peerName || message.senderName || "They");

    switch (message.systemType) {
      case "call_started":
        return `${actor} started a call`;
      case "call_ended":
        if (message.callDurationSeconds && message.callDurationSeconds > 0) {
          const verb = message.isMine ? "called" : "called you";
          return `${actor} ${verb} • ${formatDuration(message.callDurationSeconds)}`;
        }
        return message.isMine ? "You called" : `${actor} called you`;
      case "call_missed":
        return message.isMine ? "You cancelled the call" : `Missed call from ${actor}`;
      case "call_rejected":
        return `${actor} declined`;
      case "channel_pin":
        return `${actor} pinned a message to this channel.`;
      case "group_member_added":
      case "group_member_removed":
      case "group_member_left":
      case "group_owner_changed":
        return "";
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center gap-2 px-8 py-1.5 my-1">
      <div className={`flex-shrink-0 ${getIconColor()}`}>
        {getIcon()}
      </div>
      <span className="text-sm text-muted-foreground">
        {getMessageText()}
      </span>
      <span className="text-xs text-muted-foreground/50 ml-1">
        {formatDate(message.createdAt)}
      </span>
    </div>
  );
});
