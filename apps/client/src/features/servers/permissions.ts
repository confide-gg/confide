export const Permissions = {
  NONE: 0,
  CREATE_INVITE: 1 << 0,
  KICK_MEMBERS: 1 << 1,
  BAN_MEMBERS: 1 << 2,
  MANAGE_CHANNELS: 1 << 3,
  MANAGE_SERVER: 1 << 4,
  READ_MESSAGES: 1 << 5,
  SEND_MESSAGES: 1 << 6,
  MANAGE_MESSAGES: 1 << 7,
  MENTION_EVERYONE: 1 << 8,
  ADMINISTRATOR: 1 << 9,
  MANAGE_ROLES: 1 << 10,
  VIEW_CHANNELS: 1 << 11,
} as const;

export function hasPermission(userPerms: number, required: number): boolean {
  if (userPerms & Permissions.ADMINISTRATOR) {
    return true;
  }
  return (userPerms & required) !== 0;
}
