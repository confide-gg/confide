export type DragItem = { type: "channel" | "category"; id: string };

export type DragOver =
  | { type: "channel"; id: string; position: "above" | "below"; categoryId: string | null }
  | { type: "category"; id: string; position: "above" | "below" }
  | { type: "uncategorized" };
