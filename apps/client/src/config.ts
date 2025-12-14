export const CENTRAL_API_URL = import.meta.env.VITE_CENTRAL_API_URL || "http://localhost:3000/api";
export const CENTRAL_WS_URL = import.meta.env.VITE_CENTRAL_WS_URL || "ws://localhost:3000";

declare const __APP_VERSION__: string;
export const CLIENT_VERSION = __APP_VERSION__;
