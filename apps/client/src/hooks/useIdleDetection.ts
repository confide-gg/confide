import { useEffect, useRef } from "react";
import { usePresence } from "../context/PresenceContext";
import { useAuth } from "../context/AuthContext";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];

export function useIdleDetection() {
  const { updateMyPresence, getUserPresence } = usePresence();
  const { user, profile } = useAuth();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasIdleRef = useRef(false);

  const getMyStatus = () => {
    if (!user) return "online";
    const presence = getUserPresence(user.id);
    return presence?.status || profile?.status || "online";
  };

  const getMyStatusRef = useRef(getMyStatus);
  getMyStatusRef.current = getMyStatus;

  useEffect(() => {
    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      const currentStatus = getMyStatusRef.current();
      if (wasIdleRef.current && currentStatus === "away") {
        updateMyPresence("online");
        wasIdleRef.current = false;
      }

      idleTimerRef.current = setTimeout(() => {
        const status = getMyStatusRef.current();
        if (status === "online") {
          updateMyPresence("away");
          wasIdleRef.current = true;
        }
      }, IDLE_TIMEOUT_MS);
    };

    const handleActivity = () => resetIdleTimer();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetIdleTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [updateMyPresence]);
}
