import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { centralWebSocketService } from "../core/network/CentralWebSocketService";
import { useAuth } from "./AuthContext";
import type { UserActivity } from "../features/profiles/types";
import { SubscriptionManager } from "../core/network/SubscriptionManager";

export interface UserPresence {
  status: string; // "online", "idle", "dnd", "invisible"
  customStatus?: string;
  isOnline: boolean;
}

interface PresenceContextType {
  userPresence: Map<string, UserPresence>;
  userActivities: Map<string, UserActivity | null>;
  isOnline: (userId: string) => boolean;
  getUserPresence: (userId: string) => UserPresence | undefined;
  getUserActivity: (userId: string) => UserActivity | null | undefined;
  updateMyPresence: (status: string, customStatus?: string) => void;
  subscribeToUsers: (userIds: string[]) => void;
  isWsConnected: boolean;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
  const [userActivities, setUserActivities] = useState<Map<string, UserActivity | null>>(new Map());
  const [isWsConnected, setIsWsConnected] = useState(false);
  const subscriptionManagerRef = useRef(new SubscriptionManager());

  useEffect(() => {
    if (!user) {
      centralWebSocketService.disconnect();
      setIsWsConnected(false);
      setUserPresence(new Map());
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

        case "activity_update":
          setUserActivities((prev) => {
            const next = new Map(prev);
            const activityData = message.data as { user_id: string; activity: UserActivity | null };
            next.set(activityData.user_id, activityData.activity);
            return next;
          });
          break;
      }
    });

    const handleConnect = () => {
      setIsWsConnected(true);
      setUserPresence(new Map());
      subscriptionManagerRef.current.onReconnect((userId) => {
        centralWebSocketService.subscribeUser(userId);
      });
    };

    const unsubscribeConnect = centralWebSocketService.onConnect(handleConnect);

    const unsubscribeDisconnect = centralWebSocketService.onDisconnect(() => {
      setIsWsConnected(false);
      setUserPresence(new Map());
    });

    const connectWithRetry = async () => {
      try {
        if (centralWebSocketService.isConnected()) {
          handleConnect();
        } else {
          await centralWebSocketService.connect();
        }
      } catch (err) {
        console.error("Failed to connect to presence WebSocket:", err);
        setIsWsConnected(false);
      }
    };

    const timer = setTimeout(() => {
      connectWithRetry();
    }, 100);

    return () => {
      clearTimeout(timer);
      unsubscribeMessage();
      unsubscribeConnect();
      unsubscribeDisconnect();
      centralWebSocketService.disconnect();
    };
  }, [user?.id]);

  const isOnline = (userId: string) => userPresence.has(userId);

  const getUserPresence = (userId: string) => userPresence.get(userId);

  const getUserActivity = (userId: string) => userActivities.get(userId);

  const updateMyPresence = (status: string, customStatus?: string) => {
    if (user) {
      setUserPresence((prev) => {
        const next = new Map(prev);
        next.set(user.id, { status, customStatus, isOnline: true });
        return next;
      });
      centralWebSocketService.updatePresence(status, customStatus);
    }
  };

  const subscribeToUsers = useCallback(
    (userIds: string[]) => {
      for (const userId of userIds) {
        if (!subscriptionManagerRef.current.subscribe(userId, "user")) continue;

        if (isWsConnected) {
          centralWebSocketService.subscribeUser(userId);
          subscriptionManagerRef.current.markActive(userId);
        }
      }
    },
    [isWsConnected]
  );

  const value = {
    userPresence,
    userActivities,
    isOnline,
    getUserPresence,
    getUserActivity,
    updateMyPresence,
    subscribeToUsers,
    isWsConnected,
  };

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) throw new Error("usePresence must be used within PresenceProvider");
  return context;
};
