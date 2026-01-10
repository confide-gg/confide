import { useRef, useCallback, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Avatar } from "../ui/avatar";
import { useCall } from "./context";
import { callService as callsApi } from "../../features/calls/calls";
import {
  checkMicrophonePermission,
  requestMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";
import { platform } from "@tauri-apps/plugin-os";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface IncomingCallDialogProps {
  dsaSecretKey: number[];
}

export function IncomingCallDialog({ dsaSecretKey }: IncomingCallDialogProps) {
  const { incomingCall, acceptCall, rejectCall, callState } = useCall();
  const acceptTriggeredRef = useRef(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = useCallback(async () => {
    if (!incomingCall) return;
    if (isAccepting || acceptTriggeredRef.current) return;

    acceptTriggeredRef.current = true;
    setIsAccepting(true);

    try {
      const currentPlatform = await platform();
      if (currentPlatform === "macos") {
        const hasPermission = await checkMicrophonePermission();
        if (!hasPermission) {
          const granted = await requestMicrophonePermission();
          if (!granted) {
            console.error("Microphone permission denied");
            toast.error("Microphone permission required", {
              description:
                "Please grant microphone access in System Settings > Privacy & Security > Microphone",
              duration: 5000,
            });
            await callsApi
              .rejectCall(incomingCall.call_id, "permission_denied")
              .catch(console.error);
            await rejectCall();
            return;
          }
        }
      }

      if (!incomingCall) {
        return;
      }

      const answer = await acceptCall(incomingCall.caller_identity_key, dsaSecretKey);

      await callsApi.answerCall(incomingCall.call_id, {
        ephemeral_kem_public: answer.ephemeral_kem_public,
        kem_ciphertext: answer.kem_ciphertext,
        signature: answer.signature,
      });
    } catch (e) {
      console.error("[IncomingCallDialog] Failed to accept call:", e);
      toast.error("Failed to accept call", {
        description: e instanceof Error ? e.message : "Unknown error occurred",
      });
    } finally {
      setIsAccepting(false);
      acceptTriggeredRef.current = false;
    }
  }, [incomingCall, acceptCall, rejectCall, dsaSecretKey, isAccepting]);

  const handleReject = useCallback(async () => {
    try {
      await rejectCall();
    } catch (e) {
      console.error("Failed to reject call:", e);
    }
  }, [rejectCall]);

  if (!incomingCall) return null;
  if (callState.is_caller) return null;

  const displayName = incomingCall.caller_display_name || incomingCall.caller_username;

  return (
    <Dialog open={!!incomingCall}>
      <DialogContent className="sm:max-w-[340px] bg-zinc-900/95 backdrop-blur-xl border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden p-0">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.03] to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-emerald-500/10 blur-[80px] pointer-events-none" />

        <div className="relative flex flex-col items-center gap-6 px-8 py-10">
          <div className="relative">
            <div className="absolute inset-0 -m-2 rounded-full bg-emerald-500/20 animate-[incoming-call-ring_1.5s_ease-in-out_infinite]" />

            <div className="relative">
              <Avatar
                src={incomingCall.caller_avatar_url || undefined}
                fallback={displayName}
                size="xl"
                className="w-24 h-24 ring-[3px] ring-emerald-400/60"
              />
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full border-[3px] border-zinc-900 flex items-center justify-center">
                <FontAwesomeIcon icon="phone" className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-semibold text-white tracking-tight">{displayName}</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-sm text-zinc-400 font-medium">Incoming voice call</p>
            </div>
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
                onClick={handleReject}
                disabled={isAccepting}
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
                  "bg-emerald-500 hover:bg-emerald-400 text-white",
                  "border border-emerald-400/50",
                  "transition-all duration-200 hover:scale-105 active:scale-95",
                  "shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                )}
                onClick={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <FontAwesomeIcon icon="spinner" className="h-6 w-6 animate-spin" />
                ) : (
                  <FontAwesomeIcon icon="phone" className="h-6 w-6" />
                )}
              </Button>
              <span className="text-xs text-zinc-500 font-medium">Accept</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
