import type { LexisSettings } from "./types";
import { addDays, localDate } from "./review-log-data";

export const LEARNING_FIELDS = [
  "reviewPlans", "reviewPracticeProgress", "reviewDailyTargets", "reviewGoalHistory", "reviewLog",
  "reviewHistory", "reviewEvents", "reviewAddedAt", "reviewCardMeta", "reviewCatalogInitialized",
  "reviewPriorities", "syntaxCardStates", "suspendedReviewItems",
] as const;
export type LearningField = typeof LEARNING_FIELDS[number];
export type LearningData = Pick<LexisSettings, LearningField>;
export type DataEntries = Record<string, unknown>;
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const equal = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function retentionDays(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(3650, Math.round(value))) : 90;
}

export function learningData(settings: Partial<LexisSettings>): LearningData {
  return Object.fromEntries(LEARNING_FIELDS.map(field => [field, copy(settings[field]
    ?? (field === "reviewEvents" || field === "reviewPlans" ? [] : field === "reviewCatalogInitialized" ? false : {}))])) as LearningData;
}

export function settingsOnly(settings: Partial<LexisSettings>): Partial<LexisSettings> {
  const result = { ...settings };
  for (const field of LEARNING_FIELDS) delete result[field];
  // Input-only migration key; never written by the new format.
  delete (result as Record<string, unknown>).encounterFolder;
  return result;
}

export function pruneLearning(data: LearningData, days: number | null, today = localDate(new Date())): LearningData {
  if (days === null) return copy(data);
  const result = copy(data), cutoff = addDays(today, 1 - retentionDays(days));
  result.reviewEvents = result.reviewEvents.filter(event => event.date >= cutoff);
  for (const [key, history] of Object.entries(result.reviewHistory)) {
    const recent = Array.isArray(history) ? history.filter(event => event.date >= cutoff).slice(-64) : [];
    if (recent.length) result.reviewHistory[key] = recent;
    else delete result.reviewHistory[key];
  }
  for (const field of ["reviewLog", "reviewGoalHistory"] as const) {
    for (const day of Object.keys(result[field])) if (day < cutoff) delete result[field][day];
  }
  return result;
}

export function flattenLearning(data: LearningData): DataEntries {
  const entries: DataEntries = {};
  for (const field of LEARNING_FIELDS) {
    const value = data[field];
    if (field === "reviewEvents" || field === "reviewPlans") {
      for (const item of data[field]) entries[JSON.stringify([field, item.id])] = item;
      if (field === "reviewPlans") entries[JSON.stringify([field, "$order"])] = data.reviewPlans.map(plan => plan.id);
    } else if (field === "reviewPracticeProgress") {
      for (const [plan, progress] of Object.entries(data.reviewPracticeProgress || {})) {
        entries[JSON.stringify([field, JSON.stringify([plan, "$date"])])] = progress.date;
        for (const [card, count] of Object.entries(progress.counts)) entries[JSON.stringify([field, JSON.stringify([plan, card])])] = { date: progress.date, count };
      }
    } else if (field === "reviewHistory") {
      for (const [card, history] of Object.entries(data.reviewHistory)) {
        const byDate: Record<string, typeof history> = {};
        for (const event of history) (byDate[event.date] ??= []).push(event);
        for (const [date, events] of Object.entries(byDate)) entries[JSON.stringify([field, JSON.stringify([card, date])])] = events;
      }
    } else if (field === "reviewCatalogInitialized") entries[JSON.stringify([field, "$value"])] = value;
    else if (record(value)) for (const [key, item] of Object.entries(value)) entries[JSON.stringify([field, key])] = item;
  }
  return entries;
}

export function entryParts(key: string): [LearningField, string] {
  const parsed: unknown = JSON.parse(key);
  if (!Array.isArray(parsed) || parsed.length !== 2 || !LEARNING_FIELDS.includes(parsed[0] as LearningField) || typeof parsed[1] !== "string") {
    throw new Error("Invalid learning record key");
  }
  return parsed as [LearningField, string];
}

export function entryDay(key: string, value?: unknown): string | null {
  const [field, id] = entryParts(key);
  if (field === "reviewLog" || field === "reviewGoalHistory") return id;
  if (field === "reviewEvents") return record(value) && typeof value.date === "string" ? value.date : null;
  if (field === "reviewHistory") {
    const parts: unknown = JSON.parse(id);
    if (!Array.isArray(parts) || parts.length !== 2 || typeof parts[0] !== "string" || typeof parts[1] !== "string") throw new Error("Invalid review history key");
    return parts[1];
  }
  return null;
}

export function validateLearningValue(key: string, value: unknown): boolean {
  const [field, id] = entryParts(key);
  if (field === "reviewCatalogInitialized") return typeof value === "boolean";
  if (field === "reviewPlans" && id === "$order") return Array.isArray(value) && value.every(id => typeof id === "string");
  if (field === "reviewLog") return typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (field === "reviewAddedAt") return typeof value === "string";
  if (field === "suspendedReviewItems") return typeof value === "boolean";
  if (field === "reviewPracticeProgress") {
    const parts: unknown = JSON.parse(id);
    return Array.isArray(parts) && parts.length === 2 && parts.every(part => typeof part === "string")
      && (parts[1] === "$date" ? typeof value === "string" : record(value) && typeof value.date === "string"
        && typeof value.count === "number" && Number.isFinite(value.count) && value.count >= 0);
  }
  if (field === "reviewHistory") return Array.isArray(value) && value.every(event => record(event) && typeof event.date === "string"
    && event.date === entryDay(key) && typeof event.s === "number" && Number.isFinite(event.s) && event.s > 0);
  if (!record(value)) return false;
  if (field === "reviewEvents") return value.id === id && typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && typeof value.timestamp === "string" && typeof value.filePath === "string" && typeof value.label === "string"
    && (value.type === "note" || value.type === "syntax") && (value.precision === "day" || value.precision === "time")
    && Array.isArray(value.memberKeys) && value.memberKeys.every(key => typeof key === "string")
    && typeof value.grade === "number" && Number.isInteger(value.grade) && value.grade >= 1 && value.grade <= 4;
  if (field === "reviewPlans") return value.id === id && typeof value.name === "string" && typeof value.content === "string";
  return true;
}

export function inflateLearning(entries: DataEntries): LearningData {
  const data = learningData({});
  let order: string[] = [];
  for (const [key, value] of Object.entries(entries)) {
    const [field, id] = entryParts(key);
    if (field === "reviewPlans" && id === "$order") { order = value as string[]; continue; }
    if (field === "reviewEvents") data.reviewEvents.push(value as LearningData["reviewEvents"][number]);
    else if (field === "reviewPlans") data.reviewPlans.push(value as LearningData["reviewPlans"][number]);
    else if (field === "reviewPracticeProgress") {
      const [plan, card] = JSON.parse(id) as [string, string];
      const item = value as { date: string; count: number };
      const date = card === "$date" ? value as string : item.date;
      const progress = data.reviewPracticeProgress[plan];
      if (!progress || progress.date < date) data.reviewPracticeProgress[plan] = { date, counts: {} };
      if (data.reviewPracticeProgress[plan].date === date && card !== "$date") data.reviewPracticeProgress[plan].counts[card] = item.count;
    }
    else if (field === "reviewHistory") {
      const [card] = JSON.parse(id) as [string, string];
      (data.reviewHistory[card] ??= []).push(...value as LearningData["reviewHistory"][string]);
    }
    else if (field === "reviewCatalogInitialized") data.reviewCatalogInitialized = value === true;
    else Object.defineProperty(data[field], id, { value, enumerable: true, configurable: true, writable: true });
  }
  data.reviewEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  for (const key of Object.keys(data.reviewHistory)) data.reviewHistory[key].sort((a, b) => a.date.localeCompare(b.date));
  data.reviewPlans.sort((a, b) => (order.indexOf(a.id) < 0 ? Infinity : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? Infinity : order.indexOf(b.id)) || a.id.localeCompare(b.id));
  return data;
}
