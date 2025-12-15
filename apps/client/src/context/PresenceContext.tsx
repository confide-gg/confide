import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { centralWebSocketService } from "../core/network/CentralWebSocketService";
import { useAuth } from "./AuthContext";

export interface UserPresence {
  status: string; // "online", "idle", "dnd", "invisible"
  customStatus?: string;
  isOnline: boolean;
}

interface PresenceContextType {
  userPresence: Map<string, UserPresence>;
  isOnline: (userId: string) => boolean;
  getUserPresence: (userId: string) => UserPresence | undefined;
  updateMyPresence: (status: string, customStatus?: string) => void;
  subscribeToUsers: (userIds: string[]) => void;
  isWsConnected: boolean;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
  const [isWsConnected, setIsWsConnected] = useState(false);
  const subscribedUsersRef = useRef<Set<string>>(new Set());
  const pendingSubscriptionsRef = useRef<Set<string>>(new Set());
  const activeSubscriptionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      centralWebSocketService.disconnect();
      setIsWsConnected(false);
      return;
    }

    const unsubscribeMessage = centralWebSocketService.onMessage((message) => {
      switch (message.type) {
        case "presence_update":
          setUserPresence((prev) => {
            const next = new Map(prev);
            if (message.data.online) {
              next.set(message.data.member_id, {
                status: message.data.status || "online",
                customStatus: message.data.custom_status,
                isOnline: true,
              });
            } else {
              next.delete(message.data.member_id);
            }
            return next;
          });
          break;

        case "presence_sync":
          setUserPresence(() => {
            const next = new Map();
            const presences = (message.data as any).presences || message.data.online_users || [];
            presences.forEach((presenceInfo: any) => {
              next.set(presenceInfo.member_id || presenceInfo.user_id, {
                status: presenceInfo.status || "online",
                customStatus: presenceInfo.custom_status,
                isOnline: true,
              });
            });
            return next;
          });
          break;
      }
    });

    const handleConnect = () => {
      setIsWsConnected(true);
      activeSubscriptionsRef.current.clear();
      for (const userId of subscribedUsersRef.current) {
        centralWebSocketService.subscribeUser(userId);
        activeSubscriptionsRef.current.add(userId);
      }
      for (const userId of pendingSubscriptionsRef.current) {
        if (!activeSubscriptionsRef.current.has(userId)) {
          centralWebSocketService.subscribeUser(userId);
          subscribedUsersRef.current.add(userId);
          activeSubscriptionsRef.current.add(userId);
        }
      }
      pendingSubscriptionsRef.current.clear();
    };

    const unsubscribeConnect = centralWebSocketService.onConnect(handleConnect);

    const unsubscribeDisconnect = centralWebSocketService.onDisconnect(() => {
      setIsWsConnected(false);
      activeSubscriptionsRef.current.clear();
    });

    if (centralWebSocketService.isConnected()) {
      handleConnect();
    } else {
      centralWebSocketService.connect();
    }

    return () => {
      unsubscribeMessage();
      unsubscribeConnect();
      unsubscribeDisconnect();
      centralWebSocketService.disconnect();
    };
  }, [user?.id]);

  const isOnline = (userId: string) => userPresence.has(userId);

  const getUserPresence = (userId: string) => userPresence.get(userId);

  const updateMyPresence = (status: string, customStatus?: string) => {
    if (user) {
      setUserPresence(prev => {
        const next = new Map(prev);
        next.set(user.id, { status, customStatus, isOnline: true });
        return next;
      });
      centralWebSocketService.updatePresence(status, customStatus);
    }
  };

  const subscribeToUsers = useCallback((userIds: string[]) => {
    for (const userId of userIds) {
      if (subscribedUsersRef.current.has(userId)) continue;

      if (isWsConnected) {
        centralWebSocketService.subscribeUser(userId);
        subscribedUsersRef.current.add(userId);
        activeSubscriptionsRef.current.add(userId);
      } else {
        pendingSubscriptionsRef.current.add(userId);
      }
    }
  }, [isWsConnected]);

  const value = {
    userPresence,
    isOnline,
    getUserPresence,
    updateMyPresence,
    subscribeToUsers,
    isWsConnected,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) throw new Error("usePresence must be used within PresenceProvider");
  return context;
};