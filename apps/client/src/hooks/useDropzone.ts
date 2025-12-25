import { useEffect, useRef, useState } from "react";
import { useChat } from "../context/chat";
import { toast } from "sonner";

export function useDropzone() {
  const { activeChat, setDroppedFile } = useChat();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (activeChatRef.current && e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = activeChatRef.current ? "copy" : "none";
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (!activeChatRef.current) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];

        if (file.size > 100 * 1024 * 1024) {
          toast.error("File too large", {
            description: "Maximum file size is 100MB",
          });
          return;
        }

        setDroppedFile(file);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [setDroppedFile]);

  return { isDragging };
}
