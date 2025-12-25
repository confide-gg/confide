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
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="flex items-center gap-8">
        <UserTile
          name={peerName}
          avatarUrl={peerAvatarUrl}
          isSpeaking={!peerHasLeft && !isLeft && !peerIsMuted}
          isMuted={peerIsMuted}
          hasLeft={peerHasLeft}
          isConnecting={isConnecting}
          size="md"
        />

        <UserTile
          name={myName}
          avatarUrl={myAvatarUrl}
          isSpeaking={!isMuted && !isLeft}
          isMuted={isMuted}
          hasLeft={isLeft}
          size="md"
          isSelf
        />
      </div>
    </div>
  );
}
