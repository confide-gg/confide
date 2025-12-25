import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ScreenShareCanvasProps } from "./types";

export function ScreenShareCanvas({ peerName }: ScreenShareCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const isPollingRef = useRef(true);
  const usingWebCodecsRef = useRef(false);
  const webCodecsFailedRef = useRef(false);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const lastDrawTsRef = useRef<number>(0);
  const lastFetchRef = useRef<{
    queued_at_ms: number;
    drained: number;
    frame_id: number;
    is_keyframe: boolean;
  } | null>(null);
  const needKeyframeRef = useRef(false);

  useEffect(() => {
    isPollingRef.current = true;

    usingWebCodecsRef.current =
      typeof (window as unknown as { VideoDecoder?: unknown }).VideoDecoder !== "undefined";
    webCodecsFailedRef.current = false;

    const drawToCanvas = (source: CanvasImageSource, codedWidth: number, codedHeight: number) => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = wrapper.getBoundingClientRect();
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
    };

    const pollFrames = async () => {
      if (!isPollingRef.current) return;

      try {
        if (usingWebCodecsRef.current && !webCodecsFailedRef.current) {
          const chunk = await invoke<{
            width: number;
            height: number;
            timestamp: number;
            frame_id: number;
            is_keyframe: boolean;
            data_b64: string;
            queued_at_ms: number;
            age_ms: number;
            drained: number;
            reasm_ms: number;
          } | null>("get_h264_chunk");
          if (chunk) {
            setDimensions({ width: chunk.width, height: chunk.height });
            lastFetchRef.current = {
              queued_at_ms: chunk.queued_at_ms,
              drained: chunk.drained,
              frame_id: chunk.frame_id,
              is_keyframe: chunk.is_keyframe,
            };

            if (needKeyframeRef.current && chunk.is_keyframe) {
              needKeyframeRef.current = false;
            }

            const bin = atob(chunk.data_b64);
            const data = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);

            if (!decoderRef.current) {
              if (!chunk.is_keyframe) {
                return;
              }
              try {
                const decoder = new VideoDecoder({
                  output: (frame) => {
                    const ts = performance.now();
                    if (ts - lastDrawTsRef.current < 5) {
                      frame.close();
                      return;
                    }
                    lastDrawTsRef.current = ts;
                    drawToCanvas(frame, frame.codedWidth, frame.codedHeight);
                    const queuedAtMs = Math.floor(frame.timestamp / 1000);
                    const displayAge = Date.now() - queuedAtMs;
                    const dq = decoderRef.current ? decoderRef.current.decodeQueueSize : 0;
                    if (displayAge > 220 || dq > 2) {
                      needKeyframeRef.current = true;
                      try {
                        decoderRef.current?.close();
                      } catch {}
                      decoderRef.current = null;
                    }
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
                const dq = decoderRef.current.decodeQueueSize;
                if (dq > 2 && !chunk.is_keyframe) {
                  return;
                }
                const tsUs = chunk.queued_at_ms * 1000;
                const encoded = new EncodedVideoChunk({
                  type: chunk.is_keyframe ? "key" : "delta",
                  timestamp: tsUs,
                  data,
                });
                decoderRef.current.decode(encoded);
              } catch {
                webCodecsFailedRef.current = true;
                decoderRef.current?.close();
                decoderRef.current = null;
              }
            }
          }
        } else {
          const frame = await invoke<{ width: number; height: number; rgba_data: number[] } | null>(
            "get_video_frame"
          );
          if (frame && canvasRef.current) {
            setDimensions({ width: frame.width, height: frame.height });
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              if (canvas.width !== frame.width || canvas.height !== frame.height) {
                canvas.width = frame.width;
                canvas.height = frame.height;
              }
              const imageData = ctx.createImageData(frame.width, frame.height);
              imageData.data.set(new Uint8ClampedArray(frame.rgba_data));
              ctx.putImageData(imageData, 0, 0);
            }
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
      }
      if (decoderRef.current) {
        try {
          decoderRef.current.close();
        } catch {}
        decoderRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={wrapperRef} className="absolute inset-0 flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: "auto" }} />

      {dimensions.width === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
          <FontAwesomeIcon icon="desktop" className="w-10 h-10 mb-2 animate-pulse" />
          <p className="text-sm">Waiting for {peerName}'s screen...</p>
        </div>
      )}

      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/80">
        {peerName}'s screen
      </div>

      {dimensions.width > 0 && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/60">
          {dimensions.width} x {dimensions.height}
        </div>
      )}
    </div>
  );
}
