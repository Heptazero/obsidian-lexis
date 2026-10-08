import { localDate } from "./review-log-data";
import { createDailyTarget, dashboardSummary, mergeReviewItems, planOptions, type DashboardSummary } from "./review-dashboard-data";
import type { LexisSettings, ReviewItem, ReviewOptions, ReviewPlan } from "./types";

export interface DashboardHost {
  settings: LexisSettings;
  collectReviewItems(options?: ReviewOptions, includeReviewed?: boolean): Promise<ReviewItem[]>;
  saveSettings(): Promise<void>;
}

export interface DashboardData {
  today: DashboardSummary;
  plans: Array<{ plan: ReviewPlan; summary: DashboardSummary; items: ReviewItem[] }>;
}

export class ReviewDashboard {
  private listeners = new Set<() => void>();
  private pending: Promise<DashboardData> | null = null;

  constructor(private readonly plugin: DashboardHost) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  refresh(): void {
    this.pending = null;
    for (const listener of this.listeners) listener();
  }

  load(): Promise<DashboardData> {
    if (this.pending === null) {
      const task = this.collect();
      this.pending = task;
      void task.then(() => { if (this.pending === task) this.pending = null; }, () => { if (this.pending === task) this.pending = null; });
    }
    return this.pending;
  }

  private async collect(): Promise<DashboardData> {
    const { settings } = this.plugin;
    const date = localDate(new Date());
    const plans = await Promise.all(settings.reviewPlans.map(async (plan) => ({ plan, items: await this.plugin.collectReviewItems(planOptions(plan), true) })));
    const globalItems = plans.length ? mergeReviewItems(plans.map((plan) => plan.items)) : await this.plugin.collectReviewItems(planOptions(), true);
    const globalOptions: ReviewOptions = plans.length
      ? { sources: plans.flatMap(({ plan }) => plan.sources), content: "both" }
      : planOptions();
    const globalId = `global:${plans.map(({ plan }) => plan.id).join(",")}`;
    let changed = false;
    const summary = (id: string, items: ReviewItem[], options: ReviewOptions): DashboardSummary => {
      let target = settings.reviewDailyTargets[id];
      if (!target || target.date !== date) {
        target = createDailyTarget(items, settings, date);
        settings.reviewDailyTargets[id] = target;
        changed = true;
      } else if (!target.keys.length) {
        const next = createDailyTarget(items, settings, date);
        if (next.keys.length) { target = next; settings.reviewDailyTargets[id] = target; changed = true; }
      }
      return dashboardSummary(items, settings, target, options);
    };
    const today = summary(globalId, globalItems, globalOptions);
    const result = plans.map(({ plan, items }) => ({ plan, items, summary: summary(plan.id, items, planOptions(plan)) }));
    if (settings.reviewGoalHistory[date]?.goal !== today.goal || settings.reviewGoalHistory[date]?.minimum !== today.minimum) {
      settings.reviewGoalHistory[date] = { goal: today.goal, minimum: today.minimum };
      changed = true;
    }
    const active = new Set([globalId, ...plans.map(({ plan }) => plan.id)]);
    for (const id of Object.keys(settings.reviewDailyTargets)) {
      if (!active.has(id) || settings.reviewDailyTargets[id].date !== date) { delete settings.reviewDailyTargets[id]; changed = true; }
    }
    if (changed) await this.plugin.saveSettings();
    return { today, plans: result };
  }
}
