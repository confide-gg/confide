import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import type { IncomingGroupCallInfo } from "../types";

interface GroupCallInviteDialogProps {
  incomingCall: IncomingGroupCallInfo | null;
  groupName?: string;
  isJoining?: boolean;
  onJoin: () => void;
  onDecline: () => void;
}

export function GroupCallInviteDialog({
  incomingCall,
  groupName,
  isJoining = false,
  onJoin,
  onDecline,
}: GroupCallInviteDialogProps) {
  if (!incomingCall) return null;

  const displayName = incomingCall.initiator_display_name || incomingCall.initiator_username;

  return (
    <Dialog open={!!incomingCall}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Avatar
                src={incomingCall.initiator_avatar_url || undefined}
                fallback={displayName}
                size="xl"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <FontAwesomeIcon icon="phone" className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-lg font-semibold">{isJoining ? "Joining..." : "Group Call"}</h2>
            <p className="text-sm text-muted-foreground">
              {isJoining ? "Connecting to call" : `${displayName} started a call`}
              {!isJoining && groupName && ` in ${groupName}`}
            </p>
            {!isJoining && incomingCall.participant_count > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                {incomingCall.participant_count - 1} other
                {incomingCall.participant_count > 2 ? "s" : ""} in call
              </p>
            )}
          </div>

          <div className="flex gap-4 mt-2">
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full w-14 h-14"
              onClick={onDecline}
              disabled={isJoining}
            >
              <FontAwesomeIcon icon="phone-slash" className="w-6 h-6" />
            </Button>
            <Button
              variant="default"
              size="lg"
              className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600"
              onClick={onJoin}
              disabled={isJoining}
            >
              {isJoining ? (
                <FontAwesomeIcon icon="spinner" className="w-6 h-6 animate-spin" />
              ) : (
                <FontAwesomeIcon icon="phone" className="w-6 h-6" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
