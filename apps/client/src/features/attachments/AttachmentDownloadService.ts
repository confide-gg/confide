import { compressionService, CompressionType } from "./CompressionService";
import { fileEncryptionService } from "./FileEncryptionService";
import { FileMetadata } from "./AttachmentUploadService";

class AttachmentDownloadService {
  async downloadAndDecryptFile(metadata: FileMetadata): Promise<Blob> {
    const { url, fileKey, compressionType, mimeType } = metadata.file;

    const s3Key = url.replace("s3://", "");

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:3000/api"}/attachments/download/${encodeURIComponent(s3Key)}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    const encryptedBlob = await response.blob();

    const fileKeyBytes = this.base64ToBytes(fileKey);
    const decryptedBlob = await fileEncryptionService.decryptFile(encryptedBlob, fileKeyBytes);

    const finalBlob = await compressionService.decompressFile(
      decryptedBlob,
      compressionType as CompressionType,
      mimeType
    );

    return finalBlob;
  }

  async downloadAndSaveFile(metadata: FileMetadata): Promise<void> {
    const blob = await this.downloadAndDecryptFile(metadata);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = metadata.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private base64ToBytes(base64: string): number[] {
    const binary = atob(base64);
    return Array.from(binary, (c) => c.charCodeAt(0));
  }
}

export const attachmentDownloadService = new AttachmentDownloadService();
