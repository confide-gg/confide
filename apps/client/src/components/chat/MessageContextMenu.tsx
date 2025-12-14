import type { MessageContextMenuData } from "../../types";

interface MessageContextMenuProps {
  data: MessageContextMenuData;
  onReply: () => void;
  onReact: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function MessageContextMenu({ data, onReply, onReact, onEdit, onDelete }: MessageContextMenuProps) {
  const { message } = data;

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: data.y, left: data.x }}
    >
      <button
        onClick={onReply}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
          <polyline points="9 17 4 12 9 7" />
          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
        </svg>
        Reply
      </button>
      <button
        onClick={onReact}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
        React
      </button>
      {message.isMine && (
        <>
          <div className="h-px bg-border my-1" />
          {!message.isGif && (
            <button
              onClick={onEdit}
              className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
          <button
            className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
            onClick={onDelete}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Delete
          </button>
        </>
      )}
    </div>
  );
}
