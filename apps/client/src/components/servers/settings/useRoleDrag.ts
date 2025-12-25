import { useState, useEffect } from "react";

interface UseRoleDragParams {
  onReorder: (fromId: string, toId: string) => void;
}

export function useRoleDrag({ onReorder }: UseRoleDragParams) {
  const [dragRoleId, setDragRoleId] = useState<string | null>(null);
  const [dragOverRoleId, setDragOverRoleId] = useState<string | null>(null);
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);

  useEffect(() => {
    if (!dragRoleId || dragPointerId === null) return;

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const findRoleId = (el: Element | null): string | null => {
      let node: Element | null = el;
      while (node) {
        const id = (node as HTMLElement).dataset?.roleId;
        if (id) return id;
        node = node.parentElement;
      }
      return null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const id = findRoleId(el);
      setDragOverRoleId(id);
    };

    const end = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      if (dragOverRoleId && dragOverRoleId !== dragRoleId) {
        onReorder(dragRoleId, dragOverRoleId);
      }
      setDragRoleId(null);
      setDragOverRoleId(null);
      setDragPointerId(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });

    return () => {
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end as EventListener);
      window.removeEventListener("pointercancel", end as EventListener);
    };
  }, [dragRoleId, dragPointerId, dragOverRoleId, onReorder]);

  const startDrag = (roleId: string, pointerId: number) => {
    setDragRoleId(roleId);
    setDragOverRoleId(roleId);
    setDragPointerId(pointerId);
  };

  return {
    dragRoleId,
    dragOverRoleId,
    startDrag,
  };
}
