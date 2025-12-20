import { compressionService } from './CompressionService';
import { fileEncryptionService } from './FileEncryptionService';
import { validateFile, sanitizeFilename } from '../../utils/fileValidation';

export interface FileMetadata {
  type: 'file';
  text?: string;
  file: {
    url: string;
    name: string;
    size: number;
    mimeType: string;
    encryptedSize: number;
    compressionType: string;
    fileKey: string;
  };
}

export interface UploadProgress {
  stage: 'compressing' | 'encrypting' | 'uploading' | 'complete';
  progress: number;
}

class AttachmentUploadService {
  async uploadFile(
    file: File,
    conversationId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<FileMetadata> {
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    onProgress?.({ stage: 'compressing', progress: 0 });
    const compressionResult = await compressionService.compressFile(file);
    onProgress?.({ stage: 'compressing', progress: 100 });

    onProgress?.({ stage: 'encrypting', progress: 0 });
    const encryptedFile = await fileEncryptionService.encryptFile(
      compressionResult.compressedData
    );
    onProgress?.({ stage: 'encrypting', progress: 100 });
    onProgress?.({ stage: 'uploading', progress: 0 });

    const encryptedBlob = encryptedFile.encryptedData;

    const s3_key = await this.uploadDirect(
      encryptedBlob,
      conversationId,
      file.name,
      file.type,
      (progress) => onProgress?.({ stage: 'uploading', progress })
    );

    onProgress?.({ stage: 'complete', progress: 100 });

    const s3Url = `s3://${s3_key}`;

    const metadata: FileMetadata = {
      type: 'file',
      file: {
        url: s3Url,
        name: sanitizeFilename(file.name),
        size: file.size,
        mimeType: file.type,
        encryptedSize: encryptedBlob.size,
        compressionType: compressionResult.compressionType,
        fileKey: this.bytesToBase64(encryptedFile.fileKey),
      },
    };

    return metadata;
  }

  private async uploadDirect(
    encryptedBlob: Blob,
    conversationId: string,
    filename: string,
    mimeType: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress?.(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.s3_key);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.open(
        'POST',
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/attachments/upload`
      );
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('auth_token')}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('x-conversation-id', conversationId);
      xhr.setRequestHeader('x-filename', filename);
      xhr.setRequestHeader('x-mime-type', mimeType);

      xhr.send(encryptedBlob);
    });
  }

  private bytesToBase64(bytes: number[]): string {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  }
}

export const attachmentUploadService = new AttachmentUploadService();
