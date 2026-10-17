import { managedEntryIdentity } from "../../../src/marginnote-protocol";
import { preference, setPreference } from "./source";

export function colorBindings(topic: string): Record<string, number> {
  const stored = preference(topic, "colors");
  if (typeof stored !== "string") return {};
  try {
    const value = JSON.parse(stored) as Record<string, number>;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function boundColor(color: string | undefined, bindings: Record<string, number>): number | undefined {
  const index = color ? bindings[color.toLowerCase()] : undefined;
  return typeof index === "number" && Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}

export function bindSelectedColor(topic: string, window: unknown): string {
  const note = Application.sharedInstance().studyController(window).notebookController.focusNote;
  const identity = note && managedEntryIdentity(note.excerptText || "");
  const source = preference(topic, "source");
  if (!note || !identity?.color || note.colorIndex == null || !Number.isSafeInteger(note.colorIndex) || note.colorIndex < 0) {
    throw new Error("请选中带颜色信息的 Lexis 卡片，并先用 MN 调色板设置它的颜色 / Select a colored Lexis card and choose its native MN color first");
  }
  if (source && identity.sourceId !== source) throw new Error("此卡片不属于当前词库 / This card belongs to another dictionary");
  const bindings = colorBindings(topic);
  bindings[identity.color.toLowerCase()] = note.colorIndex;
  setPreference(topic, "colors", JSON.stringify(bindings));
  return identity.color;
}
