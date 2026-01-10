import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import type { IncomingGroupCallInfo } from "../types";
import { cn } from "@/lib/utils";

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
  const participantCount = incomingCall.participant_count;

  return (
    <Dialog open={!!incomingCall}>
      <DialogContent className="sm:max-w-[360px] bg-zinc-900/95 backdrop-blur-xl border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden p-0">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-500/10 blur-[80px] pointer-events-none" />

        <div className="relative flex flex-col items-center gap-6 px-8 py-10">
          <div className="relative">
            <div className="absolute inset-0 -m-2 rounded-full bg-blue-500/20 animate-[incoming-call-ring_1.5s_ease-in-out_infinite]" />

            <div className="relative">
              <Avatar
                src={incomingCall.initiator_avatar_url || undefined}
                fallback={displayName}
                size="xl"
                className="w-24 h-24 ring-[3px] ring-blue-400/60"
              />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 rounded-full border-[3px] border-zinc-900 flex items-center justify-center">
                <FontAwesomeIcon icon="users" className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {isJoining ? "Joining..." : "Group Call"}
            </h2>
            <p className="text-sm text-zinc-400">
              {isJoining ? (
                "Connecting to call"
              ) : (
                <>
                  <span className="text-zinc-200 font-medium">{displayName}</span>
                  {" started a call"}
                  {groupName && (
                    <>
                      {" in "}
                      <span className="text-zinc-200 font-medium">{groupName}</span>
                    </>
                  )}
                </>
              )}
            </p>
            {!isJoining && participantCount > 1 && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <FontAwesomeIcon icon="users" className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-blue-400 font-medium">
                    {participantCount - 1} other{participantCount > 2 ? "s" : ""} in call
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 mt-4 w-full justify-center">
            <div className="flex flex-col items-center gap-2.5">
              <Button
                variant="ghost"
                size="lg"
                className={cn(
                  "rounded-full h-16 w-16 p-0",
                  "bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white",
                  "border border-red-500/20 hover:border-red-500",
                  "transition-all duration-200 hover:scale-105 active:scale-95",
                  "shadow-lg shadow-red-500/0 hover:shadow-red-500/25"
                )}
                onClick={onDecline}
                disabled={isJoining}
              >
                <FontAwesomeIcon icon="phone-slash" className="h-6 w-6" />
              </Button>
              <span className="text-xs text-zinc-500 font-medium">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-2.5">
              <Button
                size="lg"
                className={cn(
                  "rounded-full h-16 w-16 p-0",
                  "bg-blue-500 hover:bg-blue-400 text-white",
                  "border border-blue-400/50",
                  "transition-all duration-200 hover:scale-105 active:scale-95",
                  "shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                )}
                onClick={onJoin}
                disabled={isJoining}
              >
                {isJoining ? (
                  <FontAwesomeIcon icon="spinner" className="h-6 w-6 animate-spin" />
                ) : (
                  <FontAwesomeIcon icon="phone" className="h-6 w-6" />
                )}
              </Button>
              <span className="text-xs text-zinc-500 font-medium">Join</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
