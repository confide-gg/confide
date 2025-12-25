import { httpClient } from "../../core/network/HttpClient";

export interface FavoriteGif {
  id: string;
  user_id: string;
  gif_url: string;
  gif_preview_url: string;
  created_at: string;
}

interface AddFavoriteRequest {
  gif_url: string;
  gif_preview_url: string;
}

interface RemoveFavoriteRequest {
  gif_url: string;
}

interface RemoveFavoriteResponse {
  success: boolean;
}

class GifFavoritesService {
  async getFavorites(): Promise<FavoriteGif[]> {
    return httpClient.get<FavoriteGif[]>("/gifs/favorites");
  }

  async addFavorite(gifUrl: string, gifPreviewUrl: string): Promise<FavoriteGif> {
    return httpClient.post<FavoriteGif>("/gifs/favorites", {
      gif_url: gifUrl,
      gif_preview_url: gifPreviewUrl,
    } as AddFavoriteRequest);
  }

  async removeFavorite(gifUrl: string): Promise<RemoveFavoriteResponse> {
    return httpClient.del<RemoveFavoriteResponse>("/gifs/favorites", {
      gif_url: gifUrl,
    } as RemoveFavoriteRequest);
  }
}

export const gifFavoritesService = new GifFavoritesService();
