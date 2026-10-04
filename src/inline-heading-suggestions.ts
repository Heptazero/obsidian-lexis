"use strict";

import { fuzzyScore } from "./alias-search";
import type { InlineHeadingLevel } from "./types";

interface HeadingSource {
  path: string;
  headings: { heading: string; level: number }[];
}

export interface InlineHeadingSuggestion {
  name: string;
  fileCount: number;
  occurrenceCount: number;
}

export function inlineHeadingQuery(line: string, cursorCh: number, level: InlineHeadingLevel): { startCh: number; query: string } | null {
  if (level < 1 || level > 6) return null;
  const beforeCursor = line.slice(0, cursorCh);
  const match = new RegExp(`^(\\s{0,3}${"#".repeat(level)}\\s+)(.*)$`).exec(beforeCursor);
  return match ? { startCh: match[1].length, query: match[2] } : null;
}

export function collectInlineHeadingSuggestions(sources: HeadingSource[], level: InlineHeadingLevel): InlineHeadingSuggestion[] {
  const suggestions = new Map<string, { name: string; paths: Set<string>; occurrenceCount: number }>();
  for (const source of sources) for (const heading of source.headings) {
    const name = heading.level === level ? heading.heading.trim() : "";
    const key = name.normalize("NFKC").toLowerCase();
    if (!key) continue;
    const item = suggestions.get(key) || { name, paths: new Set<string>(), occurrenceCount: 0 };
    item.paths.add(source.path);
    item.occurrenceCount++;
    suggestions.set(key, item);
  }
  return [...suggestions.values()].map(({ name, paths, occurrenceCount }) => ({ name, fileCount: paths.size, occurrenceCount }));
}

export function rankInlineHeadingSuggestions(suggestions: InlineHeadingSuggestion[], query: string, limit = 30): InlineHeadingSuggestion[] {
  const value = query.trim();
  if (!value) return [...suggestions]
    .sort((left, right) => right.fileCount - left.fileCount || right.occurrenceCount - left.occurrenceCount || left.name.localeCompare(right.name))
    .slice(0, limit);
  return suggestions
    .map((item) => ({ item, score: fuzzyScore(value, item.name) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || right.item.fileCount - left.item.fileCount || left.item.name.localeCompare(right.item.name))
    .slice(0, limit)
    .map(({ item }) => item);
}
