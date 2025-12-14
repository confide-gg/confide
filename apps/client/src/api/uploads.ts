import { fetch } from "@tauri-apps/plugin-http";
import { getAuthToken } from "./client";
import { CENTRAL_API_URL } from "../config";

const API_BASE_URL = CENTRAL_API_URL;

export interface UploadResponse {
  id: string;
  url: string;
}

export async function uploadFile(file: File, type: "avatar" | "banner"): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("type", type);
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    headers,
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

export async function deleteFile(type: "avatar" | "banner"): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/uploads/type/${type}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok && response.status !== 204) {
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
}

export function getUploadUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const baseUrl = API_BASE_URL.replace(/\/api$/, "");
  return `${baseUrl}${path}`;
}
