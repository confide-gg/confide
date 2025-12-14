import { useState, useEffect, useCallback } from "react";
import { Monitor, AppWindow, Loader2, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { toast } from "sonner";
import type { ScreenCaptureSource } from "./types";

interface ScreenSharePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sourceId: string) => void;
}

export function ScreenSharePicker({ open, onClose, onSelect }: ScreenSharePickerProps) {
  const [sources, setSources] = useState<ScreenCaptureSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [starting, setStarting] = useState(false);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setPermissionDenied(false);

    try {
      const screenSources = await invoke<ScreenCaptureSource[]>("get_screen_sources");
      if (screenSources.length === 0 && platform() === "macos") {
        await invoke("request_screen_recording_permission");
        const retryScreenSources = await invoke<ScreenCaptureSource[]>("get_screen_sources");
        if (retryScreenSources.length === 0) {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }
        setSources(retryScreenSources);
      } else {
        setSources(screenSources);
      }
    } catch (e) {
      console.error("Failed to load screen sources:", e);
      if (platform() === "macos") {
        setPermissionDenied(true);
      } else {
        toast.error("Failed to load screen sources");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSources();
      setSelectedId(null);
    }
  }, [open, loadSources]);

  const handleSelect = async () => {
    if (!selectedId) return;
    setStarting(true);

    try {
      onSelect(selectedId);
      onClose();
    } catch (e) {
      console.error("Failed to start screen share:", e);
      toast.error("Failed to start screen share");
    } finally {
      setStarting(false);
    }
  };

  const screens = sources.filter((s) => s.source_type === "screen");
  const windows = sources.filter((s) => s.source_type === "window");

  const renderSource = (source: ScreenCaptureSource) => {
    const isSelected = selectedId === source.id;
    const thumbnailUrl = source.thumbnail
      ? `data:image/png;base64,${btoa(String.fromCharCode(...source.thumbnail))}`
      : null;

    return (
      <button
        key={source.id}
        onClick={() => setSelectedId(source.id)}
        className={`
          flex flex-col rounded-lg border-2 overflow-hidden transition-all
          ${isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/30"}
        `}
      >
        <div className="relative aspect-video bg-muted">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={source.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {source.source_type === "screen" ? (
                <Monitor className="h-8 w-8 text-muted-foreground" />
              ) : (
                <AppWindow className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        <div className="p-2 text-left">
          <p className="text-sm font-medium truncate">{source.name}</p>
          <p className="text-xs text-muted-foreground">
            {source.width} × {source.height}
          </p>
        </div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share your screen</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : permissionDenied ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <h3 className="font-semibold">Screen Recording Permission Required</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please grant screen recording access in System Settings → Privacy & Security → Screen Recording
              </p>
            </div>
            <Button variant="outline" onClick={loadSources}>
              Try Again
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="screens" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="screens" className="flex-1">
                <Monitor className="h-4 w-4 mr-2" />
                Screens ({screens.length})
              </TabsTrigger>
              <TabsTrigger value="windows" className="flex-1">
                <AppWindow className="h-4 w-4 mr-2" />
                Windows ({windows.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="screens" className="mt-4">
              {screens.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No screens available
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {screens.map(renderSource)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="windows" className="mt-4">
              {windows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No windows available
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {windows.map(renderSource)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedId || starting}
          >
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              "Share"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
