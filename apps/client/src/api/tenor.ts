import { fetch } from "@tauri-apps/plugin-http";

const TENOR_API_KEY = "AIzaSyBXrXL9qs4nS5fTjKM3W8J8KCHi_PdGXzU";
const CLIENT_KEY = "Confide";
const BASE_URL = "https://tenor.googleapis.com/v2";

export interface TenorGif {
    id: string;
    title: string;
    media_formats: {
        gif: {
            url: string;
            dims: number[];
            duration: number;
        };
        tinygif: {
            url: string;
            dims: number[];
        };
        mediumgif: {
            url: string;
            dims: number[];
        };
    };
    content_description: string;
    itemurl: string;
}

export interface TenorCategory {
    searchterm: string;
    path: string;
    image: string;
    name: string;
}

export class TenorClient {
    private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
        const searchParams = new URLSearchParams({
            key: TENOR_API_KEY,
            client_key: CLIENT_KEY,
            ...params,
        });

        const response = await fetch(`${BASE_URL}${endpoint}?${searchParams.toString()}`);
        if (!response.ok) {
            throw new Error(`Tenor API Error: ${response.statusText}`);
        }
        return response.json();
    }

    async search(q: string, limit = 20): Promise<TenorGif[]> {
        const data = await this.fetch<{ results: TenorGif[] }>("/search", {
            q,
            limit: limit.toString(),
            media_filter: "gif,tinygif,mediumgif",
        });
        return data.results;
    }

    async getTrending(limit = 20): Promise<TenorGif[]> {
        const data = await this.fetch<{ results: TenorGif[] }>("/featured", {
            limit: limit.toString(),
            media_filter: "gif,tinygif,mediumgif",
        });
        return data.results;
    }

    async getCategories(): Promise<TenorCategory[]> {
        const data = await this.fetch<{ tags: TenorCategory[] }>("/categories", {
            type: "featured"
        });
        return data.tags;
    }

    async getSuggestions(q: string): Promise<string[]> {
        const data = await this.fetch<{ results: string[] }>("/search_suggestions", { q });
        return data.results;
    }
}

export const tenor = new TenorClient();
