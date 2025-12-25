import { useEffect, useState } from "react";
import { useChat } from "../context/chat";

export function useKeyboardShortcuts() {
  const { dmPreviews, activeChat, setActiveChat, openDmFromPreview, openGroupFromPreview } =
    useChat();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputActive =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if (e.key === "?" && !isInputActive) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && activeChat && !isInputActive) {
        setActiveChat(null);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key) - 1;
        const preview = dmPreviews[idx];
        if (preview) {
          e.preventDefault();
          if (preview.isGroup) {
            openGroupFromPreview(preview);
          } else {
            openDmFromPreview(preview);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dmPreviews, activeChat, setActiveChat, openDmFromPreview, openGroupFromPreview]);

  return { showShortcutsModal, setShowShortcutsModal };
}
