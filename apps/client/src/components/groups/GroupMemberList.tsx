import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { Panel } from "../layout/Panel";
import { Avatar } from "../ui/avatar";
import { useAuth } from "../../context/AuthContext";
import { usePresence } from "../../context/PresenceContext";
import { cn } from "@/lib/utils";
import type { MemberResponse } from "../../features/chat/types";
import { groupService } from "../../features/groups/groupService";
import { ActivityDisplay } from "../activity/ActivityDisplay";
import { MemberProfileCard } from "../servers/MemberProfileCard";

interface GroupMemberListProps {
  conversationId: string;
  ownerId?: string | null;
  onOwnerIdChange?: (ownerId: string) => void;
}

export function GroupMemberList({ conversationId, ownerId, onOwnerIdChange }: GroupMemberListProps) {
  const { user } = useAuth();
  const { getUserPresence, getUserActivity, subscribeToUsers, isWsConnected, isOnline } = usePresence();

  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [profilePosition, setProfilePosition] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    userId: string;
    username: string;
  } | null>(null);

  const isOwner = ownerId && user?.id ? ownerId === user.id : false;

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await groupService.getMembers(conversationId);
      setMembers(result);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (!isWsConnected || members.length === 0) return;
    subscribeToUsers(members.map((m) => m.user.id));
  }, [isWsConnected, members, subscribeToUsers]);

  const sortedMembers = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      const aOwner = ownerId && a.user.id === ownerId ? 1 : 0;
      const bOwner = ownerId && b.user.id === ownerId ? 1 : 0;
      if (aOwner !== bOwner) return bOwner - aOwner;
      return a.user.username.localeCompare(b.user.username);
    });
    return copy;
  }, [members, ownerId]);

  const handleKick = async (targetUserId: string) => {
    await groupService.removeMember(conversationId, targetUserId);
    setContextMenu(null);
    loadMembers();
  };

  const handleMakeOwner = async (targetUserId: string) => {
    await groupService.transferOwnership(conversationId, { new_owner_id: targetUserId });
    setContextMenu(null);
    onOwnerIdChange?.(targetUserId);
    loadMembers();
  };

  const handleMemberClick = (userId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setProfilePosition({ x: rect.left, y: rect.top });
    setSelectedMemberId(userId);
  };

  const handleMemberRightClick = (userId: string, username: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      userId,
      username,
    });
  };

  const selectedMember = members.find(m => m.user.id === selectedMemberId);

  return (
    <>
      {selectedMemberId && selectedMember && (
        <MemberProfileCard
          userId={selectedMember.user.id}
          username={selectedMember.user.username}
          status={getUserPresence(selectedMember.user.id)?.status || "offline"}
          roles={[]}
          position={profilePosition}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
      {contextMenu && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
            onClick={() => setContextMenu(null)}
          >
            Close
          </button>
          {isOwner && contextMenu.userId !== ownerId && (
            <>
              <div className="h-px bg-border my-1" />
              <button
                className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
                onClick={() => handleMakeOwner(contextMenu.userId)}
              >
                Make Owner
              </button>
              <button
                className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
                onClick={() => handleKick(contextMenu.userId)}
              >
                Kick
              </button>
            </>
          )}
        </div>
      )}

      <aside className="w-60 h-full flex flex-col shrink-0 overflow-hidden">
        <Panel className="h-full flex flex-col">
          <div className="h-14 px-4 flex items-center justify-between shrink-0 border-b border-border">
            <h3 className="font-semibold text-base text-foreground">Members</h3>
            <div className="text-xs text-muted-foreground">{members.length}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-0.5">
                {sortedMembers.map((m) => {
                  const memberIsOwner = ownerId ? m.user.id === ownerId : false;
                  const presence = getUserPresence(m.user.id);
                  const userIsOnline = isOnline(m.user.id);
                  const status = userIsOnline ? (presence?.status || "online") : "offline";
                  const activity = getUserActivity(m.user.id);
                  return (
                    <div
                      key={m.user.id}
                      className={cn(
                        "flex items-center gap-3 px-2 py-1.5 mx-1 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
                      )}
                      onClick={(e) => handleMemberClick(m.user.id, e)}
                      onContextMenu={(e) => handleMemberRightClick(m.user.id, m.user.username, e)}
                    >
                      <Avatar
                        fallback={m.user.username}
                        size="sm"
                        status={status as any}
                        className="w-8 h-8"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium truncate text-foreground">
                            {m.user.username}
                          </div>
                          {memberIsOwner && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                        </div>
                        {activity && <ActivityDisplay activity={activity} compact className="mt-0.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </aside>
    </>
  );
}

