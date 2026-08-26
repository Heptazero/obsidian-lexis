"use strict";

import { ItemView, Component, Notice } from "obsidian";
import type { App, TFile, WorkspaceLeaf } from "obsidian";
import type { TranslationVars } from "./i18n";
import type { LexisSettings } from "./types";

interface ReviewCard {
  s?: number | null;
  d?: number | null;
  due?: string | null;
  last?: string | null;
  reps?: number | null;
  lapses?: number | null;
}

interface ReviewSchedule {
  s: number;
  d: number;
  due: string;
  reps: number;
  lapses: number;
  interval: number;
}

interface ReviewItem {
  file: TFile;
  card: ReviewCard;
}

interface ReviewOptions {
  tag?: string;
  folder?: string;
  order?: string;
}

interface ReviewUndo {
  item: ReviewItem;
  prev: ReviewCard;
  wasNew: boolean;
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
  buildQueue(options: ReviewOptions): ReviewItem[];
  getTags(file: TFile): Set<string>;
  openReview(options?: ReviewOptions): Promise<void>;
  scheduleCard(card: ReviewCard, grade: number): ReviewSchedule;
  humanInterval(days: number): string;
  renderNoteInto(container: HTMLElement, file: TFile, component: Component, reviewMode?: boolean): Promise<void>;
  cardRetrievability(card: ReviewCard): number;
  applySchedule(file: TFile, schedule: ReviewSchedule): Promise<void>;
  logReview(file: TFile, schedule: ReviewSchedule, grade: number, retentionBefore: number): Promise<void>;
  undoReviewLog(file: TFile): Promise<void>;
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
  backEl: HTMLElement | null = null;
  showBtn: HTMLButtonElement | null = null;
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
    this.registerDomEvent(window, "resize", () => this.updateMobileRateBarOffset());
    const saved = this.plugin.takeReviewSession(this.leaf);
    if (!saved) { this.refresh(); return; }
    this.queue = saved.queue; this.pos = saved.pos; this.reviewed = saved.reviewed;
    this.undoStack = saved.undoStack; this.options = saved.options;
    this.render();
    if (saved.revealed) await this.reveal();
  }
  async onClose() { if (this._comp) this._comp.unload(); if (this._frontComp) this._frontComp.unload(); this.closeImagePreview(); }
  refresh() { this.queue = this.plugin.buildQueue(this.options); this.pos = 0; this.reviewed = 0; this.revealed = false; this.undoStack = []; this.render(); }

  render() {
    const c = this.contentEl;
    c.empty(); c.addClass("lexis-review");
    if (this.pos >= this.queue.length) { this.renderDone(c); return; }
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
    const card = c.createDiv({ cls: "lexis-rv-card" });
    const wordEl = card.createDiv({ cls: "lexis-rv-word", text: item.file.basename });
    wordEl.setAttribute("title", this.plugin.t("review.openSource"));
    wordEl.addEventListener("click", () => { void this.openSource(item.file); });
    if (this.plugin.settings.cardFront === "cloze") void this.applyClozeFront(wordEl, item);
    const tagsSet = this.plugin.getTags(item.file);
    if (tagsSet.size) {
      const tw = card.createDiv({ cls: "lexis-rv-tags" });
      for (const t of tagsSet) {
        const pill = tw.createSpan({ cls: "lexis-tag", text: "#" + t });
        pill.setAttribute("title", this.plugin.t("review.onlyTag", { tag: t }));
        pill.addEventListener("click", () => { void this.plugin.openReview({ ...this.options, tag: t }); });
      }
    }
    this.backEl = card.createDiv({ cls: "lexis-rv-back" });
    this.backEl.setCssStyles({ display: "none" });
    this.showBtn = c.createEl("button", { cls: "mod-cta lexis-rv-show", text: this.plugin.t("review.show") });
    this.showBtn.addEventListener("click", () => { void this.reveal(); });
    this.rateBar = c.createDiv({ cls: "lexis-rv-rate" });
    this.rateBar.setCssStyles({ display: "none" });
    const bs = this.plugin.settings.reviewBottomSpace || 70;
    const isPhone = this.containerEl.doc.body.classList.contains("is-phone");
    this.rateBar.setCssStyles({ marginBottom: isPhone ? "" : bs + "px" });
    if (isPhone) this.updateMobileRateBarOffset();
    const grades: Array<[number, string]> = [[1, "review.again"], [2, "review.hard"], [3, "review.good"], [4, "review.easy"]];
    for (const [g, key] of grades) {
      const ivl = this.plugin.scheduleCard(item.card, g).interval;
      const b = this.rateBar.createEl("button", { cls: "lexis-rv-btn lexis-rv-g" + g });
      b.createSpan({ cls: "lexis-rv-label", text: `${this.plugin.t(key)} (${g})` });
      b.createSpan({ cls: "lexis-rv-ivl", text: this.plugin.humanInterval(ivl) });
      b.addEventListener("click", () => { void this.grade(g); });
    }
  }
  async reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.showBtn.setCssStyles({ display: "none" });
    this.backEl.setCssStyles({ display: "" });
    this.rateBar.setCssStyles({ display: "" });
    try {
      if (this._comp) this._comp.unload();
      this._comp = new Component(); this._comp.load();
      await this.plugin.renderNoteInto(this.backEl, this.currentItem.file, this._comp, true);
      const openOcc = () => this.backEl.querySelectorAll<HTMLDetailsElement>("details.lexis-occ-details").forEach((details) => { details.open = true; });
      openOcc(); window.setTimeout(openOcc, 60);
      this.installAnswerInteractions();
    } catch (err) {
      this.backEl.setText(this.plugin.t("review.renderFailed", { error: errorMessage(err) }));
      console.error("[Lexis] reveal error", err);
    }
  }
  updateMobileRateBarOffset() {
    if (!this.rateBar || !this.containerEl.doc.body.classList.contains("is-phone")) return;
    const navbarHeight = Math.ceil(this.containerEl.doc.querySelector(".mobile-navbar")?.getBoundingClientRect().height || 58);
    this.rateBar.setCssProps({ "--lexis-mobile-navbar-height": `${navbarHeight}px` });
  }
  async grade(g: number) {
    if (!this.revealed) { new Notice(this.plugin.t("review.revealFirst")); return; }
    const item = this.currentItem;
    try {
      const prev = { s: item.card.s, d: item.card.d, due: item.card.due, last: item.card.last, reps: item.card.reps, lapses: item.card.lapses };
      const wasNew = item.card.s == null || isNaN(Number(item.card.s));
      const retentionBefore = this.plugin.cardRetrievability(item.card);
      const sched = this.plugin.scheduleCard(item.card, g);
      await this.plugin.applySchedule(item.file, sched);
      await this.plugin.logReview(item.file, sched, g, retentionBefore);
      this.undoStack.push({ item, prev, wasNew, pos: this.pos, requeued: g === 1 });
      this.reviewed++;
      if (g === 1) this.queue.push({ file: item.file, card: { s: sched.s, d: sched.d, due: sched.due, last: todayStr(), reps: sched.reps, lapses: sched.lapses } });
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
      await this.plugin.app.fileManager.processFrontMatter(u.item.file, (fm: Record<string, unknown>) => {
        if (u.wasNew) { delete fm["lexis-s"]; delete fm["lexis-d"]; delete fm["lexis-due"]; delete fm["lexis-last"]; delete fm["lexis-reps"]; delete fm["lexis-lapses"]; }
        else { fm["lexis-s"] = u.prev.s; fm["lexis-d"] = u.prev.d; fm["lexis-due"] = u.prev.due; fm["lexis-last"] = u.prev.last; fm["lexis-reps"] = u.prev.reps; fm["lexis-lapses"] = u.prev.lapses; }
      });
      await this.plugin.undoReviewLog(u.item.file);
      if (u.requeued && this.queue.length) this.queue.pop();
      this.pos = u.pos;
      this.reviewed = Math.max(0, this.reviewed - 1);
      this.render();
    } catch (err) { new Notice(this.plugin.t("review.undoFailed", { error: errorMessage(err) })); }
  }
  async openSource(file: TFile) {
    this.plugin.saveReviewSession(this.leaf, {
      queue: this.queue, pos: this.pos, reviewed: this.reviewed, revealed: this.revealed,
      undoStack: this.undoStack, options: this.options,
    });
    await this.leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(this.leaf);
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
    if (e.code === "Space") { e.preventDefault(); if (!this.revealed) void this.reveal(); return; }
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
  installAnswerInteractions() {
    this.backEl.querySelectorAll("img").forEach((img) => {
      img.classList.add("lexis-rv-zoomable");
      img.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this.openImagePreview(img); });
    });
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
  renderDone(c: HTMLElement) {
    const d = c.createDiv({ cls: "lexis-rv-done" });
    d.createDiv({ cls: "lexis-rv-done-emoji", text: "🎉" });
    d.createDiv({ text: this.reviewed ? this.plugin.t("review.done", { count: this.reviewed }) : this.plugin.t("review.noneDue") });
    const b = d.createEl("button", { cls: "mod-cta", text: this.plugin.t("review.checkAgain") });
    b.onclick = () => { void this.plugin.rebuildIndex(false); this.refresh(); };
    this.plugin.renderHeatmap(d.createDiv({ cls: "lexis-hm-wrap" }));
    c.setCssStyles({ paddingBottom: (this.plugin.settings.reviewBottomSpace || 70) + "px" });
  }
};

export { createReviewView };
