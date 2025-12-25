export const queryKeys = {
  all: ["confide"] as const,

  conversations: {
    all: ["conversations"] as const,
    lists: () => [...queryKeys.conversations.all, "list"] as const,
    list: () => [...queryKeys.conversations.lists()] as const,
    details: () => [...queryKeys.conversations.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.conversations.details(), id] as const,
    members: (id: string) => [...queryKeys.conversations.detail(id), "members"] as const,
  },

  messages: {
    all: ["messages"] as const,
    lists: () => [...queryKeys.messages.all, "list"] as const,
    list: (conversationId: string) => [...queryKeys.messages.lists(), conversationId] as const,
    infinite: (conversationId: string) => [...queryKeys.messages.lists(), conversationId, "infinite"] as const,
    pinned: (conversationId: string) => [...queryKeys.messages.list(conversationId), "pinned"] as const,
  },

  friends: {
    all: ["friends"] as const,
    lists: () => [...queryKeys.friends.all, "list"] as const,
    list: () => [...queryKeys.friends.lists()] as const,
    requests: () => [...queryKeys.friends.all, "requests"] as const,
  },

  servers: {
    all: ["servers"] as const,
    lists: () => [...queryKeys.servers.all, "list"] as const,
    list: () => [...queryKeys.servers.lists()] as const,
    details: () => [...queryKeys.servers.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.servers.details(), id] as const,
    members: (id: string) => [...queryKeys.servers.detail(id), "members"] as const,
    categories: (id: string) => [...queryKeys.servers.detail(id), "categories"] as const,
    channels: (id: string) => [...queryKeys.servers.detail(id), "channels"] as const,
    roles: (id: string) => [...queryKeys.servers.detail(id), "roles"] as const,
    invites: (id: string) => [...queryKeys.servers.detail(id), "invites"] as const,
    bans: (id: string) => [...queryKeys.servers.detail(id), "bans"] as const,
    channelPermissions: (serverId: string, channelId: string) =>
      [...queryKeys.servers.detail(serverId), "channels", channelId, "permissions"] as const,
  },
};
