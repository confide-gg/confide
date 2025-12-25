import { WsKeyExchange, WsKeyUpdate } from "../crypto/types";
import {
  WsCallAnswer,
  WsCallCancel,
  WsCallEnd,
  WsCallKeyComplete,
  WsCallLeave,
  WsCallMediaReady,
  WsCallMissed,
  WsCallMuteUpdate,
  WsCallOffer,
  WsCallReject,
  WsCallRejoin,
  WsScreenShareStart,
  WsScreenShareStop,
} from "../../features/calls/types";
import {
  WsGroupCreated,
  WsGroupDeleted,
  WsGroupMemberAdded,
  WsGroupMemberLeft,
  WsGroupMemberRemoved,
  WsGroupMetadataUpdated,
  WsGroupOwnerChanged,
  WsMessageDeleted,
  WsMessageEdited,
  WsMessagePinned,
  WsMessageUnpinned,
  WsNewMessage,
  WsReactionAdded,
  WsReactionRemoved,
  WsTyping,
  WsTypingStart,
  WsTypingStop,
  WsMemberRolesUpdated,
  WsRoleCreated,
  WsRoleUpdated,
  WsRoleDeleted,
} from "../../features/chat/types";
import { WsFriendAccepted, WsFriendRemoved, WsFriendRequest } from "../../features/friends/types";
import { WsActivityUpdate } from "../../features/profiles/types";
import { WsPresence, WsPresenceSync, WsUpdatePresence } from "../../shared/types/common";

export type WsMessage =
  | WsNewMessage
  | WsMessageDeleted
  | WsMessageEdited
  | WsMessagePinned
  | WsMessageUnpinned
  | WsReactionAdded
  | WsReactionRemoved
  | WsFriendRequest
  | WsFriendAccepted
  | WsFriendRemoved
  | WsKeyUpdate
  | WsGroupCreated
  | WsGroupMemberAdded
  | WsGroupMemberRemoved
  | WsGroupMemberLeft
  | WsGroupOwnerChanged
  | WsGroupDeleted
  | WsGroupMetadataUpdated
  | WsTyping
  | WsTypingStart
  | WsTypingStop
  | WsPresence
  | WsPresenceSync
  | WsUpdatePresence
  | WsKeyExchange
  | WsMemberRolesUpdated
  | WsRoleCreated
  | WsRoleUpdated
  | WsRoleDeleted
  | WsCallOffer
  | WsCallAnswer
  | WsCallKeyComplete
  | WsCallReject
  | WsCallCancel
  | WsCallEnd
  | WsCallMediaReady
  | WsCallMissed
  | WsCallLeave
  | WsCallRejoin
  | WsScreenShareStart
  | WsScreenShareStop
  | WsCallMuteUpdate
  | WsActivityUpdate;
