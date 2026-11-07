import type { DictionarySetting, LexisEntry } from "./types";
import type { resolveDictionaries } from "./dictionary-sources";

/** Resolve identical spellings once so every reading surface uses the same entry. */
export function createEntryIndex(dictionaries: DictionarySetting[], scopes: ReturnType<typeof resolveDictionaries>) {
  const ranks = new Map(dictionaries.map((dictionary, rank) => [dictionary, rank]));
  const fileRanks = new Map<string, number>();
  for (const [path, memberships] of scopes.byFile) {
    fileRanks.set(path, Math.min(...memberships.map(dictionary => ranks.get(dictionary) ?? Infinity)));
  }
  const rank = (entry: LexisEntry): number => fileRanks.get(entry.file.path) ?? Infinity;
  const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
  const compare = (left: LexisEntry, right: LexisEntry): number => {
    // Unlisted inline sources share the last rank. Avoid Infinity - Infinity (NaN).
    if (rank(left) !== rank(right)) return rank(left) < rank(right) ? -1 : 1;
    return Number(left.isAlias) - Number(right.isAlias)
      || compareText(left.file.path.normalize("NFC"), right.file.path.normalize("NFC"))
      || (left.line ?? -1) - (right.line ?? -1)
      || compareText(left.canonical || left.display, right.canonical || right.display);
  };
  const index = new Map<string, LexisEntry>();
  return {
    index,
    add: (entry: LexisEntry): void => {
      const key = entry.display.toLowerCase();
      const existing = index.get(key);
      if (!existing || compare(entry, existing) < 0) index.set(key, entry);
    },
  };
}
