"use strict";

const { ItemView, Component, Notice } = require("obsidian");

// 复习会话只负责界面与用户操作；排期、词库读写仍由 LexisPlugin 提供。
const createReviewView = ({ reviewViewType, todayStr, renderLexisMarkdown }) => class LexisReviewView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.queue = []; this.pos = 0; this.reviewed = 0; this.revealed = false; this.undoStack = []; this.options = {}; }
  getViewType() { return reviewViewType; }
  getDisplayText() { return "Lexis 背单词"; }
  getIcon() { return "brain"; }
  async onOpen() { this.registerDomEvent(window, "keydown", (e) => this.onKey(e)); this.refresh(); }
  onClose() { if (this._comp) this._comp.unload(); if (this._frontComp) this._frontComp.unload(); }
  refresh() { this.queue = this.plugin.buildQueue(this.options); this.pos = 0; this.reviewed = 0; this.revealed = false; this.undoStack = []; this.render(); }

  render() {
    const c = this.contentEl;
    c.empty(); c.addClass("lexis-review");
    if (this.pos >= this.queue.length) { this.renderDone(c); return; }
    this.revealed = false;
    const item = this.currentItem = this.queue[this.pos];
    const topbar = c.createDiv({ cls: "lexis-rv-topbar" });
    topbar.createDiv({ cls: "lexis-rv-progress", text: `已背 ${this.reviewed} · 剩 ${this.queue.length - this.pos}` });
    const topbtns = topbar.createDiv({ cls: "lexis-rv-topbtns" });
    if (this.undoStack.length) {
      const ub = topbtns.createEl("button", { cls: "lexis-rv-undo", text: "↩ 撤销 (Z)" });
      ub.addEventListener("click", () => this.undo());
    }
    const sb = topbtns.createEl("button", { cls: "lexis-rv-undo", text: "跳过 (S)" });
    sb.addEventListener("click", () => this.skip());
    const card = c.createDiv({ cls: "lexis-rv-card" });
    const wordEl = card.createDiv({ cls: "lexis-rv-word", text: item.file.basename });
    wordEl.setAttribute("title", "点击在旁边打开原文");
    wordEl.addEventListener("click", () => this.openSource(item.file));
    if (this.plugin.settings.cardFront === "cloze") this.applyClozeFront(wordEl, item);
    const tagsSet = this.plugin.getTags(item.file);
    if (tagsSet.size) {
      const tw = card.createDiv({ cls: "lexis-rv-tags" });
      for (const t of tagsSet) {
        const pill = tw.createSpan({ cls: "lexis-tag", text: "#" + t });
        pill.setAttribute("title", `只背 #${t}`);
        pill.addEventListener("click", () => this.plugin.openReview({ tag: t }));
      }
    }
    this.backEl = card.createDiv({ cls: "lexis-rv-back" });
    this.backEl.style.display = "none";
    this.showBtn = c.createEl("button", { cls: "mod-cta lexis-rv-show", text: "显示答案 (空格)" });
    this.showBtn.addEventListener("click", () => this.reveal());
    this.rateBar = c.createDiv({ cls: "lexis-rv-rate" });
    this.rateBar.style.display = "none";
    const bs = this.plugin.settings.reviewBottomSpace || 70;
    const isPhone = document.body.classList.contains("is-phone");
    if (isPhone) {
      const spacer = document.createElement("div");
      spacer.style.flex = "1";
      c.insertBefore(spacer, this.rateBar);
    }
    this.rateBar.style.marginBottom = isPhone
      ? `max(${Math.max(bs, 112)}px, calc(24px + env(safe-area-inset-bottom)))`
      : bs + "px";
    const grades = [[1, "重来"], [2, "较难"], [3, "记得"], [4, "简单"]];
    for (const [g, label] of grades) {
      const ivl = this.plugin.scheduleCard(item.card, g).interval;
      const b = this.rateBar.createEl("button", { cls: "lexis-rv-btn lexis-rv-g" + g });
      b.createSpan({ cls: "lexis-rv-label", text: `${label} (${g})` });
      b.createSpan({ cls: "lexis-rv-ivl", text: this.plugin.humanInterval(ivl) });
      b.addEventListener("click", () => this.grade(g));
    }
  }
  async reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.showBtn.style.display = "none";
    this.backEl.style.display = "";
    this.rateBar.style.display = "";
    try {
      if (this._comp) this._comp.unload();
      this._comp = new Component(); this._comp.load();
      await this.plugin.renderNoteInto(this.backEl, this.currentItem.file, this._comp, true);
      const openOcc = () => this.backEl.querySelectorAll("details.lexis-occ-details").forEach((d) => { d.open = true; });
      openOcc(); window.setTimeout(openOcc, 60);
    } catch (err) {
      this.backEl.setText("内容渲染出错:" + (err?.message || err));
      console.error("[Lexis] reveal error", err);
    }
  }
  async grade(g) {
    if (!this.revealed) { new Notice("Lexis:请先点「显示答案」"); return; }
    const item = this.currentItem;
    try {
      const prev = { s: item.card.s, d: item.card.d, due: item.card.due, last: item.card.last, reps: item.card.reps, lapses: item.card.lapses };
      const wasNew = item.card.s == null || isNaN(Number(item.card.s));
      const sched = this.plugin.scheduleCard(item.card, g);
      await this.plugin.applySchedule(item.file, sched);
      await this.plugin.logReview();
      this.undoStack.push({ item, prev, wasNew, pos: this.pos, requeued: g === 1 });
      this.reviewed++;
      if (g === 1) this.queue.push({ file: item.file, card: { s: sched.s, d: sched.d, due: sched.due, last: todayStr(), reps: sched.reps, lapses: sched.lapses } });
      this.pos++;
      this.render();
    } catch (err) {
      new Notice("Lexis 评分出错:" + (err?.message || err));
      console.error("[Lexis] grade error", err);
    }
  }
  async undo() {
    const u = this.undoStack.pop();
    if (!u) { new Notice("Lexis:没有可撤销的"); return; }
    try {
      await this.plugin.app.fileManager.processFrontMatter(u.item.file, (fm) => {
        if (u.wasNew) { delete fm["lexis-s"]; delete fm["lexis-d"]; delete fm["lexis-due"]; delete fm["lexis-last"]; delete fm["lexis-reps"]; delete fm["lexis-lapses"]; }
        else { fm["lexis-s"] = u.prev.s; fm["lexis-d"] = u.prev.d; fm["lexis-due"] = u.prev.due; fm["lexis-last"] = u.prev.last; fm["lexis-reps"] = u.prev.reps; fm["lexis-lapses"] = u.prev.lapses; }
      });
      const t = todayStr();
      if (this.plugin.settings.reviewLog[t]) { this.plugin.settings.reviewLog[t]--; if (this.plugin.settings.reviewLog[t] <= 0) delete this.plugin.settings.reviewLog[t]; await this.plugin.saveSettings(); }
      if (u.requeued && this.queue.length) this.queue.pop();
      this.pos = u.pos;
      this.reviewed = Math.max(0, this.reviewed - 1);
      this.render();
    } catch (err) { new Notice("Lexis 撤销出错:" + (err?.message || err)); }
  }
  openSource(file) {
    let target = this.app.workspace.getLeavesOfType("markdown").find((l) => l !== this.leaf);
    if (!target) target = this.app.workspace.getLeaf("split", "vertical");
    target.openFile(file);
    this.app.workspace.revealLeaf(target);
  }
  onKey(e) {
    if (this.app.workspace.activeLeaf !== this.leaf) return;
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
  skip() {
    if (this.pos >= this.queue.length) return;
    this.queue.push(this.queue[this.pos]);
    this.pos++;
    this.render();
  }
  renderDone(c) {
    const d = c.createDiv({ cls: "lexis-rv-done" });
    d.createDiv({ cls: "lexis-rv-done-emoji", text: "🎉" });
    d.createDiv({ text: this.reviewed ? `本轮背了 ${this.reviewed} 个,清空啦` : "现在没有到期的单词~" });
    const b = d.createEl("button", { cls: "mod-cta", text: "再查一遍" });
    b.onclick = () => { this.plugin.rebuildIndex(false); this.refresh(); };
    this.plugin.renderHeatmap(d.createDiv({ cls: "lexis-hm-wrap" }));
    c.style.paddingBottom = (this.plugin.settings.reviewBottomSpace || 70) + "px";
  }
};

module.exports = { createReviewView };
