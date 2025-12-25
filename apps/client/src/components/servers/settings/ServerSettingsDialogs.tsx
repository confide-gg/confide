import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { ScrollArea } from "../../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../ui/dialog";
import { AlertTriangle } from "lucide-react";
import type { ServerRole } from "../../../features/servers/types";
import { PERMISSION_GROUPS } from "./types";

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newRoleName: string;
  setNewRoleName: (name: string) => void;
  newRoleColor: string;
  setNewRoleColor: (color: string) => void;
  newRolePermissions: number;
  togglePermission: (perm: number) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateRoleDialog({
  open,
  onOpenChange,
  newRoleName,
  setNewRoleName,
  newRoleColor,
  setNewRoleColor,
  newRolePermissions,
  togglePermission,
  isLoading,
  onSubmit,
}: CreateRoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>Add a new role to organize your server members</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Role Name</label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Enter role name"
                className="bg-secondary border-0"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Role Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  className="w-12 h-10 rounded-lg cursor-pointer border-2 border-border bg-transparent"
                />
                <Input
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  className="w-28 font-mono bg-secondary border-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Permissions</label>
              <ScrollArea className="h-64 rounded-xl bg-secondary/30 p-4">
                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.name} className="space-y-2">
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {group.name}
                      </h5>
                      <div className="space-y-1">
                        {group.permissions.map((perm) => (
                          <div
                            key={perm.value}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary transition-colors"
                          >
                            <span className="text-sm">{perm.name}</span>
                            <Switch
                              checked={(newRolePermissions & perm.value) !== 0}
                              onCheckedChange={() => togglePermission(perm.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !newRoleName.trim()}>
              Create Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ServerRole | null;
  isLoading: boolean;
  onConfirm: () => void;
}

export function DeleteRoleDialog({
  open,
  onOpenChange,
  role,
  isLoading,
  onConfirm,
}: DeleteRoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete Role
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{role?.name}</strong>? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            Delete Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  isLoading: boolean;
  onConfirm: () => void;
}

export function DeleteServerDialog({
  open,
  onOpenChange,
  serverName,
  isLoading,
  onConfirm,
}: DeleteServerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete Server
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you absolutely sure you want to delete <strong>{serverName}</strong>?
            </p>
            <p className="text-destructive font-semibold">
              This action cannot be undone. All channels, messages, and roles will be permanently
              deleted.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete Server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
