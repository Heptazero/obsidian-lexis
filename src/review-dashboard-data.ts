import { reviewItemKeys } from "./review-item";
import { completedOnDate, latestReviewGrades, progressForKeys } from "./review-progress";
import type { LexisSettings, ReviewCardState, ReviewDailyTarget, ReviewItem, ReviewOptions, ReviewPlan } from "./types";

export interface DashboardSummary {
  date: string;
  goal: number;
  minimum: number;
  completed: number;
  remaining: number;
  retry: number;
  due: number;
  fresh: number;
  total: number;
  options: ReviewOptions;
}

export const planOptions = (plan?: ReviewPlan): ReviewOptions => plan
  ? { sources: plan.sources, content: plan.content }
  : { scope: "vocab", content: "notes" };

const isFresh = (card: ReviewCardState): boolean => card.s == null || !Number.isFinite(Number(card.s));
const isDue = (card: ReviewCardState, date: string): boolean => !isFresh(card) && (!card.due || String(card.due).slice(0, 10) <= date);

function inventory(items: ReviewItem[]): Map<string, ReviewCardState> {
  const result = new Map<string, ReviewCardState>();
  for (const item of items) {
    if (item.syntax?.members?.length) for (const member of item.syntax.members) result.set(`syntax:${member.id}`, member.card);
    else for (const key of reviewItemKeys(item)) result.set(key, item.card);
  }
  return result;
}

export function createDailyTarget(items: ReviewItem[], settings: LexisSettings, date: string): ReviewDailyTarget {
  const grades = latestReviewGrades(settings.reviewEvents, date);
  const entries = [...inventory(items)];
  const completed = entries.filter(([key]) => (grades.get(key) || 0) > 1).map(([key]) => key);
  const due = entries.filter(([key, card]) => isDue(card, date) || grades.get(key) === 1).map(([key]) => key);
  const fresh = entries.filter(([key, card]) => isFresh(card) && !grades.has(key)).map(([key]) => key).slice(0, Math.max(0, settings.newPerDay));
  const keys = [...new Set([...completed, ...due, ...fresh])];
  const goal = Math.min(keys.length, Math.max(0, settings.reviewDailyGoal));
  return { date, keys, goal, minimum: Math.min(goal, Math.max(0, settings.reviewMinimumGoal)) };
}

export function dashboardSummary(items: ReviewItem[], settings: LexisSettings, target: ReviewDailyTarget, options: ReviewOptions): DashboardSummary {
  const grades = latestReviewGrades(settings.reviewEvents, target.date);
  const entries = inventory(items);
  const keys = target.keys.filter((key) => entries.has(key));
  const progress = progressForKeys(entries.keys(), grades);
  const goal = Math.min(target.goal, keys.length);
  const uncompleted = [...entries].filter(([key]) => (grades.get(key) || 0) <= 1);
  return {
    date: target.date, goal, minimum: Math.min(target.minimum, goal),
    completed: progress.completed, remaining: Math.max(0, goal - progress.completed), retry: progress.retry,
    due: uncompleted.filter(([, card]) => isDue(card, target.date)).length,
    fresh: uncompleted.filter(([, card]) => isFresh(card)).length,
    total: entries.size,
    options: { ...options, targetKeys: keys, dailyCardLimit: Math.max(0, goal - progress.completed) },
  };
}

export function mergeReviewItems(groups: ReviewItem[][]): ReviewItem[] {
  const items = new Map<string, ReviewItem>();
  for (const group of groups) for (const item of group) items.set(reviewItemKeys(item).join("|"), item);
  return [...items.values()];
}

export { completedOnDate };
