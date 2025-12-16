import * as React from "react";

interface ChannelSidebarContextMenuProps {
  x: number;
  y: number;
  onCreateChannel: () => void;
  onCreateCategory: () => void;
}

export function ChannelSidebarContextMenu({
  x,
  y,
  onCreateChannel,
  onCreateCategory,
}: ChannelSidebarContextMenuProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: y, left: x }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={onCreateChannel}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        Create Channel
      </button>
      <button
        onClick={onCreateCategory}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        Create Category
      </button>
    </div>
  );
}


