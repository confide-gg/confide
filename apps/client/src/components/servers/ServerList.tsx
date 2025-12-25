import { useServer } from "../../context/server";
import { Home, Plus } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";

export function ServerList() {
  const { servers, activeServer, setActiveServer, createServer } = useServer();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverDescription, setServerDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) return;

    setIsCreating(true);
    try {
      await createServer(serverName, serverDescription || undefined);
      setServerName("");
      setServerDescription("");
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to create server:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setShowCreateModal(false);
    setServerName("");
    setServerDescription("");
  };

  return (
    <div className="flex flex-col items-center w-[72px] bg-background border-r border-border/50 py-3 gap-2 shrink-0">
      <button
        onClick={() => setActiveServer(null)}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
          !activeServer
            ? "bg-primary rounded-xl"
            : "bg-bg-elevated hover:bg-primary hover:rounded-xl"
        }`}
        title="Home"
      >
        <Home className="w-5 h-5 text-foreground" />
      </button>

      <div className="w-8 h-[2px] bg-border rounded-full" />

      {servers.map((server) => (
        <button
          key={server.id}
          onClick={() => setActiveServer(server)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all font-semibold ${
            activeServer?.id === server.id
              ? "bg-primary rounded-xl text-foreground"
              : "bg-bg-elevated hover:bg-primary hover:rounded-xl text-muted-foreground hover:text-foreground"
          }`}
          title={server.name}
        >
          {server.icon_url ? (
            <img src={server.icon_url} alt={server.name} className="w-full h-full rounded-2xl object-cover" />
          ) : (
            <span className="text-sm">
              {server.name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          )}
        </button>
      ))}

      <button
        onClick={() => setShowCreateModal(true)}
        className="w-12 h-12 rounded-2xl bg-bg-elevated hover:bg-primary hover:rounded-xl flex items-center justify-center transition-all group"
        title="Create Server"
      >
        <Plus className="w-5 h-5 text-primary group-hover:text-foreground transition-colors" />
      </button>

      <Dialog open={showCreateModal} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-[460px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create Server</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateServer} className="space-y-4">
            <div>
              <label htmlFor="serverName" className="block text-sm font-medium text-foreground mb-1">
                Server Name *
              </label>
              <input
                type="text"
                id="serverName"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="My Awesome Server"
                autoFocus
                required
              />
            </div>
            <div>
              <label htmlFor="serverDesc" className="block text-sm font-medium text-foreground mb-1">
                Description (optional)
              </label>
              <textarea
                id="serverDesc"
                value={serverDescription}
                onChange={(e) => setServerDescription(e.target.value)}
                className="w-full px-3 py-2 bg-bg-elevated text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="A place to hang out..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !serverName.trim()}
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
