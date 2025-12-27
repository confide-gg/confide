import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface FilePreviewProps {
  file: File;
  previewUrl: string | null;
  onRemove: () => void;
}

export function FilePreview({ file, previewUrl, onRemove }: FilePreviewProps) {
  return (
    <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-3 animate-in slide-in-from-bottom-2 duration-100">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0 group/preview">
          {file.type.startsWith("image/") && previewUrl && (
            <div className="relative">
              <img
                src={previewUrl}
                alt={file.name}
                className="w-24 h-24 object-cover rounded-lg border-2 border-border shadow-sm"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/preview:bg-black/10 rounded-lg transition-colors" />
            </div>
          )}
          {!file.type.startsWith("image/") && (
            <div className="w-24 h-24 flex items-center justify-center bg-secondary/50 rounded-lg border-2 border-border shadow-sm">
              <FontAwesomeIcon icon="file" className="w-9 h-9 text-muted-foreground" />
            </div>
          )}
          <button
            onClick={onRemove}
            className="absolute -top-2 -right-2 w-7 h-7 flex items-center justify-center bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full shadow-lg transition-all hover:scale-110"
            title="Remove file"
          >
            <FontAwesomeIcon icon="xmark" className="w-[14px] h-[14px]" />
          </button>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon="paperclip" className="w-4 h-4 text-primary shrink-0" />
            <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            <span className="text-muted-foreground/50">•</span>
            <span className="capitalize">{file.type.split("/")[0] || "File"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
