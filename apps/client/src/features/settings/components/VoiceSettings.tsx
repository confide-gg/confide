import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { audioSettingsService } from "@/features/calls/audioSettings";
import type { AudioDevices, AudioSettings as TauriAudioSettings } from "@/components/calls/types";
import { InputLevelDetector } from "./InputLevelDetector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface LocalSettings {
  input_device: string | null;
  output_device: string | null;
}

interface SyncedSettings {
  input_volume: number;
  output_volume: number;
  input_sensitivity: number;
  auto_sensitivity: boolean;
  input_mode: "voice_activity" | "push_to_talk";
  push_to_talk_key: string | null;
  noise_suppression_enabled: boolean;
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </Label>
      {children}
    </div>
  );
}

export function VoiceSettings() {
  const [devices, setDevices] = useState<AudioDevices>({ input: [], output: [] });
  const [localSettings, setLocalSettings] = useState<LocalSettings>({
    input_device: null,
    output_device: null,
  });
  const [syncedSettings, setSyncedSettings] = useState<SyncedSettings>({
    input_volume: 1.0,
    output_volume: 1.0,
    input_sensitivity: 0.3,
    auto_sensitivity: true,
    input_mode: "voice_activity",
    push_to_talk_key: null,
    noise_suppression_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const initialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadDevicesAndSettings();
  }, []);

  const loadDevicesAndSettings = async () => {
    try {
      const [devicesData, tauriSettings, dbSettings] = await Promise.all([
        invoke<AudioDevices>("get_audio_devices"),
        invoke<TauriAudioSettings>("get_audio_settings"),
        audioSettingsService.getAudioSettings().catch(() => null),
      ]);

      setDevices(devicesData);

      setLocalSettings({
        input_device: tauriSettings.input_device,
        output_device: tauriSettings.output_device,
      });

      if (dbSettings) {
        setSyncedSettings({
          input_volume: dbSettings.input_volume,
          output_volume: dbSettings.output_volume,
          input_sensitivity: dbSettings.input_sensitivity,
          auto_sensitivity: dbSettings.voice_activity_enabled,
          input_mode: dbSettings.push_to_talk_enabled ? "push_to_talk" : "voice_activity",
          push_to_talk_key: dbSettings.push_to_talk_key,
          noise_suppression_enabled: dbSettings.noise_suppression_enabled ?? true,
        });
      } else {
        setSyncedSettings({
          input_volume: tauriSettings.input_volume,
          output_volume: tauriSettings.output_volume,
          input_sensitivity: tauriSettings.input_sensitivity,
          auto_sensitivity: tauriSettings.voice_activity_enabled,
          input_mode: tauriSettings.push_to_talk_enabled ? "push_to_talk" : "voice_activity",
          push_to_talk_key: tauriSettings.push_to_talk_key,
          noise_suppression_enabled: tauriSettings.noise_suppression_enabled ?? true,
        });
      }
    } catch (e) {
      console.error("Failed to load audio settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = useCallback(async (local: LocalSettings, synced: SyncedSettings) => {
    try {
      const fullSettings: TauriAudioSettings = {
        ...local,
        input_volume: synced.input_volume,
        output_volume: synced.output_volume,
        input_sensitivity: synced.input_sensitivity,
        voice_activity_enabled: synced.auto_sensitivity,
        push_to_talk_enabled: synced.input_mode === "push_to_talk",
        push_to_talk_key: synced.push_to_talk_key,
        noise_suppression_enabled: synced.noise_suppression_enabled,
      };

      await Promise.all([
        invoke("update_audio_settings", { settings: fullSettings }),
        audioSettingsService.updateAudioSettings({
          input_volume: synced.input_volume,
          output_volume: synced.output_volume,
          input_sensitivity: synced.input_sensitivity,
          voice_activity_enabled: synced.auto_sensitivity,
          push_to_talk_enabled: synced.input_mode === "push_to_talk",
          push_to_talk_key: synced.push_to_talk_key,
          noise_suppression_enabled: synced.noise_suppression_enabled,
        }),
      ]);
    } catch (e) {
      console.error("Failed to save audio settings:", e);
    }
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings(localSettings, syncedSettings);
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localSettings, syncedSettings, saveSettings]);

  const handleKeyRecord = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let keyName = e.key;
    if (e.key === " ") keyName = "Space";
    else if (e.key.length === 1) keyName = e.key.toUpperCase();

    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push("Ctrl");
    if (e.altKey) modifiers.push("Alt");
    if (e.shiftKey) modifiers.push("Shift");
    if (e.metaKey) modifiers.push("Cmd");

    if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      const fullKey = [...modifiers, keyName].join(" + ");
      setSyncedSettings((prev) => ({ ...prev, push_to_talk_key: fullKey }));
      setIsRecordingKey(false);
    }
  }, []);

  useEffect(() => {
    if (isRecordingKey) {
      window.addEventListener("keydown", handleKeyRecord);
      return () => window.removeEventListener("keydown", handleKeyRecord);
    }
  }, [isRecordingKey, handleKeyRecord]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-8 pr-2">
        {/* Audio Devices */}
        <SettingsSection title="Audio Devices">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FontAwesomeIcon icon="microphone" className="w-3.5 h-3.5" />
                <span>Input</span>
              </div>
              <Select
                value={localSettings.input_device || "default"}
                onValueChange={(value) =>
                  setLocalSettings({
                    ...localSettings,
                    input_device: value === "default" ? null : value,
                  })
                }
              >
                <SelectTrigger className="h-10 bg-secondary/50 border-0">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  {devices.input.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FontAwesomeIcon icon="volume-high" className="w-3.5 h-3.5" />
                <span>Output</span>
              </div>
              <Select
                value={localSettings.output_device || "default"}
                onValueChange={(value) =>
                  setLocalSettings({
                    ...localSettings,
                    output_device: value === "default" ? null : value,
                  })
                }
              >
                <SelectTrigger className="h-10 bg-secondary/50 border-0">
                  <SelectValue placeholder="Select speakers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  {devices.output.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsSection>

        {/* Volume Controls */}
        <SettingsSection title="Volume">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Input</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(syncedSettings.input_volume * 100)}%
                </span>
              </div>
              <Slider
                value={[syncedSettings.input_volume]}
                onValueChange={([value]) =>
                  setSyncedSettings({ ...syncedSettings, input_volume: value })
                }
                min={0}
                max={2}
                step={0.01}
                className="py-1"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Output</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(syncedSettings.output_volume * 100)}%
                </span>
              </div>
              <Slider
                value={[syncedSettings.output_volume]}
                onValueChange={([value]) =>
                  setSyncedSettings({ ...syncedSettings, output_volume: value })
                }
                min={0}
                max={2}
                step={0.01}
                className="py-1"
              />
            </div>
          </div>
        </SettingsSection>

        {/* Mic Test */}
        <SettingsSection title="Mic Test">
          <InputLevelDetector
            sensitivity={syncedSettings.auto_sensitivity ? 0 : syncedSettings.input_sensitivity}
            volume={syncedSettings.input_volume}
            inputDeviceId={localSettings.input_device}
            pttEnabled={syncedSettings.input_mode === "push_to_talk"}
            pttKey={syncedSettings.push_to_talk_key}
          />
        </SettingsSection>

        {/* Voice Processing */}
        <SettingsSection title="Voice Processing">
          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-secondary/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FontAwesomeIcon icon="wand-magic-sparkles" className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="font-medium text-sm">Noise Suppression</span>
                <p className="text-xs text-muted-foreground">
                  Remove background noise from your mic
                </p>
              </div>
            </div>
            <Switch
              checked={syncedSettings.noise_suppression_enabled}
              onCheckedChange={(checked) =>
                setSyncedSettings({ ...syncedSettings, noise_suppression_enabled: checked })
              }
            />
          </div>
        </SettingsSection>

        {/* Input Mode */}
        <SettingsSection title="Input Mode">
          <div className="space-y-2">
            <button
              onClick={() => setSyncedSettings({ ...syncedSettings, input_mode: "voice_activity" })}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                syncedSettings.input_mode === "voice_activity"
                  ? "bg-primary/10 border-primary"
                  : "bg-secondary/30 border-transparent hover:bg-secondary/50"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                  syncedSettings.input_mode === "voice_activity"
                    ? "border-primary"
                    : "border-muted-foreground"
                )}
              >
                {syncedSettings.input_mode === "voice_activity" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon="radio" className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Voice Activity</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Automatically transmit when you speak
                </p>
              </div>
            </button>

            <button
              onClick={() => setSyncedSettings({ ...syncedSettings, input_mode: "push_to_talk" })}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                syncedSettings.input_mode === "push_to_talk"
                  ? "bg-primary/10 border-primary"
                  : "bg-secondary/30 border-transparent hover:bg-secondary/50"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                  syncedSettings.input_mode === "push_to_talk"
                    ? "border-primary"
                    : "border-muted-foreground"
                )}
              >
                {syncedSettings.input_mode === "push_to_talk" && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon="keyboard" className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Push to Talk</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Hold a key to transmit your voice
                </p>
              </div>
            </button>
          </div>

          {/* Push to Talk Key - shown when PTT is selected */}
          {syncedSettings.input_mode === "push_to_talk" && (
            <div className="mt-4 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm">Keybind</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsRecordingKey(true)}
                  className={cn(
                    "flex-1 h-10 font-mono",
                    isRecordingKey && "ring-2 ring-primary border-primary animate-pulse"
                  )}
                >
                  {isRecordingKey ? (
                    <span className="text-primary">Press any key...</span>
                  ) : syncedSettings.push_to_talk_key ? (
                    <span>{syncedSettings.push_to_talk_key}</span>
                  ) : (
                    <span className="text-muted-foreground">Click to set key</span>
                  )}
                </Button>
                {syncedSettings.push_to_talk_key && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSyncedSettings({ ...syncedSettings, push_to_talk_key: null })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Voice Activity Options - shown when VA is selected */}
          {syncedSettings.input_mode === "voice_activity" && (
            <div className="mt-4 pt-4 border-t border-border/50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/20">
                <div>
                  <span className="text-sm">Automatic Sensitivity</span>
                  <p className="text-xs text-muted-foreground">
                    Automatically detect when you're speaking
                  </p>
                </div>
                <Switch
                  checked={syncedSettings.auto_sensitivity}
                  onCheckedChange={(checked) =>
                    setSyncedSettings({ ...syncedSettings, auto_sensitivity: checked })
                  }
                />
              </div>

              {!syncedSettings.auto_sensitivity && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Manual Threshold</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Math.round(syncedSettings.input_sensitivity * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[syncedSettings.input_sensitivity]}
                    onValueChange={([value]) =>
                      setSyncedSettings({ ...syncedSettings, input_sensitivity: value })
                    }
                    min={0}
                    max={1}
                    step={0.01}
                    className="py-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Audio below this level won't be transmitted
                  </p>
                </div>
              )}
            </div>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}
