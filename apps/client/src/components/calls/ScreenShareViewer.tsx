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

interface H264Chunk {
  width: number;
  height: number;
  timestamp: number;
  frame_id: number;
  is_keyframe: boolean;
  data_b64: string;
  age_ms: number;
  drained: number;
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
  const usingWebCodecsRef = useRef(false);
  const webCodecsFailedRef = useRef(false);
  const decoderRef = useRef<VideoDecoder | null>(null);

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

  const drawToCanvas = useCallback((source: CanvasImageSource, codedWidth: number, codedHeight: number) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.max(1, Math.floor(rect.width * dpr));
    const targetH = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(canvas.width / codedWidth, canvas.height / codedHeight);
    const drawW = Math.max(1, Math.floor(codedWidth * scale));
    const drawH = Math.max(1, Math.floor(codedHeight * scale));
    const x = Math.floor((canvas.width - drawW) / 2);
    const y = Math.floor((canvas.height - drawH) / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, x, y, drawW, drawH);
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
      if (decoderRef.current) {
        try {
          decoderRef.current.close();
        } catch {}
        decoderRef.current = null;
      }
      return;
    }

    isPollingRef.current = true;
    usingWebCodecsRef.current = typeof (window as unknown as { VideoDecoder?: unknown }).VideoDecoder !== "undefined";
    webCodecsFailedRef.current = false;

    const pollFrames = async () => {
      if (!isPollingRef.current) return;

      try {
        if (usingWebCodecsRef.current && !webCodecsFailedRef.current) {
          const chunk = await invoke<H264Chunk | null>("get_h264_chunk");
          if (chunk) {
            setDimensions({ width: chunk.width, height: chunk.height });
            const bin = atob(chunk.data_b64);
            const data = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);

            if (!decoderRef.current) {
              try {
                const decoder = new VideoDecoder({
                  output: (frame) => {
                    drawToCanvas(frame, frame.codedWidth, frame.codedHeight);
                    frame.close();
                  },
                  error: () => {
                    webCodecsFailedRef.current = true;
                    decoderRef.current?.close();
                    decoderRef.current = null;
                  },
                });

                decoder.configure({
                  codec: "avc1.42E01E",
                  codedWidth: chunk.width,
                  codedHeight: chunk.height,
                  hardwareAcceleration: "prefer-hardware",
                  optimizeForLatency: true,
                  avc: { format: "annexb" },
                } as unknown as VideoDecoderConfig);

                decoderRef.current = decoder;
              } catch {
                webCodecsFailedRef.current = true;
              }
            }

            if (decoderRef.current && !webCodecsFailedRef.current) {
              try {
                decoderRef.current.decode(
                  new EncodedVideoChunk({
                    type: chunk.is_keyframe ? "key" : "delta",
                    timestamp: chunk.timestamp * 1000,
                    data,
                  })
                );
              } catch {
                webCodecsFailedRef.current = true;
                decoderRef.current?.close();
                decoderRef.current = null;
              }
            }
          }
        } else {
          const frame = await invoke<DecodedFrame | null>("get_video_frame");
          if (frame) {
            renderFrame(frame);
          }
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
      if (decoderRef.current) {
        try {
          decoderRef.current.close();
        } catch {}
        decoderRef.current = null;
      }
    };
  }, [isActive, renderFrame, drawToCanvas]);

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