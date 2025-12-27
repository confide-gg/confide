import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FILTER_OPTIONS, type SearchFilterType } from "./types";

interface FilterOptionsPanelProps {
  onFilterSelect: (filterType: SearchFilterType) => void;
}

export function FilterOptionsPanel({ onFilterSelect }: FilterOptionsPanelProps) {
  return (
    <div className="p-2">
      <div className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-2 py-1">
        Search Options
      </div>
      {FILTER_OPTIONS.map((option) => (
        <button
          key={option.type}
          onClick={() => onFilterSelect(option.type)}
          className="flex items-center gap-3 w-full px-2 py-2.5 rounded-md hover:bg-secondary/50 transition-colors text-left group"
        >
          <FontAwesomeIcon
            icon={option.icon as any}
            className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground">{option.label}</div>
            <div className="text-xs text-muted-foreground/70">{option.hint}</div>
          </div>
        </button>
      ))}
      <div className="border-t border-border/30 mt-2 pt-2">
        <button
          onClick={() => onFilterSelect("before")}
          className="flex items-center gap-3 w-full px-2 py-2.5 rounded-md hover:bg-secondary/50 transition-colors text-left group"
        >
          <FontAwesomeIcon
            icon="calendar"
            className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground">Date range</div>
            <div className="text-xs text-muted-foreground/70">before: or after: date</div>
          </div>
        </button>
      </div>
    </div>
  );
}
