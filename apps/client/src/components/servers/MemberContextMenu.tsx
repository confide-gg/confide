import { useState, useRef, useEffect } from "react";
import { UserMinus, Ban, Shield, Check } from "lucide-react";
import { servers as serversApi, crypto } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { hasPermission, Permissions, DecryptedRole } from "../../types/servers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

interface MemberContextMenuProps {
  serverId: string;
  userId: string;
  username: string;
  isOwner: boolean;
  userPermissions: number;
  memberRoles: DecryptedRole[];
  availableRoles: DecryptedRole[];
  onClose: () => void;
  onAction: () => void;
  position: { x: number; y: number };
}

export function MemberContextMenu({
  serverId,
  userId,
  username,
  isOwner,
  userPermissions,
  memberRoles,
  availableRoles,
  onClose,
  onAction,
  position,
}: MemberContextMenuProps) {
  const { user, keys } = useAuth();
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const canKick = hasPermission(userPermissions, Permissions.KICK_MEMBERS);
  const canBan = hasPermission(userPermissions, Permissions.BAN_MEMBERS);
  const canManageRoles = hasPermission(userPermissions, Permissions.MANAGE_ROLES);
  const isSelf = user?.id === userId;

  useEffect(() => {
    if (triggerRef.current) {
      triggerRef.current.click();
    }
  }, []);

  const handleKick = async () => {
    if (!confirm(`Are you sure you want to kick ${username}?`)) return;

    setIsProcessing(true);
    try {
      await serversApi.kickMember(serverId, userId);
      onAction();
      onClose();
    } catch (error) {
      console.error("Failed to kick member:", error);
      alert("Failed to kick member");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      let encryptedReason: number[] | undefined;
      if (banReason.trim() && keys) {
        const reasonBytes = new TextEncoder().encode(banReason);
        encryptedReason = await crypto.encryptData(
          keys.kem_secret_key,
          Array.from(reasonBytes)
        );
      }

      await serversApi.banMember(serverId, userId, {
        encrypted_reason: encryptedReason,
      });

      onAction();
      onClose();
    } catch (error) {
      console.error("Failed to ban member:", error);
      alert("Failed to ban member");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleRole = async (roleId: string, hasRole: boolean) => {
    setIsProcessing(true);
    try {
      if (hasRole) {
        await serversApi.removeRole(serverId, userId, roleId);
      } else {
        await serversApi.assignRole(serverId, userId, roleId);
      }
      await onAction();
    } catch (error) {
      console.error("Failed to toggle role:", error);
      alert("Failed to update role");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm(`Are you sure you want to leave this server?`)) return;

    setIsProcessing(true);
    try {
      await serversApi.leaveServer(serverId);
      onAction();
      onClose();
    } catch (error) {
      console.error("Failed to leave server:", error);
      alert("Failed to leave server");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            className="fixed w-0 h-0 opacity-0"
            style={{ top: position.y, left: position.x }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-52"
          side="left"
          align="start"
          sideOffset={0}
        >
          {isSelf && isOwner ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Shield className="w-4 h-4" />
                Manage My Roles
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
                    const hasRole = memberRoles.some(r => r.id === role.id);
                    return (
                      <DropdownMenuItem
                        key={role.id}
                        onClick={() => handleToggleRole(role.id, hasRole)}
                        disabled={isProcessing}
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
          ) : isSelf ? (
            <DropdownMenuItem
              onClick={handleLeave}
              disabled={isProcessing}
              className="text-destructive focus:text-destructive gap-2"
            >
              <UserMinus className="w-4 h-4" />
              Leave Server
            </DropdownMenuItem>
          ) : (
            <>
              {canManageRoles && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Shield className="w-4 h-4" />
                    Manage Roles
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="ml-1">
                    {availableRoles.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                        No roles available
                      </div>
                    ) : (
                      availableRoles.map((role) => {
                        const hasRole = memberRoles.some(r => r.id === role.id);
                        return (
                          <DropdownMenuItem
                            key={role.id}
                            onClick={() => handleToggleRole(role.id, hasRole)}
                            disabled={isProcessing}
                            className="gap-2"
                          >
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: role.color || "#5865F2" }}
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
              )}

              {canManageRoles && (canKick || canBan) && !isOwner && (
                <DropdownMenuSeparator />
              )}

              {canKick && !isOwner && (
                <DropdownMenuItem
                  onClick={handleKick}
                  disabled={isProcessing}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <UserMinus className="w-4 h-4" />
                  Kick {username}
                </DropdownMenuItem>
              )}

              {canBan && !isOwner && (
                <DropdownMenuItem
                  onClick={() => setShowBanModal(true)}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Ban {username}
                </DropdownMenuItem>
              )}

              {!canKick && !canBan && !canManageRoles && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No actions available
                </div>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showBanModal} onOpenChange={setShowBanModal}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>Ban {username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBan} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This user will be removed from the server and unable to rejoin.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Enter ban reason..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBanModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isProcessing}
              >
                {isProcessing ? "Banning..." : "Ban Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
