import { Monitor } from "lucide-react";
import { UserTile } from "./UserTile";
import { ScreenShareCanvas } from "./ScreenShareCanvas";
import type { ScreenShareLayoutProps } from "./types";

export function ScreenShareLayout({
  isSharing,
  peerIsSharing,
  peerName,
  myName,
  myAvatarUrl,
  peerAvatarUrl,
  isMuted,
  peerIsMuted,
  peerHasLeft,
  isLeft,
}: ScreenShareLayoutProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full w-full flex flex-col md:flex-row min-h-0">
        <div className="relative bg-black flex-1 min-h-[180px] md:min-h-0">
          {peerIsSharing ? (
            <ScreenShareCanvas peerName={peerName} />
          ) : isSharing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
              <Monitor className="w-12 h-12 mb-3 text-green-400" />
              <p className="text-base font-medium text-green-400">You are sharing your screen</p>
              <p className="text-xs text-white/50 mt-1">Others can see your screen</p>
            </div>
          ) : null}
        </div>

        <div className="w-full md:w-[280px] bg-background border-t md:border-t-0 md:border-l border-border flex-shrink-0 min-h-0">
          <div className="p-3 border-b border-border">
            <div className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
              In Call
            </div>
          </div>

          <div className="p-3 overflow-y-auto min-h-0">
            <div className="flex flex-col gap-1.5">
              <UserTile
                name={peerName}
                avatarUrl={peerAvatarUrl}
                isSpeaking={!peerHasLeft && !isLeft && !peerIsMuted}
                isMuted={peerIsMuted}
                hasLeft={peerHasLeft}
                size="sm"
                horizontal
                isScreenSharing={peerIsSharing}
              />

              <UserTile
                name={myName}
                avatarUrl={myAvatarUrl}
                isSpeaking={!isMuted && !isLeft}
                isMuted={isMuted}
                hasLeft={isLeft}
                size="sm"
                horizontal
                isSelf
                isScreenSharing={isSharing}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
