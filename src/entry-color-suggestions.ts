"use strict";

import { fuzzyScore } from "./alias-search";
import type { EntryColor } from "./types";

export interface EntryColorSuggestion {
  name: string;
  group: string;
  color: string;
}

export function inlineColorQuery(line: string, cursorCh: number, delimiter: string): { startCh: number; query: string } | null {
  const beforeCursor = line.slice(0, cursorCh);
  const match = /\{([^{}]*)$/.exec(beforeCursor);
  if (!match) return null;
  const openAt = beforeCursor.length - match[0].length;
  const entryText = beforeCursor.slice(0, openAt).replace(/^\s*[-*+]\s+/, "").trim();
  if (!entryText) return null;
  const delimiterAt = line.indexOf(delimiter || "::");
  if (delimiterAt >= 0 && openAt > delimiterAt) return null;
  return { startCh: openAt + 1, query: match[1] };
}

export function collectEntryColorSuggestions(entries: EntryColor[]): EntryColorSuggestion[] {
  const suggestions = new Map<string, EntryColorSuggestion>();
  for (const entry of entries || []) {
    const group = String(entry?.name || "").trim();
    const color = String(entry?.color || "").trim();
    for (const rawName of group.split(/\s*\/\s*/)) {
      const name = rawName.trim();
      const key = name.normalize("NFKC").toLowerCase();
      if (key && !suggestions.has(key)) suggestions.set(key, { name, group, color });
    }
  }
  return [...suggestions.values()];
}

export function rankEntryColorSuggestions(suggestions: EntryColorSuggestion[], query: string, limit = 30): EntryColorSuggestion[] {
  const value = query.trim();
  if (!value) return suggestions.slice(0, limit);
  return suggestions
    .map((item) => ({ item, score: fuzzyScore(value, item.name) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.item.name.localeCompare(right.item.name))
    .slice(0, limit)
    .map(({ item }) => item);
}
