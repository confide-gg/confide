import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "../../../lib/utils";
import { ChannelItem } from "./ChannelItem";
import type { DragItem, DragOver } from "./types";

interface Channel {
  id: string;
  name: string;
  category_id?: string;
  position: number;
}

interface Category {
  id: string;
  name: string;
}

interface CategorySectionProps {
  category: Category;
  channels: Channel[];
  isExpanded: boolean;
  canManage: boolean;
  activeChannelId: string | undefined;
  dragItem: DragItem | null;
  dragOver: DragOver | null;
  onToggle: () => void;
  onCreateChannel: () => void;
  onChannelSelect: (channel: Channel) => void;
  onCategoryDragStart: (e: React.PointerEvent) => void;
  onChannelDragStart: (channelId: string, categoryId: string) => (e: React.PointerEvent) => void;
}

export function CategorySection({
  category,
  channels,
  isExpanded,
  canManage,
  activeChannelId,
  dragItem,
  dragOver,
  onToggle,
  onCreateChannel,
  onChannelSelect,
  onCategoryDragStart,
  onChannelDragStart,
}: CategorySectionProps) {
  const isDraggedOverCategory =
    dragItem?.type === "category" && dragOver?.type === "category" && dragOver.id === category.id;
  const isChannelDropTarget =
    dragItem?.type === "channel" && dragOver?.type === "category" && dragOver.id === category.id;
  const isDragging = dragItem?.type === "category" && dragItem.id === category.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between px-2 py-1.5 text-muted-foreground hover:text-foreground group",
          isDraggedOverCategory
            ? dragOver.position === "above"
              ? "border-t-2 border-primary"
              : "border-b-2 border-primary"
            : "",
          isChannelDropTarget ? "ring-2 ring-primary/40 rounded-md" : "",
          isDragging ? "opacity-50" : ""
        )}
        data-dnd-type="category"
        data-dnd-id={category.id}
      >
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
          {canManage && (
            <button
              type="button"
              onPointerDown={onCategoryDragStart}
              className="p-1 -ml-1 rounded hover:bg-secondary/50 text-muted-foreground/70 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing"
              aria-label="Drag category"
            >
              <FontAwesomeIcon icon="grip-vertical" className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 flex-1 overflow-hidden text-left"
          >
            <FontAwesomeIcon
              icon={isExpanded ? "chevron-down" : "chevron-right"}
              className="w-3 h-3 flex-shrink-0"
            />
            <span className="text-[11px] font-semibold uppercase tracking-wide truncate select-none">
              {category.name}
            </span>
          </button>
        </div>

        {canManage && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateChannel();
              }}
              className="p-1 hover:text-primary transition-colors"
              title="Create Channel"
            >
              <FontAwesomeIcon icon="plus" className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          {channels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={activeChannelId === channel.id}
              categoryId={category.id}
              canManage={canManage}
              dragItem={dragItem}
              dragOver={dragOver}
              onSelect={() => onChannelSelect(channel)}
              onDragStart={onChannelDragStart(channel.id, category.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
