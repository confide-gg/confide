export type SearchFilterType = "from" | "has" | "mentions" | "before" | "after";

export type ContentFilterValue = "link" | "file" | "image" | "gif";

export interface SearchFilter {
  type: SearchFilterType;
  value: string;
  displayValue?: string;
}

export interface SearchResult {
  id: string;
  conversationId: string;
  conversationName: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isGroup: boolean;
  hasLink: boolean;
  hasFile: boolean;
  hasImage: boolean;
  isGif: boolean;
}

export type SortOption = "newest" | "oldest";

export interface ParsedFileContent {
  type: "file";
  file: {
    name: string;
    mimeType: string;
    url: string;
    size: number;
  };
  text?: string;
}

export function parseMessageContent(content: string): {
  text: string;
  hasLink: boolean;
  hasFile: boolean;
  hasImage: boolean;
  isGif: boolean;
  fileData?: ParsedFileContent;
} {
  const isGif = content.startsWith("https://") && content.includes("tenor");

  if (isGif) {
    return { text: content, hasLink: true, hasFile: false, hasImage: false, isGif: true };
  }

  try {
    const parsed = JSON.parse(content);
    if (parsed.type === "file" && parsed.file) {
      const fileData = parsed as ParsedFileContent;
      const mimeType = fileData.file.mimeType || "";
      const isImage = mimeType.startsWith("image/");

      return {
        text: fileData.text || fileData.file.name,
        hasLink: false,
        hasFile: true,
        hasImage: isImage,
        isGif: false,
        fileData,
      };
    }
  } catch {
    // Not JSON, treat as plain text
  }

  const hasLink = /https?:\/\/[^\s]+/.test(content);

  return { text: content, hasLink, hasFile: false, hasImage: false, isGif: false };
}
