export function formatReplyPreview(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === "file" && parsed.file) {
      const caption = parsed.text ? ` - ${parsed.text}` : "";
      return `${parsed.file.name}${caption}`;
    }
  } catch {}
  return content;
}

export function isFileAttachment(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed.type === "file" && parsed.file;
  } catch {
    return false;
  }
}

export function getPreviewContent(content: string): string {
  if (isFileAttachment(content)) {
    return "📎 Attachment";
  }
  if (content.startsWith("https://") && content.includes("tenor")) {
    return "GIF";
  }
  return content;
}
