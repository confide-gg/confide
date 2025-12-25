import { cryptoService } from "../../core/crypto/crypto";

export interface EncryptedFile {
  encryptedData: Blob;
  fileKey: number[];
}

class FileEncryptionService {
  async encryptFile(fileData: Blob): Promise<EncryptedFile> {
    const fileKey = await cryptoService.generateConversationKey();

    const arrayBuffer = await fileData.arrayBuffer();
    const fileBytes = Array.from(new Uint8Array(arrayBuffer));

    const encryptedBytes = await cryptoService.encryptWithKey(fileKey, fileBytes);

    const encryptedData = new Blob([new Uint8Array(encryptedBytes)], {
      type: "application/octet-stream",
    });

    return {
      encryptedData,
      fileKey,
    };
  }

  async decryptFile(encryptedData: Blob, fileKey: number[]): Promise<Blob> {
    const arrayBuffer = await encryptedData.arrayBuffer();
    const encryptedBytes = Array.from(new Uint8Array(arrayBuffer));

    const decryptedBytes = await cryptoService.decryptWithKey(fileKey, encryptedBytes);

    return new Blob([new Uint8Array(decryptedBytes)]);
  }
}

export const fileEncryptionService = new FileEncryptionService();
