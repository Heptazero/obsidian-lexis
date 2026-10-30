import { restrictReviewItem, reviewItemKeys } from "./review-item";
import type { LexisSettings, ReviewItem, ReviewOptions, ReviewPracticeProgress } from "./types";

export const reviewRounds = (options: Pick<ReviewOptions, "mode" | "rounds">): number =>
  options.mode === "cram" ? Math.max(1, Math.floor(Number(options.rounds) || 1)) : 1;

/** Count individual clozes, without splitting their existing card identities. */
export function takeReviewBatch(items: ReviewItem[], count?: number | null): { selected: ReviewItem[]; remaining: ReviewItem[] } {
  const keys = [...new Set(items.flatMap(reviewItemKeys))];
  const size = count == null ? keys.length : Math.max(0, Math.floor(count));
  const selectedKeys = new Set(keys.slice(0, size)), remainingKeys = new Set(keys.slice(size));
  const restrict = (allowed: Set<string>) => items.map(item => restrictReviewItem(item, allowed)).filter((item): item is ReviewItem => !!item);
  return { selected: restrict(selectedKeys), remaining: restrict(remainingKeys) };
}

export function practiceCounts(settings: LexisSettings, planId: string | undefined, date: string): Record<string, number> {
  const progress = planId ? settings.reviewPracticeProgress?.[planId] : undefined;
  return progress?.date === date ? progress.counts : {};
}

export interface PracticeUndo {
  counts: Record<string, number>;
  grades: Record<string, number>;
  stored?: ReviewPracticeProgress;
  replaceStore: boolean;
}

/** Session-only rounds; practice never calls the FSRS scheduler or writes note metadata. */
export class ReviewBatch {
  readonly items: ReviewItem[];
  readonly remaining: ReviewItem[];
  readonly counts: Record<string, number>;
  readonly grades: Record<string, number> = {};
  round = 1;
  readonly rounds: number;
  constructor(pool: ReviewItem[], options: ReviewOptions, counts: Record<string, number> = {}) {
    const target = options.targetKeys ? new Set(options.targetKeys) : null;
    const eligible = target ? pool.map(item=>restrictReviewItem(item,target)).filter((item):item is ReviewItem=>!!item) : pool;
    const size = options.dailyCardLimit == null ? options.batchSize : Math.min(options.dailyCardLimit,options.batchSize ?? Infinity);
    this.items = takeReviewBatch(eligible,size).selected;
    const selected = new Set(this.items.flatMap(reviewItemKeys));
    this.remaining = pool.map(item=>restrictReviewItem(item,new Set(reviewItemKeys(item).filter(key=>!selected.has(key))))).filter((item):item is ReviewItem=>!!item);
    this.counts = { ...counts }; this.rounds = reviewRounds(options);
    const minimum = Math.min(...this.items.flatMap(reviewItemKeys).map(key => this.counts[key] || 0));
    if (Number.isFinite(minimum)) this.round = Math.min(this.rounds, minimum + 1);
  }
  queue(suspended: Record<string, boolean> = {}): ReviewItem[] {
    const allowed = new Set(this.items.flatMap(reviewItemKeys).filter(key => (this.counts[key] || 0) < this.rounds && !suspended[key.startsWith("syntax:") ? key : `note:${key}`]));
    return this.items.map(item => restrictReviewItem(item, allowed)).filter((item): item is ReviewItem => !!item);
  }
  nextRound(suspended: Record<string, boolean> = {}): ReviewItem[] {
    const next = this.queue(suspended);
    if (next.length) { this.round++; for (const key of Object.keys(this.grades)) delete this.grades[key]; }
    return next;
  }
  async grade(item: ReviewItem, grade: number, host: {settings: LexisSettings; saveSettings(): Promise<void>; reviewDashboard?: {refresh():void}}, options: ReviewOptions, date: string): Promise<PracticeUndo> {
    const keys = reviewItemKeys(item), previous = options.planId ? host.settings.reviewPracticeProgress?.[options.planId] : undefined;
    const select = (values: Record<string,number>) => Object.fromEntries(keys.map(key=>[key,values[key] || 0]));
    const snapshot: PracticeUndo = { counts:select(this.counts),grades:select(this.grades),replaceStore:previous?.date !== date,
      stored:previous ? {date:previous.date,counts:previous.date === date ? select(previous.counts) : {...previous.counts}} : undefined,
    };
    for (const key of keys) {
      this.grades[key] = grade;
      if (grade > 1) this.counts[key] = (this.counts[key] || 0) + 1;
    }
    if (options.planId && grade > 1) {
      const store = host.settings.reviewPracticeProgress ||= {};
      const counts = { ...practiceCounts(host.settings, options.planId, date) };
      for (const key of reviewItemKeys(item)) counts[key] = (counts[key] || 0) + 1;
      store[options.planId] = { date, counts };
      try { await host.saveSettings(); }
      catch (error) { this.restore(snapshot); if (previous) store[options.planId] = previous; else delete store[options.planId]; throw error; }
    }
    host.reviewDashboard?.refresh();
    return snapshot;
  }
  restore(snapshot: PracticeUndo): void {
    for (const [key,count] of Object.entries(snapshot.counts)) {if(count)this.counts[key]=count;else delete this.counts[key];}
    for (const [key,grade] of Object.entries(snapshot.grades)) {if(grade)this.grades[key]=grade;else delete this.grades[key];}
  }
}

export function restorePracticeStore(store: Record<string,ReviewPracticeProgress>, id: string, snapshot: PracticeUndo): void {
  if (!snapshot.stored) {delete store[id];return;}
  if (snapshot.replaceStore) {store[id]=snapshot.stored;return;}
  const counts = {...store[id]?.counts};
  for (const [key,count] of Object.entries(snapshot.stored.counts)) {if(count) counts[key]=count;else delete counts[key];}
  store[id]={date:snapshot.stored.date,counts};
}

export function renamePracticeKey(settings: LexisSettings, before: string, after: string): boolean {
  if (before === after) return false;
  let changed = false;
  for (const progress of Object.values(settings.reviewPracticeProgress || {})) if (progress.counts[before] != null) {
    progress.counts[after]=Math.max(progress.counts[after] || 0,progress.counts[before]);delete progress.counts[before];changed=true;
  }
  for (const target of Object.values(settings.reviewDailyTargets || {})) if (target.keys.includes(before)) {
    target.keys=[...new Set(target.keys.map(key=>key === before ? after : key))];changed=true;
  }
  return changed;
}
