import { fetch } from "@tauri-apps/plugin-http";
import { CENTRAL_API_URL } from "../../config";

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
        this.name = "ApiError";
    }
}

class HttpClient {
    private authToken: string | null = null;
    private isLoggingOut = false;
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    public setAuthToken(token: string | null) {
        this.authToken = token;
        if (token) {
            this.isLoggingOut = false;
        }
    }

    public getAuthToken(): string | null {
        return this.authToken;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.authToken) {
            headers["Authorization"] = `Bearer ${this.authToken}`;
        }
        return headers;
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            if (response.status === 401) {
                if (!this.isLoggingOut) {
                    console.warn("[Client] Received 401 Unauthorized - triggering logout");
                    this.isLoggingOut = true;
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

        const text = await response.text();
        if (!text || text.length === 0) {
            return undefined as T;
        }
        return JSON.parse(text);
    }

    public async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
        let url = `${this.baseUrl}${endpoint}`;
        if (params) {
            const searchParams = new URLSearchParams(params);
            url += `?${searchParams.toString()}`;
        }
        const response = await fetch(url, {
            method: "GET",
            headers: this.getHeaders(),
        });
        return this.handleResponse<T>(response);
    }

    public async post<T, B = unknown>(endpoint: string, body?: B): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse<T>(response);
    }

    public async put<T, B = unknown>(endpoint: string, body?: B): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "PUT",
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse<T>(response);
    }

    public async patch<T, B = unknown>(endpoint: string, body?: B): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "PATCH",
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse<T>(response);
    }

    public async del<T, B = unknown>(endpoint: string, body?: B): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "DELETE",
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse<T>(response);
    }
}

export const httpClient = new HttpClient(CENTRAL_API_URL);
