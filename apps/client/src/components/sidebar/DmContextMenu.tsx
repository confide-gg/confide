import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { DmContextMenuData } from "../../types";

interface DmContextMenuProps {
  data: DmContextMenuData;
  onClose: () => void;
  onUnfriend: () => void;
  onCloseDm: () => void;
}

export function DmContextMenu({ data, onUnfriend, onCloseDm }: DmContextMenuProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: data.y, left: data.x }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={onCloseDm}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        <FontAwesomeIcon icon="xmark" className="w-4 h-4 opacity-70" />
        Close Chat
      </button>
      <div className="h-px bg-border my-1" />
      <button
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
        onClick={onUnfriend}
      >
        <FontAwesomeIcon icon="user-minus" className="w-4 h-4" />
        Unfriend
      </button>
    </div>
  );
}
