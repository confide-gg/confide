import { useEffect, useState, useCallback } from "react";
import { Search, Heart, Loader2 } from "lucide-react";
import { tenor, TenorGif, TenorCategory } from "../../features/chat/tenor";
import { cn } from "../../lib/utils";

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  className?: string;
}

export function GifPicker({ onSelect, className }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenorGif[]>([]);
  const [categories, setCategories] = useState<TenorCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"trending" | "search" | "favorites">("trending");
  const [favorites, setFavorites] = useState<string[]>([]); // Array of GIF URLs for now, should store full object ideally

  // Load initial data
  useEffect(() => {
    loadCategories();
    loadTrending();
    // Load favorites from local storage
    const storedFavs = localStorage.getItem("confide_gif_favorites");
    if (storedFavs) {
      try {
        setFavorites(JSON.parse(storedFavs));
      } catch (e) { console.error("Failed to parse favorites", e); }
    }
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await tenor.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load gif categories", err);
    }
  };

  const loadTrending = async () => {
    setIsLoading(true);
    try {
      const gifs = await tenor.getTrending();
      setResults(gifs);
      setActiveTab("trending");
    } catch (err) {
      console.error("Failed to load trending gifs", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      loadTrending();
      return;
    }
    setIsLoading(true);
    setActiveTab("search");
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

  const toggleFavorite = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(url)
        ? prev.filter(f => f !== url)
        : [...prev, url];
      localStorage.setItem("confide_gif_favorites", JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col h-80 bg-popover rounded-md overflow-hidden", className)}>
      {/* Search Header */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs via Tenor..."
            className="w-full pl-8 pr-3 py-1.5 bg-bg-elevated rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* Categories / Tabs */}
        {categories.length > 0 && !query && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            <button
              className={cn("px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors", activeTab === "trending" ? "bg-primary/20 text-primary" : "bg-muted/50 hover:bg-muted")}
              onClick={() => { setQuery(""); loadTrending(); }}
            >
              Trending
            </button>
            <button
              className={cn("px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors flex items-center gap-1", activeTab === "favorites" ? "bg-primary/20 text-primary" : "bg-muted/50 hover:bg-muted")}
              onClick={() => setActiveTab("favorites")}
            >
              <Heart className="w-3 h-3 fill-current" /> Favorites
            </button>
            {categories.map(cat => (
              <button
                key={cat.searchterm}
                className="px-3 py-1 rounded-full bg-muted/50 hover:bg-muted text-xs whitespace-nowrap transition-colors"
                onClick={() => { setQuery(cat.searchterm); }}
              >
                {cat.searchterm}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Grid */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-rounded">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : activeTab === "favorites" ? (
          favorites.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {favorites.map(url => (
                <div key={url} className="relative aspect-video rounded-md overflow-hidden cursor-pointer group" onClick={() => onSelect(url)}>
                  <img src={url} alt="Favorite" className="w-full h-full object-cover" />
                  <button
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => toggleFavorite(url, e)}
                  >
                    <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <Heart className="w-8 h-8" />
              <p className="text-sm">No favorites yet</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {results.map(gif => {
              const url = gif.media_formats.mediumgif?.url || gif.media_formats.gif?.url;
              const isFav = favorites.includes(url);
              return (
                <div
                  key={gif.id}
                  className="relative aspect-video rounded-md overflow-hidden cursor-pointer bg-muted/20 group hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => onSelect(url)}
                >
                  <img
                    src={gif.media_formats.tinygif.url}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <button
                    className={cn("absolute top-1 right-1 p-1 bg-black/50 rounded-full transition-opacity", isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                    onClick={(e) => toggleFavorite(url, e)}
                  >
                    <Heart className={cn("w-3 h-3", isFav ? "fill-red-500 text-red-500" : "text-white")} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}