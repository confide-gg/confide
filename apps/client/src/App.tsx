import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";
import { AppProviders } from "./app/providers";
import { AppRoutes, ConditionalSnowEffect } from "./app/routes";
import "./App.css";

function App() {
  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await check();
        if (update) {
          toast(`Update available: v${update.version}`, {
            description: "A new version is ready to install.",
            duration: Infinity,
            action: {
              label: "Install & Restart",
              onClick: async () => {
                toast.loading("Downloading update...", { id: "update-progress" });
                await update.downloadAndInstall();
                toast.dismiss("update-progress");
                await relaunch();
              },
            },
          });
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
      }
    }
    checkForUpdates();
  }, []);

  return (
    <AppProviders>
      <AppRoutes />
      <ConditionalSnowEffect />
    </AppProviders>
  );
}

export default App;
