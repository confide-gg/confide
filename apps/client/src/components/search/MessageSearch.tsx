import {
  ArrowUpDown,
  AtSign,
  Calendar,
  FileIcon,
  ImageIcon,
  Link2,
  Search,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/chat";
import { FilterTag } from "./FilterTag";
import { SearchResultItem } from "./SearchResultItem";
import {
  ContentFilterValue,
  parseMessageContent,
  SearchFilter,
  SearchResult,
  SortOption,
} from "./types";

interface MessageSearchProps {
  conversationName?: string;
}

interface AutocompleteSuggestion {
  value: string;
  label: string;
  icon?: typeof User;
}

const FILTER_OPTIONS: {
  type: SearchFilter["type"];
  icon: typeof User;
  label: string;
  hint: string;
}[] = [
  { type: "from", icon: User, label: "From a specific user", hint: "from: username" },
  { type: "has", icon: Link2, label: "Contains content", hint: "has: link, file, image" },
  { type: "mentions", icon: AtSign, label: "Mentions a user", hint: "mentions: username" },
];

const CONTENT_SUGGESTIONS: AutocompleteSuggestion[] = [
  { value: "link", label: "Links", icon: Link2 },
  { value: "file", label: "Files", icon: FileIcon },
  { value: "image", label: "Images", icon: ImageIcon },
];

export function MessageSearch({ conversationName }: MessageSearchProps) {
  const { activeChat, chatMessages } = useChat();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [view, setView] = useState<"filters" | "results">("filters");
  const [autocomplete, setAutocomplete] = useState<AutocompleteSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const uniqueSenders = useMemo(() => {
    if (!chatMessages) return [];
    const senders = new Map<string, string>();
    chatMessages.forEach((msg) => {
      if (msg.senderName && !msg.isSystem) {
        senders.set(msg.senderId, msg.senderName);
      }
    });
    return Array.from(senders.values());
  }, [chatMessages]);

  const parseQueryForAutocomplete = useCallback(
    (q: string): { filterType: string | null; partial: string } => {
      const colonIdx = q.indexOf(":");
      if (colonIdx === -1) return { filterType: null, partial: q };
      const filterType = q.substring(0, colonIdx).toLowerCase();
      const partial = q.substring(colonIdx + 1).trim();
      return { filterType, partial };
    },
    []
  );

  useEffect(() => {
    const { filterType, partial } = parseQueryForAutocomplete(query);

    if (!filterType) {
      setAutocomplete([]);
      setSelectedSuggestion(0);
      return;
    }

    let suggestions: AutocompleteSuggestion[] = [];

    if (filterType === "from" || filterType === "mentions") {
      const lowerPartial = partial.toLowerCase();
      suggestions = uniqueSenders
        .filter((name) => name.toLowerCase().includes(lowerPartial))
        .slice(0, 6)
        .map((name) => ({ value: name, label: name, icon: User }));

      if (user && user.username.toLowerCase().includes(lowerPartial)) {
        const alreadyIncluded = suggestions.some(
          (s) => s.value.toLowerCase() === user.username.toLowerCase()
        );
        if (!alreadyIncluded) {
          suggestions.unshift({
            value: user.username,
            label: `${user.username} (you)`,
            icon: User,
          });
        }
      }
    } else if (filterType === "has") {
      const lowerPartial = partial.toLowerCase();
      suggestions = CONTENT_SUGGESTIONS.filter(
        (s) =>
          s.value.toLowerCase().includes(lowerPartial) ||
          s.label.toLowerCase().includes(lowerPartial)
      );
    } else if (filterType === "before" || filterType === "after") {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      suggestions = [
        { value: today.toISOString().split("T")[0], label: "Today" },
        { value: yesterday.toISOString().split("T")[0], label: "Yesterday" },
        { value: lastWeek.toISOString().split("T")[0], label: "Last week" },
        { value: lastMonth.toISOString().split("T")[0], label: "Last month" },
      ].filter((s) => s.label.toLowerCase().includes(partial.toLowerCase()) || partial === "");
    }

    setAutocomplete(suggestions);
    setSelectedSuggestion(0);
  }, [query, uniqueSenders, user, parseQueryForAutocomplete]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setQuery("");
    setFilters([]);
    setResults([]);
    setView("filters");
    setShowSortMenu(false);
    setAutocomplete([]);
  };

  const allSearchableMessages = useMemo(() => {
    if (!chatMessages || !activeChat) return [];
    return chatMessages
      .filter((msg) => !msg.isSystem)
      .map((msg) => {
        const parsed = parseMessageContent(msg.content);
        return {
          id: msg.id,
          conversationId: activeChat.conversationId,
          conversationName: activeChat.isGroup
            ? activeChat.groupName || "Group"
            : activeChat.visitorUsername,
          senderId: msg.senderId,
          senderName: msg.senderName || "Unknown",
          content: msg.content,
          createdAt: msg.createdAt,
          isGroup: activeChat.isGroup || false,
          hasLink: parsed.hasLink,
          hasFile: parsed.hasFile,
          hasImage: parsed.hasImage,
          isGif: parsed.isGif,
        };
      });
  }, [chatMessages, activeChat]);

  const performSearch = useCallback(() => {
    const { filterType } = parseQueryForAutocomplete(query);
    if (filterType && autocomplete.length > 0) return;

    const hasActiveFilters = (query.trim() && !query.includes(":")) || filters.length > 0;
    if (!hasActiveFilters) {
      setResults([]);
      if (view === "results") setView("filters");
      return;
    }

    setIsSearching(true);
    let filtered = [...allSearchableMessages];

    if (query.trim() && !query.includes(":")) {
      const searchTerms = query.toLowerCase().trim();
      filtered = filtered.filter((msg) => {
        const parsed = parseMessageContent(msg.content);
        return parsed.text.toLowerCase().includes(searchTerms);
      });
    }

    const fromFilters = filters.filter((f) => f.type === "from");
    const hasFilters = filters.filter((f) => f.type === "has");
    const mentionsFilters = filters.filter((f) => f.type === "mentions");
    const beforeFilters = filters.filter((f) => f.type === "before");
    const afterFilters = filters.filter((f) => f.type === "after");

    if (fromFilters.length > 0) {
      const fromValues = fromFilters.map((f) => f.value.toLowerCase());
      filtered = filtered.filter((msg) => fromValues.includes(msg.senderName.toLowerCase()));
    }

    if (hasFilters.length > 0) {
      filtered = filtered.filter((msg) => {
        return hasFilters.some((filter) => {
          const ct = filter.value.toLowerCase() as ContentFilterValue;
          if (ct === "link") return msg.hasLink && !msg.isGif;
          if (ct === "file") return msg.hasFile;
          if (ct === "image") return msg.hasImage || msg.isGif;
          if (ct === "gif") return msg.isGif;
          return false;
        });
      });
    }

    if (mentionsFilters.length > 0) {
      filtered = filtered.filter((msg) => {
        const parsed = parseMessageContent(msg.content);
        const text = parsed.text.toLowerCase();
        return mentionsFilters.some((f) => text.includes(`@${f.value.toLowerCase()}`));
      });
    }

    if (beforeFilters.length > 0) {
      const earliestBefore = beforeFilters
        .map((f) => new Date(f.value))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (earliestBefore) {
        filtered = filtered.filter((m) => new Date(m.createdAt) < earliestBefore);
      }
    }

    if (afterFilters.length > 0) {
      const latestAfter = afterFilters
        .map((f) => new Date(f.value))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      if (latestAfter) {
        filtered = filtered.filter((m) => new Date(m.createdAt) > latestAfter);
      }
    }

    filtered.sort((a, b) =>
      sortBy === "newest"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    setResults(filtered);
    setIsSearching(false);
    setView("results");
  }, [
    query,
    filters,
    allSearchableMessages,
    sortBy,
    view,
    autocomplete.length,
    parseQueryForAutocomplete,
  ]);

  useEffect(() => {
    const debounce = setTimeout(performSearch, 150);
    return () => clearTimeout(debounce);
  }, [performSearch]);

  const addFilter = (type: SearchFilter["type"], value: string, displayValue?: string) => {
    const alreadyExists = filters.some(
      (f) => f.type === type && f.value.toLowerCase() === value.toLowerCase()
    );
    if (alreadyExists) {
      setQuery("");
      setAutocomplete([]);
      return;
    }
    const newFilter: SearchFilter = { type, value, displayValue };
    setFilters([...filters, newFilter]);
    setQuery("");
    setAutocomplete([]);
    setView("results");
  };

  const removeFilter = (index: number) => {
    const updated = filters.filter((_, i) => i !== index);
    setFilters(updated);
    if (updated.length === 0 && !query.trim()) setView("filters");
  };

  const clearAll = () => {
    setQuery("");
    setFilters([]);
    setResults([]);
    setView("filters");
    setAutocomplete([]);
    inputRef.current?.focus();
  };

  const selectSuggestion = (suggestion: AutocompleteSuggestion) => {
    const { filterType } = parseQueryForAutocomplete(query);
    if (filterType) {
      addFilter(filterType as SearchFilter["type"], suggestion.value, suggestion.label);
    }
  };

  const handleFilterSelect = (filterType: SearchFilter["type"]) => {
    setQuery(`${filterType}:`);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (autocomplete.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev + 1) % autocomplete.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev - 1 + autocomplete.length) % autocomplete.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectSuggestion(autocomplete[selectedSuggestion]);
        return;
      }
    }

    if (e.key === "Enter" && query.includes(":")) {
      const colonIdx = query.indexOf(":");
      const filterType = query.substring(0, colonIdx).toLowerCase();
      const filterValue = query.substring(colonIdx + 1).trim();
      if (filterValue && ["from", "has", "mentions", "before", "after"].includes(filterType)) {
        addFilter(filterType as SearchFilter["type"], filterValue, filterValue);
      }
    } else if (e.key === "Backspace" && query === "" && filters.length > 0) {
      removeFilter(filters.length - 1);
    }
  };

  const handleJump = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("search-highlight");
      setTimeout(() => element.classList.remove("search-highlight"), 2000);
    }
    handleClose();
  };

  const displayName = conversationName || activeChat?.visitorUsername || "messages";
  const hasActiveFilters = (query.trim() && !query.includes(":")) || filters.length > 0;
  const showAutocomplete = autocomplete.length > 0 && query.includes(":");

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all",
          "bg-secondary/40 hover:bg-secondary/70 text-muted-foreground hover:text-foreground",
          "min-w-[160px] max-w-[200px] border border-transparent hover:border-border/50"
        )}
      >
        <Search className="w-4 h-4 shrink-0 opacity-60" />
        <span className="truncate text-xs">Search</span>
      </button>

      {isOpen && (
        <div className="absolute top-0 right-0 z-50 w-[400px] bg-popover border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-secondary/20">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {filters.map((filter, index) => (
                <FilterTag
                  key={`${filter.type}-${filter.value}-${index}`}
                  filter={filter}
                  onRemove={() => removeFilter(index)}
                />
              ))}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={filters.length > 0 ? "Add more..." : `Search in ${displayName}`}
                className="flex-1 min-w-[80px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
            </div>
            {(query || filters.length > 0) && (
              <button
                onClick={clearAll}
                className="p-1.5 hover:bg-secondary/50 rounded-md transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {showAutocomplete && (
            <div className="border-b border-border/30">
              <div className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-4 py-1.5">
                Suggestions
              </div>
              {autocomplete.map((suggestion, idx) => {
                const Icon = suggestion.icon || User;
                return (
                  <button
                    key={suggestion.value}
                    onClick={() => selectSuggestion(suggestion)}
                    className={cn(
                      "flex items-center gap-3 w-full px-4 py-2 text-left transition-colors",
                      idx === selectedSuggestion ? "bg-secondary/60" : "hover:bg-secondary/40"
                    )}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{suggestion.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!showAutocomplete && view === "filters" && !hasActiveFilters && (
            <div className="p-2">
              <div className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-2 py-1">
                Search Options
              </div>
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleFilterSelect(option.type)}
                  className="flex items-center gap-3 w-full px-2 py-2.5 rounded-md hover:bg-secondary/50 transition-colors text-left group"
                >
                  <option.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">{option.label}</div>
                    <div className="text-xs text-muted-foreground/70">{option.hint}</div>
                  </div>
                </button>
              ))}
              <div className="border-t border-border/30 mt-2 pt-2">
                <button
                  onClick={() => handleFilterSelect("before")}
                  className="flex items-center gap-3 w-full px-2 py-2.5 rounded-md hover:bg-secondary/50 transition-colors text-left group"
                >
                  <Calendar className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">Date range</div>
                    <div className="text-xs text-muted-foreground/70">before: or after: date</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {!showAutocomplete && (view === "results" || hasActiveFilters) && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-secondary/10 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {isSearching
                    ? "Searching..."
                    : `${results.length} result${results.length !== 1 ? "s" : ""}`}
                </span>
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    {sortBy === "newest" ? "Newest" : "Oldest"}
                  </button>
                  {showSortMenu && (
                    <div className="absolute right-0 top-full mt-1 w-28 bg-popover border border-border rounded-md shadow-lg py-1 z-20">
                      <button
                        onClick={() => {
                          setSortBy("newest");
                          setShowSortMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-xs hover:bg-secondary/50",
                          sortBy === "newest" && "text-primary font-medium"
                        )}
                      >
                        Newest first
                      </button>
                      <button
                        onClick={() => {
                          setSortBy("oldest");
                          setShowSortMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-xs hover:bg-secondary/50",
                          sortBy === "oldest" && "text-primary font-medium"
                        )}
                      >
                        Oldest first
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                <div className="p-2">
                  {isSearching ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                    </div>
                  ) : results.length > 0 ? (
                    <div className="space-y-0.5">
                      {results.map((result) => (
                        <SearchResultItem key={result.id} result={result} onJump={handleJump} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-muted-foreground/60 text-sm">No messages found</div>
                      <button
                        onClick={clearAll}
                        className="text-xs text-primary hover:underline mt-2"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .search-highlight {
          background-color: rgba(132, 204, 22, 0.2) !important;
          transition: background-color 0.3s ease;
        }
      `}</style>
    </div>
  );
}
