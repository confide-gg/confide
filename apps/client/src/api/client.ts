import { fetch } from "@tauri-apps/plugin-http";
import { CENTRAL_API_URL } from "../config";

const API_BASE_URL = CENTRAL_API_URL;

let authToken: string | null = null;

let isLoggingOut = false;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    isLoggingOut = false;
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      if (!isLoggingOut) {
        console.warn("[Client] Received 401 Unauthorized - triggering logout");
        isLoggingOut = true;
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error || json.message || text;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message);
  }
  return response.json();
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  } else {
    console.warn("[Client] No auth token available for request");
  }
  return headers;
}

export async function get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });
  return handleResponse<T>(response);
}

export async function post<T, B = unknown>(endpoint: string, body?: B): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function put<T, B = unknown>(endpoint: string, body?: B): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function patch<T, B = unknown>(endpoint: string, body?: B): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function del<T, B = unknown>(endpoint: string, body?: B): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "DELETE",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}
