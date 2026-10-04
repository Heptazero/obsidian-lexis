"use strict";

import type { EntryColor, InlineColorTokenUsage, LexisEntry } from "./types";

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function resolveEntryColorToken(token: string | undefined, entries: EntryColor[] | undefined): string {
  const value = String(token || "").trim();
  if (!value) return "";
  if (HEX_COLOR.test(value)) return value;
  const key = value.toLowerCase();
  const entry = (entries || []).find((item) => String(item?.name || "")
    .split(/\s*\/\s*/)
    .some((name) => name.trim().toLowerCase() === key));
  const color = String(entry?.color || "").trim();
  return HEX_COLOR.test(color) ? color : "";
}

export function entryColorLabel(token: string | undefined): string {
  const value = String(token || "").trim();
  return value && !HEX_COLOR.test(value) ? value : "";
}

export function collectInlineColorTokenUsages(entries: LexisEntry[]): InlineColorTokenUsage[] {
  const usages = new Map<string, { token: string; count: number; files: Set<string> }>();
  for (const entry of entries) {
    const token = String(entry.colorToken || "").trim();
    const key = token.normalize("NFKC").toLowerCase();
    if (!key) continue;
    const usage = usages.get(key) || { token, count: 0, files: new Set<string>() };
    usage.count++;
    if (entry.file?.path) usage.files.add(entry.file.path);
    usages.set(key, usage);
  }
  return [...usages.values()].map(({ token, count, files }) => ({ token, count, fileCount: files.size }));
}

export function unconfiguredEntryColorUsages(usages: InlineColorTokenUsage[], entries: EntryColor[]): InlineColorTokenUsage[] {
  return usages.filter(({ token }) => !resolveEntryColorToken(token, entries));
}
