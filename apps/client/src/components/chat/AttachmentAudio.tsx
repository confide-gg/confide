import { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAttachmentBlob } from "../../features/attachments/useAttachment";
import { attachmentDownloadService } from "../../features/attachments/AttachmentDownloadService";
import type { FileMetadata } from "../../features/attachments/AttachmentUploadService";
import { toast } from "sonner";

interface AttachmentAudioProps {
  metadata: FileMetadata;
}

export function AttachmentAudio({ metadata }: AttachmentAudioProps) {
  const { data, isLoading, error } = useAttachmentBlob(metadata);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
    const menuHeight = 60;
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

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/5 border border-destructive/30 rounded-lg max-w-md">
        <div className="shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <FontAwesomeIcon icon="circle-exclamation" className="w-4.5 h-4.5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-destructive">Failed to load audio</div>
          <div className="text-xs text-destructive/70 truncate">
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !data?.blobUrl) {
    return (
      <div className="flex items-center gap-3 p-4 bg-card/50 border border-border/50 rounded-lg max-w-md">
        <div className="shrink-0">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">Loading audio...</div>
          <div className="text-xs text-muted-foreground mt-0.5">Please wait</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-fit max-w-md group/audio">
        <div
          className="relative rounded-lg overflow-hidden border border-border/50 shadow-sm bg-card/30 p-4"
          onContextMenu={handleContextMenu}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FontAwesomeIcon icon="music" className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {metadata.file.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {(metadata.file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={data.blobUrl}
            controls
            className="w-full h-10"
            preload="metadata"
          >
            Your browser does not support the audio tag.
          </audio>
        </div>

        {showMenu && (
          <div
            ref={menuRef}
            className="fixed z-50 bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl py-1.5 min-w-[180px] animate-in fade-in-0 zoom-in-95 duration-100"
            style={{ left: menuPosition.x, top: menuPosition.y }}
          >
            <button
              onClick={handleDownload}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-3 group/menuitem"
            >
              <FontAwesomeIcon
                icon="download"
                className="w-4 h-4 text-muted-foreground group-hover/menuitem:text-foreground transition-colors"
              />
              <span className="font-medium">Download</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
