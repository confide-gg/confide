import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { VoiceSettings } from "./VoiceSettings";
import { SpotifySettings } from "./SpotifySettings";
import { X } from "lucide-react";
import { Panel } from "../layout/Panel";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "voice" | "account" | "appearance" | "connections";
}

type Tab = "voice" | "account" | "appearance" | "connections";

const TABS: { id: Tab; label: string }[] = [
  { id: "account", label: "My Account" },
  { id: "voice", label: "Voice & Audio" },
  { id: "connections", label: "Connections" },
  { id: "appearance", label: "Appearance" },
];

export function SettingsModal({ open, onClose, defaultTab = "voice" }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] max-h-[700px] p-3 gap-3">
        <div className="flex h-full gap-3">
          <aside className="w-60 shrink-0">
            <Panel className="h-full flex flex-col">
              <DialogHeader className="px-4 py-6">
                <DialogTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Settings
                </DialogTitle>
              </DialogHeader>
              <nav className="flex-1 p-2 space-y-0.5">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </Panel>
          </aside>

          <Panel className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "voice" && <VoiceSettings />}
            {activeTab === "connections" && <SpotifySettings />}
            {activeTab === "account" && (
              <div className="p-6 text-sm text-muted-foreground">
                Account settings coming soon...
              </div>
            )}
            {activeTab === "appearance" && (
              <div className="p-6 text-sm text-muted-foreground">
                Appearance settings coming soon...
              </div>
            )}
          </Panel>
        </div>
      </DialogContent>
    </Dialog>
  );
}
