import { Phone, PhoneOff, PhoneMissed, PhoneIncoming } from "lucide-react";
import { formatDate } from "../../utils/formatters";
import type { DecryptedMessage } from "../../types";

interface SystemMessageProps {
  message: DecryptedMessage;
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

export function SystemMessage({ message }: SystemMessageProps) {
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
      default:
        return "text-muted-foreground";
    }
  };

  const getMessageText = () => {
    if (message.content) {
      return message.content;
    }

    switch (message.systemType) {
      case "call_started":
        return "Call started";
      case "call_ended":
        if (message.callDurationSeconds && message.callDurationSeconds > 0) {
          return `Call ended, lasted ${formatDuration(message.callDurationSeconds)}`;
        }
        return "Call ended";
      case "call_missed":
        return "Missed call";
      case "call_rejected":
        return "Call declined";
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
}
