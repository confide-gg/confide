import { httpClient } from "../../core/network/HttpClient";
import { CENTRAL_API_URL } from "../../config";

export interface UploadResponse {
  id: string;
  url: string;
}

class UploadService {
  public async uploadFile(file: File, type: "avatar" | "banner"): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);

    const token = httpClient.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // HttpClient doesn't support FormData directly yet (it assumes JSON by default and adds Content-Type).
    // So we use fetch directly or extend HttpClient.
    // HttpClient `post` stringifies body.
    // We should probably just use fetch here or use `httpClient` if it supports custom body/headers.
    // HttpClient adds Content-Type: application/json. Fetch with FormData should NOT have Content-Type set manually (browser sets boundary).

    // I will use raw fetch here for now, similar to how it was, but cleaner.
    // Or I should add `upload` method to HttpClient.
    // Given the complexity, I'll keep logic here using fetch but use CENTRAL_API_URL (which I need to import or reuse from HttpClient).

    // Actually, I can use `httpClient` but I need to bypass the default headers if I pass FormData.
    // Let's implement it with `fetch` here to be safe and simple.

    const response = await fetch(`${CENTRAL_API_URL}/uploads`, {
      method: "POST",
      headers, // No Content-Type
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const json = JSON.parse(text);
        message = json.error || json.message || text;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return response.json();
  }

  public async deleteFile(type: "avatar" | "banner"): Promise<void> {
    return httpClient.del<void>(`/uploads/type/${type}`);
  }

  public getUploadUrl(path: string): string {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    const baseUrl = CENTRAL_API_URL.replace(/\/api$/, "");
    return `${baseUrl}${path}`;
  }
}

export const uploadService = new UploadService();
