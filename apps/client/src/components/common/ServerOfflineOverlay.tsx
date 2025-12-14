import { WifiOff } from "lucide-react";
import { Button } from "../ui/button";
import { wsService } from "../../api";
import { useState } from "react";

export function ServerOfflineOverlay() {
    const [isRetrying, setIsRetrying] = useState(false);

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            await wsService.connect();
        } catch (e) {
            console.error("Failed to reconnect manually", e);
        } finally {
            setIsRetrying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-8 flex flex-col items-center text-center space-y-6">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <WifiOff className="h-8 w-8 text-destructive" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Connection Lost</h2>
                    <p className="text-muted-foreground">
                        Unable to connect to the server.
                    </p>
                </div>

                <div className="flex gap-4">
                    <Button
                        variant="default"
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="min-w-[120px]"
                    >
                        {isRetrying ? "Connecting..." : "Try Again"}
                    </Button>
                </div>

                <p className="text-xs text-muted-foreground animate-pulse">
                    Attempting to reconnect automatically...
                </p>
            </div>
        </div>
    );
}
