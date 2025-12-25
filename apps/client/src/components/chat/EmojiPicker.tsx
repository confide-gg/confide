import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import data from "@emoji-mart/data";
import type { EmojiMartData, Emoji } from "@emoji-mart/data";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const emojiData = data as EmojiMartData;

interface EmojiPickerProps {
  onSelect: (emoji: { native: string; id: string }) => void;
  onTabChange?: (tab: "gif" | "emoji") => void;
  activeTab?: "gif" | "emoji";
  className?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  frequent: "🕐",
  people: "😀",
  nature: "🐻",
  foods: "🍔",
  activity: "⚽",
  places: "✈️",
  objects: "💡",
  symbols: "💕",
  flags: "🏳️",
};

const CATEGORY_NAMES: Record<string, string> = {
  frequent: "Frequently Used",
  people: "People",
  nature: "Nature",
  foods: "Food & Drink",
  activity: "Activities",
  places: "Travel & Places",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
};

const FREQUENT_STORAGE_KEY = "emoji-frequent";
const MAX_FREQUENT = 36;

function getFrequentEmojis(): string[] {
  try {
    const stored = localStorage.getItem(FREQUENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addFrequentEmoji(emojiId: string) {
  try {
    const frequent = getFrequentEmojis().filter((id) => id !== emojiId);
    frequent.unshift(emojiId);
    localStorage.setItem(FREQUENT_STORAGE_KEY, JSON.stringify(frequent.slice(0, MAX_FREQUENT)));
  } catch {}
}

function getEmojiNative(emoji: Emoji, skinTone: number = 0): string {
  return emoji.skins[skinTone]?.native || emoji.skins[0]?.native || "";
}

export function EmojiPicker({
  onSelect,
  onTabChange,
  activeTab = "emoji",
  className,
}: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const [hoveredEmoji, setHoveredEmoji] = useState<{
    native: string;
    id: string;
  } | null>(null);
  const [activeCategory, setActiveCategory] = useState("frequent");
  const [frequentEmojis, setFrequentEmojis] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setFrequentEmojis(getFrequentEmojis());
  }, []);

  const categories = useMemo(() => {
    const cats: { id: string; emojis: Emoji[] }[] = [];

    if (frequentEmojis.length > 0) {
      const freqEmojis = frequentEmojis.map((id) => emojiData.emojis[id]).filter(Boolean);
      if (freqEmojis.length > 0) {
        cats.push({ id: "frequent", emojis: freqEmojis });
      }
    }

    for (const cat of emojiData.categories) {
      const emojis = cat.emojis.map((id) => emojiData.emojis[id]).filter(Boolean);
      if (emojis.length > 0) {
        cats.push({ id: cat.id, emojis });
      }
    }

    return cats;
  }, [frequentEmojis]);

  const filteredCategories = useMemo(() => {
    if (!query.trim()) return categories;

    const q = query.toLowerCase().replace(/:/g, "");
    const matchingEmojis: Emoji[] = [];

    for (const emoji of Object.values(emojiData.emojis)) {
      if (
        emoji.id.includes(q) ||
        emoji.name.toLowerCase().includes(q) ||
        emoji.keywords.some((k) => k.includes(q))
      ) {
        matchingEmojis.push(emoji);
      }
    }

    if (matchingEmojis.length === 0) return [];
    return [{ id: "search", emojis: matchingEmojis }];
  }, [query, categories]);

  const handleEmojiClick = useCallback(
    (emoji: Emoji) => {
      const native = getEmojiNative(emoji);
      addFrequentEmoji(emoji.id);
      setFrequentEmojis(getFrequentEmojis());
      onSelect({ native, id: emoji.id });
    },
    [onSelect]
  );

  const scrollToCategory = useCallback((categoryId: string) => {
    const el = categoryRefs.current[categoryId];
    if (el && contentRef.current) {
      contentRef.current.scrollTo({
        top: el.offsetTop - contentRef.current.offsetTop,
        behavior: "smooth",
      });
    }
    setActiveCategory(categoryId);
  }, []);

  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const scrollTop = contentRef.current.scrollTop;
    const containerTop = contentRef.current.offsetTop;

    for (const cat of categories) {
      const el = categoryRefs.current[cat.id];
      if (el) {
        const elTop = el.offsetTop - containerTop;
        const elBottom = elTop + el.offsetHeight;
        if (scrollTop >= elTop - 50 && scrollTop < elBottom - 50) {
          setActiveCategory(cat.id);
          break;
        }
      }
    }
  }, [categories]);

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
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <FontAwesomeIcon
              icon="magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={hoveredEmoji ? `:${hoveredEmoji.id}:` : "Search emoji..."}
              className="w-full pl-9 pr-3 py-2 bg-secondary/30 border border-border/50 rounded-md text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
            />
          </div>
          {hoveredEmoji && <span className="text-2xl shrink-0">{hoveredEmoji.native}</span>}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <TooltipProvider delayDuration={100}>
          <div className="w-10 flex flex-col items-center py-1 border-r border-border/30 bg-secondary/10">
            {categories.map((cat) => (
              <Tooltip key={cat.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => scrollToCategory(cat.id)}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-md text-base transition-colors",
                      activeCategory === cat.id
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    {CATEGORY_ICONS[cat.id] || "📁"}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {CATEGORY_NAMES[cat.id] || cat.id}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>

        <div ref={contentRef} className="flex-1 overflow-y-auto px-2 py-1" onScroll={handleScroll}>
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <span className="text-3xl mb-2">😕</span>
              <span className="text-sm">No emojis found</span>
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div
                key={cat.id}
                ref={(el) => {
                  categoryRefs.current[cat.id] = el;
                }}
              >
                <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-1 py-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {cat.id === "search" ? "Search Results" : CATEGORY_NAMES[cat.id] || cat.id}
                  </span>
                </div>
                <div className="grid grid-cols-9 gap-0.5">
                  {cat.emojis.map((emoji) => {
                    const native = getEmojiNative(emoji);
                    return (
                      <button
                        key={emoji.id}
                        onClick={() => handleEmojiClick(emoji)}
                        onMouseEnter={() => setHoveredEmoji({ native, id: emoji.id })}
                        onMouseLeave={() => setHoveredEmoji(null)}
                        className="w-9 h-9 flex items-center justify-center text-2xl rounded-md hover:bg-secondary/70 transition-colors"
                        title={`:${emoji.id}:`}
                      >
                        {native}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-secondary/20 h-12">
        {hoveredEmoji ? (
          <>
            <span className="text-2xl">{hoveredEmoji.native}</span>
            <span className="text-sm text-muted-foreground">:{hoveredEmoji.id}:</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Select an emoji</span>
        )}
      </div>
    </div>
  );
}
