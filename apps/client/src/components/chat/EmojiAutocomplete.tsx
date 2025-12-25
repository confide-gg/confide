import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import data from "@emoji-mart/data";
import type { EmojiMartData } from "@emoji-mart/data";
import { cn } from "../../lib/utils";

const emojiData = data as EmojiMartData;

interface EmojiAutocompleteProps {
  text: string;
  onSelect: (emoji: string, shortcode: string) => void;
  onClose: () => void;
  className?: string;
}

interface EmojiMatch {
  id: string;
  native: string;
  name: string;
}

function getShortcodeQuery(text: string): string | null {
  const match = text.match(/:([a-zA-Z0-9_+-]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

function searchEmojis(query: string, limit: number = 10): EmojiMatch[] {
  const results: EmojiMatch[] = [];
  const q = query.toLowerCase();

  for (const [id, emoji] of Object.entries(emojiData.emojis)) {
    if (results.length >= limit) break;

    const matches =
      id.includes(q) ||
      emoji.name.toLowerCase().includes(q) ||
      emoji.keywords.some((k) => k.includes(q));

    if (matches && emoji.skins[0]?.native) {
      results.push({
        id,
        native: emoji.skins[0].native,
        name: emoji.name,
      });
    }
  }

  return results.sort((a, b) => {
    const aStartsWith = a.id.startsWith(q) ? 0 : 1;
    const bStartsWith = b.id.startsWith(q) ? 0 : 1;
    return aStartsWith - bStartsWith || a.id.localeCompare(b.id);
  });
}

export function EmojiAutocomplete({ text, onSelect, onClose, className }: EmojiAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const query = useMemo(() => getShortcodeQuery(text), [text]);
  const results = useMemo(() => (query ? searchEmojis(query) : []), [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (emoji: EmojiMatch) => {
      onSelect(emoji.native, emoji.id);
    },
    [onSelect]
  );

  useEffect(() => {
    if (!query || results.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case "Enter":
        case "Tab":
          if (results[selectedIndex]) {
            e.preventDefault();
            e.stopPropagation();
            handleSelect(results[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [query, results, selectedIndex, handleSelect, onClose]);

  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, results.length]);

  if (!query || results.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute bottom-full left-0 mb-2 w-72 max-h-64 overflow-hidden bg-card border border-border rounded-lg shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-100",
        className
      )}
    >
      <div className="px-3 py-2 border-b border-border/50 bg-secondary/20">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Emoji matching :{query}
        </span>
      </div>
      <div ref={listRef} className="py-1 max-h-48 overflow-y-auto">
        {results.map((emoji, index) => (
          <button
            key={emoji.id}
            onClick={() => handleSelect(emoji)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-1.5 text-left",
              index === selectedIndex
                ? "bg-secondary text-foreground"
                : "hover:bg-secondary/50 text-foreground"
            )}
          >
            <span className="text-xl w-6 text-center">{emoji.native}</span>
            <span className="text-sm">:{emoji.id}:</span>
          </button>
        ))}
      </div>
    </div>
  );
}
