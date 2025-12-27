import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/lib/utils";
import { SearchResultItem } from "./SearchResultItem";
import type { SearchResult, SortOption } from "./types";

interface SearchResultsPanelProps {
  results: SearchResult[];
  isSearching: boolean;
  sortBy: SortOption;
  showSortMenu: boolean;
  onSortChange: (sort: SortOption) => void;
  onSortMenuToggle: () => void;
  onJump: (messageId: string) => void;
  onClearFilters: () => void;
}

export function SearchResultsPanel({
  results,
  isSearching,
  sortBy,
  showSortMenu,
  onSortChange,
  onSortMenuToggle,
  onJump,
  onClearFilters,
}: SearchResultsPanelProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-secondary/10 shrink-0">
        <span className="text-xs text-muted-foreground">
          {isSearching
            ? "Searching..."
            : `${results.length} result${results.length !== 1 ? "s" : ""}`}
        </span>
        <div className="relative">
          <button
            onClick={onSortMenuToggle}
            className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <FontAwesomeIcon icon="sort" className="w-3 h-3" />
            {sortBy === "newest" ? "Newest" : "Oldest"}
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 w-28 bg-popover border border-border rounded-md shadow-lg py-1 z-20">
              <button
                onClick={() => onSortChange("newest")}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-xs hover:bg-secondary/50",
                  sortBy === "newest" && "text-primary font-medium"
                )}
              >
                Newest first
              </button>
              <button
                onClick={() => onSortChange("oldest")}
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
                <SearchResultItem key={result.id} result={result} onJump={onJump} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-muted-foreground/60 text-sm">No messages found</div>
              <button
                onClick={onClearFilters}
                className="text-xs text-primary hover:underline mt-2"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
