import { useRef, useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Maximize2, Minimize2, Monitor } from "lucide-react";
import { Button } from "../ui/button";

interface DecodedFrame {
  width: number;
  height: number;
  timestamp: number;
  rgba_data: number[];
}

interface ScreenShareViewerProps {
  isActive: boolean;
  peerUsername?: string;
}

export function ScreenShareViewer({ isActive, peerUsername }: ScreenShareViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (isFullscreen) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen toggle failed:", e);
    }
  }, [isFullscreen]);

  const renderFrame = useCallback((frame: DecodedFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width;
      canvas.height = frame.height;
      setDimensions({ width: frame.width, height: frame.height });
    }

    const imageData = ctx.createImageData(frame.width, frame.height);
    const data = new Uint8ClampedArray(frame.rgba_data);
    imageData.data.set(data);
    ctx.putImageData(imageData, 0, 0);
  }, []);

  useEffect(() => {
    if (!isActive) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      setDimensions({ width: 0, height: 0 });
      isPollingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    isPollingRef.current = true;

    const pollFrames = async () => {
      if (!isPollingRef.current) return;

      try {
        const frame = await invoke<DecodedFrame | null>("get_video_frame");
        if (frame) {
          renderFrame(frame);
        }
      } catch (e) {
        console.error("Failed to get video frame:", e);
      }

      if (isPollingRef.current) {
        animationFrameRef.current = requestAnimationFrame(pollFrames);
      }
    };

    pollFrames();

    return () => {
      isPollingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isActive, renderFrame]);

  if (!isActive) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`
        relative bg-black rounded-lg overflow-hidden
        ${isFullscreen ? "fixed inset-0 z-50" : "w-full aspect-video"}
      `}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ imageRendering: "auto" }}
      />

      {dimensions.width === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
          <Monitor className="h-12 w-12 mb-2 animate-pulse" />
          <p className="text-sm">
            {peerUsername ? `Waiting for ${peerUsername}'s screen...` : "Waiting for screen share..."}
          </p>
        </div>
      )}

      <div className="absolute bottom-2 right-2 flex gap-2">
        {dimensions.width > 0 && (
          <span className="px-2 py-1 bg-black/50 rounded text-xs text-white/70">
            {dimensions.width} × {dimensions.height}
          </span>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4 text-white" />
          ) : (
            <Maximize2 className="h-4 w-4 text-white" />
          )}
        </Button>
      </div>

      {peerUsername && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded">
          <span className="text-xs text-white/90">{peerUsername}'s screen</span>
        </div>
      )}
    </div>
  );
}