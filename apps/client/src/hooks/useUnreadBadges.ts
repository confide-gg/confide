import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UnreadCounts {
  [conversationId: string]: number;
}

interface BadgeOptions {
  count: number;
  showOnDock?: boolean;
  showOnTaskbar?: boolean;
  showOnTray?: boolean;
}

export function useUnreadBadges() {
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    checkBadgeSupport();
  }, []);

  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    setTotalUnread(total);
    updateSystemBadge(total);
  }, [unreadCounts]);

  const checkBadgeSupport = async () => {
    try {
      const platform = await import("@tauri-apps/plugin-os").then(os => os.platform());
      setSupported(["macos", "windows", "linux"].includes(platform));
    } catch (error) {
      setSupported(false);
    }
  };

  const updateSystemBadge = async (count: number) => {
    if (!supported) return;

    try {
      await updatePlatformBadge({ count });
    } catch (error) {
    }
  };

  const updatePlatformBadge = async (options: BadgeOptions) => {
    try {
      await invoke("update_app_badge", { count: options.count });
    } catch (error) {
      await updateBadgeFallback(options);
    }
  };

  const updateBadgeFallback = async (options: BadgeOptions) => {
    const platform = await import("@tauri-apps/plugin-os").then(os => os.platform());
    
    switch (platform) {
      case "macos":
        await updateMacOSBadge(options.count);
        break;
      case "windows":
        await updateWindowsBadge(options.count);
        break;
      case "linux":
        await updateLinuxBadge(options.count);
        break;
    }
  };

  const updateMacOSBadge = async (count: number) => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();

      if (count > 0) {
        await window.setTitle(`Confide (${count})`);
      } else {
        await window.setTitle("Confide");
      }
    } catch (error) {
    }
  };

  const updateWindowsBadge = async (count: number) => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();

      if (count > 0) {
        await window.setTitle(`Confide (${count})`);
      } else {
        await window.setTitle("Confide");
      }
    } catch (error) {
    }
  };

  const updateLinuxBadge = async (count: number) => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const window = getCurrentWindow();

      if (count > 0) {
        await window.setTitle(`Confide (${count})`);
      } else {
        await window.setTitle("Confide");
      }
    } catch (error) {
    }
  };

  const incrementUnread = useCallback((conversationId: string, increment = 1) => {
    setUnreadCounts(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || 0) + increment
    }));
  }, []);

  const decrementUnread = useCallback((conversationId: string, decrement = 1) => {
    setUnreadCounts(prev => {
      const current = prev[conversationId] || 0;
      const newCount = Math.max(0, current - decrement);
      
      if (newCount === 0) {
        const { [conversationId]: removed, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [conversationId]: newCount
      };
    });
  }, []);

  const clearUnread = useCallback((conversationId: string) => {
    setUnreadCounts(prev => {
      const { [conversationId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllUnread = useCallback(() => {
    setUnreadCounts({});
  }, []);

  const setUnread = useCallback((conversationId: string, count: number) => {
    if (count <= 0) {
      clearUnread(conversationId);
    } else {
      setUnreadCounts(prev => ({
        ...prev,
        [conversationId]: count
      }));
    }
  }, [clearUnread]);

  const getUnreadCount = useCallback((conversationId: string): number => {
    return unreadCounts[conversationId] || 0;
  }, [unreadCounts]);

  return {
    unreadCounts,
    totalUnread,
    supported,
    incrementUnread,
    decrementUnread,
    clearUnread,
    clearAllUnread,
    setUnread,
    getUnreadCount,
  };
}