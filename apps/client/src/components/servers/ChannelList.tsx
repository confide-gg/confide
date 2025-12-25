import { useServer } from "../../context/server";
import {
  Hash,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  Loader2,
  GripVertical,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "../../lib/utils";
import { UserProfile } from "../sidebar/UserProfile";
import { isFederatedServer } from "../../features/servers/types";
import { ServerSettings } from "./settings";
import { Panel } from "../layout/Panel";
import { serverService } from "../../features/servers/servers";
import { ChannelSidebarContextMenu } from "./ChannelSidebarContextMenu";

export function ChannelList() {
  const {
    activeServer,
    categories,
    channels,
    activeChannel,
    setActiveChannel,
    createChannel,
    createCategory,
    reloadServerData,
    federatedClient,
  } = useServer();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (categories.length > 0) {
      setExpandedCategories(new Set(categories.map((cat) => cat.id)));
    }
  }, [categories]);

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelCategoryId, setNewChannelCategoryId] = useState<string | undefined>();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  type DragItem = { type: "channel" | "category"; id: string };
  type DragOver =
    | { type: "channel"; id: string; position: "above" | "below"; categoryId: string | null }
    | { type: "category"; id: string; position: "above" | "below" }
    | { type: "uncategorized" };

  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOver, setDragOver] = useState<DragOver | null>(null);
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);

  const [sidebarMenu, setSidebarMenu] = useState<{ x: number; y: number } | null>(null);

  const [showSettings, setShowSettings] = useState(false);

  const isFederated = activeServer ? isFederatedServer(activeServer) : false;

  if (!activeServer) return null;

  const uncategorizedChannels = channels.filter((ch) => !ch.category_id);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleCreateChannel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChannelName.trim() || !activeServer) return;

    setIsCreating(true);
    try {
      await createChannel(activeServer.id, newChannelName, newChannelCategoryId);
      setNewChannelName("");
      setNewChannelCategoryId(undefined);
      setShowCreateChannel(false);
    } catch (error) {
      console.error("Failed to create channel:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCategoryName.trim() || !activeServer) return;

    setIsCreating(true);
    try {
      await createCategory(activeServer.id, newCategoryName, categories.length);
      setNewCategoryName("");
      setShowCreateCategory(false);
    } catch (error) {
      console.error("Failed to create category:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const commitDrag = async (from: DragItem, to: DragOver) => {
    if (!activeServer) return;

    const updateChannel = async (
      channelId: string,
      data: { position?: number; category_id?: string | null }
    ) => {
      if (federatedClient) {
        await federatedClient.updateChannel(channelId, data);
      } else {
        await serverService.updateChannel(activeServer.id, channelId, data);
      }
    };

    const updateCategory = async (categoryId: string, data: { position?: number }) => {
      if (federatedClient) {
        await federatedClient.updateCategory(categoryId, data);
      } else {
        await serverService.updateCategory(activeServer.id, categoryId, data);
      }
    };

    // Categories: reorder relative to another category.
    if (from.type === "category" && to.type === "category") {
      if (from.id === to.id) return;
      const sorted = [...categories].sort((a, b) => a.position - b.position);
      const fromIndex = sorted.findIndex((c) => c.id === from.id);
      if (fromIndex === -1) return;
      const [moved] = sorted.splice(fromIndex, 1);
      const targetIndex = sorted.findIndex((c) => c.id === to.id);
      if (targetIndex === -1) return;
      const insertAt = to.position === "below" ? targetIndex + 1 : targetIndex;
      sorted.splice(insertAt, 0, moved);

      for (let i = 0; i < sorted.length; i++) {
        const cat = sorted[i];
        if (cat.position !== i) {
          await updateCategory(cat.id, { position: i });
        }
      }
      await reloadServerData();
      return;
    }

    // Channels: reorder within a list or move across categories/uncategorized.
    if (from.type !== "channel") return;
    const dragged = channels.find((c) => c.id === from.id);
    if (!dragged) return;

    const normCat = (v: string | undefined) => (v ? v : null);
    const byId = new Map(channels.map((c) => [c.id, c] as const));

    const getList = (catId: string | null) =>
      channels
        .filter((c) => normCat(c.category_id) === catId)
        .sort((a, b) => a.position - b.position);

    const sourceCatId = normCat(dragged.category_id);

    let targetCatId: string | null = sourceCatId;
    let insertIndex: number | null = null;

    if (to.type === "channel") {
      if (to.id === from.id) return;
      targetCatId = to.categoryId;
      const targetList = getList(targetCatId).filter((c) => c.id !== dragged.id);
      const baseIndex = targetList.findIndex((c) => c.id === to.id);
      if (baseIndex === -1) return;
      insertIndex = to.position === "below" ? baseIndex + 1 : baseIndex;
    } else if (to.type === "category") {
      targetCatId = to.id;
      insertIndex = getList(targetCatId).filter((c) => c.id !== dragged.id).length; // end
    } else if (to.type === "uncategorized") {
      targetCatId = null;
      insertIndex = getList(null).filter((c) => c.id !== dragged.id).length; // end
    } else {
      return;
    }

    const sourceListNext = getList(sourceCatId).filter((c) => c.id !== dragged.id);
    const targetListBase = getList(targetCatId).filter((c) => c.id !== dragged.id);
    const targetListNext = [...targetListBase];
    targetListNext.splice(insertIndex, 0, dragged);

    // Persist target list (and source list if moved across categories).
    const persistList = async (catId: string | null, list: typeof channels) => {
      for (let i = 0; i < list.length; i++) {
        const ch = list[i];
        const original = byId.get(ch.id);
        const desiredCat = catId;
        const origCat = normCat(original?.category_id);
        if (!original) continue;
        if (original.position !== i || origCat !== desiredCat) {
          await updateChannel(ch.id, { position: i, category_id: desiredCat });
        }
      }
    };

    if (sourceCatId !== targetCatId) {
      await persistList(sourceCatId, sourceListNext);
    }
    await persistList(targetCatId, targetListNext);
    await reloadServerData();
  };

  useEffect(() => {
    if (!dragItem || dragPointerId === null) return;

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const findTarget = (el: Element | null): HTMLElement | null => {
      let node: Element | null = el;
      while (node) {
        const t = (node as HTMLElement).dataset?.dndType;
        if (t) return node as HTMLElement;
        node = node.parentElement;
      }
      return null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = findTarget(el);
      if (!target) {
        setDragOver(null);
        return;
      }

      const t = target.dataset.dndType;
      const id = target.dataset.dndId;

      if (t === "channel" && id) {
        const rect = target.getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? "above" : "below";
        const rawCat = target.dataset.dndCategoryId;
        setDragOver({ type: "channel", id, position, categoryId: rawCat ? rawCat : null });
        return;
      }

      if (t === "category" && id) {
        const rect = target.getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? "above" : "below";
        setDragOver({ type: "category", id, position });
        return;
      }

      if (t === "uncategorized") {
        setDragOver({ type: "uncategorized" });
        return;
      }

      setDragOver(null);
    };

    const end = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      const from = dragItem;
      const to = dragOver;
      setDragItem(null);
      setDragOver(null);
      setDragPointerId(null);

      if (!to) return;
      // Fire and forget; the UI will refresh via reloadServerData.
      commitDrag(from, to).catch((err) => console.error("Failed to reorder:", err));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });

    return () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end as any);
      window.removeEventListener("pointercancel", end as any);
    };
  }, [dragItem, dragPointerId, dragOver, categories, channels, activeServer, federatedClient]);

  useEffect(() => {
    if (!sidebarMenu) return;
    const onDown = () => setSidebarMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sidebarMenu]);

  return (
    <aside className="w-60 h-full overflow-hidden shrink-0">
      <Panel className="h-full flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-base truncate text-foreground">{activeServer?.name}</h2>
          {isFederated && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 hover:bg-secondary/50 rounded-md transition-colors"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div
          className="flex-1 overflow-y-auto custom-scrollbar"
          onContextMenu={(e) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('[data-dnd-type="channel"], [data-dnd-type="category"], button'))
              return;
            e.preventDefault();
            setSidebarMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          {sidebarMenu && (
            <ChannelSidebarContextMenu
              x={sidebarMenu.x}
              y={sidebarMenu.y}
              onCreateChannel={() => {
                setSidebarMenu(null);
                setNewChannelCategoryId(undefined);
                setShowCreateChannel(true);
              }}
              onCreateCategory={() => {
                setSidebarMenu(null);
                setShowCreateCategory(true);
              }}
            />
          )}
          <div className="p-2 space-y-4">
            {categories.map((category) => {
              const categoryChannels = channels
                .filter((c) => c.category_id === category.id)
                .sort((a, b) => a.position - b.position);

              return (
                <div key={category.id}>
                  <div
                    className={cn(
                      "flex items-center justify-between px-2 py-1.5 text-muted-foreground hover:text-foreground group",
                      dragItem?.type === "category" &&
                        dragOver?.type === "category" &&
                        dragOver.id === category.id
                        ? dragOver.position === "above"
                          ? "border-t-2 border-primary"
                          : "border-b-2 border-primary"
                        : "",
                      dragItem?.type === "channel" &&
                        dragOver?.type === "category" &&
                        dragOver.id === category.id
                        ? "ring-2 ring-primary/40 rounded-md"
                        : "",
                      dragItem?.type === "category" && dragItem.id === category.id
                        ? "opacity-50"
                        : ""
                    )}
                    data-dnd-type="category"
                    data-dnd-id={category.id}
                  >
                    <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragItem({ type: "category", id: category.id });
                          setDragOver({ type: "category", id: category.id, position: "below" });
                          setDragPointerId(e.pointerId);
                        }}
                        className="p-1 -ml-1 rounded hover:bg-secondary/50 text-muted-foreground/70 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                        aria-label="Drag category"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        className="flex items-center gap-1.5 flex-1 overflow-hidden text-left"
                      >
                        {expandedCategories.has(category.id) ? (
                          <ChevronDown className="w-3 h-3 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span className="text-[11px] font-semibold uppercase tracking-wide truncate select-none">
                          {category.name}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewChannelCategoryId(category.id);
                          setShowCreateChannel(true);
                        }}
                        className="p-1 hover:text-primary transition-colors"
                        title="Create Channel"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {expandedCategories.has(category.id) && (
                    <div className="mt-1 space-y-0.5">
                      {categoryChannels.map((channel) => (
                        <div
                          key={channel.id}
                          className={cn(
                            "group",
                            dragItem?.type === "channel" &&
                              dragOver?.type === "channel" &&
                              dragOver.id === channel.id
                              ? dragOver.position === "above"
                                ? "border-t-2 border-primary"
                                : "border-b-2 border-primary"
                              : "",
                            dragItem?.type === "channel" && dragItem.id === channel.id
                              ? "opacity-50"
                              : ""
                          )}
                          data-dnd-type="channel"
                          data-dnd-id={channel.id}
                          data-dnd-category-id={category.id}
                        >
                          <div className="flex items-center gap-1 ml-2 w-[calc(100%-8px)]">
                            <button
                              type="button"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDragItem({ type: "channel", id: channel.id });
                                setDragOver({
                                  type: "channel",
                                  id: channel.id,
                                  position: "below",
                                  categoryId: category.id,
                                });
                                setDragPointerId(e.pointerId);
                              }}
                              className="p-1 rounded hover:bg-secondary/50 text-muted-foreground/70 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                              aria-label="Drag channel"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setActiveChannel(channel)}
                              className={`flex items-center gap-2 px-3 py-1.5 flex-1 text-left rounded-lg transition-colors ${
                                activeChannel?.id === channel.id
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                              }`}
                            >
                              <Hash className="w-4 h-4 flex-shrink-0 opacity-70" />
                              <span className="truncate text-sm">{channel.name}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {uncategorizedChannels.length > 0 && (
              <div>
                <div
                  className={cn(
                    "px-2 py-1.5 text-muted-foreground text-[11px] font-semibold uppercase tracking-wide rounded-md",
                    dragItem?.type === "channel" && dragOver?.type === "uncategorized"
                      ? "ring-2 ring-primary/40"
                      : ""
                  )}
                  data-dnd-type="uncategorized"
                >
                  Text Channels
                </div>
                <div className="space-y-0.5">
                  {uncategorizedChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className={cn(
                        "group",
                        dragItem?.type === "channel" &&
                          dragOver?.type === "channel" &&
                          dragOver.id === channel.id
                          ? dragOver.position === "above"
                            ? "border-t-2 border-primary"
                            : "border-b-2 border-primary"
                          : "",
                        dragItem?.type === "channel" && dragItem.id === channel.id
                          ? "opacity-50"
                          : ""
                      )}
                      data-dnd-type="channel"
                      data-dnd-id={channel.id}
                    >
                      <div className="flex items-center gap-1 w-full">
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragItem({ type: "channel", id: channel.id });
                            setDragOver({
                              type: "channel",
                              id: channel.id,
                              position: "below",
                              categoryId: null,
                            });
                            setDragPointerId(e.pointerId);
                          }}
                          className="p-1 rounded hover:bg-secondary/50 text-muted-foreground/70 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                          aria-label="Drag channel"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActiveChannel(channel)}
                          className={`flex items-center gap-2 px-3 py-1.5 flex-1 text-left rounded-lg transition-colors ${
                            activeChannel?.id === channel.id
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <Hash className="w-4 h-4 flex-shrink-0 opacity-70" />
                          <span className="truncate text-sm">{channel.name}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-2 shrink-0">
          <UserProfile />
        </div>

        <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Channel</DialogTitle>
              <DialogDescription>
                Create a new text channel in{" "}
                {newChannelCategoryId
                  ? categories.find((c) => c.id === newChannelCategoryId)?.name
                  : "this server"}
                .
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Channel Name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    #
                  </span>
                  <input
                    id="name"
                    value={newChannelName}
                    onChange={(e) =>
                      setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                    }
                    placeholder="new-channel"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-7 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category (Optional)</label>
                <Select value={newChannelCategoryId} onValueChange={setNewChannelCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateChannel(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateChannel} disabled={!newChannelName.trim() || isCreating}>
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Channel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCreateCategory} onOpenChange={setShowCreateCategory}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
              <DialogDescription>Create a new folder to organize your channels.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="catName" className="text-sm font-medium">
                  Category Name
                </label>
                <input
                  id="catName"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Text Channels"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateCategory(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim() || isCreating}
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Server Settings Modal */}
        {isFederated && showSettings && activeServer && (
          <ServerSettings
            serverId={activeServer.id}
            serverName={activeServer.name}
            isOwner={(activeServer as any).is_owner || false}
            onClose={() => setShowSettings(false)}
          />
        )}
      </Panel>
    </aside>
  );
}
