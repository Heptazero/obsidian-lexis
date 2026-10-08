import { Menu, Modal, type App, type Component } from "obsidian";
import { addDays, localDate } from "./review-log-data";
import { completedOnDate, type DashboardSummary } from "./review-dashboard-data";
import { reviewItemKeys } from "./review-item";
import { ReviewPlanEditor, type PlanEditorHost } from "./review-plan-editor";
import type { TranslationVars } from "./i18n";
import type { ReviewItem, ReviewOptions, ReviewPlan } from "./types";

export interface DashboardViewHost extends PlanEditorHost {
  app: App;
  openReview(options?: ReviewOptions): Promise<void>;
  openReviewLog(date?: string): Promise<void>;
  openHome(): Promise<void>;
}

const tFor = (plugin: DashboardViewHost) => (key: string, vars?: TranslationVars) => plugin.t(key, vars);

function renderGoal(parent: HTMLElement, value: number, goal: number, label: string): void {
  const root = parent.createDiv({ cls: "lexis-dashboard-goal" });
  const caption = root.createDiv({ cls: "lexis-dashboard-goal-caption" });
  caption.createSpan({ text: label });
  caption.createSpan({ text: `${value} / ${goal}${goal > 0 && value >= goal ? " ✓" : ""}` });
  const track = root.createDiv({ cls: "lexis-progress-track", attr: { role: "progressbar", "aria-label": label, "aria-valuemin": "0", "aria-valuemax": String(Math.max(1, goal)), "aria-valuenow": String(Math.min(value, goal)) } });
  track.createSpan({ cls: "lexis-progress-segment is-complete" }).setCssProps({ "--lexis-progress-width": `${goal ? Math.min(1, value / goal) * 100 : 0}%` });
}

function renderWeek(parent: HTMLElement, plugin: DashboardViewHost): void {
  const t = tFor(plugin);
  const root = parent.createDiv({ cls: "lexis-dashboard-week" });
  root.createDiv({ cls: "lexis-dashboard-label", text: t("dashboard.week") });
  const today = localDate(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return { date, count: completedOnDate(plugin.settings.reviewEvents, date), goal: plugin.settings.reviewGoalHistory[date]?.goal };
  });
  const maximum = Math.max(1, ...days.flatMap((day) => [day.count, day.goal || 0]));
  const chart = root.createDiv({ cls: "lexis-week-chart" });
  for (const day of days) {
    const label = t("dashboard.day", { date: day.date, count: day.count, goal: day.goal == null ? "" : ` / ${day.goal}` });
    const button = chart.createEl("button", { cls: `lexis-week-day${day.goal && day.count >= day.goal ? " is-complete" : ""}`, attr: { type: "button", title: label, "aria-label": label } });
    button.createEl("small", { text: String(day.count) });
    const column = button.createSpan({ cls: "lexis-week-column" });
    column.createSpan({ cls: "lexis-week-bar" }).setCssProps({ "--lexis-week-height": `${day.count / maximum * 100}%` });
    if (day.goal != null) column.createSpan({ cls: "lexis-week-goal" }).setCssProps({ "--lexis-week-height": `${day.goal / maximum * 100}%` });
    button.createSpan({ text: day.date.slice(5) });
    button.onclick = () => { void plugin.openReviewLog(day.date); };
  }
}

class RemovePlanModal extends Modal {
  constructor(private plugin: DashboardViewHost, private plan: ReviewPlan) { super(plugin.app); }
  onOpen(): void {
    this.setTitle(this.plugin.t("dashboard.removePlan"));
    this.contentEl.createEl("p", { text: this.plugin.t("dashboard.removeConfirm", { name: this.plan.name }) });
    const actions = this.contentEl.createDiv({ cls: "lexis-plan-actions" });
    actions.createEl("button", { text: this.plugin.t("common.cancel") }).onclick = () => this.close();
    actions.createEl("button", { text: this.plugin.t("dashboard.removePlan"), cls: "mod-warning" }).onclick = () => { void (async () => {
      this.plugin.settings.reviewPlans = this.plugin.settings.reviewPlans.filter((plan) => plan.id !== this.plan.id);
      delete this.plugin.settings.reviewDailyTargets[this.plan.id];
      await this.plugin.saveSettings(); this.plugin.reviewDashboard.refresh(); this.close();
    })(); };
  }
}

function renderFolderTree(parent: HTMLElement, items: ReviewItem[], planId: string, expanded: Set<string>, prefix = ""): void {
  const groups = new Map<string, ReviewItem[]>();
  for (const item of items) {
    const folder = item.file.path.slice(0, item.file.path.lastIndexOf("/"));
    if (!folder || item.file.path.lastIndexOf("/") < 0) continue;
    const tail = prefix ? folder.slice(prefix.length + 1) : folder;
    const child = tail.split("/")[0];
    if (!child) continue;
    const path = prefix ? `${prefix}/${child}` : child;
    const group = groups.get(path) || []; group.push(item); groups.set(path, group);
  }
  for (const [path, members] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    const nested = members.some((item) => item.file.path.slice(0, item.file.path.lastIndexOf("/")) !== path);
    if (!nested) {
      const row = parent.createDiv({ cls: "lexis-plan-folder-leaf" });
      row.createSpan({ text: path.split("/").pop() || path });
      row.createSpan({ cls: "lexis-dim", text: String(new Set(members.flatMap(reviewItemKeys)).size) });
      continue;
    }
    const root = parent.createEl("details", { cls: "lexis-plan-folder" });
    root.dataset.lexisExpand = `${planId}:${path}`;
    root.open = expanded.has(root.dataset.lexisExpand);
    const heading = root.createEl("summary");
    heading.createSpan({ text: path.split("/").pop() || path });
    heading.createSpan({ cls: "lexis-dim", text: String(new Set(members.flatMap(reviewItemKeys)).size) });
    const body = root.createDiv({ cls: "lexis-plan-folder-body" });
    let rendered = false;
    const renderChildren = () => {
      if (!root.open || rendered) return;
      rendered = true;
      renderFolderTree(body, members, planId, expanded, path);
    };
    root.addEventListener("toggle", renderChildren);
    renderChildren();
  }
}

function renderPlans(parent: HTMLElement, plugin: DashboardViewHost, plans: Array<{ plan: ReviewPlan; summary: DashboardSummary; items: ReviewItem[] }>, expanded: Set<string>): void {
  const t = tFor(plugin);
  const section = parent.createDiv({ cls: "lexis-dashboard-plans" });
  const header = section.createDiv({ cls: "lexis-dashboard-header" });
  header.createEl("h4", { text: t("dashboard.plans") });
  header.createEl("button", { text: t("dashboard.addPlan"), attr: { type: "button" } }).onclick = () => new ReviewPlanEditor(plugin.app, plugin).open();
  if (!plans.length) section.createDiv({ cls: "lexis-dim", text: t("dashboard.noPlans") });
  for (const { plan, summary, items } of plans) {
    const details = section.createEl("details", { cls: "lexis-plan-row" });
    details.dataset.lexisExpand = plan.id;
    details.open = expanded.has(plan.id);
    const heading = details.createEl("summary");
    const info = heading.createDiv({ cls: "lexis-plan-info" });
    info.createEl("strong", { text: plan.name });
    info.createSpan({ cls: "lexis-dim", text: t("dashboard.counts", { total: summary.total, due: summary.due, fresh: summary.fresh }) });
    info.createSpan({ cls: "lexis-dim", text: t("dashboard.progress", { done: summary.completed, goal: summary.goal, left: summary.remaining }) });
    const start = heading.createEl("button", { text: summary.remaining ? t("dashboard.start") : "✓", attr: { type: "button", "aria-label": t("dashboard.start") } });
    start.disabled = !summary.remaining;
    start.onclick = (event) => { event.preventDefault(); event.stopPropagation(); void plugin.openReview(summary.options); };
    const menuButton = heading.createEl("button", { text: "⋯", attr: { type: "button", "aria-label": t("dashboard.editPlan") } });
    menuButton.onclick = (event) => {
      event.preventDefault(); event.stopPropagation();
      new Menu().addItem((item) => item.setTitle(t("dashboard.editPlan")).setIcon("pencil").onClick(() => new ReviewPlanEditor(plugin.app, plugin, plan).open()))
        .addItem((item) => item.setTitle(t("dashboard.removePlan")).setIcon("trash").onClick(() => new RemovePlanModal(plugin, plan).open())).showAtMouseEvent(event);
    };
    const body = details.createDiv({ cls: "lexis-plan-tree" });
    let rendered = false;
    const renderChildren = () => { if (details.open && !rendered) { rendered = true; renderFolderTree(body, items, plan.id, expanded); } };
    details.addEventListener("toggle", renderChildren);
    renderChildren();
  }
}

export function mountReviewDashboard(parent: HTMLElement, plugin: DashboardViewHost, component: Component, options: { compact?: boolean; planName?: string } = {}): () => void {
  let stopped = false, generation = 0;
  let day = localDate(new Date());
  const render = async () => {
    const id = ++generation;
    try {
      const data = await plugin.reviewDashboard.load();
      if (stopped || id !== generation) return;
      const t = tFor(plugin);
      const selected = options.planName ? data.plans.find(({ plan }) => plan.name === options.planName)?.summary : data.today;
      const expanded = new Set([...parent.querySelectorAll<HTMLDetailsElement>("details[data-lexis-expand]")].filter((element) => element.open).map((element) => element.dataset.lexisExpand || ""));
      parent.empty(); parent.addClass("lexis-dashboard");
      if (!selected) { parent.createDiv({ cls: "lexis-dim", text: t("dashboard.planMissing", { name: options.planName || "" }) }); return; }
      const top = parent.createDiv({ cls: "lexis-dashboard-top" });
      const today = top.createDiv({ cls: "lexis-dashboard-today" });
      today.createEl("h4", { text: options.planName || t("dashboard.today") });
      today.createDiv({ cls: "lexis-dashboard-main-count", text: selected.goal ? t("dashboard.progress", { done: selected.completed, goal: selected.goal, left: selected.remaining }) : t("dashboard.empty") });
      today.createDiv({ cls: "lexis-dim", text: t("dashboard.counts", { total: selected.total, due: selected.due, fresh: selected.fresh }) });
      renderGoal(today, selected.completed, selected.minimum, t("dashboard.minimum"));
      renderGoal(today, selected.completed, selected.goal, t("dashboard.goal"));
      const start = today.createEl("button", { cls: "mod-cta lexis-dashboard-start", text: selected.remaining ? t("dashboard.continue", { count: selected.remaining }) : t(selected.goal ? "dashboard.done" : "dashboard.empty") });
      start.disabled = !selected.remaining;
      start.onclick = () => { void plugin.openReview(selected.options); };
      renderWeek(top, plugin);
      if (!options.compact) renderPlans(parent, plugin, data.plans, expanded);
      else parent.createEl("button", { text: t("home.open") }).onclick = () => { void plugin.openHome(); };
    } catch (error) {
      if (stopped || id !== generation) return;
      console.warn("[Lexis] Cannot load review dashboard", error);
      parent.empty(); parent.createDiv({ cls: "lexis-dim", text: plugin.t("dashboard.failed") });
      parent.createEl("button", { text: plugin.t("dashboard.retry") }).onclick = () => { void render(); };
    }
  };
  const unsubscribe = plugin.reviewDashboard.subscribe(() => { void render(); });
  plugin.app.workspace.onLayoutReady(() => { if (!stopped) void render(); });
  const timer = window.setInterval(() => {
    const date = localDate(new Date());
    if (date !== day) { day = date; void render(); }
  }, 60000);
  const cleanup = () => { stopped = true; unsubscribe(); window.clearInterval(timer); };
  component.register(cleanup);
  return cleanup;
}
