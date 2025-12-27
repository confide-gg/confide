import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "../../../lib/utils";
import type { DragItem, DragOver } from "./types";

interface Channel {
  id: string;
  name: string;
  category_id?: string;
}

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  categoryId?: string | null;
  canManage: boolean;
  dragItem: DragItem | null;
  dragOver: DragOver | null;
  onSelect: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export function ChannelItem({
  channel,
  isActive,
  categoryId,
  canManage,
  dragItem,
  dragOver,
  onSelect,
  onDragStart,
}: ChannelItemProps) {
  const isDraggedOver =
    dragItem?.type === "channel" && dragOver?.type === "channel" && dragOver.id === channel.id;
  const isDragging = dragItem?.type === "channel" && dragItem.id === channel.id;

  return (
    <div
      className={cn(
        "group",
        isDraggedOver
          ? dragOver.position === "above"
            ? "border-t-2 border-primary"
            : "border-b-2 border-primary"
          : "",
        isDragging ? "opacity-50" : ""
      )}
      data-dnd-type="channel"
      data-dnd-id={channel.id}
      data-dnd-category-id={categoryId}
    >
      <div className={cn("flex items-center gap-1 w-full", categoryId && "ml-2")}>
        <button
          onClick={onSelect}
          onPointerDown={canManage ? onDragStart : undefined}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 flex-1 text-left rounded-lg transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            canManage && "cursor-grab active:cursor-grabbing"
          )}
        >
          <FontAwesomeIcon icon="hashtag" className="w-4 h-4 flex-shrink-0 opacity-70" />
          <span className="truncate text-sm">{channel.name}</span>
        </button>
      </div>
    </div>
  );
}
