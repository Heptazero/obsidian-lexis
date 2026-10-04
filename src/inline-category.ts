"use strict";

import type { HeadingRef, LexisEntry } from "./types";

export function inlineClassificationHeading(entry: LexisEntry, level: number): HeadingRef | null {
  const headings = entry.headingPath || [];
  if (!headings.length) return null;
  if (!Number.isInteger(level) || level < 1 || level > 6) return headings.at(-1) || null;
  return [...headings].reverse().find((heading) => heading.level <= level) || headings[0] || null;
}
