import { compressionService } from './CompressionService';
import { fileEncryptionService } from './FileEncryptionService';

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

const CHUNK_SIZE = 5 * 1024 * 1024;

class AttachmentUploadService {
  async uploadFile(
    file: File,
    conversationId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<FileMetadata> {
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
    const totalChunks = Math.ceil(encryptedBlob.size / CHUNK_SIZE);
    const uploadId = this.generateUploadId();

    let uploadedBytes = 0;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, encryptedBlob.size);
      const chunk = encryptedBlob.slice(start, end);

      await this.uploadChunk(
        chunk,
        chunkIndex,
        totalChunks,
        uploadId,
        conversationId,
        file.name,
        file.type
      );

      uploadedBytes += chunk.size;
      const progress = Math.round((uploadedBytes / encryptedBlob.size) * 100);
      onProgress?.({ stage: 'uploading', progress });
    }

    const s3_key = await this.finalizeUpload(
      uploadId,
      conversationId,
      file.name,
      file.type,
      encryptedBlob.size
    );

    onProgress?.({ stage: 'complete', progress: 100 });

    const s3Url = `s3://${s3_key}`;

    const metadata: FileMetadata = {
      type: 'file',
      file: {
        url: s3Url,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        encryptedSize: encryptedBlob.size,
        compressionType: compressionResult.compressionType,
        fileKey: this.bytesToBase64(encryptedFile.fileKey),
      },
    };

    return metadata;
  }

  private async uploadChunk(
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    uploadId: string,
    conversationId: string,
    filename: string,
    mimeType: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Chunk upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Chunk upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Chunk upload aborted')));

      xhr.open(
        'POST',
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/attachments/upload-chunk`
      );
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('auth_token')}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('x-conversation-id', conversationId);
      xhr.setRequestHeader('x-filename', filename);
      xhr.setRequestHeader('x-mime-type', mimeType);
      xhr.setRequestHeader('x-upload-id', uploadId);
      xhr.setRequestHeader('x-chunk-index', chunkIndex.toString());
      xhr.setRequestHeader('x-total-chunks', totalChunks.toString());

      xhr.send(chunk);
    });
  }

  private async finalizeUpload(
    uploadId: string,
    conversationId: string,
    filename: string,
    mimeType: string,
    totalSize: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.s3_key);
        } else {
          reject(new Error(`Finalize upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Finalize upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Finalize upload aborted')));

      xhr.open(
        'POST',
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/attachments/finalize-upload`
      );
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('auth_token')}`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.send(JSON.stringify({
        upload_id: uploadId,
        conversation_id: conversationId,
        filename,
        mime_type: mimeType,
        total_size: totalSize,
      }));
    });
  }

  private generateUploadId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private bytesToBase64(bytes: number[]): string {
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
  }
}

export const attachmentUploadService = new AttachmentUploadService();
