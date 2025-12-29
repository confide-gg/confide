import { useRef } from "react";
import { useCall } from "./context";
import { CallView } from "./view";

const DEFAULT_HEIGHT = 360;

export function CallHeader() {
  const { callState, peerHasLeft } = useCall();
  const containerRef = useRef<HTMLDivElement>(null);

  if (callState.status === "left" && peerHasLeft) return null;
  if (callState.status !== "active" && callState.status !== "left") return null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-card border-b border-border"
      style={{ height: `min(${DEFAULT_HEIGHT}px, 70vh)` }}
    >
      <div className="flex-1 overflow-hidden">
        <CallView />
      </div>
    </div>
  );
}
