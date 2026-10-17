import type { ListedReviewCard } from "./review-catalog";
import type { LexisSettings, ReviewCardState } from "./types";
import { FSRS } from "./fsrs";
import { localDate } from "./review-log-data";
import { libraryGroups, type LibraryGroup } from "./review-library-groups";

export type LibraryStatus = "all" | "unreviewed" | "reviewed" | "suspended" | "archived";
export type LibrarySort = "name" | "discovered" | "firstReview" | "due" | "reps" | "retention" | "stability" | "newest" | "oldest";
export interface LibraryState {
  status: LibraryStatus; sort: LibrarySort; query: string; category: string;
  direction?: "asc" | "desc"; view?: "list" | "cards"; hasCurve?: boolean;
  groupBy?: LibraryGroup;
}
export interface LibraryMetricsHost {
  settings: LexisSettings;
  readLifecycle(file: ListedReviewCard["file"]): { archived: boolean; retired: boolean };
  readCard(file: ListedReviewCard["file"]): ReviewCardState;
  readSyntaxCardState(id: string): ReviewCardState;
}
export interface LibraryMetrics { reps: number | null; retention: number | null; stability: number | null; hasCurve: boolean }
export const librarySorts = ["name", "discovered", "firstReview", "due", "reps", "retention", "stability"] as const;
export const compactLibrarySorts = ["name", "reps", "retention", "due"] as const;
export const libraryStateOf = (host: LibraryMetricsHost, card: ListedReviewCard): ReviewCardState => card.type === "note" ? host.readCard(card.file) : host.readSyntaxCardState(card.key.slice(7));
const dateValid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

export function normalizeLibraryState(saved: Partial<LibraryState> = {}): LibraryState {
  const legacy = saved.sort === "newest" || saved.sort === "oldest";
  const savedGroup = String(saved.groupBy || "");
  const groupBy = savedGroup === "hub" ? "file" : libraryGroups.find(value => value === savedGroup) || "none";
  return {
    status: ["all", "unreviewed", "reviewed", "suspended", "archived"].includes(saved.status) ? saved.status : "all",
    sort: legacy ? "discovered" : librarySorts.some((key) => key === saved.sort) ? saved.sort : "name",
    direction: saved.direction === "asc" ? "asc" : saved.direction === "desc" || (legacy && saved.sort === "newest") ? "desc" : "asc",
    view: saved.view === "cards" ? "cards" : "list", hasCurve: saved.hasCurve === true,
    query: typeof saved.query === "string" ? saved.query : "", category: typeof saved.category === "string" ? saved.category : "",
    groupBy,
  };
}

/** Compact panel state cannot retain filters which no longer have visible controls. */
export function normalizeCompactLibraryState(saved: Partial<LibraryState> = {}): LibraryState {
  const state = normalizeLibraryState(saved);
  return { ...state, sort: compactLibrarySorts.some((key) => key === state.sort) ? state.sort : "reps",
    status: "all", hasCurve: false, category: "" };
}

export function libraryMetrics(state: ReviewCardState, today = localDate(new Date())): LibraryMetrics {
  const s = Number(state.s), count = Number(state.reps);
  const stability = Number.isFinite(s) && s > 0 ? s : null;
  const validHistory = (Array.isArray(state.history) ? state.history : []).map((event) => ({ date: String(event?.date || "").slice(0, 10), s: Number(event?.s) })).filter((event) => dateValid(event.date) && event.date <= today && Number.isFinite(event.s) && event.s > 0);
  const last = String(state.last || "").slice(0, 10);
  const validLast = dateValid(last) && last <= today;
  const date = validLast ? last : validHistory.map((event) => event.date.slice(0, 10)).sort().at(-1);
  const elapsed = date ? Math.max(0, (Date.parse(today) - Date.parse(date)) / 86400000) : null;
  const retention = stability != null && elapsed != null ? FSRS.retrievability(elapsed, stability) : null;
  const reps = state.reps != null && Number.isInteger(count) && count >= 0 ? count : null;
  return { reps, stability, retention: Number.isFinite(retention) && retention != null ? retention : null, hasCurve: stability != null && !!date };
}

export function selectLibraryCards(cards: ListedReviewCard[], host: LibraryMetricsHost, input: LibraryState, today = localDate(new Date()), reviewedOnly = false): ListedReviewCard[] {
  const state = normalizeLibraryState(input);
  const first = new Map<string, string>();
  for (const event of host.settings.reviewEvents) for (const key of event.memberKeys) {
    if (!first.has(key) || event.timestamp < first.get(key)) first.set(key, event.timestamp);
  }
  const metrics = new Map<string, LibraryMetrics>();
  const result = cards.filter((card) => {
    const lifecycle = host.readLifecycle(card.file), scheduled = libraryStateOf(host, card);
    const archived = lifecycle.archived || lifecycle.retired;
    const suspended = !!host.settings.suspendedReviewItems[card.type === "note" ? `note:${card.key}` : card.key];
    const metric = libraryMetrics(scheduled, today); metrics.set(card.key, metric);
    const reviewed = first.has(card.key) || metric.stability != null || (metric.reps != null && metric.reps > 0);
    if (reviewedOnly && (!reviewed || suspended || archived)) return false;
    if (state.status === "suspended" && !suspended) return false;
    if (state.status === "archived" && !archived) return false;
    if (state.status === "unreviewed" && (reviewed || suspended || archived)) return false;
    if (state.status === "reviewed" && !reviewed) return false;
    if (state.hasCurve && !metric.hasCurve) return false;
    if (state.category && !(card.headingPath || []).join(" / ").toLocaleLowerCase().includes(state.category.trim().toLocaleLowerCase())) return false;
    return !state.query || `${card.label} ${card.file.path} ${(card.headingPath || []).join(" / ")}`.toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase());
  });
  const value = (card: ListedReviewCard): number | string | null => {
    if (state.sort === "name") return card.label;
    if (state.sort === "reps" || state.sort === "retention" || state.sort === "stability") return metrics.get(card.key)[state.sort];
    if (state.sort === "firstReview") return first.get(card.key) || null;
    if (state.sort === "due") return libraryStateOf(host, card).due || null;
    return host.settings.reviewCardMeta?.[card.key]?.discoveredAt || null;
  };
  const values = new Map(result.map((card) => [card.key, value(card)]));
  return result.sort((left, right) => {
    const a = values.get(left.key), b = values.get(right.key);
    if (a != null && b == null) return -1;
    if (a == null && b != null) return 1;
    if (a != null && b != null && a !== b) {
      const compared = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
      return compared * (state.direction === "desc" ? -1 : 1);
    }
    return left.label.localeCompare(right.label) || left.file.path.localeCompare(right.file.path) || (left.line || 0) - (right.line || 0);
  });
}
