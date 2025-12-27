import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReplyTo } from "../../../types";
import { AttachmentImage } from "../AttachmentImage";

interface ReplyContextProps {
  replyTo: ReplyTo;
  onCancel: () => void;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("video/")) {
    return <FontAwesomeIcon icon="video" className="w-5 h-5 text-primary" />;
  }
  if (mimeType.startsWith("audio/")) {
    return <FontAwesomeIcon icon="music" className="w-5 h-5 text-primary" />;
  }
  return <FontAwesomeIcon icon="file" className="w-5 h-5 text-primary" />;
}

export function ReplyContext({ replyTo, onCancel }: ReplyContextProps) {
  let fileMetadata = null;
  try {
    const parsed = JSON.parse(replyTo.content);
    if (parsed.type === "file") {
      fileMetadata = parsed;
    }
  } catch {}

  return (
    <div className="absolute bottom-full left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-2.5 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-100">
      <div className="flex items-center gap-3 overflow-hidden min-w-0">
        <div className="shrink-0 w-1 h-10 bg-primary rounded-full" />
        {fileMetadata && fileMetadata.file.mimeType.startsWith("image/") && (
          <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-border shadow-sm bg-secondary/50">
            <div className="[&_img]:max-h-12 [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:rounded-none [&>div]:max-w-none [&>div]:rounded-none">
              <AttachmentImage metadata={fileMetadata} />
            </div>
          </div>
        )}
        {fileMetadata && !fileMetadata.file.mimeType.startsWith("image/") && (
          <div className="shrink-0 w-12 h-12 rounded-md flex items-center justify-center bg-secondary/30 border border-border">
            {getFileIcon(fileMetadata.file.mimeType)}
          </div>
        )}
        <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon="reply" className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Replying to</span>
            <span className="text-xs font-semibold text-foreground">{replyTo.senderName}</span>
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {fileMetadata ? fileMetadata.text || fileMetadata.file.name : replyTo.content}
          </span>
        </div>
      </div>
      <button
        className="shrink-0 p-1.5 hover:bg-secondary/50 rounded-md transition-colors group"
        onClick={onCancel}
        title="Cancel reply"
      >
        <FontAwesomeIcon
          icon="xmark"
          className="w-[14px] h-[14px] text-muted-foreground group-hover:text-foreground transition-colors"
        />
      </button>
    </div>
  );
}
