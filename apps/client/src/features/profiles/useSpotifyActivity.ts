import { useEffect, useRef } from "react";
import { spotifyService } from "./spotify";

export function useSpotifyActivity(isConnected: boolean) {
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isConnected) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        const refreshActivity = async () => {
            try {
                await spotifyService.refreshActivityNow();
            } catch (error) {
                console.error("Failed to refresh Spotify activity:", error);
            }
        };

        refreshActivity();

        intervalRef.current = window.setInterval(refreshActivity, 3000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isConnected]);
}
