import { useEffect, useRef } from 'react';
import { usePresence } from '../context/PresenceContext';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

export function useIdleDetection() {
  const { updateMyPresence } = usePresence();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasIdleRef = useRef(false);
  const currentStatusRef = useRef<string>('online');

  const resetIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    if (wasIdleRef.current && currentStatusRef.current === 'online') {
      updateMyPresence('online');
      wasIdleRef.current = false;
    }

    idleTimerRef.current = setTimeout(() => {
      if (currentStatusRef.current === 'online') {
        updateMyPresence('away');
        wasIdleRef.current = true;
      }
    }, IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    const handleActivity = () => resetIdleTimer();

    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetIdleTimer();

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  return {
    currentStatus: currentStatusRef.current,
    setCurrentStatus: (status: string) => {
      currentStatusRef.current = status;
    }
  };
}
