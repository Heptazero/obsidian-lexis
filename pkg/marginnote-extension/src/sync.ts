import {
  managedEntryBody, managedEntryIdentity, marginNoteKeywords,
  type MarginNoteDictionary, type MarginNoteEntry,
} from "../../../src/marginnote-protocol";

export interface DictionaryNote {
  noteId: string;
  noteTitle: string;
  excerptText: string;
  excerptTextMarkdown: number;
  colorIndex?: number;
}

export interface DictionaryStore {
  notes(): DictionaryNote[];
  create(title: string): DictionaryNote;
  save(): void;
  yield(): Promise<void>;
  place?(note: DictionaryNote, entry: MarginNoteEntry): boolean;
  color?(entry: MarginNoteEntry): number | undefined;
}

export interface ImportResult { created: number; updated: number; disabled: number; total: number }

/** Ownership travels with the card, rather than a device-local ID table. */
export async function syncDictionary(
  snapshot: MarginNoteDictionary,
  store: DictionaryStore,
  progress: (completed: number, total: number) => void = () => {},
): Promise<ImportResult> {
  const managed = new Map<string, DictionaryNote>();
  for (const note of store.notes()) {
    const identity = managedEntryIdentity(note.excerptText || "");
    if (identity?.sourceId !== snapshot.source.id) continue;
    if (managed.has(identity.entryId)) throw new Error("发现重复的 Lexis 卡片，请先移除重复副本 / Duplicate managed cards");
    managed.set(identity.entryId, note);
  }
  const result: ImportResult = { created: 0, updated: 0, disabled: 0, total: snapshot.entries.length };
  const active = new Set<string>();
  let pending = 0;
  try {
    for (const entry of snapshot.entries) {
      active.add(entry.id);
      const title = marginNoteKeywords(entry);
      const body = managedEntryBody(snapshot.source.id, entry);
      let note = managed.get(entry.id);
      let changed = false;
      if (!note) {
        note = store.create(title);
        note.excerptText = body;
        note.excerptTextMarkdown = 1;
        result.created++;
        pending++;
        changed = true;
      } else if (note.noteTitle !== title || note.excerptText !== body || !note.excerptTextMarkdown) {
        note.noteTitle = title;
        note.excerptText = body;
        note.excerptTextMarkdown = 1;
        result.updated++;
        pending++;
        changed = true;
      }
      const color = store.color?.(entry);
      const recolor = color !== undefined && note.colorIndex !== color;
      if (recolor) note.colorIndex = color;
      const moved = store.place?.(note, entry);
      if ((recolor || moved) && !changed) { result.updated++; pending++; }
      if (pending >= 40) {
        store.save();
        pending = 0;
        progress(active.size, result.total);
        await store.yield();
      }
    }
    for (const [id, note] of managed) {
      if (!active.has(id) && note.noteTitle) {
        // Stop title matching without deleting the card or its user's comments.
        note.noteTitle = "";
        result.disabled++;
        pending++;
        if (pending >= 40) {
          store.save();
          pending = 0;
          await store.yield();
        }
      }
    }
  } finally {
    // Persist completed batches even if a later native operation fails; retries are idempotent.
    if (pending) store.save();
  }
  progress(result.total, result.total);
  return result;
}
