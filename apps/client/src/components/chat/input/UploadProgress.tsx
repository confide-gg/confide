import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { UploadProgress as UploadProgressType } from "../../../features/attachments/AttachmentUploadService";

interface UploadProgressProps {
  file: File;
  progress: UploadProgressType;
}

export function UploadProgress({ file, progress }: UploadProgressProps) {
  return (
    <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-3 animate-in slide-in-from-bottom-2 duration-100">
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
            <FontAwesomeIcon icon="spinner" className="w-8 h-8 text-primary" spin />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{file.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-xs font-medium text-primary capitalize">{progress.stage}</span>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {progress.progress}%
              </span>
            </div>
          </div>
          <div className="relative w-full bg-secondary/50 rounded-full h-2 overflow-hidden shadow-inner">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{ width: `${progress.progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse" />
            </div>
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
      </div>
    </div>
  );
}
