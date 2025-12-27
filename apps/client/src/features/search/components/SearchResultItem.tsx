import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatDate } from "@/utils/formatters";
import { Avatar } from "@/components/ui/avatar";
import { parseMessageContent, SearchResult } from "./types";

interface SearchResultItemProps {
  result: SearchResult;
  onJump: (messageId: string) => void;
}

export function SearchResultItem({ result, onJump }: SearchResultItemProps) {
  const displayDate = formatDate(result.createdAt);
  const parsed = parseMessageContent(result.content);

  const getContentIndicator = () => {
    if (result.isGif) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded">
          <FontAwesomeIcon icon="image" className="w-3 h-3" />
          GIF
        </span>
      );
    }
    if (result.hasImage) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded">
          <FontAwesomeIcon icon="image" className="w-3 h-3" />
          Image
        </span>
      );
    }
    if (result.hasFile) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded">
          <FontAwesomeIcon icon="file" className="w-3 h-3" />
          File
        </span>
      );
    }
    if (result.hasLink) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 bg-secondary/50 px-1.5 py-0.5 rounded">
          <FontAwesomeIcon icon="link" className="w-3 h-3" />
          Link
        </span>
      );
    }
    return null;
  };

  const getDisplayContent = () => {
    if (result.isGif) {
      return "[GIF]";
    }
    if (parsed.fileData) {
      return parsed.fileData.text || parsed.fileData.file.name;
    }
    const text = parsed.text;
    if (text.length > 120) {
      return `${text.substring(0, 120)}...`;
    }
    return text;
  };

  return (
    <button
      onClick={() => onJump(result.id)}
      className="w-full text-left rounded-md hover:bg-secondary/40 transition-colors group p-2"
    >
      <div className="flex items-start gap-2.5">
        <Avatar fallback={result.senderName} size="sm" className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm text-foreground truncate">
                {result.senderName}
              </span>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">{displayDate}</span>
            </div>
            <span className="shrink-0 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
              Jump
            </span>
          </div>
          <div className="flex items-start gap-2 mt-0.5">
            <p className="text-xs text-foreground/80 line-clamp-2 break-words flex-1">
              {getDisplayContent()}
            </p>
            {getContentIndicator()}
          </div>
        </div>
      </div>
    </button>
  );
}
