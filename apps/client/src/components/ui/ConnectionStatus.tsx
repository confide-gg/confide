import { useChat } from "../../context/chat";

export function ConnectionStatus() {
  const { isConnected, hasConnectedOnce } = useChat();

  if (isConnected) return null;

  if (!hasConnectedOnce) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 bg-muted/50 text-muted-foreground text-xs rounded-md">
        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        Connecting...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 bg-destructive/10 text-destructive text-xs rounded-md animate-in fade-in">
      <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
      Reconnecting...
    </div>
  );
}
