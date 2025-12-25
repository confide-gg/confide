import { useState, useRef, useEffect } from "react";
import { Shield, Check } from "lucide-react";
import type { ServerRole } from "../../features/servers/types";
import type { FederatedServerClient } from "../../features/servers/federatedClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../ui/dropdown-menu";

interface FederatedMemberContextMenuProps {
  federatedClient: FederatedServerClient;
  memberId: string;
  username: string;
  memberRoleIds: string[];
  availableRoles: ServerRole[];
  userPermissions: number;
  isOwner: boolean;
  isSelf: boolean;
  onClose: () => void;
  onRoleUpdated: () => void;
  position: { x: number; y: number };
}

export function FederatedMemberContextMenu({
  federatedClient,
  memberId,
  username: _username,
  memberRoleIds,
  availableRoles,
  userPermissions,
  isOwner,
  isSelf,
  onClose,
  onRoleUpdated,
  position,
}: FederatedMemberContextMenuProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Check permissions: users can manage roles if they have MANAGE_ROLES permission, ADMINISTRATOR permission, or are owner
  const canManageRoles = (userPermissions & (1 << 10)) !== 0; // MANAGE_ROLES = 1 << 10
  const isAdministrator = (userPermissions & (1 << 9)) !== 0; // ADMINISTRATOR = 1 << 9
  const hasPermission = canManageRoles || isAdministrator || isOwner;

  // Always show menu when right-clicking yourself (to view roles), but only allow management if you have permission
  // For others, require MANAGE_ROLES permission, ADMINISTRATOR permission, or owner status
  const canManageThisMember = hasPermission;
  const shouldShow = isSelf || hasPermission; // Always show for self, require permission for others

  useEffect(() => {
    if (triggerRef.current) {
      triggerRef.current.click();
    }
  }, []);

  const handleToggleRole = async (roleId: string, hasRole: boolean) => {
    if (!canManageThisMember) {
      alert("You don't have permission to manage roles");
      return;
    }
    setIsProcessing(true);
    try {
      if (hasRole) {
        await federatedClient.removeRole(roleId, memberId);
      } else {
        await federatedClient.assignRole(roleId, memberId);
      }
      onRoleUpdated();
    } catch (error) {
      console.error("Failed to toggle role:", error);
      alert("Failed to update role");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          className="fixed w-0 h-0 opacity-0"
          style={{ top: position.y, left: position.x }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" side="left" align="start" sideOffset={0}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <Shield className="w-4 h-4" />
            {isSelf ? "Manage My Roles" : "Manage Roles"}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="ml-1">
            {availableRoles.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                No roles available
              </div>
            ) : (
              availableRoles
                .sort((a, b) => b.position - a.position)
                .map((role) => {
                  const hasRole = memberRoleIds.includes(role.id);
                  return (
                    <DropdownMenuItem
                      key={role.id}
                      onClick={() => handleToggleRole(role.id, hasRole)}
                      disabled={isProcessing || !canManageThisMember}
                      className="gap-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: role.color || "#71717a" }}
                      />
                      <span className="flex-1" style={{ color: hasRole ? role.color : undefined }}>
                        {role.name}
                      </span>
                      {hasRole && <Check className="w-4 h-4 shrink-0" />}
                    </DropdownMenuItem>
                  );
                })
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
