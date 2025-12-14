import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { VoiceSettings } from "./VoiceSettings";
import { X } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "voice" | "account" | "appearance";
}

type Tab = "voice" | "account" | "appearance";

const TABS: { id: Tab; label: string }[] = [
  { id: "account", label: "My Account" },
  { id: "voice", label: "Voice & Audio" },
  { id: "appearance", label: "Appearance" },
];

export function SettingsModal({ open, onClose, defaultTab = "voice" }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] max-h-[700px] p-0 gap-0">
        <div className="flex h-full">
          <div className="w-60 border-r border-border bg-background flex flex-col">
            <DialogHeader className="px-4 py-6 border-b border-border">
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
                      ? "bg-[#c9ed7b] text-black"
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors border-t border-border"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "voice" && <VoiceSettings />}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
