"use strict";

import type { HeadingRef, LexisEntry } from "./types";

export function inlineClassificationHeading(entry: LexisEntry, level: number): HeadingRef | null {
  const headings = entry.headingPath || [];
  if (!headings.length) return null;
  if (!Number.isInteger(level) || level < 1 || level > 6) return headings.at(-1) || null;
  return [...headings].reverse().find((heading) => heading.level <= level) || headings[0] || null;
}

export function inlineClassificationPath(entry: LexisEntry, level: number): HeadingRef[] {
  const headings = entry.headingPath || [];
  const category = inlineClassificationHeading(entry, level);
  if (!category) return [];
  const start = headings.indexOf(category);
  return start < 0 ? [category] : headings.slice(start);
}

export function inlineCategoryLabel(entry: LexisEntry): string {
  return (entry.categoryPath?.length ? entry.categoryPath : [entry.category || ""]).filter(Boolean).join(" / ");
}
