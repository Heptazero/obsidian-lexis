"use strict";

import { ItemView, Component, MarkdownView, Notice } from "obsidian";
import type { App, TFile, WorkspaceLeaf } from "obsidian";
import type { TranslationVars } from "./i18n";
import { chooseClozeRevealMode, type ClozeRevealMode } from "./review-item";
import type { LexisSettings, ReviewCardState, ReviewItem, ReviewOptions, ReviewStateSnapshot } from "./types";

interface ReviewSchedule {
  s: number;
  d: number;
  due: string;
  reps: number;
  lapses: number;
  interval: number;
}

interface ReviewUndo {
  item: ReviewItem;
  snapshot: ReviewStateSnapshot;
  previousCard: ReviewCardState;
  pos: number;
  requeued: boolean;
}

interface ReviewSession {
  queue: ReviewItem[];
  pos: number;
  reviewed: number;
  revealed: boolean;
  undoStack: ReviewUndo[];
  options: ReviewOptions;
}

interface ReviewRuntime {
  app: App;
  settings: LexisSettings;
  t(key: string, vars?: TranslationVars): string;
  takeReviewSession(leaf: WorkspaceLeaf): ReviewSession | null;
  saveReviewSession(leaf: WorkspaceLeaf, session: ReviewSession): void;
  buildQueue(options: ReviewOptions): Promise<ReviewItem[]>;
  getTags(file: TFile): Set<string>;
  openReview(options?: ReviewOptions): Promise<void>;
  scheduleCard(card: ReviewCardState, grade: number): ReviewSchedule;
  humanInterval(days: number): string;
  renderNoteInto(container: HTMLElement, file: TFile, component: Component, reviewMode?: boolean): Promise<void>;
  cardRetrievability(card: ReviewCardState): number;
  snapshotReviewItem(item: ReviewItem): ReviewStateSnapshot;
  applyReviewItemSchedule(item: ReviewItem, schedule: ReviewSchedule): Promise<void>;
  suspendReviewItem(item: ReviewItem): Promise<void>;
  restoreReviewItem(item: ReviewItem, snapshot: ReviewStateSnapshot): Promise<void>;
  logReviewItem(item: ReviewItem, schedule: ReviewSchedule, grade: number, retentionBefore: number): Promise<void>;
  undoReviewItemLog(item: ReviewItem): Promise<void>;
  getFirstExample(file: TFile): Promise<string>;
  buildCloze(example: string, word: string): string;
  rebuildIndex(notify?: boolean): Promise<void>;
  renderHeatmap(container: HTMLElement): void;
}

interface ReviewViewDependencies {
  reviewViewType: string;
  todayStr: () => string;
  renderLexisMarkdown: (app: App, markdown: string, element: HTMLElement, sourcePath: string, component: Component) => Promise<void>;
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

// 复习会话只负责界面与用户操作；排期、词库读写仍由 LexisPlugin 提供。
const createReviewView = ({ reviewViewType, todayStr, renderLexisMarkdown }: ReviewViewDependencies) => class LexisReviewView extends ItemView {
  plugin: ReviewRuntime;
  queue: ReviewItem[];
  pos: number;
  reviewed: number;
  revealed: boolean;
  undoStack: ReviewUndo[];
  options: ReviewOptions;
  currentItem: ReviewItem | null = null;
  wordEl: HTMLElement | null = null;
  backEl: HTMLElement | null = null;
  showBtn: HTMLElement | null = null;
  rateBar: HTMLElement | null = null;
  _comp: Component | null = null;
  _frontComp: Component | null = null;
  _imagePreview: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ReviewRuntime) { super(leaf); this.plugin = plugin; this.queue = []; this.pos = 0; this.reviewed = 0; this.revealed = false; this.undoStack = []; this.options = {}; }
  getViewType() { return reviewViewType; }
  getDisplayText() { return this.plugin.t("review.title"); }
  getIcon() { return "brain"; }
  async onOpen() {
    this.registerDomEvent(window, "keydown", (event) => this.onKey(event));
    this.registerDomEvent(window, "resize", () => this.updateMobileReviewLayout());
    const saved = this.plugin.takeReviewSession(this.leaf);
    if (!saved) { await this.refresh(); return; }
    this.queue = saved.queue; this.pos = saved.pos; this.reviewed = saved.reviewed;
    this.undoStack = saved.undoStack; this.options = saved.options;
    this.render();
    if (saved.revealed) await this.reveal();
  }
  async onClose() { if (this._comp) this._comp.unload(); if (this._frontComp) this._frontComp.unload(); this.closeImagePreview(); }
  async refresh() {
    this.contentEl.empty();
    this.contentEl.createDiv({ cls: "lexis-rv-loading", text: this.plugin.t("common.loading") });
    this.queue = await this.plugin.buildQueue(this.options);
    this.pos = 0; this.reviewed = 0; this.revealed = false; this.undoStack = [];
    this.render();
  }

  render() {
    const c = this.contentEl;
    c.empty(); c.addClass("lexis-review"); c.setCssStyles({ paddingBottom: "" });
    if (this.pos >= this.queue.length) { this.renderDone(c); return; }
    if (this._frontComp) { this._frontComp.unload(); this._frontComp = null; }
    this.revealed = false;
    const item = this.currentItem = this.queue[this.pos];
    const topbar = c.createDiv({ cls: "lexis-rv-topbar" });
    topbar.createDiv({ cls: "lexis-rv-progress", text: this.plugin.t("review.progress", { done: this.reviewed, left: this.queue.length - this.pos }) });
    const topbtns = topbar.createDiv({ cls: "lexis-rv-topbtns" });
    if (this.undoStack.length) {
      const ub = topbtns.createEl("button", { cls: "lexis-rv-undo", text: `↩ ${this.plugin.t("review.undo")}` });
      ub.addEventListener("click", () => { void this.undo(); });
    }
    const sb = topbtns.createEl("button", { cls: "lexis-rv-undo", text: this.plugin.t("review.skip") });
    sb.addEventListener("click", () => this.skip());
    const suspend = topbtns.createEl("button", { cls: "lexis-rv-undo", text: this.plugin.t("review.suspend") });
    suspend.addEventListener("click", () => { void this.suspend(); });
    const card = c.createDiv({ cls: "lexis-rv-card" });
    card.addEventListener("click", (event) => {
      const image = event.composedPath().find((node): node is HTMLImageElement => (node as HTMLElement)?.tagName === "IMG");
      if (!image || !card.contains(image)) return;
      event.preventDefault();
      event.stopPropagation();
      this.openImagePreview(image);
    }, { capture: true });
    let wordEl: HTMLElement;
    if (item.type === "syntax" && item.syntax) {
      const source = card.createEl("button", { cls: "lexis-rv-source", text: `${item.file.basename} · L${item.syntax.line + 1}`, attr: { type: "button" } });
      source.setAttribute("title", this.plugin.t("review.openSource"));
      source.addEventListener("click", () => { void this.openSource(item); });
      wordEl = card.createDiv({ cls: "lexis-rv-word is-syntax" });
      void this.renderSyntaxFront(wordEl, item);
    } else {
      wordEl = card.createDiv({ cls: "lexis-rv-word" });
      wordEl.setText(item.file.basename);
      wordEl.setAttribute("title", this.plugin.t("review.openSource"));
      wordEl.addEventListener("click", () => { void this.openSource(item); });
      if (this.plugin.settings.cardFront === "cloze") void this.applyClozeFront(wordEl, item);
    }
    this.wordEl = wordEl;
    const tagsSet = this.plugin.getTags(item.file);
    if (tagsSet.size) {
      const tw = card.createDiv({ cls: "lexis-rv-tags" });
      for (const t of tagsSet) {
        const pill = tw.createSpan({ cls: "lexis-tag", text: "#" + t });
        pill.setAttribute("title", this.plugin.t("review.onlyTag", { tag: t }));
        pill.addEventListener("click", () => { void this.plugin.openReview({ ...this.options, scope: "tag", tag: t }); });
      }
    }
    this.backEl = card.createDiv({ cls: "lexis-rv-back" });
    this.backEl.setCssStyles({ display: "none" });
    if (this.isMultiCloze(item)) {
      this.showBtn = c.createDiv({ cls: "lexis-rv-show-actions" });
      const one = this.showBtn.createEl("button", { cls: "mod-cta lexis-rv-show", text: this.plugin.t("review.showOne") });
      one.addEventListener("click", () => { void this.showAnswer("one"); });
      const all = this.showBtn.createEl("button", { cls: "lexis-rv-show", text: this.plugin.t("review.showAll") });
      all.addEventListener("click", () => { void this.showAnswer("all"); });
    } else {
      this.showBtn = c.createEl("button", { cls: "mod-cta lexis-rv-show", text: this.plugin.t("review.show") });
      this.showBtn.addEventListener("click", () => { void this.showAnswer("one"); });
    }
    this.rateBar = c.createDiv({ cls: "lexis-rv-rate" });
    this.rateBar.setCssStyles({ display: "none" });
    const bs = this.plugin.settings.reviewBottomSpace ?? 70;
    this.containerEl.setCssProps({ "--lexis-review-bottom-space": `${bs}px` });
    const isPhone = this.containerEl.doc.body.classList.contains("is-phone");
    this.rateBar.setCssStyles({ marginBottom: isPhone ? "" : bs + "px" });
    this.renderRateButtons(item);
    if (isPhone) this.updateMobileReviewLayout();
  }
  renderRateButtons(item: ReviewItem) {
    this.rateBar.empty();
    const grades: Array<[number, string]> = [[1, "review.again"], [2, "review.hard"], [3, "review.good"], [4, "review.easy"]];
    for (const [g, key] of grades) {
      const ivl = this.plugin.scheduleCard(item.card, g).interval;
      const b = this.rateBar.createEl("button", { cls: "lexis-rv-btn lexis-rv-g" + g });
      b.createSpan({ cls: "lexis-rv-label", text: `${this.plugin.t(key)} (${g})` });
      b.createSpan({ cls: "lexis-rv-ivl", text: this.plugin.humanInterval(ivl) });
      b.addEventListener("click", () => { void this.grade(g); });
    }
  }
  isMultiCloze(item: ReviewItem | null): item is ReviewItem {
    return !!item && item.type === "syntax" && item.syntax?.kind === "cloze" && (item.syntax.members?.length || 0) > 1;
  }
  async showAnswer(mode: ClozeRevealMode) {
    const item = this.currentItem;
    if (this.isMultiCloze(item)) {
      const selected = chooseClozeRevealMode(item, mode);
      this.queue.splice(this.pos, 1, selected.current, ...selected.remaining);
      this.currentItem = selected.current;
      this.renderRateButtons(selected.current);
      if (this.wordEl) await this.renderSyntaxFront(this.wordEl, selected.current);
    }
    await this.reveal();
  }
  async reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.showBtn.setCssStyles({ display: "none" });
    this.backEl.setCssStyles({ display: "" });
    this.rateBar.setCssStyles({ display: "" });
    this.updateMobileReviewLayout();
    try {
      if (this._comp) this._comp.unload();
      this._comp = new Component(); this._comp.load();
      const item = this.currentItem;
      if (item.type === "syntax" && item.syntax) {
        this.backEl.empty();
        await renderLexisMarkdown(this.app, item.syntax.back, this.backEl, item.file.path, this._comp);
      } else {
        await this.plugin.renderNoteInto(this.backEl, item.file, this._comp, true);
        const openOcc = () => this.backEl.querySelectorAll<HTMLDetailsElement>("details.lexis-occ-details").forEach((details) => { details.open = true; });
        openOcc(); window.setTimeout(openOcc, 60);
      }
    } catch (err) {
      this.backEl.setText(this.plugin.t("review.renderFailed", { error: errorMessage(err) }));
      console.error("[Lexis] reveal error", err);
    }
  }
  updateMobileReviewLayout() {
    if (!this.rateBar || !this.containerEl.doc.body.classList.contains("is-phone")) return;
    const navbarHeight = Math.ceil(this.containerEl.doc.querySelector(".mobile-navbar")?.getBoundingClientRect().height || 58);
    this.containerEl.setCssProps({ "--lexis-mobile-navbar-height": `${navbarHeight}px` });
    const rateBarHeight = Math.ceil(this.rateBar.getBoundingClientRect().height);
    if (rateBarHeight) this.containerEl.setCssProps({ "--lexis-mobile-rate-height": `${rateBarHeight}px` });
  }
  async grade(g: number) {
    if (!this.revealed) { new Notice(this.plugin.t("review.revealFirst")); return; }
    const item = this.currentItem;
    try {
      const snapshot = this.plugin.snapshotReviewItem(item);
      const previousCard = { ...item.card };
      const retentionBefore = this.plugin.cardRetrievability(item.card);
      const sched = this.plugin.scheduleCard(item.card, g);
      await this.plugin.applyReviewItemSchedule(item, sched);
      await this.plugin.logReviewItem(item, sched, g, retentionBefore);
      this.undoStack.push({ item, snapshot, previousCard, pos: this.pos, requeued: g === 1 });
      this.reviewed++;
      const updated = { s: sched.s, d: sched.d, due: sched.due, last: todayStr(), reps: sched.reps, lapses: sched.lapses };
      item.card = updated;
      if (g === 1) this.queue.push({ ...item, card: { ...updated } });
      this.pos++;
      this.render();
    } catch (err) {
      new Notice(this.plugin.t("review.gradeFailed", { error: errorMessage(err) }));
      console.error("[Lexis] grade error", err);
    }
  }
  async undo() {
    const u = this.undoStack.pop();
    if (!u) { new Notice(this.plugin.t("review.nothingUndo")); return; }
    try {
      await this.plugin.restoreReviewItem(u.item, u.snapshot);
      await this.plugin.undoReviewItemLog(u.item);
      u.item.card = { ...u.previousCard };
      if (u.requeued && this.queue.length) this.queue.pop();
      this.pos = u.pos;
      this.reviewed = Math.max(0, this.reviewed - 1);
      this.render();
    } catch (err) { new Notice(this.plugin.t("review.undoFailed", { error: errorMessage(err) })); }
  }
  async openSource(item: ReviewItem) {
    this.plugin.saveReviewSession(this.leaf, {
      queue: this.queue, pos: this.pos, reviewed: this.reviewed, revealed: this.revealed,
      undoStack: this.undoStack, options: this.options,
    });
    await this.leaf.openFile(item.file, { active: true });
    await this.app.workspace.revealLeaf(this.leaf);
    if (item.syntax && this.leaf.view instanceof MarkdownView) {
      const position = { line: item.syntax.line, ch: 0 };
      this.leaf.view.editor.setCursor(position);
      this.leaf.view.editor.scrollIntoView({ from: position, to: position }, true);
    }
  }
  onKey(e: KeyboardEvent) {
    if (this.app.workspace.getMostRecentLeaf() !== this.leaf) return;
    if (e.key === "Escape" && this._imagePreview) { e.preventDefault(); this.closeImagePreview(); return; }
    const target = e.targetNode;
    const element = target?.instanceOf(HTMLElement) ? target : null;
    const tag = element?.tagName || "";
    if (/INPUT|TEXTAREA/.test(tag) || element?.isContentEditable) return;
    if (e.key === "z" || e.key === "Z") { e.preventDefault(); void this.undo(); return; }
    if (e.key === "s" || e.key === "S") { e.preventDefault(); this.skip(); return; }
    if (this.pos >= this.queue.length) return;
    if (e.code === "Space") { e.preventDefault(); if (!this.revealed) void this.showAnswer("one"); return; }
    if (this.revealed && ["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); void this.grade(Number(e.key)); }
  }
  async applyClozeFront(wordEl: HTMLElement, item: ReviewItem) {
    const ex = await this.plugin.getFirstExample(item.file);
    if (!ex || this.currentItem !== item) return;
    wordEl.addClass("lexis-rv-cloze");
    wordEl.empty();
    if (this._frontComp) this._frontComp.unload();
    this._frontComp = new Component(); this._frontComp.load();
    const cloze = this.plugin.buildCloze(ex, item.file.basename);
    await renderLexisMarkdown(this.app, cloze, wordEl, item.file.path, this._frontComp);
  }
  async renderSyntaxFront(wordEl: HTMLElement, item: ReviewItem) {
    if (!item.syntax || this.currentItem !== item) return;
    wordEl.empty();
    if (this._frontComp) this._frontComp.unload();
    this._frontComp = new Component(); this._frontComp.load();
    await renderLexisMarkdown(this.app, item.syntax.front, wordEl, item.file.path, this._frontComp);
  }
  openImagePreview(source: HTMLImageElement) {
    this.closeImagePreview();
    const overlay = this.containerEl.doc.body.createDiv({ cls: "lexis-rv-image-preview" });
    const image = overlay.createEl("img");
    image.src = source.currentSrc || source.src;
    image.alt = source.alt || "";
    image.className = "is-fit";
    image.addEventListener("click", (e) => {
      e.stopPropagation();
      const fit = image.classList.toggle("is-fit");
      overlay.classList.toggle("is-actual", !fit);
    });
    const close = overlay.createEl("button", { cls: "lexis-rv-image-close" });
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", this.plugin.t("review.closeImage"));
    close.addEventListener("click", () => this.closeImagePreview());
    overlay.addEventListener("click", () => this.closeImagePreview());
    this._imagePreview = overlay;
  }
  closeImagePreview() {
    if (this._imagePreview) this._imagePreview.remove();
    this._imagePreview = null;
  }
  skip() {
    if (this.pos >= this.queue.length) return;
    this.queue.push(this.queue[this.pos]);
    this.pos++;
    this.render();
  }
  async suspend() {
    if (this.pos >= this.queue.length) return;
    try {
      await this.plugin.suspendReviewItem(this.queue[this.pos]);
      this.pos++;
      this.render();
    } catch (err) {
      new Notice(this.plugin.t("review.suspendFailed", { error: errorMessage(err) }));
    }
  }
  renderDone(c: HTMLElement) {
    const d = c.createDiv({ cls: "lexis-rv-done" });
    d.createDiv({ cls: "lexis-rv-done-emoji", text: "🎉" });
    d.createDiv({ text: this.reviewed ? this.plugin.t("review.done", { count: this.reviewed }) : this.plugin.t("review.noneDue") });
    const b = d.createEl("button", { cls: "mod-cta", text: this.plugin.t("review.checkAgain") });
    b.onclick = () => { void this.plugin.rebuildIndex(false); void this.refresh(); };
    this.plugin.renderHeatmap(d.createDiv({ cls: "lexis-hm-wrap" }));
    const isPhone = this.containerEl.doc.body.classList.contains("is-phone");
    c.setCssStyles({ paddingBottom: isPhone ? "" : `${this.plugin.settings.reviewBottomSpace ?? 70}px` });
  }
};

export { createReviewView };
