import imageCompression from 'browser-image-compression';
import pako from 'pako';

export type CompressionType = 'webp' | 'h265' | 'brotli' | 'none';

export interface CompressionResult {
  compressedData: Blob;
  originalSize: number;
  compressedSize: number;
  compressionType: CompressionType;
}

class CompressionService {
  async compressFile(file: File): Promise<CompressionResult> {
    const mimeType = file.type;
    const originalSize = file.size;

    if (mimeType.startsWith('image/')) {
      return this.compressImage(file);
    }

    if (this.isDocument(mimeType)) {
      return this.compressDocument(file);
    }

    return {
      compressedData: file,
      originalSize,
      compressedSize: file.size,
      compressionType: 'none',
    };
  }

  private async compressImage(file: File): Promise<CompressionResult> {
    const originalSize = file.size;

    if (file.type === 'image/webp' && file.size < 500000) {
      return {
        compressedData: file,
        originalSize,
        compressedSize: file.size,
        compressionType: 'none',
      };
    }

    const options = {
      maxSizeMB: 5,
      useWebWorker: true,
      fileType: 'image/webp' as const,
      initialQuality: file.type === 'image/png' ? 1.0 : 0.9,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return {
        compressedData: compressedFile,
        originalSize,
        compressedSize: compressedFile.size,
        compressionType: 'webp',
      };
    } catch (error) {
      console.warn('Image compression failed, using original:', error);
      return {
        compressedData: file,
        originalSize,
        compressedSize: file.size,
        compressionType: 'none',
      };
    }
  }

  private async compressDocument(file: File): Promise<CompressionResult> {
    const originalSize = file.size;

    if (file.size < 100000) {
      return {
        compressedData: file,
        originalSize,
        compressedSize: file.size,
        compressionType: 'none',
      };
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const compressed = pako.gzip(new Uint8Array(arrayBuffer), { level: 6 });
      const blob = new Blob([compressed], { type: 'application/gzip' });

      if (blob.size < file.size * 0.9) {
        return {
          compressedData: blob,
          originalSize,
          compressedSize: blob.size,
          compressionType: 'brotli',
        };
      }

      return {
        compressedData: file,
        originalSize,
        compressedSize: file.size,
        compressionType: 'none',
      };
    } catch (error) {
      console.warn('Document compression failed, using original:', error);
      return {
        compressedData: file,
        originalSize,
        compressedSize: file.size,
        compressionType: 'none',
      };
    }
  }

  async decompressFile(
    compressedData: Blob,
    compressionType: CompressionType,
    originalMimeType: string
  ): Promise<Blob> {
    if (compressionType === 'none' || compressionType === 'webp') {
      return compressedData;
    }

    if (compressionType === 'brotli') {
      const arrayBuffer = await compressedData.arrayBuffer();
      const decompressed = pako.ungzip(new Uint8Array(arrayBuffer));
      return new Blob([decompressed], { type: originalMimeType });
    }

    return compressedData;
  }

  private isDocument(mimeType: string): boolean {
    return [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ].includes(mimeType);
  }
}

export const compressionService = new CompressionService();
