export interface SuccessResponse {
  success: boolean;
}

export interface WsPresence {
  type: "presence_update";
  data: {
    member_id: string;
    online: boolean;
    status?: string;
    custom_status?: string;
  };
}

export interface WsUpdatePresence {
  type: "update_presence";
  data: {
    status: string;
    custom_status?: string;
  };
}

export interface WsPresenceSync {
  type: "presence_sync";
  data: {
    online_users: string[];
  };
}
