import { useState } from "react";
import type { DmPreview } from "@/types";

export function useDmState() {
  const [dmPreviews, setDmPreviews] = useState<DmPreview[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  return {
    dmPreviews,
    setDmPreviews,
    unreadCounts,
    setUnreadCounts,
  };
}
