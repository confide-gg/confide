import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const modKey = isMac ? "⌘" : "Ctrl";

const shortcuts = [
  {
    category: "Navigation",
    items: [
      { keys: [`${modKey}`, "1-9"], description: "Switch to chat by position" },
      { keys: ["Esc"], description: "Close current chat" },
      { keys: ["?"], description: "Open keyboard shortcuts" },
    ],
  },
  {
    category: "Messages",
    items: [
      { keys: ["Enter"], description: "Send message" },
      { keys: ["Shift", "Enter"], description: "New line in message" },
      { keys: ["Esc"], description: "Cancel reply or file attachment" },
    ],
  },
  {
    category: "Editing",
    items: [
      { keys: ["Esc"], description: "Cancel editing message" },
      { keys: ["Enter"], description: "Save edited message" },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center gap-1">
                          <kbd className="px-2 py-1 text-xs font-medium bg-secondary border border-border rounded-md text-muted-foreground min-w-[24px] text-center">
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
