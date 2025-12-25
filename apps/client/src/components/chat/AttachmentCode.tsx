import { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAttachmentText } from "../../features/attachments/useAttachment";
import { attachmentDownloadService } from "../../features/attachments/AttachmentDownloadService";
import type { FileMetadata } from "../../features/attachments/AttachmentUploadService";
import { toast } from "sonner";

interface AttachmentCodeProps {
  metadata: FileMetadata;
}

const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    rs: "rust",
    py: "python",
    rb: "ruby",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    md: "markdown",
    sql: "sql",
    txt: "text",
  };
  return languageMap[ext] || "text";
};

export function AttachmentCode({ metadata }: AttachmentCodeProps) {
  const { data: code, isLoading, error } = useAttachmentText(metadata);
  const [isExpanded, setIsExpanded] = useState(false);
  const language = useMemo(() => getLanguageFromFilename(metadata.file.name), [metadata.file.name]);

  const handleDownload = async () => {
    try {
      await attachmentDownloadService.downloadAndSaveFile(metadata);
      toast.success("Download started");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Download failed");
    }
  };

  const handleCopy = async () => {
    if (code) {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied to clipboard");
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/5 border border-destructive/30 rounded-lg max-w-2xl">
        <div className="shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <FontAwesomeIcon icon="circle-exclamation" className="w-4.5 h-4.5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-destructive">Failed to load file</div>
          <div className="text-xs text-destructive/70 truncate">
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !code) {
    return (
      <div className="flex items-center gap-3 p-4 bg-card/50 border border-border/50 rounded-lg max-w-2xl">
        <div className="shrink-0">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">Loading file...</div>
          <div className="text-xs text-muted-foreground mt-0.5">Please wait</div>
        </div>
      </div>
    );
  }

  const lineCount = code.split("\n").length;
  const displayCode = isExpanded ? code : code.split("\n").slice(0, 15).join("\n");
  const needsExpand = lineCount > 15;

  return (
    <div className="relative w-fit max-w-2xl group/code">
      <div className="relative rounded-lg overflow-hidden border border-border/50 shadow-sm bg-[#1e1e1e]">
        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-border/20">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon="code" className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{metadata.file.name}</span>
            <span className="text-xs text-muted-foreground">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-secondary/50 rounded transition-colors group/btn"
              title="Copy code"
            >
              <FontAwesomeIcon
                icon="copy"
                className="w-4 h-4 text-muted-foreground group-hover/btn:text-foreground transition-colors"
              />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 hover:bg-secondary/50 rounded transition-colors group/btn"
              title="Download file"
            >
              <FontAwesomeIcon
                icon="download"
                className="w-4 h-4 text-muted-foreground group-hover/btn:text-foreground transition-colors"
              />
            </button>
          </div>
        </div>
        <div
          className={`${needsExpand && !isExpanded ? "max-h-[400px] overflow-hidden" : ""} relative`}
        >
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: "13px",
              lineHeight: "1.5",
            }}
            showLineNumbers
            wrapLines
          >
            {displayCode}
          </SyntaxHighlighter>
          {needsExpand && !isExpanded && (
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#1e1e1e] to-transparent pointer-events-none" />
          )}
        </div>
        {needsExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-2 bg-[#2d2d2d] border-t border-border/20 flex items-center gap-2 hover:bg-[#3d3d3d] transition-colors text-sm text-muted-foreground hover:text-foreground"
          >
            <FontAwesomeIcon
              icon="chevron-down"
              className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
            <span className="font-medium">{isExpanded ? "Collapse" : "Expand"}</span>
            <FontAwesomeIcon icon="maximize" className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
