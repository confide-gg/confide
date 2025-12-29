import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/lib/utils";

interface GroupCallIndicatorProps {
  participantCount: number;
  className?: string;
}

export function GroupCallIndicator({ participantCount, className }: GroupCallIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500",
        className
      )}
      title={`${participantCount} in call`}
    >
      <FontAwesomeIcon icon="phone" className="w-2.5 h-2.5 animate-pulse" />
      <span className="text-[10px] font-medium">{participantCount}</span>
    </div>
  );
}
