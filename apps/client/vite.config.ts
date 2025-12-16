import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

const host = process.env.TAURI_DEV_HOST;
const port = process.env.PORT ? parseInt(process.env.PORT) : 1420;

export default defineConfig(async () => ({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
}));
