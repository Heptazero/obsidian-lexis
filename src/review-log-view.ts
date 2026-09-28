import { ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import { LEXIS_LOG_VIEW } from "./constants";
import { parseSyntaxCards, type ParsedSyntaxCard } from "./flashcard-syntax";
import { addDays, firstAttemptSuccess, localDate, neverReviewed, weekStart } from "./review-log-data";
import type { LexisSettings, ReviewCardState, ReviewLogEvent } from "./types";

interface LogHost {
  settings: LexisSettings;
  t(key: string, vars?: Record<string, string | number>): string;
  inVocabFolder(path: string): boolean;
  readLifecycle(file: TFile): { archived: boolean; retired: boolean };
  readCard(file: TFile): ReviewCardState;
  readSyntaxCardState(id: string): ReviewCardState;
}

interface ListedCard {
  key: string;
  file: TFile;
  label: string;
  type: "note" | "syntax";
  line?: number;
}

const dateOf = (event: ReviewLogEvent): string => event.date;
const dateTime = (timestamp: string, precise: boolean): string => {
  if (!precise) return timestamp.slice(0, 10);
  const value = new Date(timestamp);
  return `${localDate(value)} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
};
const scheduled = (state: ReviewCardState): boolean => Number.isFinite(Number(state.s)) && Number(state.s) > 0;

export class LexisLogView extends ItemView {
  private day = localDate(new Date());
  private tab: "history" | "unreviewed" = "history";
  private filter: "all" | "note" | "syntax" = "all";
  private cards: ListedCard[] = [];
  private syntaxByKey = new Map<string, ListedCard>();
  private selectedKey = "";
  private refreshId = 0;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: LogHost) { super(leaf); }
  getViewType(): string { return LEXIS_LOG_VIEW; }
  getDisplayText(): string { return this.plugin.t("log.title"); }
  getIcon(): string { return "calendar-days"; }
  setDay(day: string): void { this.day = day; this.tab = "history"; void this.refresh(); }
  async onOpen(): Promise<void> { await this.refresh(); }

  async refresh(): Promise<void> {
    const request = ++this.refreshId;
    if (this.tab === "unreviewed") {
      this.contentEl.empty();
      this.contentEl.createDiv({ cls: "lexis-log-loading", text: this.plugin.t("common.loading") });
      await this.collectCards();
      if (request !== this.refreshId) return;
    } else if (this.dayEvents().some((event) => event.type === "syntax" && !event.filePath) && !this.syntaxByKey.size) {
      this.contentEl.empty();
      this.contentEl.createDiv({ cls: "lexis-log-loading", text: this.plugin.t("common.loading") });
      await this.collectCards();
      if (request !== this.refreshId) return;
    }
    this.render();
  }

  private async collectCards(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    const cards: ListedCard[] = [];
    const syntaxByKey = new Map<string, ListedCard>();
    const templates = {
      inline: this.plugin.settings.flashcardInlineTemplate,
      bidirectional: this.plugin.settings.flashcardBidirectionalTemplate,
      block: this.plugin.settings.flashcardBlockTemplate,
      cloze: this.plugin.settings.flashcardClozeTemplate,
    };
    await Promise.all(files.map(async (file) => {
      const lifecycle = this.plugin.readLifecycle(file);
      if (lifecycle.archived || lifecycle.retired) return;
      if (this.plugin.inVocabFolder(file.path)) cards.push({ key: file.path, file, label: file.basename, type: "note" });
      let markdown = "";
      try { markdown = await this.app.vault.cachedRead(file); } catch { return; }
      for (const syntax of parseSyntaxCards(markdown, file.path, templates)) {
        const card = this.syntaxCard(file, syntax);
        cards.push(card);
        syntaxByKey.set(card.key, card);
      }
    }));
    this.cards = cards.sort((left, right) => left.label.localeCompare(right.label));
    this.syntaxByKey = syntaxByKey;
  }

  private syntaxCard(file: TFile, syntax: ParsedSyntaxCard): ListedCard {
    return { key: `syntax:${syntax.id}`, file, label: syntax.front, type: "syntax", line: syntax.line };
  }

  private dayEvents(): ReviewLogEvent[] {
    return this.plugin.settings.reviewEvents.filter((event) => dateOf(event) === this.day && (this.filter === "all" || event.type === this.filter));
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("lexis-log");
    const header = root.createDiv({ cls: "lexis-log-header" });
    header.createEl("h2", { text: this.plugin.t("log.title") });
    const tabs = header.createDiv({ cls: "lexis-segments" });
    for (const [key, label] of [["history", "log.history"], ["unreviewed", "log.unreviewed"]] as const) {
      const button = tabs.createEl("button", { cls: `lexis-segment${this.tab === key ? " is-active" : ""}`, text: this.plugin.t(label) });
      button.setAttribute("aria-pressed", String(this.tab === key));
      button.onclick = () => { this.tab = key; this.selectedKey = ""; void this.refresh(); };
    }
    if (this.tab === "history") this.renderHistory(root);
    else this.renderUnreviewed(root);
  }

  private renderHistory(root: HTMLElement): void {
    const week = weekStart(this.day);
    const nav = root.createDiv({ cls: "lexis-log-week-nav" });
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
    this.renderFilter(listHeader);
    if (!events.length) list.createDiv({ cls: "lexis-log-empty", text: this.plugin.t("log.noDayCards") });
    for (const event of events) {
      const source = this.eventCard(event);
      const row = list.createEl("button", { cls: `lexis-log-row${event.id === this.selectedKey ? " is-active" : ""}` });
      row.createSpan({ cls: "lexis-log-row-title", text: source?.label || event.label || this.plugin.t("log.unknownCard") });
      row.createSpan({ cls: "lexis-log-row-meta", text: `${this.plugin.t(`review.${["", "again", "hard", "good", "easy"][event.grade] || "again"}`)} · ${event.precision === "time" ? dateTime(event.timestamp, true).slice(11) : this.plugin.t("log.dateOnly")}${event.type === "syntax" ? ` · ${source?.file.basename || event.filePath}` : ""}` });
      row.onclick = () => {
        const scroll = this.contentEl.scrollTop;
        this.selectedKey = event.id;
        this.render();
        this.contentEl.scrollTop = scroll;
      };
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
    const group = host.createDiv({ cls: "lexis-segments" });
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
    detail.createEl("h3", { text: card?.label || event?.label || this.plugin.t("log.unknownCard") });
    if (!card) { detail.createDiv({ text: this.plugin.t("log.sourceMissing") }); return; }
    const added = this.plugin.settings.reviewAddedAt[card.key];
    if (added) this.stat(detail, "log.added", dateTime(added, true));
    else if (card.type === "note") this.stat(detail, "log.fileCreated", dateTime(new Date(card.file.stat.ctime).toISOString(), false));
    else this.stat(detail, "log.added", this.plugin.t("log.unknown"));
    const history = this.plugin.settings.reviewEvents.filter((item) => item.memberKeys.includes(card.key)).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const earliest = history[0];
    this.stat(detail, earliest?.precision === "time" && added ? "log.firstReview" : "log.earliestReview", earliest ? dateTime(earliest.timestamp, earliest.precision === "time") : this.plugin.t("log.never"));
    const state = card.type === "note" ? this.plugin.readCard(card.file) : this.plugin.readSyntaxCardState(card.key.slice(7));
    if (state.due) this.stat(detail, "log.due", state.due);
    const recent = history.slice(-5).reverse();
    if (recent.length) {
      detail.createEl("h4", { text: this.plugin.t("log.recent") });
      for (const item of recent) detail.createDiv({ cls: "lexis-log-recent", text: `${dateTime(item.timestamp, item.precision === "time")} · ${this.plugin.t(`review.${["", "again", "hard", "good", "easy"][item.grade] || "again"}`)}` });
    }
    const open = detail.createEl("button", { text: this.plugin.t("log.openSource") });
    open.onclick = () => { void this.openSource(card); };
  }

  private async openSource(card: ListedCard): Promise<void> {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(card.file);
    await this.app.workspace.revealLeaf(leaf);
    const editor = (leaf.view as { editor?: { setCursor(position: { line: number; ch: number }): void; scrollIntoView(range: { from: { line: number; ch: number }; to: { line: number; ch: number } }, center: boolean): void } }).editor;
    if (editor && card.line != null) {
      const position = { line: card.line, ch: 0 };
      editor.setCursor(position);
      editor.scrollIntoView({ from: position, to: position }, true);
    }
  }

  private renderUnreviewed(root: HTMLElement): void {
    const header = root.createDiv({ cls: "lexis-log-list-header" });
    header.createEl("h3", { text: this.plugin.t("log.unreviewed") });
    this.renderFilter(header);
    const search = root.createEl("input", { cls: "lexis-log-search", attr: { type: "search", placeholder: this.plugin.t("log.search") } });
    root.createDiv({ cls: "lexis-log-note", text: this.plugin.t("log.unreviewedHint") });
    const list = root.createDiv({ cls: "lexis-log-unreviewed" });
    const reviewedKeys = new Set(this.plugin.settings.reviewEvents.flatMap((event) => event.memberKeys));
    let visibleCount = 100;
    const renderRows = () => {
      list.empty();
      const query = search.value.trim().toLocaleLowerCase();
      const matches = this.cards.filter((card) => {
        if (this.filter !== "all" && card.type !== this.filter) return false;
        if (this.plugin.settings.suspendedReviewItems[`${card.type}:${card.key.replace(/^syntax:/, "")}`]) return false;
        const state = card.type === "note" ? this.plugin.readCard(card.file) : this.plugin.readSyntaxCardState(card.key.slice(7));
        return neverReviewed(scheduled(state), reviewedKeys.has(card.key))
          && (!query || `${card.label} ${card.file.path}`.toLocaleLowerCase().includes(query));
      });
      list.createDiv({ cls: "lexis-log-count", text: this.plugin.t("log.count", { count: matches.length }) });
      if (!matches.length) list.createDiv({ cls: "lexis-log-empty", text: this.plugin.t("log.noUnreviewed") });
      for (const card of matches.slice(0, visibleCount)) {
        const entry = list.createDiv();
        const row = entry.createEl("button", { cls: "lexis-log-row" });
        row.createSpan({ cls: "lexis-log-row-title", text: card.label });
        row.createSpan({ cls: "lexis-log-row-meta", text: card.file.path });
        row.onclick = () => {
          this.selectedKey = card.key;
          list.querySelector(".lexis-log-detail")?.remove();
          this.renderCardDetail(entry, card);
        };
      }
      if (matches.length > visibleCount) {
        const more = list.createEl("button", { cls: "lexis-log-more", text: this.plugin.t("log.more", { count: matches.length - visibleCount }) });
        more.onclick = () => { visibleCount += 100; renderRows(); };
      }
    };
    search.oninput = () => { visibleCount = 100; renderRows(); };
    renderRows();
  }
}
