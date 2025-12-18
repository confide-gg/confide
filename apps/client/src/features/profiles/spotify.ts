import { httpClient } from "../../core/network/HttpClient";
import type { SpotifyStatus, CurrentTrack } from "./types";

export interface SpotifyConnectResponse {
    auth_url: string;
}

class SpotifyService {
    public async connect(): Promise<SpotifyConnectResponse> {
        return httpClient.get<SpotifyConnectResponse>("/spotify/connect");
    }

    public async disconnect(): Promise<void> {
        return httpClient.del<void>("/spotify/disconnect");
    }

    public async getStatus(): Promise<SpotifyStatus> {
        return httpClient.get<SpotifyStatus>("/spotify/status");
    }

    public async getCurrentTrack(): Promise<CurrentTrack> {
        return httpClient.get<CurrentTrack>("/spotify/current-track");
    }

    public async refreshActivityNow(): Promise<void> {
        return httpClient.post<void>("/spotify/refresh-activity");
    }
}

export const spotifyService = new SpotifyService();
