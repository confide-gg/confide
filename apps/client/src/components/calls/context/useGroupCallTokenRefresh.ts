import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GroupCallState, GroupCallMediaState } from "../types";
import { callService } from "../../../features/calls/calls";

interface UseGroupCallTokenRefreshParams {
  groupCallState: GroupCallState | null;
}

const TOKEN_CHECK_INTERVAL_MS = 60000;
const TOKEN_REFRESH_THRESHOLD_MS = 15 * 60 * 1000;

export function useGroupCallTokenRefresh({ groupCallState }: UseGroupCallTokenRefreshParams) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!groupCallState || groupCallState.status !== "active") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkTokenExpiry = async () => {
      try {
        const mediaState = await invoke<GroupCallMediaState>("get_group_call_media_state");

        if (mediaState.relay_token_expires_at) {
          const expiresAt = new Date(mediaState.relay_token_expires_at).getTime();
          const now = Date.now();
          const timeUntilExpiry = expiresAt - now;

          if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS && timeUntilExpiry > 0) {
            console.log("[GroupCall] Token expiring soon, refreshing...");

            const newCredentials = await callService.refreshGroupCallToken(groupCallState.call_id);

            await invoke("update_group_call_relay_token", {
              relayToken: newCredentials.relay_token,
              expiresAt: newCredentials.expires_at,
            });

            console.log("[GroupCall] Token refreshed successfully");
          }
        }
      } catch (e) {
        console.error("[GroupCall] Failed to check/refresh token:", e);
      }
    };

    intervalRef.current = setInterval(checkTokenExpiry, TOKEN_CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [groupCallState?.call_id, groupCallState?.status]);
}
