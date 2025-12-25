import { useEffect, useCallback } from "react";
import { ScrollArea } from "../../ui/scroll-area";
import { X, Settings, Shield, Ban } from "lucide-react";
import { Panel } from "../../layout/Panel";
import type { ServerSettingsProps, Tab } from "./types";
import { useServerSettings } from "./useServerSettings";
import { useRoleDrag } from "./useRoleDrag";
import { OverviewTab } from "./OverviewTab";
import { RolesTab } from "./RolesTab";
import { BansTab } from "./BansTab";
import { RoleEditor } from "./RoleEditor";
import { CreateRoleDialog, DeleteRoleDialog, DeleteServerDialog } from "./ServerSettingsDialogs";

export function ServerSettings({ serverId, serverName, isOwner, onClose }: ServerSettingsProps) {
  const settings = useServerSettings({ serverId, serverName, onClose });

  const { dragOverRoleId, startDrag } = useRoleDrag({
    onReorder: settings.handleReorderRoles,
  });

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !settings.showCreateRole && !settings.showDeleteConfirm) {
        if (settings.selectedRole) {
          settings.setSelectedRole(null);
        } else {
          onClose();
        }
      }
    },
    [
      onClose,
      settings.showCreateRole,
      settings.showDeleteConfirm,
      settings.selectedRole,
      settings.setSelectedRole,
    ]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  if (settings.selectedRole) {
    return (
      <>
        <RoleEditor
          role={settings.selectedRole}
          roleName={settings.selectedRoleName}
          isLoading={settings.isLoading}
          onBack={() => settings.setSelectedRole(null)}
          onRoleNameChange={settings.setSelectedRoleName}
          onRoleNameBlur={settings.handleUpdateRoleName}
          onColorChange={(color) => {
            settings.handleUpdateRole(settings.selectedRole!.id, { color });
            settings.setSelectedRole({ ...settings.selectedRole!, color });
          }}
          onTogglePermission={settings.toggleRolePermission}
          onDelete={() => {
            settings.setRoleToDelete(settings.selectedRole);
            settings.setShowDeleteConfirm(true);
          }}
        />

        <DeleteRoleDialog
          open={settings.showDeleteConfirm}
          onOpenChange={settings.setShowDeleteConfirm}
          role={settings.roleToDelete}
          isLoading={settings.isLoading}
          onConfirm={settings.handleDeleteRole}
        />

        <DeleteServerDialog
          open={settings.showDeleteServerConfirm}
          onOpenChange={settings.setShowDeleteServerConfirm}
          serverName={serverName}
          isLoading={settings.isLoading}
          onConfirm={settings.handleDeleteServer}
        />
      </>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: "overview", label: "Overview", icon: Settings },
    { id: "roles", label: "Roles", icon: Shield },
    { id: "bans", label: "Bans", icon: Ban },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background p-3 flex gap-3">
        <aside className="w-[240px] shrink-0">
          <Panel className="h-full flex flex-col">
            <div className="p-4">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide truncate">
                {serverName}
              </h2>
            </div>

            <ScrollArea className="flex-1">
              <nav className="space-y-1 px-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => settings.setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      settings.activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </Panel>
        </aside>

        <Panel className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-lg font-semibold">
              {settings.activeTab === "overview" && "Server Overview"}
              {settings.activeTab === "roles" && "Roles"}
              {settings.activeTab === "bans" && "Server Bans"}
            </h1>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 w-full max-w-4xl mx-auto">
              {settings.activeTab === "overview" && (
                <OverviewTab
                  serverName={serverName}
                  name={settings.name}
                  setName={settings.setName}
                  description={settings.description}
                  setDescription={settings.setDescription}
                  isDiscoverable={settings.isDiscoverable}
                  setIsDiscoverable={settings.setIsDiscoverable}
                  maxUsers={settings.maxUsers}
                  setMaxUsers={settings.setMaxUsers}
                  maxUploadSize={settings.maxUploadSize}
                  setMaxUploadSize={settings.setMaxUploadSize}
                  messageRetention={settings.messageRetention}
                  setMessageRetention={settings.setMessageRetention}
                  isLoading={settings.isLoading}
                  hasChanges={settings.hasChanges}
                  roles={settings.roles}
                  bans={settings.bans}
                  isOwner={isOwner}
                  onSaveSettings={settings.handleSaveSettings}
                  onShowDeleteServer={() => settings.setShowDeleteServerConfirm(true)}
                />
              )}

              {settings.activeTab === "roles" && (
                <RolesTab
                  roles={settings.roles}
                  isLoading={settings.isLoading}
                  dragOverRoleId={dragOverRoleId}
                  onCreateRole={() => settings.setShowCreateRole(true)}
                  onSelectRole={(role) => {
                    settings.setSelectedRole(role);
                    settings.setSelectedRoleName(role.name);
                  }}
                  onStartDrag={startDrag}
                />
              )}

              {settings.activeTab === "bans" && (
                <BansTab
                  bans={settings.bans}
                  isLoading={settings.isLoading}
                  onUnban={settings.handleUnban}
                />
              )}
            </div>
          </ScrollArea>
        </Panel>
      </div>

      <CreateRoleDialog
        open={settings.showCreateRole}
        onOpenChange={settings.setShowCreateRole}
        newRoleName={settings.newRoleName}
        setNewRoleName={settings.setNewRoleName}
        newRoleColor={settings.newRoleColor}
        setNewRoleColor={settings.setNewRoleColor}
        newRolePermissions={settings.newRolePermissions}
        togglePermission={settings.togglePermission}
        isLoading={settings.isLoading}
        onSubmit={settings.handleCreateRole}
      />

      <DeleteRoleDialog
        open={settings.showDeleteConfirm}
        onOpenChange={settings.setShowDeleteConfirm}
        role={settings.roleToDelete}
        isLoading={settings.isLoading}
        onConfirm={settings.handleDeleteRole}
      />
    </>
  );
}
