import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
  Settings,
  Lock,
  LockOpen,
  X,
  Loader2,
  Shield,
  AlertCircle,
  LogOut,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useServer } from "../../context/server";
import { Permissions, hasPermission } from "../../features/servers/permissions";
import type { FederatedServer } from "../../features/servers/types";

interface FederatedServerSettingsProps {
  server: FederatedServer;
  onClose: () => void;
}

type Tab = "overview" | "security";

export function FederatedServerSettings({ server, onClose }: FederatedServerSettingsProps) {
  const { federatedClient, leaveServer, deleteServer } = useServer();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isLoading, setIsLoading] = useState(false);

  const [hasPassword, setHasPassword] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [serverPassword, setServerPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);

  const [myPermissions, setMyPermissions] = useState(0);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !showPasswordDialog && !showLeaveConfirm && !showDeleteConfirm) {
      onClose();
    }
  }, [onClose, showPasswordDialog, showLeaveConfirm, showDeleteConfirm]);

  const handleLeaveServer = async () => {
    setIsLeaving(true);
    try {
      await leaveServer(server.id);
      setShowLeaveConfirm(false);
      onClose();
    } catch (error) {
      console.error("Failed to leave server:", error);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteServer = async () => {
    setIsDeleting(true);
    try {
      await deleteServer(server.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error("Failed to delete server:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    const loadServerInfo = async () => {
      if (!federatedClient) return;
      setIsLoading(true);
      try {
        const [info, perms] = await Promise.all([
          federatedClient.getServerInfo(),
          federatedClient.getMyPermissions(),
        ]);
        setHasPassword(info.has_password);
        setMyPermissions(perms);
      } catch (error) {
        console.error("Failed to load server info:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadServerInfo();
  }, [federatedClient]);

  const canManageServer = hasPermission(myPermissions, Permissions.ADMINISTRATOR) || server.is_owner;

  const handleSetPassword = async () => {
    if (!federatedClient) return;

    if (serverPassword.length < 4) {
      setPasswordError("Password must be at least 4 characters");
      return;
    }

    if (serverPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setIsLoadingPassword(true);
    setPasswordError("");

    try {
      await federatedClient.setServerPassword(serverPassword);
      setHasPassword(true);
      setShowPasswordDialog(false);
      setServerPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to set password");
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const handleRemovePassword = async () => {
    if (!federatedClient) return;

    setIsLoadingPassword(true);
    setPasswordError("");

    try {
      await federatedClient.removeServerPassword();
      setHasPassword(false);
      setShowPasswordDialog(false);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to remove password");
    } finally {
      setIsLoadingPassword(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background p-3 flex">
        <div className="w-[240px] flex flex-col mr-3">
          <div className="p-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide truncate">
              {server.name}
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

              {canManageServer && (
                <button
                  onClick={() => setActiveTab("security")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "security"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                >
                  <Shield className="w-4 h-4" />
                  Security
                </button>
              )}

              <div className="h-px bg-border/50 my-2" />

              {!server.is_owner && (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Server
                </button>
              )}

              {server.is_owner && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Server
                </button>
              )}
            </nav>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-bg-elevated rounded-xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h1 className="text-lg font-semibold">
              {activeTab === "overview" && "Server Overview"}
              {activeTab === "security" && "Security Settings"}
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
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {activeTab === "overview" && (
                    <div className="space-y-8 max-w-2xl">
                      <p className="text-muted-foreground">
                        View your server information
                      </p>

                      <div className="flex items-start gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary shrink-0">
                          {server.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Server Name
                            </label>
                            <Input
                              value={server.name}
                              disabled
                              className="bg-secondary/50 border-0 h-11"
                            />
                          </div>
                          {server.description && (
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Description
                              </label>
                              <Input
                                value={server.description}
                                disabled
                                className="bg-secondary/50 border-0 h-11"
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Domain
                            </label>
                            <Input
                              value={server.domain}
                              disabled
                              className="bg-secondary/50 border-0 h-11 font-mono text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-border/50" />

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-xl bg-secondary/30 space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Shield className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wide">Your Role</span>
                          </div>
                          <p className="text-lg font-semibold">
                            {server.is_owner ? "Owner" : hasPermission(myPermissions, Permissions.ADMINISTRATOR) ? "Administrator" : "Member"}
                          </p>
                        </div>
                        <div className="p-5 rounded-xl bg-secondary/30 space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {hasPassword ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                            <span className="text-xs font-semibold uppercase tracking-wide">Password</span>
                          </div>
                          <p className="text-lg font-semibold">
                            {hasPassword ? "Protected" : "Open"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "security" && canManageServer && (
                    <div className="space-y-8 max-w-2xl">
                      <p className="text-muted-foreground">
                        Manage security settings for your server
                      </p>

                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Server Password
                        </h3>
                        <div className="p-5 rounded-xl bg-secondary/30 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {hasPassword ? (
                                  <Lock className="w-5 h-5 text-primary" />
                                ) : (
                                  <LockOpen className="w-5 h-5 text-muted-foreground" />
                                )}
                                <span className="font-medium">
                                  {hasPassword ? "Password Protection Enabled" : "No Password Set"}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {hasPassword
                                  ? "New members must enter the password to join this server."
                                  : "Anyone can join this server without a password."}
                              </p>
                            </div>
                            <Button
                              onClick={() => setShowPasswordDialog(true)}
                              variant={hasPassword ? "outline" : "default"}
                            >
                              {hasPassword ? "Change Password" : "Set Password"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPasswordDialog(false);
          setServerPassword("");
          setConfirmPassword("");
          setPasswordError("");
        }
      }}>
        <DialogContent className="max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Server Password
            </DialogTitle>
            <DialogDescription>
              {hasPassword
                ? "Change or remove the password required to join this server."
                : "Set a password that users must enter to join this server."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {hasPassword && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                <Lock className="w-4 h-4 text-primary" />
                <span className="text-sm">Password protection is currently enabled</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="serverPassword">{hasPassword ? "New Password" : "Password"}</Label>
              <Input
                id="serverPassword"
                type="password"
                placeholder="Enter password (min 4 characters)"
                value={serverPassword}
                onChange={(e) => setServerPassword(e.target.value)}
                disabled={isLoadingPassword}
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoadingPassword}
                className="bg-secondary/50"
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {hasPassword && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemovePassword}
                disabled={isLoadingPassword}
                className="text-destructive hover:text-destructive"
              >
                {isLoadingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Remove Password"
                )}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setServerPassword("");
                  setConfirmPassword("");
                  setPasswordError("");
                }}
                disabled={isLoadingPassword}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSetPassword}
                disabled={isLoadingPassword || !serverPassword.trim() || !confirmPassword.trim()}
              >
                {isLoadingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : hasPassword ? (
                  "Update Password"
                ) : (
                  "Set Password"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Leave Server
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to leave <strong>{server.name}</strong>? You will need to rejoin with an invite to access this server again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLeaveConfirm(false)} disabled={isLeaving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeaveServer} disabled={isLeaving}>
              {isLeaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Leaving...
                </>
              ) : (
                "Leave Server"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Server
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{server.name}</strong>? This action cannot be undone and all data will be permanently lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteServer} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Server"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
