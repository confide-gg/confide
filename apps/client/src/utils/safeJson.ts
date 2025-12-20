export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    console.warn('[JSON] Parse failed:', str);
    return fallback;
  }
}
