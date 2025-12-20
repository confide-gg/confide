import { useQuery } from "@tanstack/react-query";
import { attachmentDownloadService } from "./AttachmentDownloadService";
import type { FileMetadata } from "./AttachmentUploadService";

export const attachmentQueryKeys = {
  all: ["attachments"] as const,
  blob: (s3Key: string) => [...attachmentQueryKeys.all, "blob", s3Key] as const,
  text: (s3Key: string) => [...attachmentQueryKeys.all, "text", s3Key] as const,
};

export function useAttachmentBlob(metadata: FileMetadata) {
  const s3Key = metadata.file.url.replace("s3://", "");

  return useQuery({
    queryKey: attachmentQueryKeys.blob(s3Key),
    queryFn: async () => {
      const blob = await attachmentDownloadService.downloadAndDecryptFile(metadata);
      const blobUrl = URL.createObjectURL(blob);
      return { blob, blobUrl };
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
  });
}

export function useAttachmentText(metadata: FileMetadata) {
  const s3Key = metadata.file.url.replace("s3://", "");

  return useQuery({
    queryKey: attachmentQueryKeys.text(s3Key),
    queryFn: async () => {
      const blob = await attachmentDownloadService.downloadAndDecryptFile(metadata);
      const text = await blob.text();
      return text;
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
  });
}
