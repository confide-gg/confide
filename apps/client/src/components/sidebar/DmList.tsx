import { useEffect, useMemo } from "react";
import { X, Plus } from "lucide-react";
import { useChat } from "../../context/chat";
import { usePresence } from "../../context/PresenceContext";
import { Avatar } from "../ui/avatar";
import { AvatarPile } from "../ui/avatar-pile";
import { useAuth } from "../../context/AuthContext";
import type { DmPreview } from "../../types/index";
import { ActivityDisplay } from "../activity/ActivityDisplay";
import { Button } from "../ui/button";

interface DmListProps {
  onCreateGroup?: () => void;
  onLeaveGroup?: (conversationId: string) => void;
}

export function DmList({ onCreateGroup, onLeaveGroup }: DmListProps) {
  const { user } = useAuth();
  const { dmPreviews, friendsList, activeChat, unreadCounts, openDmFromPreview, openGroupFromPreview, closeDm, setDmContextMenu, setGroupContextMenu } = useChat();
  const { getUserPresence, getUserActivity, subscribeToUsers, isWsConnected, isOnline } = usePresence();

  const { directMessages, groupMessages } = useMemo(() => {
    return {
      directMessages: dmPreviews.filter(p => !p.isGroup),
      groupMessages: dmPreviews.filter(p => p.isGroup)
    };
  }, [dmPreviews]);

  useEffect(() => {
    if (dmPreviews.length > 0 && isWsConnected) {
      const userIds = dmPreviews.filter(p => !p.isGroup).map(p => p.visitorId);
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

  const handleCloseDm = (e: React.MouseEvent, preview: DmPreview) => {
    e.stopPropagation();
    if (preview.isGroup && onLeaveGroup) {
      onLeaveGroup(preview.conversationId);
    } else {
      closeDm(preview.conversationId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, preview: DmPreview) => {
    e.preventDefault();
    if (preview.isGroup) {
      setGroupContextMenu({
        x: e.clientX,
        y: e.clientY,
        conversationId: preview.conversationId,
        isOwner: !!(user?.id && preview.groupOwnerId && user.id === preview.groupOwnerId),
      });
    } else {
      setDmContextMenu({
        x: e.clientX,
        y: e.clientY,
        conversationId: preview.conversationId,
        visitorId: preview.visitorId,
        visitorUsername: preview.visitorUsername,
        isMuted: false,
      });
    }
  };

  const renderConversationItem = (preview: DmPreview) => {
    const unreadCount = unreadCounts.get(preview.conversationId) || 0;
    const isActive = activeChat?.conversationId === preview.conversationId;
    const presence = preview.isGroup ? null : getUserPresence(preview.visitorId);
    const userIsOnline = preview.isGroup ? false : isOnline(preview.visitorId);
    const displayStatus = preview.isGroup ? undefined : (userIsOnline ? (presence?.status || "online") : "offline");
    const displayName = preview.isGroup ? (preview.groupName || "Group") : preview.visitorUsername;
    const memberCount = preview.isGroup ? (preview.memberUsernames?.length || 0) : 0;
    const activity = preview.isGroup ? null : getUserActivity(preview.visitorId);

    return (
      <button
        key={preview.conversationId}
        className={`group relative flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${isActive
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        onClick={() => (preview.isGroup ? openGroupFromPreview(preview) : openDmFromPreview(preview))}
        onContextMenu={(e) => handleContextMenu(e, preview)}
      >
        {preview.isGroup ? (
          <AvatarPile
            users={(preview.memberUsernames || []).slice(0, 10).map((n, idx) => ({
              id: `${preview.conversationId}-${idx}`,
              name: n,
            }))}
            size="sm"
          />
        ) : (
          <Avatar
            fallback={preview.visitorUsername}
            status={displayStatus as "online" | "away" | "dnd" | "invisible" | "offline"}
            size="sm"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="truncate text-sm font-medium flex items-center gap-2">
              <span className="truncate">{displayName}</span>
            </div>
            {preview.isGroup ? (
              <div className="text-[11px] text-muted-foreground truncate">
                {memberCount} member{memberCount === 1 ? "" : "s"}
              </div>
            ) : (
              activity && <ActivityDisplay activity={activity} compact className="mt-0.5" />
            )}
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
          onClick={(e) => handleCloseDm(e, preview)}
          title={preview.isGroup ? "Leave Group" : "Close DM"}
        >
          <X className="w-3.5 h-3.5" />
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {directMessages.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Direct Messages
            </span>
            {onCreateGroup && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onCreateGroup}
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="space-y-0.5">
            {directMessages.map(renderConversationItem)}
          </div>
        </div>
      )}

      {groupMessages.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Groups
            </span>
          </div>
          <div className="space-y-0.5">
            {groupMessages.map(renderConversationItem)}
          </div>
        </div>
      )}
    </div>
  );
}
