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
} from "lucide-react";
import { servers as serversApi, crypto } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useServer } from "../../context/ServerContext";
import { DecryptedRole, Permissions } from "../../types/servers";
import type { ServerRole, ServerBan } from "../../types/servers";

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

export function ServerSettings({ serverId, serverName, isOwner: _isOwner, onClose }: ServerSettingsProps) {
  const { keys } = useAuth();
  const { onRoleEvent } = useServer();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [decryptedRoles, setDecryptedRoles] = useState<DecryptedRole[]>([]);
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<DecryptedRole | null>(null);

  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#5865F2");
  const [newRolePermissions, setNewRolePermissions] = useState(0);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<DecryptedRole | null>(null);

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
    const unsubscribe = onRoleEvent((eventServerId) => {
      if (eventServerId === serverId && (activeTab === "roles" || activeTab === "overview")) {
        loadRoles();
      }
    });
    return () => unsubscribe();
  }, [serverId, activeTab, onRoleEvent]);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const serverRoles = await serversApi.getServerRoles(serverId);
      setRoles(serverRoles || []);

      if (keys && serverRoles) {
        const decrypted = await Promise.all(
          serverRoles.map(async (role) => {
            try {
              const nameBytes = await crypto.decryptData(
                keys.kem_secret_key,
                role.encrypted_name
              );
              const name = new TextDecoder().decode(new Uint8Array(nameBytes));
              return { ...role, name };
            } catch (error) {
              console.error("Failed to decrypt role:", error);
              return { ...role, name: "Unknown Role" };
            }
          })
        );
        setDecryptedRoles(decrypted);
      } else {
        setDecryptedRoles([]);
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
      setRoles([]);
      setDecryptedRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBans = async () => {
    setIsLoading(true);
    try {
      const serverBans = await serversApi.getServerBans(serverId);
      setBans(serverBans);
    } catch (error) {
      console.error("Failed to load bans:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim() || !keys) return;

    setIsLoading(true);
    try {
      const nameBytes = new TextEncoder().encode(newRoleName);
      const encryptedName = await crypto.encryptData(keys.kem_secret_key, Array.from(nameBytes));

      await serversApi.createRole(serverId, {
        encrypted_name: encryptedName,
        permissions: newRolePermissions,
        color: newRoleColor,
        position: roles.length,
      });

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

  const handleUpdateRole = async (roleId: string, updates: { permissions?: number; color?: string }) => {
    try {
      await serversApi.updateRole(serverId, roleId, updates);
      loadRoles();
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;

    setIsLoading(true);
    try {
      await serversApi.deleteRole(serverId, roleToDelete.id);
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

  const handleUnban = async (userId: string) => {
    setIsLoading(true);
    try {
      await serversApi.unbanMember(serverId, userId);
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

  const toggleRolePermission = (role: DecryptedRole, perm: number) => {
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
                <h2 className="font-semibold" style={{ color: selectedRole.color || 'inherit' }}>
                  {selectedRole.name}
                </h2>
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "overview"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Settings className="w-4 h-4" />
                Overview
              </button>

              <button
                onClick={() => setActiveTab("roles")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "roles"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Shield className="w-4 h-4" />
                Roles
              </button>

              <button
                onClick={() => setActiveTab("bans")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "bans"
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
                          value={serverName}
                          disabled
                          className="bg-secondary/50 border-0 h-11"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border/50" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl bg-secondary/30 space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Roles</span>
                      </div>
                      <p className="text-3xl font-bold">{decryptedRoles.length}</p>
                    </div>
                    <div className="p-5 rounded-xl bg-secondary/30 space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Ban className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Bans</span>
                      </div>
                      <p className="text-3xl font-bold">{bans.length}</p>
                    </div>
                  </div>
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
                    ) : decryptedRoles.length === 0 ? (
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
                      decryptedRoles
                        .sort((a, b) => b.position - a.position)
                        .map((role, index) => (
                        <button
                          key={role.id}
                          onClick={() => setSelectedRole(role)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors text-left group"
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
                              Position {decryptedRoles.length - index} • Click to edit
                            </div>
                          </div>
                          <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
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
