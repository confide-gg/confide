interface GroupContextMenuData {
  x: number;
  y: number;
  conversationId: string;
  isOwner: boolean;
}

interface GroupContextMenuProps {
  data: GroupContextMenuData;
  onClose: () => void;
  onAddMember: () => void;
  onLeave: () => void;
  onDelete: () => void;
}

export function GroupContextMenu({
  data,
  onClose,
  onAddMember,
  onLeave,
  onDelete,
}: GroupContextMenuProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: data.y, left: data.x }}
      onMouseDown={handleMouseDown}
    >
      {data.isOwner && (
        <button
          onClick={onAddMember}
          className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
        >
          Add Member
        </button>
      )}
      <button
        onClick={onLeave}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        Leave Group
      </button>
      {data.isOwner && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={onDelete}
            className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
          >
            Delete Group
          </button>
        </>
      )}
      <div className="h-px bg-border my-1" />
      <button
        onClick={onClose}
        className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-secondary transition-colors text-foreground"
      >
        Close
      </button>
    </div>
  );
}
