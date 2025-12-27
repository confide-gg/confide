import { useState } from "react";

export function useGifState() {
  const [favoriteGifUrls, setFavoriteGifUrls] = useState<Set<string>>(new Set());

  return {
    favoriteGifUrls,
    setFavoriteGifUrls,
  };
}
