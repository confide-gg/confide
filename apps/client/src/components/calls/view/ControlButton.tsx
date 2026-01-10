import { Button } from "../../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../../ui/tooltip";
import { cn } from "@/lib/utils";
import type { ControlButtonProps } from "./types";

export function ControlButton({
  icon,
  onClick,
  active,
  activeColor = "red",
  disabled,
  variant,
  tooltip,
  size = "md",
}: ControlButtonProps & { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-9 w-9",
    md: "h-11 w-11",
    lg: "h-14 w-14",
  };

  const iconSizeClasses = {
    sm: "[&_svg]:w-4 [&_svg]:h-4",
    md: "[&_svg]:w-5 [&_svg]:h-5",
    lg: "[&_svg]:w-6 [&_svg]:h-6",
  };

  const getButtonClass = () => {
    if (variant === "danger") {
      return cn(
        "bg-red-500 hover:bg-red-400 text-white",
        "border border-red-400/50",
        "shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
      );
    }
    if (active) {
      if (activeColor === "green") {
        return cn(
          "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25",
          "border border-emerald-500/30 hover:border-emerald-500/50",
          "shadow-lg shadow-emerald-500/10"
        );
      }
      return cn(
        "bg-red-500/15 text-red-400 hover:bg-red-500/25",
        "border border-red-500/30 hover:border-red-500/50",
        "shadow-lg shadow-red-500/10"
      );
    }
    return cn(
      "bg-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/[0.12]",
      "border border-white/[0.08] hover:border-white/[0.15]"
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "rounded-full p-0",
              "transition-all duration-200 ease-out",
              "hover:scale-105 active:scale-95",
              sizeClasses[size],
              iconSizeClasses[size],
              getButtonClass(),
              disabled && "opacity-40 cursor-not-allowed hover:scale-100"
            )}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-zinc-900/95 backdrop-blur-sm border-white/[0.08] text-zinc-200 text-xs font-medium px-3 py-1.5"
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
