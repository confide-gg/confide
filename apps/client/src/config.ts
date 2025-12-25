const DEV_API_URL = "http://localhost:3000/api";
const DEV_WS_URL = "ws://localhost:3000";

function getApiUrl(): string {
  const url = import.meta.env.VITE_CENTRAL_API_URL;
  if (url) {
    if (!import.meta.env.DEV && !url.startsWith("https://")) {
      throw new Error("VITE_CENTRAL_API_URL must use HTTPS in production");
    }
    return url;
  }
  if (import.meta.env.DEV) {
    return DEV_API_URL;
  }
  throw new Error("VITE_CENTRAL_API_URL is required in production");
}

function getWsUrl(): string {
  const url = import.meta.env.VITE_CENTRAL_WS_URL;
  if (url) {
    if (!import.meta.env.DEV && !url.startsWith("wss://")) {
      throw new Error("VITE_CENTRAL_WS_URL must use WSS in production");
    }
    return url;
  }
  if (import.meta.env.DEV) {
    return DEV_WS_URL;
  }
  throw new Error("VITE_CENTRAL_WS_URL is required in production");
}

export const CENTRAL_API_URL = getApiUrl();
export const CENTRAL_WS_URL = getWsUrl();

declare const __APP_VERSION__: string;
export const CLIENT_VERSION = __APP_VERSION__;
