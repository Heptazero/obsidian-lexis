import type { LexisEntry, LexisSettings } from "./types";
import { dictionaryId, dictionaryName } from "./dictionary-sources";

export interface MarginNoteSource { id: string; label: string }
const normalized = (value: string) => value.normalize("NFC").replace(/^\/+|\/+$/g, "");

export function marginNoteSources(settings: LexisSettings, index: ReadonlyMap<string, LexisEntry>): MarginNoteSource[] {
  const sources = new Map<string, string>();
  for (const dict of settings.dicts || []) {
    if (dict.sources) { sources.set(`dictionary:${dictionaryId(dict)}`,dictionaryName(dict)); continue; }
    const folder = normalized(dict.folder || "");
    if (folder) sources.set(`folder:${folder}`, folder);
    for (const tag of (dict.tag || "").split(/[,，;；\s]+/).filter(Boolean)) {
      const name = tag.replace(/^#/, "").toLowerCase();
      sources.set(`tag:${name}`, `#${name}`);
    }
  }
  for (const tag of (settings.vocabTags || "").split(/[,，;；\s]+/).filter(Boolean)) {
    const name = tag.replace(/^#/, "").toLowerCase();
    sources.set(`tag:${name}`, `#${name}`);
  }
  for (const entry of index.values()) if (entry.inline) sources.set(`file:${normalized(entry.file.path)}`, entry.file.path);
  return [...sources].map(([id, label]) => ({ id, label }));
}

export function inMarginNoteScope(entry: LexisEntry, selected: string[] | null | undefined, membership?: ReadonlyMap<string,Set<string>>): boolean {
  if (selected == null) return true;
  const path = normalized(entry.file.path);
  return selected.some((id) => {
    const split = id.indexOf(":");
    const kind = id.slice(0, split);
    const value = normalized(id.slice(split + 1));
    if (kind === "dictionary") return membership?.get(value)?.has(entry.file.path) || false;
    if (kind === "folder") return path.startsWith(`${value}/`);
    if (kind === "file") return path === value;
    return kind === "tag" && !!entry.tags?.has(value.toLowerCase());
  });
}
