import type { LexisEntry } from "./types";
import { obsidianEntryUri, type MarginNoteDictionary, type MarginNoteEntry } from "./marginnote-protocol";
import { entryColorLabel } from "./entry-colors";

export function dictionaryMarkdown(markdown: string): string {
  return markdown.replace(/^---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/, "")
    .replace(/^```(?:lexis|lexis-home|rel)\b[^\n]*\n[\s\S]*?^```\s*$/gm, "").trim();
}

export async function buildMarginNoteDictionary(
  vault: string,
  index: ReadonlyMap<string, LexisEntry>,
  read: (entry: LexisEntry) => Promise<string>,
  options: { include?(entry: LexisEntry): boolean; color?(entry: LexisEntry): string } = {},
): Promise<MarginNoteDictionary> {
  const groups = new Map<string, { entry: LexisEntry; aliases: Set<string> }>();
  for (const entry of index.values()) {
    if (entry.archived || entry.retired || options.include?.(entry) === false) continue;
    const title = entry.inline ? entry.canonical || entry.display : entry.file.basename;
    const id = JSON.stringify([entry.file.path, entry.inline ? title : ""]);
    let group = groups.get(id);
    if (!group) {
      group = { entry: { ...entry, display: title }, aliases: new Set() };
      groups.set(id, group);
    }
    if (entry.display === title) group.entry = { ...entry, display: title };
    if (entry.display !== title) group.aliases.add(entry.display);
    for (const alias of entry.aliases || []) group.aliases.add(alias);
  }
  const entries: MarginNoteEntry[] = [];
  for (const [id, { entry, aliases }] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const heading = entry.inline ? entry.headingPath?.at(-1)?.name : undefined;
    const color = options.color?.(entry) || "";
    entries.push({
      id,
      title: entry.display,
      aliases: [...aliases].sort(),
      markdown: entry.inline ? entry.annotation || "" : dictionaryMarkdown(await read(entry)),
      uri: obsidianEntryUri(vault, entry.file.path, heading),
      path: entry.file.path,
      inline: !!entry.inline,
      ...(color && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ? { color, colorLabel: entryColorLabel(entry.colorToken) } : {}),
    });
  }
  const source = { id: `obsidian:${vault}`, vault };
  const data = new TextEncoder().encode(JSON.stringify({ source, entries }));
  const digest = await crypto.subtle.digest("SHA-256", data);
  const revision = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { format: "lexis-marginnote", version: 1, source, revision, entries };
}

export function marginNoteExportPath(folder: string): string {
  const path = folder.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!path || path.startsWith("/") || /^[a-z]:/i.test(path) ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("请输入库内文件夹路径 / Enter a vault-relative folder");
  }
  return `${path}/lexis-marginnote.json`;
}
