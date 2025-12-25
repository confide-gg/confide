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
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="opacity-70"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        Close Chat
      </button>
      <div className="h-px bg-border my-1" />
      <button
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
        onClick={onUnfriend}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="18" y1="8" x2="23" y2="13" />
          <line x1="23" y1="8" x2="18" y2="13" />
        </svg>
        Unfriend
      </button>
    </div>
  );
}
