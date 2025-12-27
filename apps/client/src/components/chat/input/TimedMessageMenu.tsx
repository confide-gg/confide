import { useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { TimedMessageDuration } from "../../../types";
import { TIMED_OPTIONS } from "./constants";

interface TimedMessageMenuProps {
  duration: TimedMessageDuration;
  onDurationChange: (duration: TimedMessageDuration) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimedMessageMenu({
  duration,
  onDurationChange,
  isOpen,
  onOpenChange,
}: TimedMessageMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onOpenChange]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={`p-1.5 rounded-md transition-colors flex items-center gap-1 ${duration ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"}`}
        onClick={() => onOpenChange(!isOpen)}
        title="Timed message"
      >
        <FontAwesomeIcon icon="clock" className="w-[18px] h-[18px]" />
        {duration && (
          <span className="text-[10px] font-semibold">
            {duration >= 60 ? `${Math.floor(duration / 60)}m` : `${duration}s`}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg shadow-lg p-1 min-w-[80px] z-50">
          {TIMED_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              className={`
                w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors
                ${duration === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary/80 text-muted-foreground hover:text-foreground"}
              `}
              onClick={() => {
                onDurationChange(opt.value);
                onOpenChange(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
