import * as React from "react";
import { cn } from "../../lib/utils";

export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Use shadcn semantics (no hard-coded colors).
        // `ring-border` is derived from theme tokens.
        "bg-card rounded-xl overflow-hidden shadow-sm ring-1 ring-border/40",
        className
      )}
      {...props}
    />
  );
}


