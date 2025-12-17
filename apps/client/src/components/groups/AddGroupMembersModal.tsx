import { useEffect, useMemo, useState } from "react";
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
import { groupService } from "../../features/groups/groupService";
import { addMemberEncryptionPayload } from "../../features/groups/groupEncryption";

interface AddGroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  conversationKey: number[];
  friends: Friend[];
  maxTotalMembers: number;
  onAdded?: () => void;
}

export function AddGroupMembersModal({
  isOpen,
  onClose,
  conversationId,
  conversationKey,
  friends,
  maxTotalMembers,
  onAdded,
}: AddGroupMembersModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelected(new Set());
    setError("");
    setExistingIds(new Set());
    (async () => {
      try {
        const members = await groupService.getMembers(conversationId);
        setExistingIds(new Set(members.map((m) => m.user.id)));
      } catch {
        setExistingIds(new Set());
      }
    })();
  }, [isOpen, conversationId]);

  const availableFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? friends.filter((f) => f.username.toLowerCase().includes(q)) : friends;
    return filtered.filter((f) => !existingIds.has(f.id));
  }, [friends, query, existingIds]);

  const remainingSlots = Math.max(0, maxTotalMembers - existingIds.size);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= remainingSlots) return next;
      next.add(id);
      return next;
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) return;
    setIsLoading(true);
    setError("");
    try {
      const members = [];
      for (const userId of Array.from(selected)) {
        const kem_public_key = friends.find((f) => f.id === userId)?.kem_public_key;
        const payload = await addMemberEncryptionPayload({
          conversationKey,
          userId,
          userKemPublicKey: kem_public_key,
        });
        members.push(payload);
      }

      if (members.length === 1) {
        await groupService.addMember(conversationId, members[0]);
      } else {
        await groupService.addMembersBulk(conversationId, { members });
      }

      onAdded?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add members");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="friendSearch">Select friends</Label>
              <div className="text-xs text-muted-foreground">
                {selected.size}/{remainingSlots} selected
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
              {availableFriends.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No friends available</div>
              ) : (
                <div className="p-2 space-y-1">
                  {availableFriends.map((f) => {
                    const isSelected = selected.has(f.id);
                    const disabled = !isSelected && selected.size >= remainingSlots;
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
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || selected.size === 0}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


