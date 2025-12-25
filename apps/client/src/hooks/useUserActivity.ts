import { usePresence } from "../context/PresenceContext";
import type { UserActivity } from "../features/profiles/types";

export function useUserActivity(userId: string): UserActivity | null | undefined {
  const { getUserActivity } = usePresence();
  return getUserActivity(userId);
}
