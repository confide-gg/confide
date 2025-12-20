import { useState, useEffect, useRef, useCallback } from "react";
import { useAttachmentBlob } from "../../features/attachments/useAttachment";
import { attachmentDownloadService } from "../../features/attachments/AttachmentDownloadService";
import type { FileMetadata } from "../../features/attachments/AttachmentUploadService";
import { toast } from "sonner";

interface AttachmentImageProps {
  metadata: FileMetadata;
}

export function AttachmentImage({ metadata }: AttachmentImageProps) {
  const { data, isLoading, error } = useAttachmentBlob(metadata);
  const [showMenu, setShowMenu] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const clampMenuPosition = useCallback((x: number, y: number) => {
    const menuWidth = 180;
    const menuHeight = 150;
    const padding = 8;

    const clampedX = Math.min(x, window.innerWidth - menuWidth - padding);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - padding);

    return { x: Math.max(padding, clampedX), y: Math.max(padding, clampedY) };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const position = clampMenuPosition(e.clientX, e.clientY);
    setMenuPosition(position);
    setShowMenu(true);
  };

  const handleDownload = async () => {
    setShowMenu(false);
    try {
      await attachmentDownloadService.downloadAndSaveFile(metadata);
      toast.success("Download started");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Download failed");
    }
  };

  const handleCopyImage = async () => {
    setShowMenu(false);
    if (!data?.blobUrl) return;

    try {
      const response = await fetch(data.blobUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success("Image copied to clipboard");
    } catch (err) {
      console.error("Failed to copy image:", err);
      toast.error("Failed to copy image");
    }
  };

  const handleExpand = () => {
    setShowMenu(false);
    setShowExpanded(true);
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/5 border border-destructive/30 rounded-lg max-w-xs">
        <div className="shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-destructive">Failed to load image</div>
          <div className="text-xs text-destructive/70 truncate">{error instanceof Error ? error.message : "Unknown error"}</div>
        </div>
      </div>
    );
  }

  if (isLoading || !data?.blobUrl) {
    return (
      <div className="flex items-center gap-3 p-4 bg-card/50 border border-border/50 rounded-lg max-w-xs">
        <div className="shrink-0">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">Loading image...</div>
          <div className="text-xs text-muted-foreground mt-0.5">Please wait</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-fit max-w-lg group/image">
        <div className="relative rounded-lg overflow-hidden border border-border/50 shadow-sm bg-card/30">
          <img
            src={data.blobUrl}
            alt={metadata.file.name}
            className="block rounded-lg max-h-[32rem] max-w-full w-auto cursor-pointer hover:brightness-95 transition-all duration-200"
            loading="lazy"
            onContextMenu={handleContextMenu}
            onClick={handleExpand}
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg pointer-events-none" />
        </div>

        {showMenu && (
          <div
            ref={menuRef}
            className="fixed z-50 bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl py-1.5 min-w-[180px] animate-in fade-in-0 zoom-in-95 duration-100"
            style={{ left: menuPosition.x, top: menuPosition.y }}
          >
            <button
              onClick={handleExpand}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-3 group/menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground group-hover/menuitem:text-foreground transition-colors">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              <span className="font-medium">Expand</span>
            </button>
            <div className="h-px bg-border/50 my-1" />
            <button
              onClick={handleDownload}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-3 group/menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground group-hover/menuitem:text-foreground transition-colors">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="font-medium">Download</span>
            </button>
            <button
              onClick={handleCopyImage}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-3 group/menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground group-hover/menuitem:text-foreground transition-colors">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="font-medium">Copy Image</span>
            </button>
          </div>
        )}
      </div>

      {showExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowExpanded(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setShowExpanded(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <img
              src={data.blobUrl}
              alt={metadata.file.name}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
