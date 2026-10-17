import { ItemView, Notice, type WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { LEXIS_LOG_VIEW } from "./constants";
import type { ReviewCatalog, ListedReviewCard } from "./review-catalog";
import { renderCardLibrary, renderLibraryPriority, renderLibraryMetrics, type LibraryHost, type LibraryState } from "./review-library";
import { libraryMetrics, normalizeCompactLibraryState } from "./review-library-model";
import { addDays, firstAttemptSuccess, localDate, weekStart } from "./review-log-data";
import type { ReviewLogEvent } from "./types";
import type { LibraryNavigation } from "./review-library-preview";
import { ReviewRenderQueue } from "./review-render-queue";
import { createReviewRow, renderReviewTitle } from "./review-log-rows";
import { openReviewCardSource } from "./review-navigation";

interface LogHost extends LibraryHost {
  reviewCatalog: ReviewCatalog;
  inVocabFolder(path: string): boolean;
}

type ListedCard = ListedReviewCard;

const dateOf = (event: ReviewLogEvent): string => event.date;
const dateTime = (timestamp: string, precise: boolean): string => {
  if (!precise) return timestamp.slice(0, 10);
  const value = new Date(timestamp);
  return `${localDate(value)} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
};

export class LexisLogView extends ItemView {
  navigation = true;
  private day = localDate(new Date());
  private tab: "history" | "unreviewed" | "reviewed" = "history";
  private library: LibraryState = normalizeCompactLibraryState({ sort: "reps", direction: "desc" });
  private filter: "all" | "note" | "syntax" = "all";
  private cards: ListedCard[] = [];
  private syntaxByKey = new Map<string, ListedCard>();
  private selectedKey = "";
  private refreshId = 0;
  private libraryCleanup: (() => void) | null = null;
  private rendering: ReviewRenderQueue | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: LogHost) { super(leaf); }
  getViewType(): string { return LEXIS_LOG_VIEW; }
  getDisplayText(): string { return this.plugin.t("log.title"); }
  getIcon(): string { return "calendar-days"; }
  setDay(day: string): void { this.day = day; this.tab = "history"; void this.refresh(); }
  async onOpen(): Promise<void> { await this.refresh(); }
  async onClose(): Promise<void> { this.refreshId++; this.libraryCleanup?.(); this.rendering?.dispose(); this.rendering = null; }
  getState(): Record<string, unknown> {
    return { day: this.day, tab: this.tab, filter: this.filter, library: { ...this.library } };
  }
  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const saved = state as Partial<ReturnType<LexisLogView["getState"]>> | null;
    if (saved) {
      if (typeof saved.day === "string") this.day = saved.day;
      if (saved.tab === "library") this.tab = "reviewed";
      else if (typeof saved.tab === "string" && ["history", "unreviewed", "reviewed"].includes(saved.tab)) this.tab = saved.tab as typeof this.tab;
      if (typeof saved.filter === "string" && ["all", "note", "syntax"].includes(saved.filter)) this.filter = saved.filter as typeof this.filter;
      const library = saved.library as Partial<LibraryState> | undefined;
      if (library) this.library = normalizeCompactLibraryState({ ...this.library, ...library });
    }
    await super.setState(state, result);
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.libraryCleanup?.(); this.libraryCleanup = null;
    this.rendering?.reset();
    const request = ++this.refreshId;
    if (this.tab !== "history") {
      this.contentEl.empty();
      this.contentEl.createDiv({ cls: "lexis-log-loading", text: this.plugin.t("common.loading") });
      await this.collectCards();
      if (request !== this.refreshId) return;
    } else if (this.dayEvents().some((event) => event.type === "syntax") && !this.syntaxByKey.size) {
      this.contentEl.empty();
      this.contentEl.createDiv({ cls: "lexis-log-loading", text: this.plugin.t("common.loading") });
      await this.collectCards();
      if (request !== this.refreshId) return;
    }
    this.render();
  }

  private async collectCards(): Promise<void> {
    const cards = await this.plugin.reviewCatalog.cards();
    this.cards = cards.sort((left, right) => left.label.localeCompare(right.label));
    this.syntaxByKey = new Map(cards.filter((card) => card.type === "syntax").map((card) => [card.key, card]));
  }

  private dayEvents(): ReviewLogEvent[] {
    return this.plugin.settings.reviewEvents.filter((event) => dateOf(event) === this.day && (this.filter === "all" || event.type === this.filter));
  }

  private render(): void {
    this.libraryCleanup?.(); this.libraryCleanup = null;
    this.rendering?.reset();
    const root = this.contentEl;
    root.empty();
    root.addClass("lexis-log");
    this.rendering ||= new ReviewRenderQueue(root);
    const header = root.createDiv({ cls: "lexis-log-header" });
    header.createEl("h2", { text: this.plugin.t("log.title") });
    const tabs = header.createDiv({ cls: "lexis-segments" });
    for (const [key, label] of [["history", "log.history"], ["unreviewed", "log.unreviewed"], ["reviewed", "library.title"]] as const) {
      const button = tabs.createEl("button", { cls: `lexis-segment${this.tab === key ? " is-active" : ""}`, text: this.plugin.t(label) });
      button.setAttribute("aria-pressed", String(this.tab === key));
      if (key === "reviewed") button.setAttribute("title", this.plugin.t("library.hint"));
      button.onclick = () => { this.tab = key; this.selectedKey = ""; void this.refresh(); };
    }
    const filters = root.createDiv({ cls: "lexis-log-filters" });
    this.renderFilter(filters);
    if (this.tab === "history") this.renderHistory(root, filters);
    else if (this.tab === "reviewed") {
      this.libraryCleanup = renderCardLibrary(root, this.cards, this.plugin, this.library, this.filter, this.navigationHost(), this.rendering, true);
    }
    else this.renderUnreviewed(root);
  }

  private navigationHost(): LibraryNavigation {
    return { leaf: this.leaf, mode: () => this.plugin.settings.reviewLinkMode || "current",
      saveSession: () => this.app.workspace.requestSaveLayout(),
      failed: (error) => new Notice(this.plugin.t("review.openLinkFailed", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" })),
    };
  }

  private renderHistory(root: HTMLElement, filters: HTMLElement): void {
    const week = weekStart(this.day);
    const nav = filters.createDiv({ cls: "lexis-log-week-nav" });
    const previous = nav.createEl("button", { text: "‹", attr: { "aria-label": this.plugin.t("log.previousWeek") } });
    previous.onclick = () => this.setDay(addDays(this.day, -7));
    nav.createSpan({ text: `${week} — ${addDays(week, 6)}` });
    const today = nav.createEl("button", { text: this.plugin.t("log.today") });
    today.onclick = () => this.setDay(localDate(new Date()));
    const next = nav.createEl("button", { text: "›", attr: { "aria-label": this.plugin.t("log.nextWeek") } });
    next.disabled = addDays(week, 7) > localDate(new Date());
    next.onclick = () => this.setDay(addDays(this.day, 7));

    const days = root.createDiv({ cls: "lexis-log-days" });
    const names = this.plugin.settings.language === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    for (let index = 0; index < 7; index++) {
      const date = addDays(week, index);
      const count = this.plugin.settings.reviewLog[date] || 0;
      const button = days.createEl("button", { cls: `lexis-log-day${this.day === date ? " is-active" : ""}` });
      button.setAttribute("aria-pressed", String(this.day === date));
      button.createSpan({ text: names[index] });
      button.createEl("strong", { text: date.slice(8) });
      button.createEl("small", { text: String(count) });
      button.disabled = date > localDate(new Date());
      button.onclick = () => this.setDay(date);
    }

    const events = this.dayEvents().sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const columns = root.createDiv({ cls: "lexis-log-columns" });
    const list = columns.createDiv({ cls: "lexis-log-list" });
    const listHeader = list.createDiv({ cls: "lexis-log-list-header" });
    listHeader.createEl("h3", { text: this.day });
    if (!events.length) list.createDiv({ cls: "lexis-log-empty", text: this.plugin.t("log.noDayCards") });
    for (const event of events) {
      const source = this.eventCard(event);
      const row = createReviewRow(list, () => {
        const scroll = this.contentEl.scrollTop;
        this.selectedKey = event.id;
        this.render();
        this.contentEl.scrollTop = scroll;
      }, event.id === this.selectedKey);
      renderReviewTitle(row, source || { label: event.label || this.plugin.t("log.unknownCard"), type: event.type }, this.plugin, this.rendering, this.navigationHost());
      row.createSpan({ cls: "lexis-log-row-meta", text: `${this.plugin.t(`review.${["", "again", "hard", "good", "easy"][event.grade] || "again"}`)} · ${event.precision === "time" ? dateTime(event.timestamp, true).slice(11) : this.plugin.t("log.dateOnly")}${event.type === "syntax" ? ` · ${source?.file.basename || event.filePath}` : ""}` });
      if (event.id === this.selectedKey && this.contentEl.clientWidth < 700) this.renderCardDetail(list, source, event);
    }
    const side = columns.createDiv({ cls: "lexis-log-side" });
    this.renderStats(side, events);
    const selected = events.find((event) => event.id === this.selectedKey);
    if (selected && this.contentEl.clientWidth >= 700) this.renderCardDetail(side, this.eventCard(selected), selected);
    if (events.some((event) => event.precision === "day") || (this.filter === "all" && (this.plugin.settings.reviewLog[this.day] || 0) > events.length)) {
      list.createDiv({ cls: "lexis-log-note", text: this.plugin.t("log.legacyHint") });
    }
  }

  private renderFilter(host: HTMLElement): void {
    const group = host.createDiv({ cls: "lexis-segments lexis-log-types" });
    for (const [key, label] of [["all", "common.all"], ["note", "log.notes"], ["syntax", "log.syntax"]] as const) {
      const button = group.createEl("button", { cls: `lexis-segment${this.filter === key ? " is-active" : ""}`, text: this.plugin.t(label) });
      button.setAttribute("aria-pressed", String(this.filter === key));
      button.onclick = () => { this.filter = key; void this.refresh(); };
    }
  }

  private renderStats(host: HTMLElement, events: ReviewLogEvent[]): void {
    const exact = events.filter((event) => event.precision === "time");
    const result = firstAttemptSuccess([...exact].reverse());
    const first = new Map<string, ReviewLogEvent>();
    for (const event of [...exact].reverse()) {
      const key = event.memberKeys.join("|");
      if (!first.has(key)) first.set(key, event);
    }
    const predicted = [...first.values()].filter((event) => Number.isFinite(event.retention) && event.retention > 0);
    host.createEl("h3", { text: this.plugin.t("log.dayStats") });
    const count = this.filter === "all" ? this.plugin.settings.reviewLog[this.day] || 0 : events.length;
    const monday = weekStart(this.day);
    const weekActions = Array.from({ length: 7 }, (_, index) => this.plugin.settings.reviewLog[addDays(monday, index)] || 0).reduce((sum, value) => sum + value, 0);
    this.stat(host, "log.actions", String(count));
    this.stat(host, "log.weekActions", String(weekActions));
    this.stat(host, "log.unique", String(new Set(events.map((event) => event.memberKeys.join("|"))).size));
    this.stat(host, "log.firstSuccess", result.total ? `${Math.round(result.correct / result.total * 100)}%` : "—");
    this.stat(host, "log.predicted", predicted.length ? `${Math.round(predicted.reduce((sum, event) => sum + event.retention, 0) / predicted.length)}%` : "—");
    host.createDiv({ cls: "lexis-log-note", text: this.plugin.t("log.statsHint") });
  }

  private stat(host: HTMLElement, label: string, value: string): void {
    const line = host.createDiv({ cls: "lexis-log-stat" });
    line.createSpan({ text: this.plugin.t(label) });
    line.createEl("strong", { text: value });
  }

  private eventCard(event: ReviewLogEvent): ListedCard | null {
    if (event.type === "syntax") {
      const indexed = this.syntaxByKey.get(event.memberKeys[0]);
      if (indexed) return indexed;
      const file = this.app.vault.getFileByPath(event.filePath);
      return file ? { key: event.memberKeys[0], file, label: event.label, type: "syntax", line: event.line } : null;
    }
    const file = this.app.vault.getFileByPath(event.filePath);
    return file ? { key: event.memberKeys[0], file, label: file.basename, type: "note" } : null;
  }

  private renderCardDetail(host: HTMLElement, card: ListedCard | null, event?: ReviewLogEvent): void {
    const detail = host.createDiv({ cls: "lexis-log-detail" });
    renderReviewTitle(detail.createEl("h3"), card || { label: event?.label || this.plugin.t("log.unknownCard"), type: event?.type || "note" }, this.plugin, this.rendering, this.navigationHost());
    if (!card) { detail.createDiv({ text: this.plugin.t("log.sourceMissing") }); return; }
    if (card.headingPath?.length) this.stat(detail, "library.category", card.headingPath.join(" / "));
    const discovered = this.plugin.settings.reviewCardMeta?.[card.key]?.discoveredAt;
    this.stat(detail, "library.discovered", discovered ? dateTime(discovered, true) : this.plugin.t("log.unknown"));
    const added = this.plugin.settings.reviewAddedAt[card.key];
    if (added) this.stat(detail, "log.added", dateTime(added, true));
    else if (card.type === "note") this.stat(detail, "log.fileCreated", dateTime(new Date(card.file.stat.ctime).toISOString(), false));
    else this.stat(detail, "log.added", this.plugin.t("log.unknown"));
    const history = this.plugin.settings.reviewEvents.filter((item) => item.memberKeys.includes(card.key)).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const earliest = history[0];
    this.stat(detail, "library.firstReview", earliest ? dateTime(earliest.timestamp, earliest.precision === "time") : this.plugin.t("log.never"));
    const state = card.type === "note" ? this.plugin.readCard(card.file) : this.plugin.readSyntaxCardState(card.key.slice(7));
    renderLibraryMetrics(detail, this.plugin, libraryMetrics(state));
    if (state.due) this.stat(detail, "log.due", state.due);
    const recent = history.slice(-5).reverse();
    if (recent.length) {
      detail.createEl("h4", { text: this.plugin.t("log.recent") });
      for (const item of recent) detail.createDiv({ cls: "lexis-log-recent", text: `${dateTime(item.timestamp, item.precision === "time")} · ${this.plugin.t(`review.${["", "again", "hard", "good", "easy"][item.grade] || "again"}`)}` });
    }
    const open = detail.createEl("button", { text: this.plugin.t("log.openSource") });
    open.onclick = () => { void this.openSource(card); };
    renderLibraryPriority(this.plugin, detail, card);
  }

  private async openSource(card: ListedCard): Promise<void> {
    await openReviewCardSource({ ...this.navigationHost(), app: this.app, sourcePath: () => card.file.path }, card);
  }

  private renderUnreviewed(root: HTMLElement): void {
    this.libraryCleanup = renderCardLibrary(root, this.cards, this.plugin, this.library, this.filter, this.navigationHost(), this.rendering, false, true);
  }
}
