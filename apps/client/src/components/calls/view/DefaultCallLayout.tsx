import { UserTile } from "./UserTile";
import type { DefaultCallLayoutProps } from "./types";

export function DefaultCallLayout({
  myName,
  myAvatarUrl,
  peerName,
  peerAvatarUrl,
  isMuted,
  peerIsMuted,
  peerHasLeft,
  isLeft,
  isConnecting,
}: DefaultCallLayoutProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="flex items-center justify-center gap-16">
        <UserTile
          name={peerName}
          avatarUrl={peerAvatarUrl}
          isSpeaking={!peerHasLeft && !isLeft && !peerIsMuted}
          isMuted={peerIsMuted}
          hasLeft={peerHasLeft}
          isConnecting={isConnecting}
          size="lg"
        />

        <UserTile
          name={myName}
          avatarUrl={myAvatarUrl}
          isSpeaking={!isMuted && !isLeft}
          isMuted={isMuted}
          hasLeft={isLeft}
          size="lg"
          isSelf
        />
      </div>
    </div>
  );
}
