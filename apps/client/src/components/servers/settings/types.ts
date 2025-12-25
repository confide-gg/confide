import { Permissions } from "../../../features/servers/permissions";
import type { ServerRole, ServerBan } from "../../../features/servers/types";

export interface ServerSettingsProps {
  serverId: string;
  serverName: string;
  isOwner: boolean;
  onClose: () => void;
}

export type Tab = "overview" | "roles" | "bans";

export interface ServerSettingsState {
  activeTab: Tab;
  roles: ServerRole[];
  bans: ServerBan[];
  isLoading: boolean;
  selectedRole: ServerRole | null;
  selectedRoleName: string;
  name: string;
  description: string;
  isDiscoverable: boolean;
  maxUsers: number;
  maxUploadSize: number;
  messageRetention: string;
  showCreateRole: boolean;
  newRoleName: string;
  newRoleColor: string;
  newRolePermissions: number;
  showDeleteServerConfirm: boolean;
  showDeleteConfirm: boolean;
  roleToDelete: ServerRole | null;
}

export const PERMISSION_GROUPS = [
  {
    name: "General Server Permissions",
    permissions: [
      {
        name: "Administrator",
        value: Permissions.ADMINISTRATOR,
        description:
          "Members with this permission have every permission and can bypass channel-specific permissions.",
      },
      {
        name: "Manage Server",
        value: Permissions.MANAGE_SERVER,
        description: "Allows members to change the server name and other settings.",
      },
      {
        name: "Manage Roles",
        value: Permissions.MANAGE_ROLES,
        description: "Allows members to create, edit, and delete roles below their highest role.",
      },
      {
        name: "Manage Channels",
        value: Permissions.MANAGE_CHANNELS,
        description: "Allows members to create, edit, and delete channels.",
      },
    ],
  },
  {
    name: "Membership Permissions",
    permissions: [
      {
        name: "Create Invite",
        value: Permissions.CREATE_INVITE,
        description: "Allows members to invite new people to this server.",
      },
      {
        name: "Kick Members",
        value: Permissions.KICK_MEMBERS,
        description: "Allows members to remove other members from this server.",
      },
      {
        name: "Ban Members",
        value: Permissions.BAN_MEMBERS,
        description: "Allows members to permanently ban other members from this server.",
      },
    ],
  },
  {
    name: "Text Channel Permissions",
    permissions: [
      {
        name: "View Channels",
        value: Permissions.VIEW_CHANNELS,
        description: "Allows members to view channels by default.",
      },
      {
        name: "Read Messages",
        value: Permissions.READ_MESSAGES,
        description: "Allows members to read message history in channels.",
      },
      {
        name: "Send Messages",
        value: Permissions.SEND_MESSAGES,
        description: "Allows members to send messages in text channels.",
      },
      {
        name: "Manage Messages",
        value: Permissions.MANAGE_MESSAGES,
        description: "Allows members to delete messages by other members.",
      },
      {
        name: "Mention Everyone",
        value: Permissions.MENTION_EVERYONE,
        description: "Allows members to use @everyone to notify all members.",
      },
    ],
  },
];
