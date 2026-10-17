import { reviewItemKeys } from "./review-item";
import type { LexisSettings, ReviewItem } from "./types";

export interface ReviewPriority { at: string; initial: number }
export const PRIORITY_HALF_LIFE_DAYS = 7;

export function effectivePriority(priority: ReviewPriority | undefined, now = Date.now()): number {
  if (!priority) return 1;
  const timestamp = Date.parse(priority.at);
  if (!Number.isFinite(timestamp) || !Number.isFinite(priority.initial)) return 1;
  const days = Math.max(0, now - timestamp) / 86400000;
  return 1 - (1 - Math.max(0, Math.min(1, priority.initial))) * 2 ** (-days / PRIORITY_HALF_LIFE_DAYS);
}

export function reviewItemPriority(item: ReviewItem, priorities: LexisSettings["reviewPriorities"], now = Date.now()): number {
  // A combined cloze is penalized only as much as its least-penalized member.
  return Math.max(...reviewItemKeys(item).map((key) => effectivePriority(priorities?.[key], now)));
}

export function lowerReviewPriority(settings: LexisSettings, keys: string[], at = new Date().toISOString()): void {
  settings.reviewPriorities ||= {};
  for (const key of keys) settings.reviewPriorities[key] = { at, initial: 0.25 };
}

export function orderByReviewPriority(queue: ReviewItem[], priorities: LexisSettings["reviewPriorities"], now = Date.now()): ReviewItem[] {
  // Blend the existing rank with a decaying penalty, so a card can move back up
  // before its weight reaches 1. A simple weight sort would penalize it forever.
  return queue.map((item, index) => ({ item, rank: index + (1 - reviewItemPriority(item, priorities, now)) * queue.length }))
    .sort((left, right) => left.rank - right.rank).map(({ item }) => item);
}

export async function changeReviewPriority(settings: LexisSettings, keys: string[], lower: boolean, save: () => Promise<void>): Promise<void> {
  const previous = new Map(keys.map((key) => [key, settings.reviewPriorities?.[key]]));
  if (lower) lowerReviewPriority(settings, keys);
  else for (const key of keys) delete settings.reviewPriorities[key];
  const applied = new Map(keys.map((key) => [key, settings.reviewPriorities[key]]));
  try { await save(); }
  catch (error) {
    for (const key of keys) {
      if (settings.reviewPriorities[key] !== applied.get(key)) continue;
      const before = previous.get(key);
      if (before) settings.reviewPriorities[key] = before;
      else delete settings.reviewPriorities[key];
    }
    throw error;
  }
}
