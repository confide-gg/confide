import type { TimedMessageDuration } from "../../../types";

export const FILE_SIZE_LIMIT = 100 * 1024 * 1024;

export const TIMED_OPTIONS: { label: string; value: TimedMessageDuration }[] = [
  { label: "Off", value: null },
  { label: "5s", value: 5 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
];

export function hasActiveShortcode(text: string): boolean {
  return /:([a-zA-Z0-9_+-]{2,})$/.test(text);
}
