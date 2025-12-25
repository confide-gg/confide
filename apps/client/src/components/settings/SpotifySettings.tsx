import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Music, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { spotifyService } from "../../features/profiles/spotify";
import { useSpotifyActivity } from "../../features/profiles/useSpotifyActivity";
import type { SpotifyStatus } from "../../features/profiles/types";
import { open } from "@tauri-apps/plugin-shell";

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </Label>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function SpotifySettings() {
  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useSpotifyActivity(status?.connected ?? false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await spotifyService.getStatus();
      setStatus(data);
    } catch (error) {
      console.error("Failed to load Spotify status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const { auth_url } = await spotifyService.connect();
      await open(auth_url);

      const checkInterval = setInterval(async () => {
        const newStatus = await spotifyService.getStatus();
        if (newStatus.connected) {
          setStatus(newStatus);
          clearInterval(checkInterval);
          setConnecting(false);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(checkInterval);
        setConnecting(false);
      }, 60000);
    } catch (error) {
      console.error("Failed to connect Spotify:", error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await spotifyService.disconnect();
      setStatus({ connected: false, display_in_profile: false });
    } catch (error) {
      console.error("Failed to disconnect Spotify:", error);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-8 pr-2">
        <SettingsSection title="Spotify">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#1DB954] rounded-lg flex items-center justify-center shrink-0">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">Spotify</span>
                  {status?.connected && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 text-xs font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {!status?.connected
                    ? "Display what you're listening to on Spotify in real-time"
                    : "Your friends can see what you're listening to in real-time"}
                </p>
              </div>
            </div>

            {!status?.connected ? (
              <div className="space-y-3">
                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="bg-[#1DB954] hover:bg-[#1ed760] text-white h-10"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Waiting for authorization...
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4 mr-2" />
                      Connect Spotify
                    </>
                  )}
                </Button>
                {connecting && (
                  <p className="text-xs text-muted-foreground">
                    A browser window has opened. Please authorize Confide to access your Spotify.
                  </p>
                )}
              </div>
            ) : (
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="h-10 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            )}
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
