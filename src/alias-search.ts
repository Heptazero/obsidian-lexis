import type { TFile } from "obsidian";
import type { LexisEntry } from "./types";

export interface AliasTarget {
  id: string;
  title: string;
  terms: string[];
  file: TFile;
}

export interface AliasMatch extends AliasTarget {
  matched: string;
  score: number;
}

function normalized(value: string): string {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function fuzzyScore(query: string, value: string): number {
  const needle = normalized(query);
  const haystack = normalized(value);
  if (!needle) return 0;
  if (haystack === needle) return 0;
  if (haystack.startsWith(needle)) return 10 + (haystack.length - needle.length) / 100;
  const containedAt = haystack.indexOf(needle);
  if (containedAt >= 0) return 20 + containedAt + (haystack.length - needle.length) / 100;

  let cursor = 0;
  let first = -1;
  let gaps = 0;
  for (const character of needle) {
    const foundAt = haystack.indexOf(character, cursor);
    if (foundAt < 0) return Number.POSITIVE_INFINITY;
    if (first < 0) first = foundAt;
    gaps += foundAt - cursor;
    cursor = foundAt + 1;
  }
  return 40 + first + gaps + Math.max(0, haystack.length - needle.length) / 100;
}

export function collectAliasTargets(index: Map<string, LexisEntry>): AliasTarget[] {
  const targets = new Map<string, AliasTarget & { termSet: Set<string> }>();
  for (const entry of index.values()) {
    if (!entry?.file || entry.inline) continue;
    const id = entry.file.path;
    let target = targets.get(id);
    if (!target) {
      target = { id, title: entry.file.basename, file: entry.file, terms: [], termSet: new Set() };
      targets.set(id, target);
    }
    for (const term of [entry.file.basename, entry.display]) {
      const key = normalized(term);
      if (!key || target.termSet.has(key)) continue;
      target.termSet.add(key);
      target.terms.push(term);
    }
  }
  return [...targets.values()].map(({ termSet: _termSet, ...target }) => target);
}

export function rankAliasTargets(targets: AliasTarget[], query: string, limit = 8): AliasMatch[] {
  return targets
    .map((target) => {
      let score = Number.POSITIVE_INFINITY;
      let matched = target.title;
      for (const term of target.terms) {
        const candidateScore = fuzzyScore(query, term);
        if (candidateScore < score) { score = candidateScore; matched = term; }
      }
      return { ...target, score, matched };
    })
    .filter((target) => Number.isFinite(target.score))
    .sort((left, right) => left.score - right.score || left.title.localeCompare(right.title))
    .slice(0, limit);
}
