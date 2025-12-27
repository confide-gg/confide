export const isFileAttachment = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content);
    return parsed.type === "file" && parsed.file;
  } catch {
    return false;
  }
};

export const getPreviewContent = (content: string): string => {
  if (isFileAttachment(content)) {
    return "📎 Attachment";
  }
  if (content.startsWith("https://") && content.includes("tenor")) {
    return "GIF";
  }
  return content;
};
