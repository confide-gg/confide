import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Shield, Keyboard } from "lucide-react";
import { Button } from "../ui/button";
import { checkMicrophonePermission, requestMicrophonePermission } from "tauri-plugin-macos-permissions-api";
import { platform } from "@tauri-apps/plugin-os";

interface InputLevelDetectorProps {
  sensitivity: number;
  volume: number;
  inputDeviceId?: string | null;
  pttEnabled?: boolean;
  pttKey?: string | null;
}

function parseKeyCombo(keyCombo: string): { key: string; modifiers: { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean } } {
  const parts = keyCombo.split(" + ");
  const modifiers = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };

  let key = "";
  for (const part of parts) {
    const lowerPart = part.toLowerCase();
    if (lowerPart === "ctrl" || lowerPart === "control") {
      modifiers.ctrl = true;
    } else if (lowerPart === "alt") {
      modifiers.alt = true;
    } else if (lowerPart === "shift") {
      modifiers.shift = true;
    } else if (lowerPart === "cmd" || lowerPart === "meta" || lowerPart === "command") {
      modifiers.meta = true;
    } else {
      key = part.toLowerCase();
    }
  }

  return { key, modifiers };
}

function eventMatchesKeyCombo(e: KeyboardEvent, keyCombo: string): boolean {
  const { key, modifiers } = parseKeyCombo(keyCombo);

  let eventKey = e.key.toLowerCase();
  if (eventKey === " ") eventKey = "space";

  const keyMatches = eventKey === key.toLowerCase();
  const ctrlMatches = e.ctrlKey === modifiers.ctrl;
  const altMatches = e.altKey === modifiers.alt;
  const shiftMatches = e.shiftKey === modifiers.shift;
  const metaMatches = e.metaKey === modifiers.meta;

  return keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches;
}

export function InputLevelDetector({ sensitivity, volume, inputDeviceId, pttEnabled = false, pttKey }: InputLevelDetectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const smoothedLevel = useRef(0);
  const peakLevel = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isPTTActiveRef = useRef(false);

  const [isTesting, setIsTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);

  const effectiveLevel = pttEnabled ? (isPTTActive ? micLevel : 0) : micLevel;
  const adjustedLevel = Math.min(effectiveLevel * volume, 1);
  const isAboveSensitivity = adjustedLevel > sensitivity;

  const startMicTest = useCallback(async () => {
    try {
      setError(null);
      setPermissionDenied(false);

      if (platform() === "macos") {
        try {
          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            const granted = await requestMicrophonePermission();
            if (!granted) {
              setPermissionDenied(true);
              setError("Microphone permission denied. Please grant access in System Settings > Privacy & Security > Microphone.");
              return;
            }
          }
        } catch (permErr) {
        }
      }

      let webAudioDeviceId: string | undefined;

      if (inputDeviceId && inputDeviceId !== "default") {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(d => d.kind === "audioinput");
          const matchedDevice = audioInputs.find(d =>
            d.label === inputDeviceId || d.label.includes(inputDeviceId) || inputDeviceId.includes(d.label)
          );
          if (matchedDevice) {
            webAudioDeviceId = matchedDevice.deviceId;
          }
        } catch {
        }
      }

      const constraints: MediaStreamConstraints = {
        audio: webAudioDeviceId
          ? { deviceId: { exact: webAudioDeviceId } }
          : true,
        video: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaErr: unknown) {
        const err = mediaErr as Error & { name?: string };
        console.error("getUserMedia error:", err.name, err.message);

        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setPermissionDenied(true);
          setError("Microphone access denied. Please grant permission in System Settings > Privacy & Security > Microphone.");
          return;
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No microphone found. Please connect a microphone and try again.");
          return;
        } else if (err.name === "OverconstrainedError") {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          stream = fallbackStream;
        } else {
          setError(`Microphone error: ${err.message || "Unknown error"}`);
          return;
        }
      }

      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.1;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setIsTesting(true);
    } catch (err) {
      console.error("Failed to access microphone:", err);
      setError("Could not access microphone. Please check your device settings.");
    }
  }, [inputDeviceId]);

  const stopMicTest = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsTesting(false);
    setMicLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, [stopMicTest]);

  useEffect(() => {
    if (isTesting && inputDeviceId !== undefined) {
      stopMicTest();
      startMicTest();
    }
  }, [inputDeviceId]);

  useEffect(() => {
    if (!isTesting || !pttEnabled || !pttKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPTTActiveRef.current) return;
      if (eventMatchesKeyCombo(e, pttKey)) {
        e.preventDefault();
        isPTTActiveRef.current = true;
        setIsPTTActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isPTTActiveRef.current) return;
      const { key } = parseKeyCombo(pttKey);
      let eventKey = e.key.toLowerCase();
      if (eventKey === " ") eventKey = "space";
      if (eventKey === key.toLowerCase()) {
        e.preventDefault();
        isPTTActiveRef.current = false;
        setIsPTTActive(false);
      }
    };

    const handleBlur = () => {
      if (isPTTActiveRef.current) {
        isPTTActiveRef.current = false;
        setIsPTTActive(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isTesting, pttEnabled, pttKey]);

  useEffect(() => {
    if (!isTesting || !analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.fftSize);
    let animationId: number;

    const updateLevel = () => {
      if (!analyserRef.current) return;

      analyser.getByteTimeDomainData(dataArray);

      let max = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const amplitude = Math.abs(dataArray[i] - 128);
        if (amplitude > max) max = amplitude;
      }
      const level = max / 128;

      setMicLevel(level);

      animationId = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isTesting]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    const draw = () => {
      const targetLevel = adjustedLevel;
      smoothedLevel.current += (targetLevel - smoothedLevel.current) * 0.25;

      if (smoothedLevel.current > peakLevel.current) {
        peakLevel.current = smoothedLevel.current;
      } else {
        peakLevel.current = Math.max(0, peakLevel.current - 0.008);
      }

      const width = rect.width;
      const height = rect.height;
      const barHeight = 20;
      const barY = (height - barHeight) / 2;
      const borderRadius = barHeight / 2;
      const padding = 4;

      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.roundRect(padding, barY, width - padding * 2, barHeight, borderRadius);
      ctx.fill();

      const fillWidth = Math.max(0, smoothedLevel.current * (width - padding * 2));
      if (fillWidth > 0) {
        const gradient = ctx.createLinearGradient(padding, 0, width - padding, 0);
        gradient.addColorStop(0, "#22c55e");
        gradient.addColorStop(0.5, "#22c55e");
        gradient.addColorStop(0.7, "#eab308");
        gradient.addColorStop(0.85, "#ef4444");
        gradient.addColorStop(1, "#dc2626");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(padding, barY, fillWidth, barHeight, borderRadius);
        ctx.fill();
      }

      if (peakLevel.current > 0.01) {
        const peakX = padding + peakLevel.current * (width - padding * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.roundRect(peakX - 1.5, barY + 2, 3, barHeight - 4, 1.5);
        ctx.fill();
      }

      const sensitivityX = padding + sensitivity * (width - padding * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sensitivityX, barY - 6);
      ctx.lineTo(sensitivityX, barY + barHeight + 6);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.moveTo(sensitivityX - 4, barY - 6);
      ctx.lineTo(sensitivityX + 4, barY - 6);
      ctx.lineTo(sensitivityX, barY - 2);
      ctx.closePath();
      ctx.fill();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [adjustedLevel, sensitivity]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Mic Test</span>
        <div className="flex items-center gap-3">
          {isTesting && (
            <div className="flex items-center gap-2">
              {pttEnabled && (
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-all ${
                  isPTTActive ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground"
                }`}>
                  <Keyboard className="w-3 h-3" />
                  <span>{isPTTActive ? "Transmitting" : pttKey || "No key"}</span>
                </div>
              )}
              <div
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  isAboveSensitivity ? "bg-green-500 scale-125" : "bg-muted"
                }`}
              />
              <span className={`text-xs transition-colors ${isAboveSensitivity ? "text-green-500" : "text-muted-foreground"}`}>
                {pttEnabled
                  ? (isPTTActive ? (isAboveSensitivity ? "Speaking" : "Silent") : "Hold key")
                  : (isAboveSensitivity ? "Speaking" : "Silent")}
              </span>
            </div>
          )}
          <Button
            variant={isTesting ? "destructive" : "outline"}
            size="sm"
            onClick={isTesting ? stopMicTest : startMicTest}
            className="gap-2"
          >
            {isTesting ? (
              <>
                <MicOff className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Test Mic
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className={`text-sm px-4 py-3 rounded-xl flex items-center gap-3 ${
          permissionDenied
            ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
            : "bg-destructive/10 text-destructive"
        }`}>
          {permissionDenied && <Shield className="w-5 h-5 flex-shrink-0" />}
          <p>{error}</p>
        </div>
      )}

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-10 rounded-lg"
          style={{ background: "transparent" }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span>Low</span>
        <span>Optimal</span>
        <span>Loud</span>
      </div>

      {!isTesting && (
        <p className="text-xs text-muted-foreground text-center">
          {pttEnabled && pttKey
            ? `Click "Test Mic" then hold ${pttKey} to test`
            : 'Click "Test Mic" to check your input levels'}
        </p>
      )}
    </div>
  );
}
