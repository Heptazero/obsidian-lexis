export interface MarginNoteEntry {
  id: string;
  title: string;
  aliases: string[];
  markdown: string;
  uri: string;
  path?: string;
  inline?: boolean;
  color?: string;
  colorLabel?: string;
}

export interface MarginNoteDictionary {
  format: "lexis-marginnote";
  version: 1;
  source: { id: string; vault: string };
  revision: string;
  entries: MarginNoteEntry[];
}

export function obsidianEntryUri(vault: string, path: string, heading?: string): string {
  const target = path + (heading ? `#${heading}` : "");
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(target)}`;
}

/** Validate the whole snapshot before touching the receiving dictionary. */
export function parseMarginNoteDictionary(text: string): MarginNoteDictionary {
  const value = JSON.parse(text) as MarginNoteDictionary;
  if (value?.format !== "lexis-marginnote" || value.version !== 1 ||
      typeof value.source?.id !== "string" || !value.source.id ||
      typeof value.source.vault !== "string" || typeof value.revision !== "string" ||
      !Array.isArray(value.entries)) throw new Error("不是 Lexis 的 MarginNote 词库文件 / Not a Lexis dictionary");
  const ids = new Set<string>();
  for (const entry of value.entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id) ||
        typeof entry.title !== "string" || !entry.title.trim() ||
        !Array.isArray(entry.aliases) || !entry.aliases.every((alias) => typeof alias === "string") ||
        typeof entry.markdown !== "string" || typeof entry.uri !== "string" ||
        !/^obsidian:\/\/open\?/.test(entry.uri) ||
        (entry.path !== undefined && (typeof entry.path !== "string" || entry.path.startsWith("/") || entry.path.split("/").some((part) => part === ".."))) ||
        (entry.inline !== undefined && typeof entry.inline !== "boolean") ||
        (entry.color !== undefined && (typeof entry.color !== "string" || !/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(entry.color))) ||
        (entry.colorLabel !== undefined && typeof entry.colorLabel !== "string")) throw new Error("词库条目无效 / Invalid dictionary entry");
    ids.add(entry.id);
  }
  return value;
}

export function marginNoteKeywords(entry: MarginNoteEntry): string {
  const seen = new Set<string>();
  return [entry.title, ...entry.aliases].map((word) => word.trim()).filter((word) => {
    const key = word.toLowerCase();
    if (!word || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join("; ");
}

export interface ManagedEntryIdentity { sourceId: string; entryId: string; color?: string }

export function managedEntryBody(sourceId: string, entry: MarginNoteEntry): string {
  const marker = encodeURIComponent(JSON.stringify({ sourceId, entryId: entry.id, ...(entry.color ? { color: entry.color } : {}) }));
  const label = entry.color ? `颜色 / Color: ${entry.colorLabel ? `${entry.colorLabel} · ` : ""}${entry.color}\n\n` : "";
  return `[在 Obsidian 打开 / Open in Obsidian](${entry.uri})\n\n${label}${entry.markdown.trim()}\n\n<!-- lexis-marginnote:${marker} -->`;
}

export function managedEntryIdentity(body: string): ManagedEntryIdentity | null {
  const match = /<!-- lexis-marginnote:([^\s]+) -->\s*$/.exec(body);
  if (!match) return null;
  try {
    const identity = JSON.parse(decodeURIComponent(match[1])) as ManagedEntryIdentity;
    if (typeof identity.sourceId !== "string" || typeof identity.entryId !== "string") return null;
    const color = typeof identity.color === "string" && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(identity.color) ? identity.color : "";
    return { sourceId: identity.sourceId, entryId: identity.entryId, ...(color ? { color } : {}) };
  } catch { return null; }
}
