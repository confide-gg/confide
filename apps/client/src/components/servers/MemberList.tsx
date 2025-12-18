import { useEffect, useState, useCallback } from "react";
import { useServer } from "../../context/ServerContext";
import { useAuth } from "../../context/AuthContext";
import { usePresence } from "../../context/PresenceContext";
import { UserAvatar } from "../ui/user-avatar";
import type { FederatedMember as Member } from "../../features/servers/federatedClient";
import type { ServerRole } from "../../features/servers/types";
import { FederatedMemberContextMenu } from "./FederatedMemberContextMenu";
import { ActivityDisplay } from "../activity/ActivityDisplay";
import { MemberProfileCard } from "./MemberProfileCard";
import { Panel } from "../layout/Panel";

type MemberWithRoles = Member & {
  roleIds: string[];
  highestRole?: ServerRole;
};

export function MemberList() {
  const { activeServer, federatedClient, federatedWs } = useServer();
  const { user } = useAuth();
  const { getUserPresence, getUserActivity, subscribeToUsers, isWsConnected, isOnline: isUserOnline } = usePresence();

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [profilePosition, setProfilePosition] = useState({ x: 0, y: 0 });
  const [memberRoles, setMemberRoles] = useState<Map<string, string[]>>(new Map());
  const [availableRoles, setAvailableRoles] = useState<ServerRole[]>([]);
  const [userPermissions, setUserPermissions] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{ memberId: string; x: number; y: number } | null>(null);

  const loadMembers = useCallback(async () => {
    if (!federatedClient) return;
    setIsLoading(true);
    try {
      const serverMembers = await federatedClient.getMembers();
      setMembers(serverMembers);
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setIsLoading(false);
    }
  }, [federatedClient]);

  const loadMemberRoles = useCallback(async () => {
    if (!federatedClient) return;
    try {
      const allMemberRoles = await federatedClient.getAllMemberRoles();
      const rolesMap = new Map<string, string[]>();
      allMemberRoles.forEach(({ member_id, role_ids }) => {
        rolesMap.set(member_id, role_ids);
      });
      setMemberRoles(rolesMap);
    } catch (error) {
      console.error("Failed to load member roles:", error);
    }
  }, [federatedClient]);

  const loadRoles = useCallback(async () => {
    if (!federatedClient) return;
    try {
      const roles = await federatedClient.getRoles();
      setAvailableRoles(roles);
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  }, [federatedClient]);

  const loadUserPermissions = useCallback(async () => {
    if (!federatedClient) return;
    try {
      const perms = await federatedClient.getMyPermissions();
      setUserPermissions(perms);
    } catch (error) {
      console.error("Failed to load permissions:", error);
    }
  }, [federatedClient]);

  useEffect(() => {
    if (!activeServer) {
      setMembers([]);
      setMemberRoles(new Map());
      setAvailableRoles([]);
      return;
    }
    loadMembers();
    loadRoles();
    loadMemberRoles();
    loadUserPermissions();
  }, [activeServer?.id, loadMembers, loadRoles, loadMemberRoles, loadUserPermissions]);

  useEffect(() => {
    if (!federatedWs) return;

    const unsubscribe = federatedWs.onMessage((message) => {
      if (message.type === "member_roles_updated") {
        setMemberRoles((prev) => {
          const next = new Map(prev);
          next.set(message.member_id, message.role_ids);
          return next;
        });
      } else if (message.type === "role_created" || message.type === "role_updated" || message.type === "role_deleted") {
        loadRoles();
      } else if (message.type === "member_joined") {
        loadMembers();
        loadMemberRoles();
      } else if (message.type === "member_left") {
        setMembers(prev => prev.filter(m => m.id !== message.member_id));
        setMemberRoles(prev => {
          const next = new Map(prev);
          next.delete(message.member_id);
          return next;
        });
      }
    });

    return () => unsubscribe();
  }, [federatedWs, loadRoles, loadMembers, loadMemberRoles]);

  useEffect(() => {
    if (members.length > 0 && isWsConnected) {
      const centralUserIds = members.map(m => m.central_user_id).filter(Boolean);
      subscribeToUsers(centralUserIds);
    }
  }, [members, isWsConnected, subscribeToUsers]);

  const getHighestRole = (member: Member): ServerRole | undefined => {
    const roleIds = memberRoles.get(member.id) || [];
    const memberRoleObjects = availableRoles.filter(r => roleIds.includes(r.id));
    if (memberRoleObjects.length === 0) return undefined;
    return memberRoleObjects.reduce((highest, role) => 
      role.position > highest.position ? role : highest
    );
  };

  const getMembersWithRoles = (): MemberWithRoles[] => {
    return members.map(member => ({
      ...member,
      roleIds: memberRoles.get(member.id) || [],
      highestRole: getHighestRole(member),
    }));
  };

  const groupOnlineMembersByRole = (membersList: MemberWithRoles[]) => {
    const onlineByRole = new Map<string, MemberWithRoles[]>();

    membersList.forEach(member => {
      const presence = getUserPresence(member.central_user_id);
      const memberIsOnline = isUserOnline(member.central_user_id) && presence?.status !== "invisible";
      if (!memberIsOnline) return;

      if (!member.highestRole) {
        if (!onlineByRole.has("__no_role__")) {
          onlineByRole.set("__no_role__", []);
        }
        onlineByRole.get("__no_role__")!.push(member);
        return;
      }

      const roleId = member.highestRole.id;
      if (!onlineByRole.has(roleId)) {
        onlineByRole.set(roleId, []);
      }
      onlineByRole.get(roleId)!.push(member);
    });

    const sortedGroups: Array<{ role: ServerRole; members: MemberWithRoles[] }> = [];

    const roles = Array.from(onlineByRole.keys())
      .filter(roleId => roleId !== "__no_role__")
      .map(roleId => availableRoles.find(r => r.id === roleId))
      .filter((r): r is ServerRole => r !== undefined)
      .sort((a, b) => b.position - a.position);

    roles.forEach(role => {
      const roleMembers = onlineByRole.get(role.id) || [];
      roleMembers.sort((a, b) => {
        const nameA = a.display_name || a.username;
        const nameB = b.display_name || b.username;
        return nameA.localeCompare(nameB);
      });
      sortedGroups.push({ role, members: roleMembers });
    });

    const noRoleMembers = onlineByRole.get("__no_role__") || [];
    noRoleMembers.sort((a, b) => {
      const nameA = a.display_name || a.username;
      const nameB = b.display_name || b.username;
      return nameA.localeCompare(nameB);
    });

    return { groups: sortedGroups, onlineNoRole: noRoleMembers };
  };

  const getOfflineMembers = (membersList: MemberWithRoles[]) => {
    const offline = membersList.filter(member => {
      const presence = getUserPresence(member.central_user_id);
      const memberIsOnline = isUserOnline(member.central_user_id) && presence?.status !== "invisible";
      return !memberIsOnline;
    });

    offline.sort((a, b) => {
      const nameA = a.display_name || a.username;
      const nameB = b.display_name || b.username;
      return nameA.localeCompare(nameB);
    });

    return offline;
  };

  const handleMemberClick = (memberId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setProfilePosition({ x: rect.left, y: rect.top });
    setSelectedMemberId(memberId);
  };

  const handleMemberRightClick = (memberId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ memberId, x: event.clientX, y: event.clientY });
  };

  const handleRoleUpdated = () => {
    loadMemberRoles();
  };

  if (!activeServer) return null;

  const membersWithRoles = getMembersWithRoles();
  const { groups: onlineRoleGroups, onlineNoRole } = groupOnlineMembersByRole(membersWithRoles);
  const offlineMembers = getOfflineMembers(membersWithRoles);

  const MemberItem = ({ member }: { member: MemberWithRoles }) => {
    const isCurrentUser = member.central_user_id === user?.id;
    const presence = getUserPresence(member.central_user_id);
    const memberIsOnline = isUserOnline(member.central_user_id);
    const status = memberIsOnline ? (presence?.status || "online") : "offline";
    const displayColor = member.highestRole?.color;
    const activity = getUserActivity(member.central_user_id);

    return (
      <div
        key={member.id}
        className="flex items-center gap-3 px-2 py-1.5 mx-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
        onClick={(e) => handleMemberClick(member.id, e)}
        onContextMenu={(e) => handleMemberRightClick(member.id, e)}
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
          <div className="flex items-center gap-2">
            <p
              className="text-sm font-medium truncate"
              style={{ color: displayColor || (isCurrentUser ? undefined : undefined) }}
            >
              {member.display_name || member.username}
            </p>
          </div>
          {member.display_name && (
            <p className="text-xs text-muted-foreground truncate">
              @{member.username}
            </p>
          )}
          {activity && <ActivityDisplay activity={activity} compact className="mt-0.5" />}
        </div>
      </div>
    );
  };

  const RoleGroup = ({ role, members: groupMembers }: { role: ServerRole; members: MemberWithRoles[] }) => {
    if (groupMembers.length === 0) return null;

    return (
      <div className="mb-4">
        <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
          {role.color && (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
          )}
          <span style={{ color: role.color || undefined }}>
            {role.name} — {groupMembers.length}
          </span>
        </h3>
        <div className="space-y-0.5">
          {groupMembers.map((member) => (
            <MemberItem key={member.id} member={member} />
          ))}
        </div>
      </div>
    );
  };

  const selectedMember = members.find(m => m.id === selectedMemberId);
  const contextMenuMember = contextMenu ? members.find(m => m.id === contextMenu.memberId) : null;
  const contextMenuMemberRoles = contextMenuMember ? memberRoles.get(contextMenuMember.id) || [] : [];
  const isOwner = activeServer ? (activeServer as any).is_owner || false : false;

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="menu"]') || target.closest('[role="menuitem"]')) {
        return;
      }
      setContextMenu(null);
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClick);
    };
  }, [contextMenu]);

  return (
    <>
      {selectedMemberId && selectedMember && (
        <MemberProfileCard
          userId={selectedMember.central_user_id}
          username={selectedMember.username}
          status={getUserPresence(selectedMember.central_user_id)?.status || "offline"}
          roles={availableRoles.filter(r => (memberRoles.get(selectedMember.id) || []).includes(r.id))}
          position={profilePosition}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
      {contextMenu && contextMenuMember && federatedClient && (
        <FederatedMemberContextMenu
          federatedClient={federatedClient}
          memberId={contextMenuMember.id}
          username={contextMenuMember.username}
          memberRoleIds={contextMenuMemberRoles}
          availableRoles={availableRoles}
          userPermissions={userPermissions}
          isOwner={isOwner}
          isSelf={contextMenuMember.central_user_id === user?.id}
          onClose={() => setContextMenu(null)}
          onRoleUpdated={handleRoleUpdated}
          position={{ x: contextMenu.x, y: contextMenu.y }}
        />
      )}
      <aside className="w-60 h-full flex flex-col shrink-0 overflow-hidden">
        <Panel className="h-full flex flex-col">
          <div className="h-14 px-4 flex items-center shrink-0">
            <h3 className="font-semibold text-base text-foreground">Members</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="mt-2">
                {onlineRoleGroups.map((group) => (
                  <RoleGroup key={group.role.id} role={group.role} members={group.members} />
                ))}
                {onlineNoRole.length > 0 && (
                  <div className="mb-4">
                    <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Online — {onlineNoRole.length}
                    </h3>
                    <div className="space-y-0.5">
                      {onlineNoRole.map((member) => (
                        <MemberItem key={member.id} member={member} />
                      ))}
                    </div>
                  </div>
                )}
                {offlineMembers.length > 0 && (
                  <div className="mb-4">
                    <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Offline — {offlineMembers.length}
                    </h3>
                    <div className="space-y-0.5">
                      {offlineMembers.map((member) => (
                        <MemberItem key={member.id} member={member} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      </aside>
    </>
  );
}
