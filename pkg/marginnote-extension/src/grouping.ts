import type { MarginNoteEntry } from "../../../src/marginnote-protocol";

export interface GroupIdentity { sourceId: string; path: string }
const marker = /<!-- lexis-marginnote-group:([^\s]+) -->\s*$/;

export function groupIdentity(body: string): GroupIdentity | null {
  const match = marker.exec(body);
  if (!match) return null;
  try {
    const value = JSON.parse(decodeURIComponent(match[1])) as GroupIdentity;
    return typeof value.sourceId === "string" && typeof value.path === "string" ? value : null;
  } catch { return null; }
}

export function entryGroups(entry: MarginNoteEntry): string[] {
  let path = entry.path;
  if (!path) {
    const encoded = /[?&]file=([^&]*)/.exec(entry.uri)?.[1];
    if (!encoded) return [];
    try { path = decodeURIComponent(encoded).split("#")[0]; } catch { return []; }
  }
  const parts = path.split("/").filter(Boolean);
  if (!entry.inline) parts.pop();
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

export function groupBody(sourceId: string, path: string): string {
  const label = (path.split("/").pop() || path).replace(/\.md$/i, "");
  const value = encodeURIComponent(JSON.stringify({ sourceId, path }));
  // Empty native keyword titles prevent folder names becoming unwanted Title Links.
  return `${label}\n\n<!-- lexis-marginnote-group:${value} -->`;
}

export class DictionaryHierarchy {
  private groups = new Map<string, NativeNote>();

  constructor(private source: string, notes: NativeNote[], private root: NativeNote, private grouped: boolean) {
    for (const note of notes) {
      const owner = groupIdentity(note.excerptText || "");
      if (owner?.sourceId !== source) continue;
      if (this.groups.has(owner.path)) throw new Error("发现重复的 Lexis 分组 / Duplicate Lexis groups");
      this.groups.set(owner.path, note);
    }
  }

  place(note: NativeNote, entry: MarginNoteEntry): boolean {
    let parent = this.root;
    if (this.grouped) for (const path of entryGroups(entry)) {
      let group = this.groups.get(path);
      if (!group) {
        group = Database.sharedInstance().createNoteWithTitleTopicid("", this.root.notebookId);
        if (!group) throw new Error("无法创建词库分组 / Could not create dictionary group");
        group.excerptText = groupBody(this.source, path);
        group.excerptTextMarkdown = 1;
        parent.addChild(group);
        this.groups.set(path, group);
      }
      parent = group;
    }
    if (note.parentNote?.noteId === parent.noteId) return false;
    note.removeFromParent?.();
    parent.addChild(note);
    return true;
  }
}
