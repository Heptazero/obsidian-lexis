import { reviewItemKeys } from "./review-item";
import type { ReviewItem, ReviewLogEvent } from "./types";

export interface ReviewProgress {
  completed: number;
  retry: number;
  remaining: number;
  total: number;
}

export function latestReviewGrades(events: ReviewLogEvent[], date: string): Map<string, number> {
  const grades = new Map<string, number>();
  const ordered = events.filter((event) => event.date === date).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  for (const event of ordered) for (const key of event.memberKeys) grades.set(key, event.grade);
  return grades;
}

export function progressForKeys(keys: Iterable<string>, grades: Map<string, number>): ReviewProgress {
  const unique = new Set(keys);
  let completed = 0, retry = 0;
  for (const key of unique) {
    const grade = grades.get(key);
    if (grade && grade > 1) completed++;
    else if (grade === 1) retry++;
  }
  return { completed, retry, remaining: unique.size - completed - retry, total: unique.size };
}

export function sessionReviewProgress(queue: ReviewItem[], pos: number, events: ReviewLogEvent[], date: string, suspended: Record<string, boolean> = {}): ReviewProgress {
  const active = (key: string) => !suspended[key.startsWith("syntax:") ? key : `note:${key}`];
  const all = new Set(queue.flatMap(reviewItemKeys).filter(active));
  const pending = new Set(queue.slice(pos).flatMap(reviewItemKeys).filter(active));
  const grades = latestReviewGrades(events, date);
  let retry = 0;
  for (const key of pending) if (grades.get(key) === 1) retry++;
  return { total: all.size, completed: all.size - pending.size, retry, remaining: pending.size - retry };
}

export function completedOnDate(events: ReviewLogEvent[], date: string, allowed?: Set<string>): number {
  const grades = latestReviewGrades(events, date);
  return [...grades].filter(([key, grade]) => grade > 1 && (!allowed || allowed.has(key))).length;
}
