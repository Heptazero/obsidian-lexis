import { managedEntryIdentity, type MarginNoteEntry } from "../../../src/marginnote-protocol";
import { nativeNotes, importParent, withDictionaryWrite } from "./importer";
import { DictionaryHierarchy } from "./grouping";
import { bindSelectedColor, boundColor, colorBindings } from "./colors";
import { returnUri } from "./links";
import { preference, setPreference } from "./source";

export async function manageDictionary(topic: string, window: unknown, action: "group" | "color"): Promise<void> {
  return withDictionaryWrite(topic, async () => {
    const app = Application.sharedInstance();
    const notes = nativeNotes(topic);
    const source = preference(topic, "source") || notes.map((note) => managedEntryIdentity(note.excerptText || "")?.sourceId).find(Boolean);
    if (!source) throw new Error("请先导入词库 / Import a dictionary first");
    const grouped = preference(topic, "grouped") === false;
    const hierarchy = action === "group" ? new DictionaryHierarchy(String(source), notes, importParent(topic, window), grouped) : null;
    if (action === "group") setPreference(topic, "grouped", grouped);
    else bindSelectedColor(topic, window);
    const bindings = colorBindings(topic);
    const db = Database.sharedInstance();
    let pending = 0;
    let done = 0;
    const save = () => { db.setNotebookSyncDirty(topic); db.savedb(); pending = 0; };
    try {
      for (const note of notes) {
        const owner = managedEntryIdentity(note.excerptText || "");
        if (owner?.sourceId !== source) continue;
        let changed = false;
        if (hierarchy) {
          const uri = returnUri(note.excerptText);
          if (!uri) continue;
          let inline = false;
          try { const id = JSON.parse(owner.entryId) as unknown; inline = Array.isArray(id) && !!id[1]; } catch { /* Older IDs may be opaque. */ }
          const entry: MarginNoteEntry = { id: owner.entryId, title: note.noteTitle, aliases: [], markdown: "", uri, inline };
          changed = hierarchy.place(note, entry);
        } else {
          const color = boundColor(owner.color, bindings);
          if (color !== undefined && note.colorIndex !== color) { note.colorIndex = color; changed = true; }
        }
        if (!changed) continue;
        pending++;
        done++;
        if (pending >= 40) {
          save();
          app.showHUD(`已更新 ${done} 张卡片 / Updated cards: ${done}`, window, 2);
          await new Promise<void>((resolve) => { NSTimer.scheduledTimerWithTimeInterval(0.01, false, resolve); });
        }
      }
    } finally {
      if (pending) save();
      if (done) app.refreshAfterDBChanged(topic);
    }
    app.showHUD(`已更新 ${done} 张卡片 / Updated cards: ${done}`, window, 4);
  });
}
