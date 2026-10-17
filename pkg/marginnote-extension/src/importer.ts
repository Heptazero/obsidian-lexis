import { managedEntryIdentity, type MarginNoteDictionary } from "../../../src/marginnote-protocol";
import { preference, setPreference } from "./source";
import { syncDictionary, type ImportResult } from "./sync";
import { dictionaryForVault } from "./links";
import { DictionaryHierarchy, groupIdentity } from "./grouping";
import { colorBindings, boundColor } from "./colors";

const busy = new Set<string>();
const revisions = new Map<string, string>();

export async function withDictionaryWrite<T>(topic: string, operation: () => Promise<T>): Promise<T> {
  if (busy.has(topic)) throw new Error("正在更新词库，请稍候 / Dictionary update in progress");
  busy.add(topic);
  try { return await operation(); } finally { busy.delete(topic); }
}

export function nativeNotes(topic: string): NativeNote[] {
  const notes = Database.sharedInstance().getNotebookById(topic)?.notes;
  if (!notes) throw new Error("请先打开一个学习集 / Open a study set first");
  if (Array.isArray(notes)) return notes;
  return Array.from({ length: notes.count() }, (_, i) => notes.objectAtIndex(i));
}

export function importParent(topic: string, window: unknown): NativeNote {
  const saved = preference(topic, "parent");
  const db = Database.sharedInstance();
  const parent = (typeof saved === "string" ? db.getNoteById(saved) : null)
    || Application.sharedInstance().studyController(window).notebookController.focusNote;
  if (!parent || parent.notebookId !== topic || managedEntryIdentity(parent.excerptText || "") || groupIdentity(parent.excerptText || "")) {
    throw new Error("首次导入：在主脑图新建并选中一张「Lexis 词库」卡片 / Create and select a dictionary parent card");
  }
  return parent;
}

export async function importDictionary(
  topic: string, window: unknown, snapshot: MarginNoteDictionary, automatic = false,
): Promise<ImportResult | null> {
  if (busy.has(topic)) {
    if (automatic) return null;
    throw new Error("正在导入，请稍候 / Import in progress");
  }
  const source = preference(topic, "source");
  if (source && source !== snapshot.source.id) throw new Error("此学习集已连接其他词库，请另建学习集 / This study set uses another dictionary");
  const target = preference(topic, "targetVault");
  const projected = dictionaryForVault(snapshot, typeof target === "string" ? target : "");
  const grouped = preference(topic, "grouped") !== false;
  const bindings = colorBindings(topic);
  const revision = JSON.stringify([projected.revision, grouped, bindings]);
  if (automatic && revisions.get(topic) === revision) return null;
  // Recover ownership after native notebook sync, even on a new device.
  const notes = nativeNotes(topic);
  if (notes.some((note) => {
    const owner = managedEntryIdentity(note.excerptText || "") || groupIdentity(note.excerptText || "");
    return owner && owner.sourceId !== snapshot.source.id;
  })) throw new Error("此学习集中已有其他来源的 Lexis 卡片 / Another Lexis source is already present");
  const parent = importParent(topic, window);
  return withDictionaryWrite(topic, async () => {
    const db = Database.sharedInstance();
    const app = Application.sharedInstance();
    const hierarchy = new DictionaryHierarchy(snapshot.source.id, notes, parent, grouped);
    const result = await syncDictionary(projected, {
      notes: () => notes,
      create: (title) => {
        const note = db.createNoteWithTitleTopicid(title, topic);
        if (!note) throw new Error("MN 创建卡片失败 / Could not create card");
        return note;
      },
      place: (note, entry) => hierarchy.place(note as NativeNote, entry),
      color: (entry) => boundColor(entry.color, bindings),
      save: () => { db.setNotebookSyncDirty(topic); db.savedb(); },
      yield: () => new Promise<void>((resolve) => { NSTimer.scheduledTimerWithTimeInterval(0.01, false, resolve); }),
    }, (done, total) => {
      if (!automatic) app.showHUD(`Lexis ${done}/${total}`, window, 2);
    });
    if (result.created || result.updated || result.disabled) app.refreshAfterDBChanged(topic);
    setPreference(topic, "parent", parent.noteId);
    setPreference(topic, "source", snapshot.source.id);
    setPreference(topic, "sourceVault", snapshot.source.vault);
    revisions.set(topic, revision);
    return result;
  });
}
