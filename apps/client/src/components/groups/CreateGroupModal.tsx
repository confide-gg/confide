import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar } from "../ui/avatar";
import { cn } from "@/lib/utils";
import type { Friend } from "../../features/friends/types";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: Friend[];
  onCreate: (data: { name: string; memberIds: string[]; icon?: string }) => Promise<void>;
}

export function CreateGroupModal({ isOpen, onClose, friends, onCreate }: CreateGroupModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.username.toLowerCase().includes(q));
  }, [friends, query]);

  const remainingSlots = 9 - selected.size;

  const resetAndClose = () => {
    setQuery("");
    setSelected(new Set());
    setError("");
    onClose();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= 9) return next;
      next.add(id);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) {
      setError("Select at least one friend");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const selectedUsernames = Array.from(selected)
        .map((id) => friends.find((f) => f.id === id)?.username)
        .filter(Boolean);
      const groupName = selectedUsernames.slice(0, 3).join(", ") + (selectedUsernames.length > 3 ? "..." : "");

      await onCreate({
        name: groupName,
        memberIds: Array.from(selected),
        icon: undefined,
      });
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && resetAndClose()}>
      <DialogContent className="max-w-md bg-card border-border p-0">
        <DialogHeader className="px-4 pt-6 pb-0">
          <DialogTitle className="text-xl font-semibold">Select Friends</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            You can add {remainingSlots} more friend{remainingSlots === 1 ? "" : "s"}.
          </p>
        </DialogHeader>

        <form onSubmit={handleCreate} className="flex flex-col">
          <div className="px-4 pb-4">
            <Input
              placeholder="Type the username of a friend"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
              className="bg-secondary/50"
            />
          </div>

          <div className="max-h-80 overflow-y-auto px-4">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No friends found</div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((f) => {
                  const isSelected = selected.has(f.id);
                  const disabled = !isSelected && remainingSlots <= 0;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => !disabled && toggle(f.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                        "hover:bg-secondary/60",
                        disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Avatar fallback={f.username} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{f.username}</div>
                      </div>
                      <div
                        className={cn(
                          "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-muted-foreground bg-transparent"
                        )}
                      >
                        {isSelected && (
                          <svg className="w-4 h-4 text-primary-foreground" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 text-sm text-destructive bg-destructive/10 mx-4 rounded-md mt-2">
              {error}
            </div>
          )}

          <DialogFooter className="px-4 py-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || selected.size === 0}
            >
              Create DM
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

