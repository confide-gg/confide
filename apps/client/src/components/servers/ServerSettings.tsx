import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { ScrollArea } from "../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import {
  Plus,
  Trash2,
  Shield,
  Ban,
  X,
  Settings,
  Users,
  AlertTriangle,
  ArrowLeft,
  GripVertical,
} from "lucide-react";
import { serverService } from "../../features/servers/servers";
import { Permissions } from "../../features/servers/permissions";
import { useServer } from "../../context/ServerContext";
import type { ServerRole, ServerBan } from "../../features/servers/types";

interface ServerSettingsProps {
  serverId: string;
  serverName: string;
  isOwner: boolean;
  onClose: () => void;
}

type Tab = "overview" | "roles" | "bans";

const PERMISSION_GROUPS = [
  {
    name: "General Server Permissions",
    permissions: [
      { name: "Administrator", value: Permissions.ADMINISTRATOR, description: "Members with this permission have every permission and can bypass channel-specific permissions." },
      { name: "Manage Server", value: Permissions.MANAGE_SERVER, description: "Allows members to change the server name and other settings." },
      { name: "Manage Roles", value: Permissions.MANAGE_ROLES, description: "Allows members to create, edit, and delete roles below their highest role." },
      { name: "Manage Channels", value: Permissions.MANAGE_CHANNELS, description: "Allows members to create, edit, and delete channels." },
    ],
  },
  {
    name: "Membership Permissions",
    permissions: [
      { name: "Create Invite", value: Permissions.CREATE_INVITE, description: "Allows members to invite new people to this server." },
      { name: "Kick Members", value: Permissions.KICK_MEMBERS, description: "Allows members to remove other members from this server." },
      { name: "Ban Members", value: Permissions.BAN_MEMBERS, description: "Allows members to permanently ban other members from this server." },
    ],
  },
  {
    name: "Text Channel Permissions",
    permissions: [
      { name: "View Channels", value: Permissions.VIEW_CHANNELS, description: "Allows members to view channels by default." },
      { name: "Read Messages", value: Permissions.READ_MESSAGES, description: "Allows members to read message history in channels." },
      { name: "Send Messages", value: Permissions.SEND_MESSAGES, description: "Allows members to send messages in text channels." },
      { name: "Manage Messages", value: Permissions.MANAGE_MESSAGES, description: "Allows members to delete messages by other members." },
      { name: "Mention Everyone", value: Permissions.MENTION_EVERYONE, description: "Allows members to use @everyone to notify all members." },
    ],
  },
];


export function ServerSettings({ serverId, serverName, isOwner, onClose }: ServerSettingsProps) {
  const { onRoleEvent, federatedClient, reloadServerData } = useServer();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ServerRole | null>(null);
  const [selectedRoleName, setSelectedRoleName] = useState("");
  const [dragRoleId, setDragRoleId] = useState<string | null>(null);
  const [dragOverRoleId, setDragOverRoleId] = useState<string | null>(null);
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);
  const [name, setName] = useState(serverName);
  const [description, setDescription] = useState("");
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [maxUsers, setMaxUsers] = useState(100);
  const [maxUploadSize, setMaxUploadSize] = useState(100);
  const [messageRetention, setMessageRetention] = useState("30d");
  const [initialSettings, setInitialSettings] = useState({
    name: serverName,
    description: "",
    isDiscoverable: false,
    maxUsers: 100,
    maxUploadSize: 100,
    messageRetention: "30d"
  });

  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#5865F2");
  const [newRolePermissions, setNewRolePermissions] = useState(0);

  const hasChanges = name !== initialSettings.name ||
    description !== initialSettings.description ||
    isDiscoverable !== initialSettings.isDiscoverable ||
    maxUsers !== initialSettings.maxUsers ||
    maxUploadSize !== initialSettings.maxUploadSize ||
    messageRetention !== initialSettings.messageRetention;

  useEffect(() => {
    if (activeTab === "overview" && federatedClient) {
      loadServerSettings();
    }
  }, [activeTab, federatedClient]);

  const loadServerSettings = async () => {
    if (!federatedClient) return;
    try {
      const info = await federatedClient.getServerInfo();
      setName(info.name);
      setDescription(info.description || "");
      setIsDiscoverable(info.is_discoverable || false);
      setMaxUsers(info.max_users || 100);
      setMaxUploadSize(info.max_upload_size_mb || 100);
      setMessageRetention(info.message_retention || "30d");
      setInitialSettings({
        name: info.name,
        description: info.description || "",
        isDiscoverable: info.is_discoverable || false,
        maxUsers: info.max_users || 100,
        maxUploadSize: info.max_upload_size_mb || 100,
        messageRetention: info.message_retention || "30d"
      });
    } catch (error) {
      console.error("Failed to load server settings:", error);
    }
  };

  const handleSaveSettings = async () => {
    if (!federatedClient) return;
    setIsLoading(true);
    try {
      await federatedClient.updateServerSettings({
        server_name: name,
        description,
        is_discoverable: isDiscoverable,
        max_users: maxUsers,
        max_upload_size_mb: maxUploadSize,
        message_retention: messageRetention
      });
      setInitialSettings({ name, description, isDiscoverable, maxUsers, maxUploadSize, messageRetention });
      await reloadServerData(); // Update sidebar name
    } catch (error) {
      console.error("Failed to update settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const { deleteServer } = useServer();
  const [showDeleteServerConfirm, setShowDeleteServerConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<ServerRole | null>(null);

  const handleDeleteServer = async () => {
    setIsLoading(true);
    try {
      await deleteServer(serverId);
      onClose();
    } catch (error) {
      console.error("Failed to delete server:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !showCreateRole && !showDeleteConfirm) {
      if (selectedRole) {
        setSelectedRole(null);
      } else {
        onClose();
      }
    }
  }, [onClose, showCreateRole, showDeleteConfirm, selectedRole]);

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    if (activeTab === "roles" || activeTab === "overview") {
      loadRoles();
    }
    if (activeTab === "bans") {
      loadBans();
    }
  }, [activeTab, serverId]);

  useEffect(() => {
    const unsubscribe = onRoleEvent((eventServerId: string) => {
      if (eventServerId === serverId && (activeTab === "roles" || activeTab === "overview")) {
        loadRoles();
      }
    });
    return () => unsubscribe();
  }, [serverId, activeTab, onRoleEvent]);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      let serverRoles: ServerRole[] = [];
      if (federatedClient) {
        serverRoles = await federatedClient.getRoles();
      } else {
        serverRoles = await serverService.getServerRoles(serverId);
      }
      setRoles(serverRoles || []);
    } catch (error) {
      console.error("Failed to load roles:", error);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBans = async () => {
    setIsLoading(true);
    try {
      const serverBans = await serverService.getServerBans(serverId);
      setBans(serverBans);
    } catch (error) {
      console.error("Failed to load bans:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setIsLoading(true);
    try {
      if (federatedClient) {
        await federatedClient.createRole({
          name: newRoleName.trim(),
          permissions: newRolePermissions,
          color: newRoleColor,
          position: roles.length,
        });
      } else {
        await serverService.createRole(serverId, {
          name: newRoleName.trim(),
          permissions: newRolePermissions,
          color: newRoleColor,
          position: roles.length,
        });
      }

      setNewRoleName("");
      setNewRoleColor("#5865F2");
      setNewRolePermissions(0);
      setShowCreateRole(false);
      loadRoles();
    } catch (error) {
      console.error("Failed to create role:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (roleId: string, updates: { permissions?: number; color?: string; position?: number }) => {
    try {
      if (federatedClient) {
        await federatedClient.updateRole(roleId, updates);
      } else {
        await serverService.updateRole(serverId, roleId, updates);
      }
      loadRoles();
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleUpdateRoleName = async () => {
    if (!selectedRole) return;
    const trimmed = selectedRoleName.trim();
    if (!trimmed || trimmed === selectedRole.name) return;
    setIsLoading(true);
    try {
      if (federatedClient) {
        const updated = await federatedClient.updateRole(selectedRole.id, { name: trimmed });
        setSelectedRole(updated);
      } else {
        const updated = await serverService.updateRole(serverId, selectedRole.id, { name: trimmed });
        setSelectedRole(updated);
      }
      loadRoles();
    } catch (error) {
      console.error("Failed to update role name:", error);
      setSelectedRoleName(selectedRole.name);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;

    setIsLoading(true);
    try {
      if (federatedClient) {
        await federatedClient.deleteRole(roleToDelete.id);
      } else {
        await serverService.deleteRole(serverId, roleToDelete.id);
      }
      setSelectedRole(null);
      setShowDeleteConfirm(false);
      setRoleToDelete(null);
      loadRoles();
    } catch (error) {
      console.error("Failed to delete role:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReorderRoles = async (fromId: string, toId: string) => {
    const sortedRoles = [...roles].sort((a, b) => b.position - a.position);
    const fromIndex = sortedRoles.findIndex(r => r.id === fromId);
    const toIndex = sortedRoles.findIndex(r => r.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const next = [...sortedRoles];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    const updatedPositions = next.map((r, idx) => ({
      ...r,
      position: next.length - 1 - idx,
    }));
    setRoles(updatedPositions);

    const roleIds = next.map(r => r.id);
    try {
      if (federatedClient) {
        await federatedClient.reorderRoles(roleIds);
      } else {
        await serverService.reorderRoles(serverId, roleIds);
      }
      loadRoles();
    } catch (error) {
      console.error("Failed to reorder roles:", error);
      setRoles(sortedRoles);
    }
  };

  useEffect(() => {
    if (!dragRoleId || dragPointerId === null) return;

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const findRoleId = (el: Element | null): string | null => {
      let node: Element | null = el;
      while (node) {
        const id = (node as HTMLElement).dataset?.roleId;
        if (id) return id;
        node = node.parentElement;
      }
      return null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const id = findRoleId(el);
      setDragOverRoleId(id);
    };

    const end = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      if (dragOverRoleId && dragOverRoleId !== dragRoleId) {
        handleReorderRoles(dragRoleId, dragOverRoleId);
      }
      setDragRoleId(null);
      setDragOverRoleId(null);
      setDragPointerId(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });

    return () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end as any);
      window.removeEventListener("pointercancel", end as any);
    };
  }, [dragRoleId, dragPointerId, dragOverRoleId]);

  const handleUnban = async (userId: string) => {
    setIsLoading(true);
    try {
      await serverService.unbanMember(serverId, userId);
      loadBans();
    } catch (error) {
      console.error("Failed to unban member:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePermission = (perm: number) => {
    setNewRolePermissions(prev => prev ^ perm);
  };

  const toggleRolePermission = (role: ServerRole, perm: number) => {
    const newPerms = role.permissions ^ perm;
    handleUpdateRole(role.id, { permissions: newPerms });
    setSelectedRole({ ...role, permissions: newPerms });
  };

  const renderRoleEditor = () => {
    if (!selectedRole) return null;

    return (
      <div className="fixed inset-0 z-50 bg-background p-3 flex flex-col">
        <div className="flex-1 flex flex-col bg-bg-elevated rounded-xl border border-border/50 overflow-hidden">
          <div className="flex items-center gap-4 p-4 border-b border-border/50">
            <button
              onClick={() => setSelectedRole(null)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: selectedRole.color || "#71717a" }}
              />
              <div>
                <Input
                  value={selectedRoleName}
                  onChange={(e) => setSelectedRoleName(e.target.value)}
                  onBlur={handleUpdateRoleName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="h-8 px-2 bg-secondary/30 border-0 font-semibold"
                  style={{ color: selectedRole.color || 'inherit' }}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">Edit role permissions</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                setRoleToDelete(selectedRole);
                setShowDeleteConfirm(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="max-w-2xl mx-auto p-6 space-y-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Role Color
                </h3>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={selectedRole.color || "#5865F2"}
                    onChange={(e) => {
                      handleUpdateRole(selectedRole.id, { color: e.target.value });
                      setSelectedRole({ ...selectedRole, color: e.target.value });
                    }}
                    className="w-14 h-14 rounded-xl cursor-pointer border-2 border-border bg-transparent"
                  />
                  <Input
                    value={selectedRole.color || "#5865F2"}
                    onChange={(e) => {
                      const color = e.target.value;
                      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                        handleUpdateRole(selectedRole.id, { color });
                        setSelectedRole({ ...selectedRole, color });
                      }
                    }}
                    className="w-32 font-mono bg-secondary border-0"
                  />
                </div>
              </div>

              <div className="h-px bg-border/50" />

              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Permissions
                </h3>

                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.name} className="space-y-3">
                    <h4 className="text-sm font-medium text-foreground">{group.name}</h4>
                    <div className="space-y-2">
                      {group.permissions.map((perm) => (
                        <div
                          key={perm.value}
                          className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        >
                          <div className="space-y-1 pr-4">
                            <div className="text-sm font-medium">{perm.name}</div>
                            <div className="text-xs text-muted-foreground">{perm.description}</div>
                          </div>
                          <Switch
                            checked={(selectedRole.permissions & perm.value) !== 0}
                            onCheckedChange={() => toggleRolePermission(selectedRole, perm.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  if (selectedRole) {
    return (
      <>
        {renderRoleEditor()}

        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Delete Role
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{roleToDelete?.name}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteRole} disabled={isLoading}>
                Delete Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteServerConfirm} onOpenChange={setShowDeleteServerConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Delete Server
              </DialogTitle>
              <DialogDescription className="space-y-2">
                <p>Are you absolutely sure you want to delete <strong>{serverName}</strong>?</p>
                <p className="text-destructive font-semibold">
                  This action cannot be undone. All channels, messages, and roles will be permanently deleted.
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDeleteServerConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteServer}
                disabled={isLoading}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isLoading ? "Deleting..." : "Delete Server"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background p-3 flex">
        <div className="w-[240px] flex flex-col mr-3">
          <div className="p-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide truncate">
              {serverName}
            </h2>
          </div>

          <ScrollArea className="flex-1">
            <nav className="space-y-1 px-2">
              <button
                onClick={() => setActiveTab("overview")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "overview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <Settings className="w-4 h-4" />
                Overview
              </button>

              <button
                onClick={() => setActiveTab("roles")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "roles"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <Shield className="w-4 h-4" />
                Roles
              </button>

              <button
                onClick={() => setActiveTab("bans")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "bans"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <Ban className="w-4 h-4" />
                Bans
              </button>
            </nav>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-bg-elevated rounded-xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h1 className="text-lg font-semibold">
              {activeTab === "overview" && "Server Overview"}
              {activeTab === "roles" && "Roles"}
              {activeTab === "bans" && "Server Bans"}
            </h1>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              {activeTab === "overview" && (
                <div className="space-y-8 max-w-2xl">
                  <p className="text-muted-foreground">
                    Manage your server settings and view statistics
                  </p>

                  <div className="space-y-6">
                    <div className="flex items-start gap-6">
                      <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary shrink-0">
                        {serverName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Server Name
                          </label>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isLoading}
                            className="bg-secondary/50 border-0 h-11"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Description
                      </label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isLoading}
                        placeholder="Tell people what your server is about"
                        className="bg-secondary/50 border-0 h-11"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Discoverable</div>
                        <div className="text-xs text-muted-foreground">Allow this server to be found in public discovery</div>
                      </div>
                      <Switch
                        checked={isDiscoverable}
                        onCheckedChange={setIsDiscoverable}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Max Users
                        </label>
                        <Input
                          type="number"
                          value={maxUsers}
                          onChange={(e) => setMaxUsers(parseInt(e.target.value) || 0)}
                          disabled={isLoading}
                          className="bg-secondary/50 border-0 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Max Upload (MB)
                        </label>
                        <Input
                          type="number"
                          value={maxUploadSize}
                          onChange={(e) => setMaxUploadSize(parseInt(e.target.value) || 0)}
                          disabled={isLoading}
                          className="bg-secondary/50 border-0 h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Message Retention
                      </label>
                      <Input
                        value={messageRetention}
                        onChange={(e) => setMessageRetention(e.target.value)}
                        disabled={isLoading}
                        placeholder="e.g. 30d, 1y, forever"
                        className="bg-secondary/50 border-0 h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        How long to keep messages before deletion (e.g. '30d', '1y')
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={handleSaveSettings} disabled={isLoading || !hasChanges}>
                        {isLoading ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>

                  <div className="h-px bg-border/50" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl bg-secondary/30 space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Roles</span>
                      </div>
                      <p className="text-3xl font-bold">{roles.length}</p>
                    </div>
                    <div className="p-5 rounded-xl bg-secondary/30 space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Ban className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Bans</span>
                      </div>
                      <p className="text-3xl font-bold">{bans.length}</p>
                    </div>
                  </div>

                  {isOwner && (
                    <>
                      <div className="h-px bg-border/50" />
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-destructive uppercase tracking-wide">
                          Danger Zone
                        </h3>
                        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">Delete Server</div>
                            <div className="text-sm text-muted-foreground">
                              Permanently delete this server and all its data
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            onClick={() => setShowDeleteServerConfirm(true)}
                          >
                            Delete Server
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "roles" && (
                <div className="space-y-6 max-w-2xl">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">
                      Create and manage roles for your server members
                    </p>
                    <Button onClick={() => setShowCreateRole(true)} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Create Role
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                      </div>
                    ) : roles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                          <Shield className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-1">No Roles</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create roles to organize your server members
                        </p>
                        <Button onClick={() => setShowCreateRole(true)} variant="outline" className="gap-2">
                          <Plus className="w-4 h-4" />
                          Create Role
                        </Button>
                      </div>
                    ) : (
                      roles
                        .sort((a, b) => b.position - a.position)
                        .map((role) => (
                          <div
                            key={role.id}
                            className={`w-full flex items-center gap-3 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors group ${dragOverRoleId === role.id ? "ring-2 ring-primary/50" : ""}`}
                            data-role-id={role.id}
                          >
                            <button
                              type="button"
                              onPointerDown={(e) => {
                                setDragRoleId(role.id);
                                setDragOverRoleId(role.id);
                                setDragPointerId(e.pointerId);
                              }}
                              className="text-muted-foreground/70 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRole(role);
                                setSelectedRoleName(role.name);
                              }}
                              className="flex-1 flex items-center gap-4 text-left min-w-0"
                            >
                              <div
                                className="w-4 h-4 rounded-full shrink-0"
                                style={{ backgroundColor: role.color || "#71717a" }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate" style={{ color: role.color || 'inherit' }}>
                                  {role.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Drag to reorder • Click to edit
                                </div>
                              </div>
                              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "bans" && (
                <div className="space-y-6 max-w-2xl">
                  <p className="text-muted-foreground">
                    View and manage banned members
                  </p>

                  <div className="space-y-2">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                      </div>
                    ) : bans.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                          <Ban className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-1">No Banned Members</h3>
                        <p className="text-sm text-muted-foreground">
                          Members you ban from this server will appear here
                        </p>
                      </div>
                    ) : (
                      bans.map((ban) => (
                        <div
                          key={ban.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                              <Ban className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium">User {ban.user_id.slice(0, 8)}...</div>
                              <div className="text-xs text-muted-foreground">
                                Banned on {new Date(ban.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleUnban(ban.user_id)}
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                          >
                            Revoke Ban
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Add a new role to organize your server members
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRole} className="space-y-6">
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
              <Button type="button" variant="ghost" onClick={() => setShowCreateRole(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !newRoleName.trim()}>
                Create Role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Role
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{roleToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole} disabled={isLoading}>
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}