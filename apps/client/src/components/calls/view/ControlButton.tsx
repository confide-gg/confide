import { Button } from "../../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../../ui/tooltip";
import { cn } from "@/lib/utils";
import type { ControlButtonProps } from "./types";

export function ControlButton({ icon, onClick, active, activeColor = "red", disabled, variant, tooltip }: ControlButtonProps) {
  const getButtonClass = () => {
    if (variant === "danger") {
      return "bg-red-500 hover:bg-red-600 text-white";
    }
    if (active) {
      if (activeColor === "green") {
        return "bg-green-500/20 text-green-400 hover:bg-green-500/30";
      }
      return "bg-red-500/20 text-red-400 hover:bg-red-500/30";
    }
    return "bg-white/10 text-white/90 hover:bg-white/20";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "h-9 w-9 rounded-full p-0 transition-all",
              getButtonClass(),
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-card border-border text-white text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
