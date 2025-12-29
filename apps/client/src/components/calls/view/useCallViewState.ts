import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CallQuality, CallQualityStats } from "../types";

interface UseCallViewStateParams {
  isActive: boolean;
  connectedAt: string | null;
}

export function useCallViewState({ isActive, connectedAt }: UseCallViewStateParams) {
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<CallQuality>("good");
  const [stats, setStats] = useState<CallQualityStats | null>(null);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [isRejoining, setIsRejoining] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !connectedAt) return;

    const startTime = new Date(connectedAt).getTime();
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, connectedAt]);

  useEffect(() => {
    if (!isActive) return;

    const fetchStats = async () => {
      try {
        const s = await invoke<CallQualityStats>("get_call_stats");
        setStats(s);

        const lossRate = s.packets_sent > 0 ? s.packets_lost / s.packets_sent : 0;
        if (lossRate < 0.01 && s.jitter_ms < 20) {
          setQuality("excellent");
        } else if (lossRate < 0.03 && s.jitter_ms < 50) {
          setQuality("good");
        } else if (lossRate < 0.08 && s.jitter_ms < 100) {
          setQuality("fair");
        } else {
          setQuality("poor");
        }
      } catch (e) {
        console.error("Failed to get call stats:", e);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, [isActive]);

  return {
    duration,
    quality,
    stats,
    showScreenPicker,
    setShowScreenPicker,
    isRejoining,
    setIsRejoining,
    contentRef,
  };
}
