import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/lib/utils";
import type { AutocompleteSuggestion } from "./types";

interface AutocompletePanelProps {
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
}

export function AutocompletePanel({
  suggestions,
  selectedIndex,
  onSelect,
}: AutocompletePanelProps) {
  return (
    <div className="border-b border-border/30">
      <div className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-4 py-1.5">
        Suggestions
      </div>
      {suggestions.map((suggestion, idx) => {
        const iconName = suggestion.icon || "user";
        return (
          <button
            key={suggestion.value}
            onClick={() => onSelect(suggestion)}
            className={cn(
              "flex items-center gap-3 w-full px-4 py-2 text-left transition-colors",
              idx === selectedIndex ? "bg-secondary/60" : "hover:bg-secondary/40"
            )}
          >
            <FontAwesomeIcon icon={iconName as any} className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{suggestion.label}</span>
          </button>
        );
      })}
    </div>
  );
}
