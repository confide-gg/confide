interface TypingIndicatorProps {
  typingUsers: Map<string, string>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.size === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 px-8 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-200">
        <div className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" />
        </div>
        <span className="font-medium">
          {Array.from(typingUsers.values()).join(", ")} {typingUsers.size === 1 ? "is" : "are"}{" "}
          typing
        </span>
      </div>
    </div>
  );
}
