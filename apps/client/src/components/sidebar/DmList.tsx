import { useEffect } from "react";
import { X } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { usePresence } from "../../context/PresenceContext";
import { Avatar } from "../ui/avatar";
import type { DmPreview } from "../../types";

export function DmList() {
  const { dmPreviews, friendsList, activeChat, unreadCounts, openDmFromPreview, closeDm, setDmContextMenu } = useChat();
  const { getUserPresence, subscribeToUsers, isWsConnected, isOnline } = usePresence();

  useEffect(() => {
    if (dmPreviews.length > 0 && isWsConnected) {
      const userIds = dmPreviews.map(p => p.visitorId);
      subscribeToUsers(userIds);
    }
  }, [dmPreviews, isWsConnected, subscribeToUsers]);

  if (dmPreviews.length === 0 && friendsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <p className="text-xs">No messages yet</p>
      </div>
    );
  }

  if (dmPreviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <p className="text-xs">No conversations</p>
      </div>
    );
  }

  const handleCloseDm = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    closeDm(conversationId);
  };

  const handleContextMenu = (e: React.MouseEvent, preview: DmPreview) => {
    e.preventDefault();
    setDmContextMenu({
      x: e.clientX,
      y: e.clientY,
      conversationId: preview.conversationId,
      visitorId: preview.visitorId,
      visitorUsername: preview.visitorUsername,
    });
  };

  return (
    <div className="space-y-0.5">
      {dmPreviews.map((preview) => {
        const unreadCount = unreadCounts.get(preview.visitorId) || 0;
        const isActive = activeChat?.conversationId === preview.conversationId;
        const presence = getUserPresence(preview.visitorId);
        const userIsOnline = isOnline(preview.visitorId);
        const displayStatus = userIsOnline ? (presence?.status || "online") : "offline";

        return (
          <button
            key={preview.conversationId}
            className={`group relative flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
              isActive
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            onClick={() => openDmFromPreview(preview)}
            onContextMenu={(e) => handleContextMenu(e, preview)}
          >
            <Avatar
              fallback={preview.visitorUsername}
              status={displayStatus as "online" | "away" | "dnd" | "invisible" | "offline"}
              size="sm"
            />

            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-medium">
                {preview.visitorUsername}
              </div>
            </div>

            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}

            <div
              role="button"
              className="absolute right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/50 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={(e) => handleCloseDm(e, preview.conversationId)}
              title="Close DM"
            >
              <X className="w-3.5 h-3.5" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
