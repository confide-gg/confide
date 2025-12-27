import { useServer } from "../../context/server";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { UserProfile } from "../sidebar/UserProfile";
import { isFederatedServer } from "../../features/servers/types";
import { ServerSettings } from "./settings";
import { Panel } from "../layout/Panel";
import { serverService } from "../../features/servers/servers";
import { ChannelSidebarContextMenu } from "./ChannelSidebarContextMenu";
import { hasPermission, Permissions } from "../../features/servers/permissions";
import {
  ChannelItem,
  CategorySection,
  CreateChannelDialog,
  CreateCategoryDialog,
  type DragItem,
  type DragOver,
} from "./channel-list";

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
    myPermissions,
  } = useServer();

  const isOwner =
    activeServer && isFederatedServer(activeServer) ? activeServer.is_owner === true : false;
  const canManageChannels = isOwner || hasPermission(myPermissions, Permissions.MANAGE_CHANNELS);
  const canManageServer = isOwner || hasPermission(myPermissions, Permissions.MANAGE_SERVER);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelCategoryId, setNewChannelCategoryId] = useState<string | undefined>();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOver, setDragOver] = useState<DragOver | null>(null);
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);
  const [sidebarMenu, setSidebarMenu] = useState<{ x: number; y: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const isFederated = activeServer ? isFederatedServer(activeServer) : false;

  useEffect(() => {
    if (categories.length > 0) {
      setExpandedCategories(new Set(categories.map((cat) => cat.id)));
    }
  }, [categories]);

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
      } else if (t === "category" && id) {
        const rect = target.getBoundingClientRect();
        const position = e.clientY < rect.top + rect.height / 2 ? "above" : "below";
        setDragOver({ type: "category", id, position });
      } else if (t === "uncategorized") {
        setDragOver({ type: "uncategorized" });
      } else {
        setDragOver(null);
      }
    };

    const end = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      const from = dragItem;
      const to = dragOver;
      setDragItem(null);
      setDragOver(null);
      setDragPointerId(null);
      if (to) commitDrag(from, to).catch((err) => console.error("Failed to reorder:", err));
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

  if (!activeServer) return null;

  const uncategorizedChannels = channels.filter((ch) => !ch.category_id);
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
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
      if (federatedClient) await federatedClient.updateChannel(channelId, data);
      else await serverService.updateChannel(activeServer.id, channelId, data);
    };

    const updateCategory = async (categoryId: string, data: { position?: number }) => {
      if (federatedClient) await federatedClient.updateCategory(categoryId, data);
      else await serverService.updateCategory(activeServer.id, categoryId, data);
    };

    if (from.type === "category" && to.type === "category") {
      if (from.id === to.id) return;
      const sorted = [...categories].sort((a, b) => a.position - b.position);
      const fromIndex = sorted.findIndex((c) => c.id === from.id);
      if (fromIndex === -1) return;
      const [moved] = sorted.splice(fromIndex, 1);
      const targetIndex = sorted.findIndex((c) => c.id === to.id);
      if (targetIndex === -1) return;
      sorted.splice(to.position === "below" ? targetIndex + 1 : targetIndex, 0, moved);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].position !== i) await updateCategory(sorted[i].id, { position: i });
      }
      await reloadServerData();
      return;
    }

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
      insertIndex = getList(targetCatId).filter((c) => c.id !== dragged.id).length;
    } else if (to.type === "uncategorized") {
      targetCatId = null;
      insertIndex = getList(null).filter((c) => c.id !== dragged.id).length;
    } else return;

    const sourceListNext = getList(sourceCatId).filter((c) => c.id !== dragged.id);
    const targetListBase = getList(targetCatId).filter((c) => c.id !== dragged.id);
    const targetListNext = [...targetListBase];
    targetListNext.splice(insertIndex!, 0, dragged);

    const persistList = async (catId: string | null, list: typeof channels) => {
      for (let i = 0; i < list.length; i++) {
        const ch = list[i];
        const original = byId.get(ch.id);
        if (!original) continue;
        if (original.position !== i || normCat(original.category_id) !== catId) {
          await updateChannel(ch.id, { position: i, category_id: catId });
        }
      }
    };

    if (sourceCatId !== targetCatId) await persistList(sourceCatId, sourceListNext);
    await persistList(targetCatId, targetListNext);
    await reloadServerData();
  };

  const handleCategoryDragStart = (categoryId: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragItem({ type: "category", id: categoryId });
    setDragOver({ type: "category", id: categoryId, position: "below" });
    setDragPointerId(e.pointerId);
  };

  const handleChannelDragStart =
    (channelId: string, categoryId: string | null) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragItem({ type: "channel", id: channelId });
      setDragOver({ type: "channel", id: channelId, position: "below", categoryId });
      setDragPointerId(e.pointerId);
    };

  return (
    <aside className="w-60 h-full overflow-hidden shrink-0">
      <Panel className="h-full flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-base truncate text-foreground">{activeServer?.name}</h2>
          {isFederated && canManageServer && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 hover:bg-secondary/50 rounded-md transition-colors"
            >
              <FontAwesomeIcon icon="gear" className="w-4 h-4 text-muted-foreground" />
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
          {sidebarMenu && canManageChannels && (
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
            {categories.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                channels={channels
                  .filter((c) => c.category_id === category.id)
                  .sort((a, b) => a.position - b.position)}
                isExpanded={expandedCategories.has(category.id)}
                canManage={canManageChannels}
                activeChannelId={activeChannel?.id}
                dragItem={dragItem}
                dragOver={dragOver}
                onToggle={() => toggleCategory(category.id)}
                onCreateChannel={() => {
                  setNewChannelCategoryId(category.id);
                  setShowCreateChannel(true);
                }}
                onChannelSelect={(ch) => setActiveChannel(ch as any)}
                onCategoryDragStart={handleCategoryDragStart(category.id)}
                onChannelDragStart={(channelId, catId) => handleChannelDragStart(channelId, catId)}
              />
            ))}

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
                    <ChannelItem
                      key={channel.id}
                      channel={channel}
                      isActive={activeChannel?.id === channel.id}
                      canManage={canManageChannels}
                      dragItem={dragItem}
                      dragOver={dragOver}
                      onSelect={() => setActiveChannel(channel)}
                      onDragStart={handleChannelDragStart(channel.id, null)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-2 shrink-0">
          <UserProfile />
        </div>

        <CreateChannelDialog
          open={showCreateChannel}
          onOpenChange={setShowCreateChannel}
          channelName={newChannelName}
          onChannelNameChange={setNewChannelName}
          categoryId={newChannelCategoryId}
          onCategoryIdChange={setNewChannelCategoryId}
          categories={categories}
          isCreating={isCreating}
          onSubmit={handleCreateChannel}
        />

        <CreateCategoryDialog
          open={showCreateCategory}
          onOpenChange={setShowCreateCategory}
          categoryName={newCategoryName}
          onCategoryNameChange={setNewCategoryName}
          isCreating={isCreating}
          onSubmit={handleCreateCategory}
        />

        {isFederated && showSettings && activeServer && (
          <ServerSettings
            serverId={activeServer.id}
            serverName={activeServer.name}
            isOwner={isOwner}
            myPermissions={myPermissions}
            onClose={() => setShowSettings(false)}
          />
        )}
      </Panel>
    </aside>
  );
}
