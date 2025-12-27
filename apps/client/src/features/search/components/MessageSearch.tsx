import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FilterTag } from "./FilterTag";
import { AutocompletePanel } from "./AutocompletePanel";
import { FilterOptionsPanel } from "./FilterOptionsPanel";
import { SearchResultsPanel } from "./SearchResultsPanel";
import { useSearchLogic } from "./useSearchLogic";
import type { SearchFilter, SearchFilterType } from "./types";

interface MessageSearchProps {
  conversationName?: string;
}

export function MessageSearch({ conversationName }: MessageSearchProps) {
  const {
    query,
    setQuery,
    filters,
    results,
    isSearching,
    sortBy,
    setSortBy,
    view,
    autocomplete,
    selectedSuggestion,
    setSelectedSuggestion,
    addFilter,
    removeFilter,
    clearAll,
    selectSuggestion,
    activeChat,
  } = useSearchLogic();

  const [isOpen, setIsOpen] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleClose = useCallback(() => {
    setIsOpen(false);
    clearAll();
    setShowSortMenu(false);
  }, [clearAll]);

  const handleFilterSelect = useCallback(
    (filterType: SearchFilterType) => {
      setQuery(`${filterType}:`);
      inputRef.current?.focus();
    },
    [setQuery]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    },
    [
      autocomplete,
      selectedSuggestion,
      setSelectedSuggestion,
      selectSuggestion,
      query,
      addFilter,
      filters,
      removeFilter,
    ]
  );

  const handleJump = useCallback(
    (messageId: string) => {
      const element = document.getElementById(messageId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("search-highlight");
        setTimeout(() => element.classList.remove("search-highlight"), 2000);
      }
      handleClose();
    },
    [handleClose]
  );

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
        <FontAwesomeIcon icon="magnifying-glass" className="w-4 h-4 shrink-0 opacity-60" />
        <span className="truncate text-xs">Search</span>
      </button>

      {isOpen && (
        <div className="absolute top-0 right-0 z-50 w-[400px] bg-popover border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-secondary/20">
            <FontAwesomeIcon
              icon="magnifying-glass"
              className="w-4 h-4 text-muted-foreground shrink-0"
            />
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
                <FontAwesomeIcon
                  icon="xmark"
                  className="w-4 h-4 text-muted-foreground hover:text-foreground"
                />
              </button>
            )}
          </div>

          {showAutocomplete && (
            <AutocompletePanel
              suggestions={autocomplete}
              selectedIndex={selectedSuggestion}
              onSelect={selectSuggestion}
            />
          )}

          {!showAutocomplete && view === "filters" && !hasActiveFilters && (
            <FilterOptionsPanel onFilterSelect={handleFilterSelect} />
          )}

          {!showAutocomplete && (view === "results" || hasActiveFilters) && (
            <SearchResultsPanel
              results={results}
              isSearching={isSearching}
              sortBy={sortBy}
              showSortMenu={showSortMenu}
              onSortChange={(sort) => {
                setSortBy(sort);
                setShowSortMenu(false);
              }}
              onSortMenuToggle={() => setShowSortMenu(!showSortMenu)}
              onJump={handleJump}
              onClearFilters={clearAll}
            />
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
