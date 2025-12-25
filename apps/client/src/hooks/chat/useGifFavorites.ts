import { useCallback } from "react";
import { httpClient } from "../../core/network/HttpClient";
import type { FavoriteGif } from "../../types";

export function useGifFavorites(
  favoriteGifUrls: Set<string>,
  setFavoriteGifUrls: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  const loadFavoriteGifs = useCallback(async () => {
    try {
      const favs = await httpClient.get<FavoriteGif[]>("/gifs/favorites");
      setFavoriteGifUrls(new Set(favs.map((f) => f.gif_url)));
    } catch (err) {
      console.error("Failed to load favorite GIFs:", err);
    }
  }, [setFavoriteGifUrls]);

  const toggleFavoriteGif = useCallback(
    async (gifUrl: string, previewUrl?: string) => {
      try {
        if (favoriteGifUrls.has(gifUrl)) {
          await httpClient.del("/gifs/favorites", { gif_url: gifUrl });
          setFavoriteGifUrls((prev) => {
            const newSet = new Set(prev);
            newSet.delete(gifUrl);
            return newSet;
          });
        } else {
          await httpClient.post<FavoriteGif>("/gifs/favorites", {
            gif_url: gifUrl,
            gif_preview_url: previewUrl || gifUrl,
          });
          setFavoriteGifUrls((prev) => new Set([...prev, gifUrl]));
        }
      } catch (err) {
        console.error("Failed to toggle favorite:", err);
      }
    },
    [favoriteGifUrls, setFavoriteGifUrls]
  );

  return { loadFavoriteGifs, toggleFavoriteGif };
}
