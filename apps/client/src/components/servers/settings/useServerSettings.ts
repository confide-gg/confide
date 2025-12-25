import { useState, useEffect, useCallback } from "react";
import { serverService } from "../../../features/servers/servers";
import { useServer } from "../../../context/server";
import type { ServerRole, ServerBan } from "../../../features/servers/types";
import type { Tab } from "./types";

interface UseServerSettingsParams {
  serverId: string;
  serverName: string;
  onClose: () => void;
}

export function useServerSettings({ serverId, serverName, onClose }: UseServerSettingsParams) {
  const { onRoleEvent, federatedClient, reloadServerData, deleteServer } = useServer();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ServerRole | null>(null);
  const [selectedRoleName, setSelectedRoleName] = useState("");

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

  const [showDeleteServerConfirm, setShowDeleteServerConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<ServerRole | null>(null);

  const hasChanges = name !== initialSettings.name ||
    description !== initialSettings.description ||
    isDiscoverable !== initialSettings.isDiscoverable ||
    maxUsers !== initialSettings.maxUsers ||
    maxUploadSize !== initialSettings.maxUploadSize ||
    messageRetention !== initialSettings.messageRetention;

  const loadServerSettings = useCallback(async () => {
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
  }, [federatedClient]);

  const handleSaveSettings = useCallback(async () => {
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
      await reloadServerData();
    } catch (error) {
      console.error("Failed to update settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [federatedClient, name, description, isDiscoverable, maxUsers, maxUploadSize, messageRetention, reloadServerData]);

  const handleDeleteServer = useCallback(async () => {
    setIsLoading(true);
    try {
      await deleteServer(serverId);
      onClose();
    } catch (error) {
      console.error("Failed to delete server:", error);
    } finally {
      setIsLoading(false);
    }
  }, [deleteServer, serverId, onClose]);

  const loadRoles = useCallback(async () => {
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
  }, [federatedClient, serverId]);

  const loadBans = useCallback(async () => {
    setIsLoading(true);
    try {
      const serverBans = await serverService.getServerBans(serverId);
      setBans(serverBans);
    } catch (error) {
      console.error("Failed to load bans:", error);
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  const handleCreateRole = useCallback(async (e: React.FormEvent) => {
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
  }, [federatedClient, serverId, newRoleName, newRolePermissions, newRoleColor, roles.length, loadRoles]);

  const handleUpdateRole = useCallback(async (roleId: string, updates: { permissions?: number; color?: string; position?: number; name?: string }) => {
    try {
      let updated: ServerRole;
      if (federatedClient) {
        updated = await federatedClient.updateRole(roleId, updates);
      } else {
        updated = await serverService.updateRole(serverId, roleId, updates);
      }
      loadRoles();
      return updated;
    } catch (error) {
      console.error("Failed to update role:", error);
      throw error;
    }
  }, [federatedClient, serverId, loadRoles]);

  const handleUpdateRoleName = useCallback(async () => {
    if (!selectedRole) return;
    const trimmed = selectedRoleName.trim();
    if (!trimmed || trimmed === selectedRole.name) return;
    setIsLoading(true);
    try {
      const updated = await handleUpdateRole(selectedRole.id, { name: trimmed });
      setSelectedRole(updated);
    } catch {
      setSelectedRoleName(selectedRole.name);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRole, selectedRoleName, handleUpdateRole]);

  const handleDeleteRole = useCallback(async () => {
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
  }, [federatedClient, serverId, roleToDelete, loadRoles]);

  const handleReorderRoles = useCallback(async (fromId: string, toId: string) => {
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
  }, [roles, federatedClient, serverId, loadRoles]);

  const handleUnban = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      await serverService.unbanMember(serverId, userId);
      loadBans();
    } catch (error) {
      console.error("Failed to unban member:", error);
    } finally {
      setIsLoading(false);
    }
  }, [serverId, loadBans]);

  const togglePermission = useCallback((perm: number) => {
    setNewRolePermissions(prev => prev ^ perm);
  }, []);

  const toggleRolePermission = useCallback((role: ServerRole, perm: number) => {
    const newPerms = role.permissions ^ perm;
    handleUpdateRole(role.id, { permissions: newPerms });
    setSelectedRole({ ...role, permissions: newPerms });
  }, [handleUpdateRole]);

  useEffect(() => {
    if (activeTab === "overview" && federatedClient) {
      loadServerSettings();
    }
  }, [activeTab, federatedClient, loadServerSettings]);

  useEffect(() => {
    if (activeTab === "roles" || activeTab === "overview") {
      loadRoles();
    }
    if (activeTab === "bans") {
      loadBans();
    }
  }, [activeTab, serverId, loadRoles, loadBans]);

  useEffect(() => {
    const unsubscribe = onRoleEvent((eventServerId: string) => {
      if (eventServerId === serverId && (activeTab === "roles" || activeTab === "overview")) {
        loadRoles();
      }
    });
    return () => unsubscribe();
  }, [serverId, activeTab, onRoleEvent, loadRoles]);

  return {
    activeTab,
    setActiveTab,
    roles,
    bans,
    isLoading,
    selectedRole,
    setSelectedRole,
    selectedRoleName,
    setSelectedRoleName,
    name,
    setName,
    description,
    setDescription,
    isDiscoverable,
    setIsDiscoverable,
    maxUsers,
    setMaxUsers,
    maxUploadSize,
    setMaxUploadSize,
    messageRetention,
    setMessageRetention,
    hasChanges,
    showCreateRole,
    setShowCreateRole,
    newRoleName,
    setNewRoleName,
    newRoleColor,
    setNewRoleColor,
    newRolePermissions,
    showDeleteServerConfirm,
    setShowDeleteServerConfirm,
    showDeleteConfirm,
    setShowDeleteConfirm,
    roleToDelete,
    setRoleToDelete,
    handleSaveSettings,
    handleDeleteServer,
    handleCreateRole,
    handleUpdateRole,
    handleUpdateRoleName,
    handleDeleteRole,
    handleReorderRoles,
    handleUnban,
    togglePermission,
    toggleRolePermission,
  };
}
