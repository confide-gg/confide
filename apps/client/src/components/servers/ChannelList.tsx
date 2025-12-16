import { useServer } from "../../context/ServerContext";
import { Hash, ChevronDown, ChevronRight, Plus, Settings, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "../../lib/utils";
import { UserProfile } from "../sidebar/UserProfile";
import { isFederatedServer } from "../../features/servers/types";
import { ServerSettings } from "./ServerSettings";

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
  const [draggedItem, setDraggedItem] = useState<{ type: 'channel' | 'category'; id: string; } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ type: 'channel' | 'category'; id: string; position?: 'above' | 'below' } | null>(null);

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

  const handleDrop = async () => {
    if (!draggedItem || !dragOverItem || !activeServer || !federatedClient) return;
    if (draggedItem.id === dragOverItem.id) return;

    try {
      if (draggedItem.type === 'channel' && dragOverItem.type === 'channel') {
        const draggedChannel = channels.find(c => c.id === draggedItem.id);
        const targetChannel = channels.find(c => c.id === dragOverItem.id);
        if (!draggedChannel || !targetChannel) return;

        const categoryChannels = channels
          .filter(c => c.category_id === targetChannel.category_id)
          .sort((a, b) => a.position - b.position);

        const otherChannels = categoryChannels.filter(c => c.id !== draggedChannel.id);

        const targetIndex = otherChannels.findIndex(c => c.id === targetChannel.id);
        const insertIndex = dragOverItem.position === 'below' ? targetIndex + 1 : targetIndex;

        const reorderedChannels = [
          ...otherChannels.slice(0, insertIndex),
          draggedChannel,
          ...otherChannels.slice(insertIndex)
        ];

        for (let i = 0; i < reorderedChannels.length; i++) {
          const channel = reorderedChannels[i];
          if (channel.position !== i || channel.category_id !== targetChannel.category_id) {
            await federatedClient.updateChannel(channel.id, {
              position: i,
              category_id: targetChannel.category_id,
            });
          }
        }

        await reloadServerData();
      } else if (draggedItem.type === 'channel' && dragOverItem.type === 'category') {
        const draggedChannel = channels.find(c => c.id === draggedItem.id);
        const targetCategory = categories.find(c => c.id === dragOverItem.id);
        if (!draggedChannel || !targetCategory) return;

        const targetCategoryChannels = channels.filter(c => c.category_id === targetCategory.id);
        const newPosition = targetCategoryChannels.length;

        await federatedClient.updateChannel(draggedChannel.id, {
          position: newPosition,
          category_id: targetCategory.id,
        });

        await reloadServerData();
      } else if (draggedItem.type === 'category' && dragOverItem.type === 'category') {
        const draggedCategory = categories.find(c => c.id === draggedItem.id);
        const targetCategory = categories.find(c => c.id === dragOverItem.id);
        if (!draggedCategory || !targetCategory) return;

        const sortedCategories = [...categories].sort((a, b) => a.position - b.position);
        const otherCategories = sortedCategories.filter(c => c.id !== draggedCategory.id);

        const targetIndex = otherCategories.findIndex(c => c.id === targetCategory.id);
        const insertIndex = dragOverItem.position === 'below' ? targetIndex + 1 : targetIndex;

        const reorderedCategories = [
          ...otherCategories.slice(0, insertIndex),
          draggedCategory,
          ...otherCategories.slice(insertIndex)
        ];

        for (let i = 0; i < reorderedCategories.length; i++) {
          const category = reorderedCategories[i];
          if (category.position !== i) {
            await federatedClient.updateCategory(category.id, {
              position: i,
            });
          }
        }

        await reloadServerData();
      }
    } catch (error) {
      console.error("Failed to reorder:", error);
    } finally {
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  return (
    <div className="w-60 bg-background flex flex-col h-screen border-r border-border overflow-hidden shrink-0">
      <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
        <h2 className="font-semibold text-base truncate text-foreground">{activeServer?.name}</h2>
        {isFederated && (
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-white/5 rounded-md transition-colors"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2 space-y-4">
          {categories.map((category) => {
            const categoryChannels = channels
              .filter((c) => c.category_id === category.id)
              .sort((a, b) => a.position - b.position);

            return (
              <div
                key={category.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedItem?.type === 'category' && draggedItem.id !== category.id) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    const position = e.clientY < midpoint ? 'above' : 'below';
                    setDragOverItem({ type: 'category', id: category.id, position });
                  }
                }}
                onDragLeave={() => {
                  if (dragOverItem?.id === category.id && draggedItem?.type === 'category') {
                    setDragOverItem(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedItem?.type === 'category') {
                    handleDrop();
                  }
                }}
              >
                <div
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 text-muted-foreground hover:text-foreground group cursor-pointer",
                    dragOverItem?.id === category.id && draggedItem?.type === 'category'
                      ? dragOverItem.position === 'above' ? 'border-t-2 border-primary' : 'border-b-2 border-primary'
                      : ''
                  )}
                  draggable
                  onDragStart={(e) => {
                    setDraggedItem({ type: 'category', id: category.id });
                    e.currentTarget.style.opacity = '0.5';
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.style.opacity = '1';
                    setDraggedItem(null);
                    setDragOverItem(null);
                  }}
                >
                  <div className="flex items-center gap-1.5 flex-1 overflow-hidden" onClick={() => toggleCategory(category.id)}>
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="w-3 h-3 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wide truncate select-none">
                      {category.name}
                    </span>
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
                        draggable
                        onDragStart={(e) => {
                          setDraggedItem({ type: 'channel', id: channel.id });
                          e.currentTarget.style.opacity = '0.5';
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = '1';
                          setDraggedItem(null);
                          setDragOverItem(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedItem?.type === 'channel' && draggedItem.id !== channel.id) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const midpoint = rect.top + rect.height / 2;
                            const position = e.clientY < midpoint ? 'above' : 'below';
                            setDragOverItem({ type: 'channel', id: channel.id, position });
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverItem?.id === channel.id && draggedItem?.type === 'channel') {
                            setDragOverItem(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedItem?.type === 'channel') {
                            handleDrop();
                          }
                        }}
                        className={
                          dragOverItem?.id === channel.id && draggedItem?.type === 'channel'
                            ? dragOverItem.position === 'above'
                              ? 'border-t-2 border-primary'
                              : 'border-b-2 border-primary'
                            : ''
                        }
                      >
                        <button
                          onClick={() => setActiveChannel(channel)}
                          className={`flex items-center gap-2 px-3 py-1.5 ml-2 w-[calc(100%-8px)] text-left rounded-lg transition-colors cursor-grab active:cursor-grabbing ${activeChannel?.id === channel.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                        >
                          <Hash className="w-4 h-4 flex-shrink-0 opacity-70" />
                          <span className="truncate text-sm">{channel.name}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {uncategorizedChannels.length > 0 && (
            <div>
              <div className="px-2 py-1.5 text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                Text Channels
              </div>
              <div className="space-y-0.5">
                {uncategorizedChannels.map((channel) => (
                  <div
                    key={channel.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedItem({ type: 'channel', id: channel.id });
                      e.currentTarget.style.opacity = '0.5';
                    }}
                    onDragEnd={(e) => {
                      e.currentTarget.style.opacity = '1';
                      setDraggedItem(null);
                      setDragOverItem(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedItem?.type === 'channel' && draggedItem.id !== channel.id) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const midpoint = rect.top + rect.height / 2;
                        const position = e.clientY < midpoint ? 'above' : 'below';
                        setDragOverItem({ type: 'channel', id: channel.id, position });
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverItem?.id === channel.id && draggedItem?.type === 'channel') {
                        setDragOverItem(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedItem?.type === 'channel') {
                        handleDrop();
                      }
                    }}
                    className={
                      dragOverItem?.id === channel.id && draggedItem?.type === 'channel'
                        ? dragOverItem.position === 'above'
                          ? 'border-t-2 border-primary'
                          : 'border-b-2 border-primary'
                        : ''
                    }
                  >
                    <button
                      onClick={() => setActiveChannel(channel)}
                      className={`flex items-center gap-2 px-3 py-1.5 w-full text-left rounded-lg transition-colors cursor-grab active:cursor-grabbing ${activeChannel?.id === channel.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                    >
                      <Hash className="w-4 h-4 flex-shrink-0 opacity-70" />
                      <span className="truncate text-sm">{channel.name}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-2 shrink-0 border-t border-border">
        <UserProfile />
      </div>

      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
            <DialogDescription>
              Create a new text channel in {newChannelCategoryId ? categories.find(c => c.id === newChannelCategoryId)?.name : "this server"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Channel Name
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">#</span>
                <input
                  id="name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
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
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
            <DialogDescription>
              Create a new folder to organize your channels.
            </DialogDescription>
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
            <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim() || isCreating}>
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
    </div>
  );
}

