import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  typingNames: string[];
  className?: string;
  position?: "inline" | "absolute";
}

export function TypingIndicator({
  typingNames,
  className,
  position = "inline",
}: TypingIndicatorProps) {
  if (typingNames.length === 0) return null;

  let text: string;
  if (typingNames.length === 1) {
    text = `${typingNames[0]} is typing`;
  } else if (typingNames.length === 2) {
    text = `${typingNames[0]} and ${typingNames[1]} are typing`;
  } else if (typingNames.length === 3) {
    text = `${typingNames[0]}, ${typingNames[1]}, and ${typingNames[2]} are typing`;
  } else {
    const othersCount = typingNames.length - 2;
    text = `${typingNames[0]}, ${typingNames[1]}, and ${othersCount} ${othersCount === 1 ? "other" : "others"} are typing`;
  }

  const positionClasses =
    position === "absolute" ? "absolute bottom-full left-0 right-0 px-8 py-2" : "h-5 px-8";

  return (
    <div
      className={cn(
        positionClasses,
        "flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-200",
        className
      )}
    >
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" />
      </div>
      <span className="font-medium">{text}</span>
    </div>
  );
}
