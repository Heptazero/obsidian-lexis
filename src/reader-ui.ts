"use strict";

import * as obsidian from "obsidian";
import type { App, Component as ObsidianComponent, Editor, MarkdownPostProcessorContext, MarkdownView, Notice as ObsidianNotice, TFile as ObsidianTFile, WorkspaceLeaf } from "obsidian";
import type { Occurrence } from "./occurrence-search";
import type { InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats, ReviewHistoryEvent } from "./types";

type CurveCard = { s?: number | null; due?: string | null; last?: string | null; history?: ReviewHistoryEvent[] };
type BridgeResult = { ok: boolean; error?: string; tags?: string[] };
type TranslationVars = Record<string, string | number | boolean>;
type AddWordOptions = { openExisting?: boolean };
type StatsSummary = { due: number; fresh: number; total: number };
type Heading = { title: string; subtitle: string };
interface FsrsDisplayApi { nextInterval(stability: number, retention: number): number; retrievability(elapsedDays: number, stability: number): number }
interface ReaderUiDependencies {
  buildCurveSVG: (card: CurveCard, dependencies: { requestRetention: number; nextInterval: FsrsDisplayApi["nextInterval"]; retrievability: FsrsDisplayApi["retrievability"]; addDaysStr: (date: string, days: number) => string; daysBetween: (start: string, end: string) => number; todayStr: () => string }) => string | null;
  FSRS: FsrsDisplayApi;
  addDaysStr: (date: string, days: number) => string;
  daysBetween: (start: string, end: string) => number;
  todayStr: () => string;
  fmtDate: (date: Date) => string;
  TFile: typeof ObsidianTFile;
  Notice: typeof ObsidianNotice;
  boundedSource: (value: string) => string;
  escapeRe: (value: string) => string;
  Component: typeof ObsidianComponent;
  renderLexisMarkdown: (app: App, markdown: string, element: HTMLElement, sourcePath: string, component: ObsidianComponent) => Promise<void>;
  openAliasPicker: (app: App, plugin: object, text: string, select: (entry: LexisEntry) => Promise<void>) => void;
  openRestoreModal: (app: App, plugin: object, file: ObsidianTFile) => void;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"; }

function eventElement(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return null;
  const node = target as Node;
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  return element && "dataset" in element ? element : null;
}

function confirmAction(app: App, title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    class ConfirmModal extends obsidian.Modal {
      onOpen() {
        this.setTitle(title);
        this.contentEl.createEl("p", { text: message });
        const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
        actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
        actions.createEl("button", { cls: "mod-warning", text: "删除" }).addEventListener("click", () => { settled = true; resolve(true); this.close(); });
      }
      onClose() { this.contentEl.empty(); if (!settled) resolve(false); }
    }
    new ConfirmModal(app).open();
  });
}

function createReaderUi({ buildCurveSVG, FSRS, addDaysStr, daysBetween, todayStr, fmtDate, TFile, Notice, boundedSource, escapeRe, Component, renderLexisMarkdown, openAliasPicker, openRestoreModal }: ReaderUiDependencies): PropertyDescriptorMap {
  class ReaderUi {
  declare app: App;
  declare settings: LexisSettings;
  declare index: Map<string, LexisEntry>;
  declare stats: LexisStats;
  declare inlineCategoryOccurrences: InlineCategoryOccurrence[];
  declare _hideTimer: number;
  declare _showTimer: number | null;
  declare _showTarget: HTMLElement | null;
  declare _popover: HTMLElement | null;
  declare _popoverComp: ObsidianComponent | null;
  declare _selPill: HTMLElement | null;
  declare _occLeaf: WorkspaceLeaf | null;
  declare readCard: (file: ObsidianTFile) => CurveCard;
  declare renderDerivedWords: (element: HTMLElement, file: ObsidianTFile) => Promise<void>;
  declare renderReverseRelations: (element: HTMLElement, file: ObsidianTFile, type: string) => Promise<number>;
  declare renderTypedRelations: (element: HTMLElement, file: ObsidianTFile) => Promise<number>;
  declare getCuratedSourcePaths: (file: ObsidianTFile) => Promise<Set<string>>;
  declare findOccurrences: (word: string) => Promise<Occurrence[]>;
  declare occurrenceLabel: (occurrence: Occurrence) => string;
  declare addExampleToWord: (wordFile: ObsidianTFile, sentence: string, sourceFile: ObsidianTFile, page?: number) => Promise<boolean>;
  declare t: (key: string, vars?: TranslationVars) => string;
  declare dictFolders: () => string[];
  declare normalizeFolder: (folder: string) => string;
  declare saveSettings: () => Promise<void>;
  declare addWordFromSelection: (text: string, editor: Editor | null, view: MarkdownView | null, folder?: string, options?: AddWordOptions) => Promise<void>;
  declare rebuildIndex: (notify: boolean) => Promise<LexisStats>;
  declare getTags: (file: ObsidianTFile) => Set<string>;
  declare computeStats: () => StatsSummary;
  declare openHome: () => void;
  declare openReview: () => void;
  declare collectVocabTags: () => string[];
  declare bridgeMoveWord: (payload: Record<string, unknown>) => Promise<BridgeResult>;
  declare bridgeAnnotate: (payload: Record<string, unknown>) => Promise<BridgeResult>;
  declare bridgeDeleteWord: (key: string) => Promise<BridgeResult>;
  declare bridgeTagWord: (payload: Record<string, unknown>) => Promise<BridgeResult>;
  declare cardHeading: (entry: LexisEntry) => Heading;
  declare recordEncounter: (file: ObsidianTFile, type: string) => void;
  declare hoverFeedback: (file: ObsidianTFile) => Promise<void>;
  declare setArchived: (file: ObsidianTFile, archived: boolean) => Promise<void>;
  // 遗忘曲线 SVG(FSRS 衰减)
  buildCurveSVG(card: CurveCard): string | null {
    return buildCurveSVG(card, {
      requestRetention: this.settings.requestRetention,
      nextInterval: (stability, retention) => FSRS.nextInterval(stability, retention),
      retrievability: (elapsedDays, stability) => FSRS.retrievability(elapsedDays, stability),
      addDaysStr,
      daysBetween,
      todayStr,
    });
  }
  // 笔记内 ```lexis 代码块:曲线 + 相关词 + 出现过的地方
  async renderLexisBlock(el: HTMLElement, ctx: MarkdownPostProcessorContext, src: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof TFile)) { el.setText("Lexis:无法识别当前笔记"); return; }
    const word = file.basename;
    el.addClass("lexis-block");
    const parts = (src || "").trim().split(/\s+/).filter(Boolean);
    const m = (parts[0] || "").toLowerCase();
    const typeArg = parts.slice(1).join(" ");
    const countBefore = el.children.length;
    if (m === "derived" || m === "派生") { await this.renderDerivedWords(el, file); if (el.children.length === countBefore) el.remove(); return; }
    const showCurve = m === "" || m === "curve" || m === "all";
    const showRelated = m === "" || m === "refs" || m === "ref" || m === "rel" || m === "related" || m === "all";
    const showOcc = (m === "" || m === "refs" || m === "ref" || m === "occ" || m === "all") && this.settings.showOccurrences;

    if (showCurve) {
      const card = this.readCard(file);
      const svg = this.buildCurveSVG(card);
      if (svg) {
        const due = card.due ? ` · 下次复习 ${String(card.due).slice(0, 10)}` : "";
        el.createDiv({ cls: "lexis-section-title", text: `🧠 记忆曲线（复习日期 × 保留率${due}）` });
        const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
        const curve = el.createDiv({ cls: "lexis-curve" });
        curve.appendChild(curve.ownerDocument.importNode(parsed.documentElement, true));
      }
    }

    if (showRelated) {
      if ((m === "rel" || m === "related") && typeArg) await this.renderReverseRelations(el, file, typeArg);
      else await this.renderTypedRelations(el, file);
    }

    if (showOcc) {
      const curated = await this.getCuratedSourcePaths(file);
      const list = (await this.findOccurrences(word)).filter((o) => !curated.has(o.file.basename.toLowerCase()));
      if (!list.length) return;
      const det = el.createEl("details", { cls: "lexis-occ-details" });
      det.createEl("summary", { text: `📍 出现过的地方 (${list.length})` });
      const occWrap = det.createDiv();
      const comp = new Component(); comp.load();
      for (const o of list) {
        const dd = occWrap.createDiv({ cls: "lexis-occ" });
        await this.renderSentence(dd, o.sentence, word, comp);
        const add = dd.createSpan({ cls: "lexis-occ-add", text: " ➕" });
        add.setAttribute("title", "收藏到出处");
        add.addEventListener("click", () => { void (async () => {
          if (add.dataset.done) return;
          add.dataset.done = "1";
          if (await this.addExampleToWord(file, o.sentence, o.file, o.page)) { add.setText(" ✓"); add.setCssStyles({ cursor: "default" }); add.removeAttribute("title"); } else delete add.dataset.done;
        })(); });
        const s2 = dd.createSpan({ cls: "lexis-occ-src", text: " ↗ " + this.occurrenceLabel(o) });
        s2.addEventListener("click", () => { void this.openOccurrence(o.file, word, o.page); });
      }
    }
    if (el.children.length === countBefore) el.remove();
  }

  // ---------- 悬浮卡 ----------
  highlightTarget(target: EventTarget | null): HTMLElement | null { const element = eventElement(target); return element && (element.classList.contains("lexis-hl") || element.classList.contains("lexis-pdf-hl")) ? element : null; }
  onMouseOver(e: MouseEvent): void {
    const t = this.highlightTarget(e.target);
    if (!t) return;
    window.clearTimeout(this._hideTimer);
    if (this._popover?.dataset.lexisKey === t.dataset.lexisKey) return;
    if (this._showTarget === t) return;
    window.clearTimeout(this._showTimer);
    this._showTarget = t;
    const open = () => {
      this._showTimer = null;
      if (this._showTarget === t && t.isConnected) void this.showPopover(t);
    };
    const delay = Math.max(0, Number(this.settings.hoverDelayMs) || 0);
    if (delay) this._showTimer = window.setTimeout(open, delay); else open();
  }
  onMouseOut(e: MouseEvent): void {
    const t = this.highlightTarget(e.target);
    if (!t) return;
    if (this._showTarget === t) {
      window.clearTimeout(this._showTimer);
      this._showTimer = null;
      this._showTarget = null;
    }
    if (this._popover?.dataset.lexisKey === t.dataset.lexisKey) this.scheduleHide();
  }
  onClick(e: MouseEvent): void {
    const t = this.highlightTarget(e.target);
    if (t) {
      const entry = this.index.get(t.dataset.lexisKey);
      if (entry) {
        e.preventDefault();
        if (entry.inline) void this.openInlineEntry(entry, e.ctrlKey || e.metaKey);
        else { void this.app.workspace.getLeaf(e.ctrlKey || e.metaKey ? "tab" : false).openFile(entry.file); this.removePopover(); }
      }
    } else if (this._popover && !this._popover.contains(eventElement(e.target))) this.removePopover();
  }
  scheduleHide() { window.clearTimeout(this._hideTimer); this._hideTimer = window.setTimeout(() => this.removePopover(), 220); }
  removePopover() {
    window.clearTimeout(this._showTimer);
    this._showTimer = null;
    this._showTarget = null;
    if (this._popoverComp) { this._popoverComp.unload(); this._popoverComp = null; }
    if (this._popover) { this._popover.remove(); this._popover = null; }
  }
  // ---------- 划词添加药丸(普通笔记,阅读/编辑两种模式) ----------
  removeSelPill() { if (this._selPill) { this._selPill.remove(); this._selPill = null; } }
  maybeShowSelPill(e: MouseEvent, fromEpubIframe = false): void {
    if (!this.settings.selectionPill) return;
    const tgt = eventElement(e.target);
    // 点到自己的 UI(药丸/悬浮卡/菜单)不处理,避免抢选区
    if (tgt?.closest(".lexis-sel-pill, .lexis-popover, .menu")) return;
    const sourceDoc = tgt?.ownerDocument || document;
    const sourceWin = sourceDoc.defaultView || window;
    let sel: Selection | null, text: string;
    try { sel = sourceWin.getSelection(); text = sel ? sel.toString().trim() : ""; } catch { return; }
    if (!text || text.length > 60 || /[\n\r]/.test(text)) { this.removeSelPill(); return; }
    // 选区必须落在 Markdown 笔记内容、PDF 文字层,或已识别的 EPUB iframe 里。
    const node = sel.anchorNode;
    const host = node ? (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement) : null;
    if (!host || (!fromEpubIframe && !host.closest(".markdown-source-view, .markdown-reading-view, .markdown-preview-view, .pdf-viewer, .pdf-container, .pdf-embed, .textLayer"))) { this.removeSelPill(); return; }
    let rect: Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">; try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch { return; }
    if (!rect || (!rect.width && !rect.height)) { this.removeSelPill(); return; }
    if (sourceWin !== window && sourceWin.frameElement) {
      const frameRect = sourceWin.frameElement.getBoundingClientRect();
      rect = { left: rect.left + frameRect.left, right: rect.right + frameRect.left, top: rect.top + frameRect.top, bottom: rect.bottom + frameRect.top, width: rect.width, height: rect.height };
    }
    this.removeSelPill();
    const known = this.index.has(text.toLowerCase());
    const pill = activeDocument.body.createDiv({ cls: "lexis-sel-pill" });
    // 阻止 mousedown 收起选区/夺焦(事件冒泡到 pill 即可覆盖子按钮)
    pill.addEventListener("mousedown", (ev) => ev.preventDefault());
    if (known) {
      const b = pill.createSpan({ cls: "lexis-sel-pill-btn", text: `📖 ${this.t("selection.openExisting")}` });
      b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); void this.addFromPill(text, undefined, { openExisting: true }); });
    } else {
      const dicts = this.dictFolders();
      let selectedFolder = this.preferredSelectionFolder();
      const folderLabel = (f: string) => String(f || this.t("common.root")).split("/").pop() || "";
      const addB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "＋" });
      addB.setAttribute("title", this.t("selection.add"));
      addB.setAttribute("aria-label", this.t("selection.add"));
      addB.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        void this.addFromPill(text, selectedFolder);
      });
      if (dicts.length > 1) {
        const folderB = pill.createSpan({ cls: "lexis-sel-pill-btn lexis-sel-pill-folder", text: `📁 ${folderLabel(selectedFolder)}` });
        folderB.setAttribute("title", this.t("selection.chooseDictionary"));
        folderB.addEventListener("click", (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const menu = new obsidian.Menu();
          for (const f of dicts) menu.addItem((it) => it.setTitle(f || this.t("common.root")).setIcon(f === selectedFolder ? "check" : "folder").onClick(() => {
            selectedFolder = f;
            folderB.setText(`📁 ${folderLabel(f)}`);
            void this.rememberSelectionFolder(f);
          }));
          menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
        });
      }
      // 设为别名:选一个已有词条(标题或别名都行),把当前选中的词并入它的 aliases
      const aliasB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "🔗" });
      aliasB.setAttribute("title", this.t("selection.alias"));
      aliasB.setAttribute("aria-label", this.t("selection.alias"));
      aliasB.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this.removeSelPill();
        openAliasPicker(this.app, this, text, (entry) => this.attachAlias(text, entry.file));
      });
    }
    // 定位:选区下方略偏左;贴边时夹回视口
    const top = Math.min(rect.bottom + 6, window.innerHeight - 36);
    const left = Math.max(6, Math.min(rect.left, window.innerWidth - pill.offsetWidth - 6));
    pill.setCssStyles({ top: top + "px", left: left + "px" });
    this._selPill = pill;
  }
  preferredSelectionFolder() {
    const dicts = this.dictFolders();
    const saved = this.normalizeFolder(this.settings.lastSelectionFolder || "");
    return dicts.includes(saved) ? saved : (dicts[0] || "");
  }
  async rememberSelectionFolder(folder: string): Promise<void> {
    const value = this.normalizeFolder(folder || "");
    if (!this.dictFolders().includes(value) || this.settings.lastSelectionFolder === value) return;
    this.settings.lastSelectionFolder = value;
    await this.saveSettings();
  }
  async addFromPill(text: string, folder?: string, options: AddWordOptions = {}): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    const editor = (view && view.getMode && view.getMode() === "source" && view.editor) ? view.editor : null;
    this.removeSelPill();
    if (folder) await this.rememberSelectionFolder(folder);
    await this.addWordFromSelection(text, editor, view, folder, options);
  }
  // 把 alias 写进某词条文件的 frontmatter aliases(已存在则跳过,幂等)
  async addAliasToFile(file: ObsidianTFile, alias: string): Promise<void> {
    if (!(file instanceof TFile) || !alias) return;
    const inject = (data: string): string => {
      const re = /^---\r?\n([\s\S]*?)\r?\n---/;
      const fm = re.exec(data);
      const line = `  - ${alias}\n`;
      if (!fm) return `---\naliases:\n${line}---\n` + data;
      const body = fm[1];
      // 已列出该别名(整词匹配)就不重复加
      if (new RegExp(`(^|\\n)\\s*-\\s*["']?${escapeRe(alias)}["']?\\s*($|\\n)`).test(body)) return data;
      if (/^aliases:/m.test(body)) return data.slice(0, fm.index) + `---\n` + body.replace(/^(aliases:.*)$/m, `$1\n${line}`) + `\n---` + data.slice(fm.index + fm[0].length);
      return data.slice(0, fm.index) + `---\n${body}\naliases:\n${line}---` + data.slice(fm.index + fm[0].length);
    };
    if (this.app.vault.process) await this.app.vault.process(file, inject);
    else await this.app.vault.modify(file, inject(await this.app.vault.cachedRead(file)));
  }
  // 把当前选中的词并入目标词条(标题或别名解析到的同一个文件)的 aliases
  async attachAlias(aliasText: string, file: ObsidianTFile): Promise<void> {
    aliasText = (aliasText || "").trim();
    if (!aliasText || !(file instanceof TFile)) return;
    if (aliasText.toLowerCase() === file.basename.toLowerCase()) { new Notice(this.t("notice.aliasSelf", { word: aliasText })); return; }
    try {
      await this.addAliasToFile(file, aliasText);
      await this.rebuildIndex(false);
      const ak = aliasText.toLowerCase();
      if (!this.index.has(ak)) this.index.set(ak, { display: aliasText, file, isAlias: true, tags: this.getTags(file) });
      new Notice(this.t("notice.aliasAdded", { alias: aliasText, word: file.basename }));
    } catch (err) { new Notice(this.t("notice.aliasFailed", { error: errorMessage(err) })); }
  }
  openAndClose(file: ObsidianTFile): void { void this.app.workspace.getLeaf(false).openFile(file); this.removePopover(); }
  async openInlineEntry(entry: LexisEntry, newTab: boolean): Promise<void> {
    const leaf = this.app.workspace.getLeaf(newTab ? "tab" : false);
    await leaf.openFile(entry.file);
    try {
      const editor = (leaf.view as { editor?: Editor }).editor;
      if (editor) {
        const offset = String(editor.getValue() || "").split(/\r?\n/).slice(0, entry.line || 0).reduce((n, line) => n + line.length + 1, 0);
        const pos = editor.offsetToPos(offset);
        editor.setCursor(pos);
        editor.scrollIntoView({ from: pos, to: pos }, true);
      }
    } catch { /* The note still opens when an editor cursor is unavailable. */ }
    this.removePopover();
  }
  async openOccurrence(file: ObsidianTFile, word: string, page?: number): Promise<void> {
    let leaf = this._occLeaf;
    if (!leaf || !leaf.parent) { leaf = this.app.workspace.getLeaf("tab"); this._occLeaf = leaf; }
    await leaf.openFile(file, page ? { eState: { subpath: `#page=${page}` } } : undefined);
    await this.app.workspace.revealLeaf(leaf);
    try {
      const ed = (leaf.view as { editor?: Editor }).editor;
      if (ed && word) {
        const m = new RegExp(boundedSource(word), "i").exec(ed.getValue());
        if (m) { const pos = ed.offsetToPos(m.index); ed.setCursor(pos); ed.scrollIntoView({ from: pos, to: ed.offsetToPos(m.index + word.length) }, true); }
      }
    } catch { /* Binary/PDF views have no editor cursor to position. */ }
    this.removePopover();
  }
  renderHeatmap(el: HTMLElement): void {
    const log = this.settings.reviewLog || {};
    const weeks = 18;
    const today = new Date();
    const max = Math.max(1, ...Object.values(log).map(Number));
    const grid = el.createDiv({ cls: "lexis-hm-grid" });
    const cur = new Date(today);
    cur.setDate(cur.getDate() - (weeks * 7 - 1));
    cur.setDate(cur.getDate() - cur.getDay()); // 对齐到周日
    let total = 0;
    for (let w = 0; w <= weeks; w++) {
      const col = grid.createDiv({ cls: "lexis-hm-col" });
      for (let dch = 0; dch < 7; dch++) {
        const ds = fmtDate(cur);
        const cell = col.createDiv({ cls: "lexis-hm-cell" });
        if (cur > today) cell.addClass("lexis-hm-future");
        else { const c = Number(log[ds]) || 0; total += c; if (c > 0) cell.addClass("lexis-hm-l" + Math.min(4, Math.ceil((c / max) * 4))); cell.setAttribute("title", this.t("home.heatmapDay", { date: ds, count: c })); }
        cur.setDate(cur.getDate() + 1);
      }
    }
    el.createDiv({ cls: "lexis-hm-caption", text: this.t("home.heatmapCaption", { weeks, count: total }) });
  }
  // ```lexis-home``` 代码块:笔记里内嵌一份主页摘要(统计 + 热力图),点热力图或按钮跳到真正的主页/开始复习
  renderHomeBlock(el: HTMLElement): void {
    el.addClass("lexis-home-block");
    const st = this.computeStats();
    const stats = el.createDiv({ cls: "lexis-home-stats" });
    stats.createDiv({ cls: "lexis-stat", text: `⏰ ${this.t("home.due", { count: st.due })}` });
    stats.createDiv({ cls: "lexis-stat", text: `✨ ${this.t("home.new", { count: st.fresh })}` });
    stats.createDiv({ cls: "lexis-stat", text: `📚 ${this.t("home.total", { count: st.total })}` });
    const hmWrap = el.createDiv({ cls: "lexis-hm-wrap lexis-home-block-hm" });
    hmWrap.setAttribute("title", this.t("home.openTitle"));
    this.renderHeatmap(hmWrap);
    hmWrap.addEventListener("click", () => this.openHome());
    const btnRow = el.createDiv({ cls: "lexis-home-block-btns" });
    const reviewBtn = btnRow.createEl("button", { cls: "mod-cta", text: `▶ ${this.t("home.start")}` });
    reviewBtn.addEventListener("click", (e) => { e.stopPropagation(); this.openReview(); });
    const homeBtn = btnRow.createEl("button", { text: `📕 ${this.t("home.open")}` });
    homeBtn.addEventListener("click", (e) => { e.stopPropagation(); this.openHome(); });
  }
  // 把 el 内命中 word 的文本包一层 <b>(渲染完的 DOM 上原地操作,供出处预览统一复用)
  boldMatchesInPlace(el: HTMLElement, word: string): void {
    const re = new RegExp(boundedSource(word), "ig");
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const targets: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) if (n.nodeType === Node.TEXT_NODE) targets.push(n as Text);
    for (const node of targets) {
      const text = node.nodeValue || "";
      re.lastIndex = 0;
      if (!re.test(text)) continue;
      re.lastIndex = 0;
      const frag = createFragment();
      let last = 0;
      let m = re.exec(text);
      while (m) {
        if (m.index > last) frag.appendChild(el.ownerDocument.createTextNode(text.slice(last, m.index)));
        const b = el.createEl("b");
        b.textContent = m[0];
        frag.appendChild(b);
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
        m = re.exec(text);
      }
      if (last < text.length) frag.appendChild(el.ownerDocument.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }
  }
  // 出处预览:走 Markdown 渲染管线(LaTeX/加粗斜体等才能正常显示),渲染完再把命中词包一层 <b>
  async renderSentence(el: HTMLElement, sentence: string, word: string, comp?: ObsidianComponent | null): Promise<void> {
    el.empty();
    const useComp = comp || new Component();
    if (!comp) useComp.load();
    await renderLexisMarkdown(this.app, sentence, el, "", useComp);
    this.boldMatchesInPlace(el, word);
  }
  compactSections(md: string): string { return md.replace(/^#{2,6}[ \t].*\n(?:[ \t]*\n)*(?=#{1,6}[ \t]|$)/gm, "").trim(); }
  stripForPreview(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```lexis[\s\S]*?```/g, "").trim();
  }
  async renderNoteInto(el: HTMLElement, file: ObsidianTFile, comp: ObsidianComponent, keepLexis = false): Promise<void> {
    const raw = await this.app.vault.cachedRead(file);
    let stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
    if (!keepLexis) stripped = stripped.replace(/```lexis[\s\S]*?```/g, "");
    const md = this.compactSections(stripped.trim()) || "*(空)*";
    el.empty();
    await renderLexisMarkdown(this.app, md, el, file.path, comp);
    // 渲染后清理:两标题之间无实际内容(文本/lexis 块)则删除前一个标题
    (function compact(container: HTMLElement) {
      const hs = container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      const rm: HTMLElement[] = [];
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i], next = hs[i + 1] || null;
        let sib = h.nextElementSibling, ok = false;
        while (sib && sib !== next) {
          const ns = sib.nextElementSibling;
          if ((sib.textContent || "").trim()) { ok = true; break; }
          if (sib.querySelector(".lexis-section-title,.lexis-curve,.lexis-related,.lexis-occ,.lexis-occ-details,img,svg,video,iframe")) { ok = true; break; }
          sib = ns;
        }
        if (!ok) rm.push(h);
      }
      for (const h of rm) h.remove();
    })(el);
  }
  async renderInlineEntryInto(el: HTMLElement, entry: LexisEntry, comp: ObsidianComponent): Promise<void> {
    el.empty();
    const md = entry.annotation || "*(无批注)*";
    const content = el.createDiv({ cls: "lexis-inline-annotation" });
    await renderLexisMarkdown(this.app, md, content, entry.file.path, comp);
  }
  renderPopoverControls(meta: HTMLElement, corner: HTMLElement, body: HTMLElement, entry: LexisEntry): void {
    if (entry.inline) return;
    const baseKey = entry.file?.basename || entry.display;
    const path = entry.file?.path || "";
    const slash = path.lastIndexOf("/");
    const folder = slash > 0 ? path.slice(0, slash) : "";
    const shortFolder = (f: string) => String(f || this.t("common.root")).split("/").pop() || "";
    const folderChip = meta.createSpan({ cls: "lexis-popover-chip", text: shortFolder(folder) });
    folderChip.setAttribute("title", folder || this.t("common.root"));
    const dicts = this.dictFolders();
    if (dicts.length > 1) {
      folderChip.addClass("is-clickable");
      folderChip.setAttribute("title", `${folder || this.t("common.root")} — ${this.t("popover.moveDictionary")}`);
      folderChip.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const menu = new obsidian.Menu();
        for (const target of dicts) menu.addItem((it) => it.setTitle(shortFolder(target)).setIcon(target === folder ? "check" : "folder").onClick(async () => {
          if (target === folder) return;
          const result = await this.bridgeMoveWord({ key: baseKey, folder: target });
          new Notice(result.ok ? this.t("notice.moved", { folder: shortFolder(target) }) : this.t("notice.moveFailed", { error: result.error || this.t("common.failed") }));
          if (result.ok) this.removePopover();
        }));
        menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
      });
    }
    const noteBtn = corner.createEl("button", { cls: "lexis-popover-action", text: "✎" });
    noteBtn.setAttribute("title", this.t("popover.addNote"));
    noteBtn.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const existing = body.querySelector(".lexis-popover-note-row");
      if (existing) { existing.querySelector("input")?.focus(); return; }
      const row = body.createDiv({ cls: "lexis-popover-note-row" });
      const input = row.createEl("input", { attr: { type: "text", placeholder: this.t("popover.notePlaceholder") } });
      input.addEventListener("click", (e) => e.stopPropagation());
      input.addEventListener("keydown", (e) => { void (async () => {
        if (e.key === "Escape") { row.remove(); return; }
        if (e.key !== "Enter") return;
        e.preventDefault();
        const note = input.value.trim();
        if (!note) { row.remove(); return; }
        input.disabled = true;
        const result = await this.bridgeAnnotate({ key: baseKey, note });
        new Notice(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
        this.removePopover();
      })(); });
      body.prepend(row);
      input.focus();
    });
    const delBtn = corner.createEl("button", { cls: "lexis-popover-action is-danger", text: "🗑" });
    delBtn.setAttribute("title", this.t("popover.deleteEntry"));
    delBtn.addEventListener("click", (ev) => { void (async () => {
      ev.preventDefault(); ev.stopPropagation();
      if (!await confirmAction(this.app, this.t("popover.deleteEntry"), this.t("popover.deleteConfirm", { word: entry.display }))) return;
      const result = await this.bridgeDeleteWord(baseKey);
      new Notice(result.ok ? this.t("notice.deleted", { word: entry.display }) : this.t("notice.deleteFailed", { error: result.error || this.t("common.failed") }));
      this.removePopover();
    })(); });

    const tagWrap = body.createDiv({ cls: "lexis-popover-tags" });
    const tags = new Set(entry.tags || []);
    const renderTags = () => {
      tagWrap.empty();
      for (const tag of [...tags].sort()) {
        const pill = tagWrap.createSpan({ cls: "lexis-popover-tag", text: `#${tag}` });
        const remove = pill.createSpan({ cls: "lexis-popover-tag-remove", text: " ×" });
        remove.setAttribute("title", this.t("popover.deleteTag"));
        remove.addEventListener("click", (ev) => { void (async () => {
          ev.preventDefault(); ev.stopPropagation();
          const result = await this.bridgeTagWord({ key: baseKey, tag, action: "remove" });
          if (result.ok) { tags.delete(tag); entry.tags = new Set(result.tags || []); renderTags(); }
        })(); });
      }
      const add = tagWrap.createSpan({ cls: "lexis-popover-tag is-add", text: tags.size ? "+" : this.t("popover.addTag") });
      add.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const menu = new obsidian.Menu();
        for (const tag of this.collectVocabTags().filter((t) => !tags.has(t))) menu.addItem((it) => it.setTitle(`#${tag}`).setIcon("tag").onClick(async () => {
          const result = await this.bridgeTagWord({ key: baseKey, tag, action: "add" });
          if (result.ok) { tags.add(tag); entry.tags = new Set(result.tags || []); renderTags(); }
        }));
        menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
      });
    };
    renderTags();
  }
  async showPopover(spanEl: HTMLElement): Promise<void> {
    const key = spanEl.dataset.lexisKey;
    const entry = this.index.get(key);
    if (!entry) return;
    if (this._popover && this._popover.dataset.lexisKey === key) { window.clearTimeout(this._hideTimer); return; }
    if (!entry.inline) { this.recordEncounter(entry.file, "hover"); void this.hoverFeedback(entry.file); }
    this.removePopover();
    const pop = activeDocument.body.createDiv({ cls: "lexis-popover" });
    pop.dataset.lexisKey = key;
    this.applyPopoverAppearance(pop);
    const title = pop.createDiv({ cls: "lexis-popover-title" });
    const heading = this.cardHeading(entry);
    title.createSpan({ cls: "lexis-popover-title-main", text: heading.title });
    if (heading.subtitle) title.createSpan({ cls: "lexis-popover-alias", text: heading.subtitle });
    title.addEventListener("click", () => { if (entry.inline) void this.openInlineEntry(entry, false); else this.openAndClose(entry.file); });
    const corner = pop.createDiv({ cls: "lexis-popover-corner" });
    const meta = pop.createDiv({ cls: "lexis-popover-meta" });
    if (!entry.inline) {
      pop.addClass("has-corner-actions");
      const archiveBtn = meta.createSpan({ cls: "lexis-popover-archive", text: entry.archived ? `↩ ${this.t("popover.restore")}` : `📦 ${this.t("popover.archive")}` });
      archiveBtn.setAttribute("title", this.t(entry.archived ? "popover.restoreTitle" : "popover.archiveTitle"));
      archiveBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (entry.archived) openRestoreModal(this.app, this, entry.file);
        else void this.setArchived(entry.file, true).then(() => new Notice(this.t("notice.archived", { word: entry.file.basename })));
        this.removePopover();
      });
    }
    const body = pop.createDiv({ cls: "lexis-popover-body" });
    body.setText(this.t("common.loading"));
    pop.addEventListener("mouseenter", () => window.clearTimeout(this._hideTimer));
    pop.addEventListener("mouseleave", () => this.scheduleHide());
    spanEl.addEventListener("mouseleave", () => this.scheduleHide(), { once: true });
    this._popover = pop;
    this.positionPopover(pop, spanEl);
    try {
      body.empty();
      const comp = new Component(); comp.load(); this._popoverComp = comp;
      this.renderPopoverControls(meta, corner, body, entry);
      const contentEl = body.createDiv();
      if (entry.inline) await this.renderInlineEntryInto(contentEl, entry, comp);
      else await this.renderNoteInto(contentEl, entry.file, comp);
      if (!entry.inline && this.settings.showRelated) {
        const div = body.createDiv({ cls: "lexis-divider" });
        const n = await this.renderTypedRelations(body, entry.file);
        if (!n) div.remove();
      }
      if (!entry.inline && this.settings.showOccurrences) {
        body.createDiv({ cls: "lexis-divider" });
        const occTitle = body.createDiv({ cls: "lexis-section-title", text: `📍 ${this.t("popover.occurrences", { count: "…" })}` });
        const occWrap = body.createDiv();
        occWrap.setText(this.t("common.searching"));
        const rawList = await this.findOccurrences(entry.display);
        if (this._popover === pop) {
          const curated = await this.getCuratedSourcePaths(entry.file);
          const list = rawList.filter((occurrence) => !curated.has(occurrence.file.basename.toLowerCase()));
          occTitle.setText(`📍 ${this.t("popover.occurrences", { count: list.length })}`);
          occWrap.empty();
          if (!list.length) occWrap.createDiv({ cls: "lexis-occ", text: this.t("popover.noOccurrences") });
          else for (const o of list) {
            const d = occWrap.createDiv({ cls: "lexis-occ" });
            await this.renderSentence(d, o.sentence, entry.display, comp);
            const add = d.createSpan({ cls: "lexis-occ-add", text: " ➕" });
            add.setAttribute("title", this.t("popover.addOccurrence"));
            add.addEventListener("click", () => { void (async () => {
              if (add.dataset.done) return;
              add.dataset.done = "1";
              if (await this.addExampleToWord(entry.file, o.sentence, o.file, o.page)) { add.setText(" ✓"); add.setCssStyles({ cursor: "default" }); add.removeAttribute("title"); } else delete add.dataset.done;
            })(); });
            const src = d.createSpan({ cls: "lexis-occ-src", text: " ↗ " + this.occurrenceLabel(o) });
            src.addEventListener("click", () => { void this.openOccurrence(o.file, entry.display, o.page); });
          }
          this.positionPopover(pop, spanEl);
        }
      }
      this.positionPopover(pop, spanEl);
    } catch (err) { body.setText(this.t("popover.readFailed", { error: errorMessage(err) })); }
  }
  positionPopover(pop: HTMLElement, spanEl: HTMLElement): void {
    const r = spanEl.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const ownerWin = spanEl.ownerDocument?.defaultView;
    const frameRect = ownerWin && ownerWin !== window && ownerWin.frameElement ? ownerWin.frameElement.getBoundingClientRect() : null;
    let left = r.left + (frameRect ? frameRect.left : 0), top = r.bottom + (frameRect ? frameRect.top : 0) + 6;
    if (left + pr.width > window.innerWidth - 10) left = window.innerWidth - pr.width - 10;
    if (left < 10) left = 10;
    if (top + pr.height > window.innerHeight - 10) top = r.top + (frameRect ? frameRect.top : 0) - pr.height - 6;
    if (top < 10) top = 10;
    pop.setCssStyles({ left: left + "px", top: top + "px" });
  }
  applyPopoverAppearance(pop: HTMLElement): void {
    const width = Math.max(260, Number(this.settings.popoverWidth) || 460);
    const height = Math.max(160, Number(this.settings.popoverMaxHeight) || 420);
    const fontSize = Math.max(11, Number(this.settings.popoverFontSize) || 14);
    pop.setCssProps({
      "--lexis-popover-width": `${width}px`,
      "--lexis-popover-height": `${height}px`,
      "--lexis-popover-font-size": `${fontSize}px`,
    });
    // 内联值保证主题样式无法盖掉用户设置；预览卡用实际高度演示“最大高度”。
    pop.setCssStyles({ width: `${width}px`, fontSize: `${fontSize}px` });
    const isPreview = pop.classList.contains("lexis-popover-preview");
    pop.setCssStyles({ maxHeight: isPreview ? `${height}px` : "", height: isPreview ? `${height}px` : "" });
  }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderUi.prototype);
  return descriptors;
}

export { createReaderUi };
