import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SearchFilter } from "./types";

interface FilterTagProps {
  filter: SearchFilter;
  onRemove: () => void;
}

export function FilterTag({ filter, onRemove }: FilterTagProps) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded bg-primary/15 text-xs border border-primary/20 group shrink-0">
      <span className="text-primary/80 font-medium">{filter.type}:</span>
      <span className="text-foreground">{filter.displayValue || filter.value}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-0.5 hover:bg-primary/20 rounded transition-colors ml-0.5"
        title="Remove filter"
      >
        <FontAwesomeIcon
          icon="xmark"
          className="w-3 h-3 text-muted-foreground hover:text-foreground"
        />
      </button>
    </span>
  );
}
