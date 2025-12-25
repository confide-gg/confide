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
      <DialogContent className="sm:max-w-xs bg-card border-border">
        <div className="flex flex-col items-center gap-5 py-4">
          <div className="relative">
            <Avatar
              src={incomingCall.caller_avatar_url || undefined}
              fallback={displayName}
              size="xl"
              className="w-20 h-20 ring-2 ring-green-500/50"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-[#1a1a1d]" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold text-white">{displayName}</h2>
            <p className="text-sm text-white/60">Incoming call</p>
          </div>

          <div className="flex items-center gap-8 mt-2">
            <div className="flex flex-col items-center gap-1.5">
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full h-14 w-14 bg-red-500 hover:bg-red-600 text-white"
                onClick={handleReject}
                disabled={isAccepting}
              >
                <FontAwesomeIcon icon="phone-slash" className="h-6 w-6" />
              </Button>
              <span className="text-xs text-white/50">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Button
                size="lg"
                className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600 text-white"
                onClick={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <FontAwesomeIcon icon="spinner" className="h-6 w-6" spin />
                ) : (
                  <FontAwesomeIcon icon="phone" className="h-6 w-6" />
                )}
              </Button>
              <span className="text-xs text-white/50">Accept</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
