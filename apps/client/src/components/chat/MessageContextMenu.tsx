import { useLayoutEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { MessageContextMenuData } from "../../types/ui";

interface MessageContextMenuProps {
  data: MessageContextMenuData;
  onReply: () => void;
  onReact: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onClose: () => void;
}

export function MessageContextMenu({
  data,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
}: MessageContextMenuProps) {
  const { isMine, isPinned, isGif } = data;
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: data.y, left: data.x });

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top = data.y;
      let left = data.x;

      if (data.y + rect.height > viewportHeight) {
        top = data.y - rect.height;
      }

      if (data.x + rect.width > viewportWidth) {
        left = data.x - rect.width;
      }

      setPosition({ top, left });
    }
  }, [data.x, data.y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ top: position.top, left: position.left }}
    >
      <button
        onClick={isPinned ? onUnpin : onPin}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        <FontAwesomeIcon icon="thumbtack" className="w-4 h-4 opacity-70" />
        {isPinned ? "Unpin Message" : "Pin Message"}
      </button>
      <button
        onClick={onReply}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        <FontAwesomeIcon icon="reply" className="w-4 h-4 opacity-70" />
        Reply
      </button>
      <button
        onClick={onReact}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        <FontAwesomeIcon icon="face-smile" className="w-4 h-4 opacity-70" />
        React
      </button>
      {isMine && (
        <>
          <div className="h-px bg-border my-1" />
          {!isGif && (
            <button
              onClick={onEdit}
              className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
            >
              <FontAwesomeIcon icon="pen-to-square" className="w-4 h-4 opacity-70" />
              Edit
            </button>
          )}
          <button
            className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
            onClick={onDelete}
          >
            <FontAwesomeIcon icon="trash" className="w-4 h-4" />
            Delete
          </button>
        </>
      )}
    </div>
  );
}
