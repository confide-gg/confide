import { useEffect, useState, useCallback } from "react";
import { Search, Star, Loader2, ArrowLeft } from "lucide-react";
import { tenor, TenorGif, TenorCategory } from "../../features/chat/tenor";
import { gifFavoritesService, FavoriteGif } from "../../features/chat/gifFavorites";
import { cn } from "../../lib/utils";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onTabChange?: (tab: "gif" | "emoji") => void;
  activeTab?: "gif" | "emoji";
  className?: string;
}

export function GifPicker({ onSelect, onTabChange, activeTab = "gif", className }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenorGif[]>([]);
  const [categories, setCategories] = useState<TenorCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contentTab, setContentTab] = useState<"trending" | "search" | "favorites">("trending");
  const [favorites, setFavorites] = useState<FavoriteGif[]>([]);
  const [viewMode, setViewMode] = useState<"categories" | "results">("categories");
  const [favoriteUrls, setFavoriteUrls] = useState<Set<string>>(new Set());
  const [trendingPreview, setTrendingPreview] = useState<TenorGif[]>([]);
  const [hoveredGif, setHoveredGif] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    loadFavoritesFromDB();
    loadTrendingPreview();
  }, []);

  const loadFavoritesFromDB = async () => {
    try {
      const favs = await gifFavoritesService.getFavorites();
      setFavorites(favs);
      setFavoriteUrls(new Set(favs.map((f) => f.gif_url)));
    } catch (err) {
      console.error("Failed to load favorites", err);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await tenor.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load gif categories", err);
    }
  };

  const loadTrendingPreview = async () => {
    try {
      const gifs = await tenor.getTrending(4);
      setTrendingPreview(gifs);
    } catch (err) {
      console.error("Failed to load trending preview", err);
    }
  };

  const loadTrending = async () => {
    setIsLoading(true);
    try {
      const gifs = await tenor.getTrending();
      setResults(gifs);
      setContentTab("trending");
      setViewMode("results");
    } catch (err) {
      console.error("Failed to load trending gifs", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFavorites = () => {
    setContentTab("favorites");
    setViewMode("results");
  };

  const handleCategoryClick = async (searchterm: string) => {
    setQuery(searchterm);
    setIsLoading(true);
    setViewMode("results");
    setContentTab("search");
    try {
      const gifs = await tenor.search(searchterm);
      setResults(gifs);
    } catch (err) {
      console.error("Failed to search gifs", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setViewMode("categories");
      return;
    }
    setIsLoading(true);
    setContentTab("search");
    setViewMode("results");
    try {
      const gifs = await tenor.search(q);
      setResults(gifs);
    } catch (err) {
      console.error("Failed to search gifs", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) handleSearch(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const toggleFavorite = async (url: string, previewUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (favoriteUrls.has(url)) {
        await gifFavoritesService.removeFavorite(url);
        setFavorites((prev) => prev.filter((f) => f.gif_url !== url));
        setFavoriteUrls((prev) => {
          const next = new Set(prev);
          next.delete(url);
          return next;
        });
      } else {
        const fav = await gifFavoritesService.addFavorite(url, previewUrl);
        setFavorites((prev) => [fav, ...prev]);
        setFavoriteUrls((prev) => new Set(prev).add(url));
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col w-[456px] h-[420px] bg-card border border-border rounded-lg shadow-xl overflow-hidden",
        className
      )}
    >
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-border/50">
        <button
          onClick={() => onTabChange?.("gif")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            activeTab === "gif"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          GIFs
        </button>
        <button
          onClick={() => onTabChange?.("emoji")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            activeTab === "emoji"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
        >
          Emoji
        </button>
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          {viewMode === "results" && (
            <button
              onClick={() => {
                setViewMode("categories");
                setQuery("");
              }}
              className="p-1.5 hover:bg-secondary/50 rounded-md transition-colors shrink-0"
              title="Back to categories"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GIFs via Tenor..."
              className="w-full pl-9 pr-3 py-2 bg-secondary/30 border border-border/50 rounded-md text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : viewMode === "categories" ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loadFavorites}
              className="relative aspect-video rounded-lg overflow-hidden group cursor-pointer border border-border/50 hover:border-border hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              {favorites.length > 0 ? (
                <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
                  {favorites.slice(0, 4).map((fav, i) => (
                    <div key={i} className="relative overflow-hidden">
                      <img
                        src={fav.gif_preview_url || fav.gif_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/40 via-pink-500/30 to-blue-500/40" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute inset-0 flex items-end p-3">
                <p className="text-white font-semibold text-sm drop-shadow-lg">Favourites</p>
              </div>
            </button>

            <button
              onClick={loadTrending}
              className="relative aspect-video rounded-lg overflow-hidden group cursor-pointer border border-border/50 hover:border-border hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              {trendingPreview.length > 0 ? (
                <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
                  {trendingPreview.slice(0, 4).map((gif, i) => (
                    <div key={i} className="relative overflow-hidden">
                      <img
                        src={gif.media_formats.tinygif.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/40 via-red-500/30 to-pink-500/40" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute inset-0 flex items-end p-3">
                <p className="text-white font-semibold text-sm drop-shadow-lg">Trending GIFs</p>
              </div>
            </button>

            {categories.map((cat) => (
              <button
                key={cat.searchterm}
                onClick={() => handleCategoryClick(cat.searchterm)}
                className="relative aspect-video rounded-lg overflow-hidden group cursor-pointer border border-border/50 hover:border-border hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute inset-0 flex items-end p-3">
                  <p className="text-white font-semibold text-sm drop-shadow-lg capitalize">
                    {cat.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : contentTab === "favorites" ? (
          favorites.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="relative aspect-video rounded-lg overflow-hidden cursor-pointer group border border-border/50 hover:border-border hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                  onClick={() => onSelect(fav.gif_url)}
                  onMouseEnter={() => setHoveredGif("Favorite GIF")}
                  onMouseLeave={() => setHoveredGif(null)}
                >
                  <img
                    src={fav.gif_preview_url || fav.gif_url}
                    alt="Favorite"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  <button
                    className="absolute top-2 right-2 p-1.5 bg-primary/80 backdrop-blur-sm rounded-md opacity-0 group-hover:opacity-100 hover:bg-primary transition-all"
                    onClick={(e) => toggleFavorite(fav.gif_url, fav.gif_preview_url, e)}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3">
              <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center">
                <Star className="w-8 h-8" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">No favorites yet</p>
                <p className="text-xs text-muted-foreground/70">
                  Click the star on any GIF to save it here
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {results.map((gif) => {
              const url = gif.media_formats.mediumgif?.url || gif.media_formats.gif?.url;
              const previewUrl = gif.media_formats.tinygif.url;
              const isFav = favoriteUrls.has(url);
              return (
                <div
                  key={gif.id}
                  className="relative aspect-video rounded-lg overflow-hidden cursor-pointer bg-secondary/20 group border border-border/50 hover:border-border hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                  onClick={() => onSelect(url)}
                  onMouseEnter={() => setHoveredGif(gif.title || "GIF")}
                  onMouseLeave={() => setHoveredGif(null)}
                >
                  <img
                    src={previewUrl}
                    alt={gif.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                  <button
                    className={cn(
                      "absolute top-2 right-2 p-1.5 backdrop-blur-sm rounded-md transition-all",
                      isFav
                        ? "bg-primary/80 text-primary-foreground hover:bg-primary opacity-100"
                        : "bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => toggleFavorite(url, previewUrl, e)}
                  >
                    <Star className={cn("w-3.5 h-3.5", isFav ? "fill-current" : "")} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-secondary/20 h-12">
        {hoveredGif ? (
          <span className="text-sm text-muted-foreground truncate">{hoveredGif}</span>
        ) : (
          <span className="text-sm text-muted-foreground">Search or select a GIF</span>
        )}
      </div>
    </div>
  );
}
