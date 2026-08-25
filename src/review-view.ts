"use strict";

import { ItemView, Component, Notice } from "obsidian";
import type { LexisRuntime } from "./types";

// 复习会话只负责界面与用户操作；排期、词库读写仍由 LexisPlugin 提供。
const createReviewView = ({ reviewViewType, todayStr, renderLexisMarkdown }) => class LexisReviewView extends ItemView {
  [key: string]: any;
  declare plugin: LexisRuntime;
  constructor(leaf, plugin: LexisRuntime) { super(leaf); this.plugin = plugin; this.queue = []; this.pos = 0; this.reviewed = 0; this.revealed = false; this.undoStack = []; this.options = {}; }
  getViewType() { return reviewViewType; }
  getDisplayText() { return this.plugin.t("review.title"); }
  getIcon() { return "brain"; }
  async onOpen() {
    this.registerDomEvent(window, "keydown", (e) => this.onKey(e));
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
      ub.addEventListener("click", () => this.undo());
    }
    const sb = topbtns.createEl("button", { cls: "lexis-rv-undo", text: this.plugin.t("review.skip") });
    sb.addEventListener("click", () => this.skip());
    const card = c.createDiv({ cls: "lexis-rv-card" });
    const wordEl = card.createDiv({ cls: "lexis-rv-word", text: item.file.basename });
    wordEl.setAttribute("title", this.plugin.t("review.openSource"));
    wordEl.addEventListener("click", () => this.openSource(item.file));
    if (this.plugin.settings.cardFront === "cloze") this.applyClozeFront(wordEl, item);
    const tagsSet = this.plugin.getTags(item.file);
    if (tagsSet.size) {
      const tw = card.createDiv({ cls: "lexis-rv-tags" });
      for (const t of tagsSet) {
        const pill = tw.createSpan({ cls: "lexis-tag", text: "#" + t });
        pill.setAttribute("title", this.plugin.t("review.onlyTag", { tag: t }));
        pill.addEventListener("click", () => this.plugin.openReview({ ...this.options, tag: t }));
      }
    }
    this.backEl = card.createDiv({ cls: "lexis-rv-back" });
    this.backEl.setCssStyles({ display: "none" });
    this.showBtn = c.createEl("button", { cls: "mod-cta lexis-rv-show", text: this.plugin.t("review.show") });
    this.showBtn.addEventListener("click", () => this.reveal());
    this.rateBar = c.createDiv({ cls: "lexis-rv-rate" });
    this.rateBar.setCssStyles({ display: "none" });
    const bs = this.plugin.settings.reviewBottomSpace || 70;
    const isPhone = document.body.classList.contains("is-phone");
    this.rateBar.setCssStyles({ marginBottom: isPhone ? "" : bs + "px" });
    if (isPhone) this.updateMobileRateBarOffset();
    const grades = [[1, "review.again"], [2, "review.hard"], [3, "review.good"], [4, "review.easy"]];
    for (const [g, key] of grades) {
      const ivl = this.plugin.scheduleCard(item.card, g).interval;
      const b = this.rateBar.createEl("button", { cls: "lexis-rv-btn lexis-rv-g" + g });
      b.createSpan({ cls: "lexis-rv-label", text: `${this.plugin.t(key)} (${g})` });
      b.createSpan({ cls: "lexis-rv-ivl", text: this.plugin.humanInterval(ivl) });
      b.addEventListener("click", () => this.grade(g));
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
      const openOcc = () => this.backEl.querySelectorAll("details.lexis-occ-details").forEach((d) => { d.open = true; });
      openOcc(); window.setTimeout(openOcc, 60);
      this.installAnswerInteractions();
    } catch (err) {
      this.backEl.setText(this.plugin.t("review.renderFailed", { error: err?.message || err }));
      console.error("[Lexis] reveal error", err);
    }
  }
  updateMobileRateBarOffset() {
    if (!this.rateBar || !document.body.classList.contains("is-phone")) return;
    const navbarHeight = Math.ceil(document.querySelector(".mobile-navbar")?.getBoundingClientRect().height || 58);
    this.rateBar.setCssProps({ "--lexis-mobile-navbar-height": `${navbarHeight}px` });
  }
  async grade(g) {
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
      new Notice(this.plugin.t("review.gradeFailed", { error: err?.message || err }));
      console.error("[Lexis] grade error", err);
    }
  }
  async undo() {
    const u = this.undoStack.pop();
    if (!u) { new Notice(this.plugin.t("review.nothingUndo")); return; }
    try {
      await this.plugin.app.fileManager.processFrontMatter(u.item.file, (fm) => {
        if (u.wasNew) { delete fm["lexis-s"]; delete fm["lexis-d"]; delete fm["lexis-due"]; delete fm["lexis-last"]; delete fm["lexis-reps"]; delete fm["lexis-lapses"]; }
        else { fm["lexis-s"] = u.prev.s; fm["lexis-d"] = u.prev.d; fm["lexis-due"] = u.prev.due; fm["lexis-last"] = u.prev.last; fm["lexis-reps"] = u.prev.reps; fm["lexis-lapses"] = u.prev.lapses; }
      });
      await this.plugin.undoReviewLog(u.item.file);
      if (u.requeued && this.queue.length) this.queue.pop();
      this.pos = u.pos;
      this.reviewed = Math.max(0, this.reviewed - 1);
      this.render();
    } catch (err) { new Notice(this.plugin.t("review.undoFailed", { error: err?.message || err })); }
  }
  async openSource(file) {
    this.plugin.saveReviewSession(this.leaf, {
      queue: this.queue, pos: this.pos, reviewed: this.reviewed, revealed: this.revealed,
      undoStack: this.undoStack, options: this.options,
    });
    await this.leaf.openFile(file, { active: true });
    this.app.workspace.revealLeaf(this.leaf);
  }
  onKey(e) {
    if (this.app.workspace.activeLeaf !== this.leaf) return;
    if (e.key === "Escape" && this._imagePreview) { e.preventDefault(); this.closeImagePreview(); return; }
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (e.key === "z" || e.key === "Z") { e.preventDefault(); this.undo(); return; }
    if (e.key === "s" || e.key === "S") { e.preventDefault(); this.skip(); return; }
    if (this.pos >= this.queue.length) return;
    if (e.code === "Space") { e.preventDefault(); if (!this.revealed) this.reveal(); return; }
    if (this.revealed && ["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); this.grade(Number(e.key)); }
  }
  async applyClozeFront(wordEl, item) {
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
  openImagePreview(source) {
    this.closeImagePreview();
    const overlay = document.createElement("div");
    overlay.className = "lexis-rv-image-preview";
    const image = document.createElement("img");
    image.src = source.currentSrc || source.src;
    image.alt = source.alt || "";
    image.className = "is-fit";
    image.addEventListener("click", (e) => {
      e.stopPropagation();
      const fit = image.classList.toggle("is-fit");
      overlay.classList.toggle("is-actual", !fit);
    });
    const close = document.createElement("button");
    close.className = "lexis-rv-image-close";
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", this.plugin.t("review.closeImage"));
    close.addEventListener("click", () => this.closeImagePreview());
    overlay.addEventListener("click", () => this.closeImagePreview());
    overlay.append(image, close);
    document.body.appendChild(overlay);
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
  renderDone(c) {
    const d = c.createDiv({ cls: "lexis-rv-done" });
    d.createDiv({ cls: "lexis-rv-done-emoji", text: "🎉" });
    d.createDiv({ text: this.reviewed ? this.plugin.t("review.done", { count: this.reviewed }) : this.plugin.t("review.noneDue") });
    const b = d.createEl("button", { cls: "mod-cta", text: this.plugin.t("review.checkAgain") });
    b.onclick = () => { this.plugin.rebuildIndex(false); this.refresh(); };
    this.plugin.renderHeatmap(d.createDiv({ cls: "lexis-hm-wrap" }));
    c.setCssStyles({ paddingBottom: (this.plugin.settings.reviewBottomSpace || 70) + "px" });
  }
};

export { createReviewView };
