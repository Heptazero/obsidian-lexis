import type { LexisEntry } from "./types";

export interface TextHighlightMatch {
  start: number;
  end: number;
  key: string;
  entry: LexisEntry;
}

export function textHighlightMatches(
  text: string,
  pattern: string | null,
  resolveKey: (value: string) => string,
  index: Map<string, LexisEntry>,
): TextHighlightMatch[] {
  if (!text || !pattern) return [];
  const regex = new RegExp(pattern, "gi");
  const matches: TextHighlightMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const key = resolveKey(match[0]);
    const entry = index.get(key);
    if (entry) matches.push({ start: match.index, end: match.index + match[0].length, key, entry });
    if (!match[0].length) regex.lastIndex++;
  }
  return matches;
}
