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
import { Label } from "../ui/label";
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
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
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
    setName("");
    setIcon("");
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
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Group name is required");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one friend");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await onCreate({
        name: trimmed,
        memberIds: Array.from(selected),
        icon: icon.trim() || undefined,
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
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Create Group</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group name</Label>
              <Input
                id="groupName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupIcon">Icon (optional)</Label>
              <Input
                id="groupIcon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                disabled={isLoading}
                className="bg-secondary/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="friendSearch">Add members</Label>
              <div className="text-xs text-muted-foreground">
                {selected.size}/9 selected
              </div>
            </div>
            <Input
              id="friendSearch"
              placeholder="Search friends"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
              className="bg-secondary/50"
            />
            <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-secondary/20">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No friends found</div>
              ) : (
                <div className="p-2 space-y-1">
                  {filtered.map((f) => {
                    const isSelected = selected.has(f.id);
                    const disabled = !isSelected && remainingSlots <= 0;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => !disabled && toggle(f.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors",
                          isSelected ? "bg-secondary text-foreground" : "hover:bg-secondary/60 text-muted-foreground",
                          disabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Avatar fallback={f.username} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{f.username}</div>
                        </div>
                        <div
                          className={cn(
                            "w-4 h-4 rounded border border-border",
                            isSelected ? "bg-primary border-primary" : "bg-background"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim() || selected.size === 0}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

