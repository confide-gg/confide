import { useEffect, useState, useCallback } from "react";
import { useServer } from "../../context/ServerContext";
import { useAuth } from "../../context/AuthContext";
import { usePresence } from "../../context/PresenceContext";
import { UserAvatar } from "../ui/user-avatar";
import type { Member } from "../../api/federatedServer";

import { MemberProfileCard } from "./MemberProfileCard";

export function MemberList() {
  const { activeServer, federatedClient } = useServer();
  const { user } = useAuth();
  const { getUserPresence, subscribeToUsers, isWsConnected, isOnline: isUserOnline } = usePresence();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [profilePosition, setProfilePosition] = useState({ x: 0, y: 0 });

  const loadMembers = useCallback(async () => {
    if (!federatedClient) return;
    setIsLoading(true);
    try {
      const serverMembers = await federatedClient.getMembers();
      // Sort members: current user first, then alphabetical
      serverMembers.sort((a, b) => {
        if (a.central_user_id === user?.id) return -1;
        if (b.central_user_id === user?.id) return 1;
        return (a.display_name || a.username).localeCompare(b.display_name || b.username);
      });
      setMembers(serverMembers);
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setIsLoading(false);
    }
  }, [federatedClient, user?.id]);

  useEffect(() => {
    if (!activeServer) {
      setMembers([]);
      return;
    }
    loadMembers();
  }, [activeServer?.id, loadMembers]);

  useEffect(() => {
    if (members.length > 0 && isWsConnected) {
      const centralUserIds = members.map(m => m.central_user_id).filter(Boolean);
      subscribeToUsers(centralUserIds);
    }
  }, [members, isWsConnected, subscribeToUsers]);

  const onlineMembers = members.filter(m => {
      if (m.central_user_id === user?.id) return true;
      return isUserOnline(m.central_user_id);
  });

  const offlineMembers = members.filter(m => {
      if (m.central_user_id === user?.id) return false;
      return !isUserOnline(m.central_user_id);
  });

  const handleMemberClick = (memberId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setProfilePosition({ x: rect.left, y: rect.top });
    setSelectedMemberId(memberId);
  };

  if (!activeServer) return null;

  const MemberGroup = ({ title, list }: { title: string, list: Member[] }) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title} — {list.length}
        </h3>
        <div className="space-y-0.5">
          {list.map((member) => {
            const isCurrentUser = member.central_user_id === user?.id;
            const presence = getUserPresence(member.central_user_id);
            const memberIsOnline = isUserOnline(member.central_user_id);
            const status = memberIsOnline ? (presence?.status || "online") : "offline";

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 px-2 py-1.5 mx-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group opacity-90 hover:opacity-100"
                onClick={(e) => handleMemberClick(member.id, e)}
              >
                <div className="relative">
                  <UserAvatar
                    user={member}
                    size="sm"
                    showStatus
                    status={status}
                    className="w-8 h-8"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                      {member.display_name || member.username}
                    </p>
                  </div>
                  {member.display_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      @{member.username}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const selectedMember = members.find(m => m.id === selectedMemberId);
  const selectedMemberStatus = selectedMember
    ? (getUserPresence(selectedMember.central_user_id)?.status || "offline")
    : "offline";

  return (
    <>
      {selectedMemberId && selectedMember && (
        <MemberProfileCard
          userId={selectedMember.central_user_id} // Profile card needs central user ID
          username={selectedMember.username}
          status={selectedMemberStatus}
          roles={[]} // TODO: Fetch roles
          position={profilePosition}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
      <aside className="w-60 h-full flex flex-col shrink-0 bg-background border-l border-border">
        <div className="h-14 px-4 flex items-center border-b border-border shrink-0">
          <h3 className="font-semibold text-base text-foreground">Members</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="mt-2">
              <MemberGroup title="Online" list={onlineMembers} />
              <MemberGroup title="Offline" list={offlineMembers} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
