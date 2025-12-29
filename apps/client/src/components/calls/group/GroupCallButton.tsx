import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActiveGroupCallResponse } from "../types";

interface GroupCallButtonProps {
  conversationId: string;
  activeCall: ActiveGroupCallResponse | null;
  isInCall: boolean;
  onStartCall: () => void;
  onJoinCall: () => void;
  disabled?: boolean;
}

export function GroupCallButton({
  activeCall,
  isInCall,
  onStartCall,
  onJoinCall,
  disabled,
}: GroupCallButtonProps) {
  const hasActiveCall = activeCall !== null;

  const handleClick = () => {
    if (isInCall) {
      return;
    }
    if (hasActiveCall) {
      onJoinCall();
    } else {
      onStartCall();
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", hasActiveCall && "text-green-500")}
      onClick={handleClick}
      disabled={disabled || isInCall}
      title={isInCall ? "Already in a call" : hasActiveCall ? "Join Call" : "Start Call"}
    >
      <FontAwesomeIcon icon="phone" className={cn("w-4 h-4", hasActiveCall && "animate-pulse")} />
      {hasActiveCall && activeCall.participant_count > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-green-500 text-white rounded-full flex items-center justify-center">
          {activeCall.participant_count}
        </span>
      )}
    </Button>
  );
}
