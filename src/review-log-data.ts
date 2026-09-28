import type { ReviewHistoryEvent, ReviewLogEvent } from "./types";

export function migrateReviewEvents(history: Record<string, ReviewHistoryEvent[]>): ReviewLogEvent[] {
  const events: ReviewLogEvent[] = [];
  for (const [key, entries] of Object.entries(history)) {
    if (!Array.isArray(entries)) continue;
    const syntax = key.startsWith("syntax:");
    entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(entry.grade)) return;
      events.push({
        id: `legacy:${key}:${index}`,
        date: entry.date,
        timestamp: `${entry.date}T00:00:00`,
        precision: "day",
        type: syntax ? "syntax" : "note",
        filePath: syntax ? "" : key,
        label: syntax ? "" : key.split("/").pop()?.replace(/\.md$/i, "") || key,
        memberKeys: [key],
        grade: entry.grade,
        retention: entry.retention,
      });
    });
  }
  return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function weekStart(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() - (parsed.getDay() + 6) % 7);
  return localDate(parsed);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return localDate(parsed);
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function firstAttemptSuccess(events: ReviewLogEvent[]): { correct: number; total: number } {
  const seen = new Set<string>();
  let correct = 0;
  for (const event of events) {
    const key = `${event.date}:${event.memberKeys.join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (event.grade > 1) correct++;
  }
  return { correct, total: seen.size };
}

export function neverReviewed(hasSchedule: boolean, hasHistory: boolean): boolean {
  return !hasSchedule && !hasHistory;
}
