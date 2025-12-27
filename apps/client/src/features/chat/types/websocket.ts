export interface WsNewMessage {
  type: "new_message";
  data: {
    id: string;
    conversation_id?: string;
    channel_id?: string;
    sender_id: string;
    encrypted_content: number[];
    signature: number[];
    sender_dsa_public_key?: number[];
    reply_to_id: string | null;
    expires_at: string | null;
    sender_chain_id?: number | null;
    sender_chain_iteration?: number | null;
    created_at: string;
    message_type?: string;
    call_id?: string | null;
    call_duration_seconds?: number | null;
    pinned_at?: string | null;
    sender_username: string;
  };
}

export interface WsMessageDeleted {
  type: "message_deleted";
  data: {
    message_id: string;
    conversation_id?: string;
    channel_id?: string;
  };
}

export interface WsMessageEdited {
  type: "message_edited";
  data: {
    message_id: string;
    conversation_id: string;
    encrypted_content: number[];
    signature: number[];
    edited_at: string;
  };
}

export interface WsMessagePinned {
  type: "message_pinned";
  data: {
    message_id: string;
    conversation_id: string;
    pinner_id: string;
    pinned_at: string;
  };
}

export interface WsMessageUnpinned {
  type: "message_unpinned";
  data: {
    message_id: string;
    conversation_id: string;
    unpinner_id: string;
  };
}

export interface WsReactionAdded {
  type: "reaction_added";
  data: {
    id: string;
    message_id: string;
    conversation_id: string;
    user_id: string;
    emoji: string;
  };
}

export interface WsReactionRemoved {
  type: "reaction_removed";
  data: {
    message_id: string;
    conversation_id: string;
    user_id: string;
    emoji: string;
  };
}

export interface WsGroupMemberAdded {
  type: "group_member_added";
  data: {
    conversation_id: string;
    user_id: string;
    added_by: string;
  };
}

export interface WsGroupMemberRemoved {
  type: "group_member_removed";
  data: {
    conversation_id: string;
    user_id: string;
    removed_by: string;
  };
}

export interface WsGroupMemberLeft {
  type: "group_member_left";
  data: {
    conversation_id: string;
    user_id: string;
  };
}

export interface WsGroupCreated {
  type: "group_created";
  data: {
    conversation_id: string;
    owner_id: string;
  };
}

export interface WsGroupOwnerChanged {
  type: "group_owner_changed";
  data: {
    conversation_id: string;
    old_owner_id: string;
    new_owner_id: string;
    changed_by: string;
  };
}

export interface WsGroupDeleted {
  type: "group_deleted";
  data: {
    conversation_id: string;
    deleted_by: string;
  };
}

export interface WsGroupMetadataUpdated {
  type: "group_metadata_updated";
  data: {
    conversation_id: string;
    updated_by: string;
  };
}

export interface WsTyping {
  type: "typing";
  data: {
    conversation_id: string;
    user_id: string | null;
    is_typing: boolean;
  };
}

export interface WsMemberRolesUpdated {
  type: "member_roles_updated";
  data: {
    server_id: string;
    user_id: string;
    role_ids: string[];
  };
}

export interface WsRoleCreated {
  type: "role_created";
  data: {
    server_id: string;
    role_id: string;
    encrypted_name: number[];
    color: string | null;
    permissions: number;
    position: number;
  };
}

export interface WsRoleUpdated {
  type: "role_updated";
  data: {
    server_id: string;
    role_id: string;
    encrypted_name: number[] | null;
    color: string | null;
    permissions: number | null;
  };
}

export interface WsRoleDeleted {
  type: "role_deleted";
  data: {
    server_id: string;
    role_id: string;
  };
}

export interface WsTypingStart {
  type: "typing_start";
  data: {
    channel_id: string;
    member_id: string;
    username: string;
  };
}

export interface WsTypingStop {
  type: "typing_stop";
  data: {
    channel_id: string;
    member_id: string;
  };
}
