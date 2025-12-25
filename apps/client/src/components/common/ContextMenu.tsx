import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ContextMenuData } from "../../types";

interface ContextMenuProps {
  data: ContextMenuData;
  onMessage: () => void;
  onRemove: () => void;
  onClose: () => void;
  onVerify?: () => void;
}

export function ContextMenu({ data, onMessage, onRemove, onVerify }: ContextMenuProps) {
  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: data.y, left: data.x }}
    >
      <button
        onClick={onMessage}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        <FontAwesomeIcon icon="comment" className="w-4 h-4 opacity-70" />
        Message
      </button>
      {onVerify && (
        <button
          onClick={onVerify}
          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
        >
          <FontAwesomeIcon icon="shield" className="w-4 h-4 opacity-70" />
          Verify Identity
        </button>
      )}
      <div className="h-px bg-border my-1" />
      <button
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
        onClick={onRemove}
      >
        <FontAwesomeIcon icon="user-minus" className="w-4 h-4" />
        Remove Friend
      </button>
    </div>
  );
}
