"use strict";

import * as obsidian from "obsidian";
import type { App, Component as ObsidianComponent, Editor, MarkdownPostProcessorContext, Notice as ObsidianNotice, TFile as ObsidianTFile, WorkspaceLeaf } from "obsidian";
import type { Occurrence } from "./occurrence-search";
import { overlayDocumentFor } from "./reader-interactions";
import { pdfTargetSource } from "./pdf-highlight-targets";
import type { InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats, ReviewHistoryEvent } from "./types";
import { createReaderContent } from "./reader-content";
import { createReaderHomeBlocks } from "./reader-home-blocks";
import { renderReaderPopoverControls } from "./reader-popover-controls";
import { entryColorLabel } from "./entry-colors";

type CurveCard = { s?: number | null; due?: string | null; last?: string | null; history?: ReviewHistoryEvent[] };
type BridgeResult = { ok: boolean; error?: string; tags?: string[] };
type TranslationVars = Record<string, string | number | boolean>;
type StatsSummary = { due: number; fresh: number; total: number };
type Heading = { title: string; subtitle: string };
type HighlightSource = { file: ObsidianTFile | null; sentence: string; page?: number };
interface FsrsDisplayApi { nextInterval(stability: number, retention: number): number; retrievability(elapsedDays: number, stability: number): number }
interface ReaderUiDependencies {
  buildCurveSVG: (card: CurveCard, dependencies: { requestRetention: number; nextInterval: FsrsDisplayApi["nextInterval"]; retrievability: FsrsDisplayApi["retrievability"]; addDaysStr: (date: string, days: number) => string; daysBetween: (start: string, end: string) => number; todayStr: () => string }) => string | null;
  recentReviewDates: (card: CurveCard, limit?: number) => string[];
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
  openRestoreModal: (app: App, plugin: object, file: ObsidianTFile) => void;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"; }

function createReaderUi({ buildCurveSVG, recentReviewDates, FSRS, addDaysStr, daysBetween, todayStr, fmtDate, TFile, Notice, boundedSource, escapeRe, Component, renderLexisMarkdown, openRestoreModal }: ReaderUiDependencies): PropertyDescriptorMap {
  class ReaderUi {
  declare app: App;
  declare settings: LexisSettings;
  declare index: Map<string, LexisEntry>;
  declare stats: LexisStats;
  declare inlineCategoryOccurrences: InlineCategoryOccurrence[];
  declare _hideTimer: number;
  declare _popover: HTMLElement | null;
  declare _popoverComp: ObsidianComponent | null;
  declare _occLeaf: WorkspaceLeaf | null;
  declare readCard: (file: ObsidianTFile) => CurveCard;
  declare renderDerivedWords: (element: HTMLElement, file: ObsidianTFile) => Promise<void>;
  declare renderReverseRelations: (element: HTMLElement, file: ObsidianTFile, type: string) => Promise<number>;
  declare renderTypedRelations: (element: HTMLElement, file: ObsidianTFile) => Promise<number>;
  declare getCuratedSourcePaths: (file: ObsidianTFile) => Promise<Set<string>>;
  declare findOccurrences: (word: string) => Promise<Occurrence[]>;
  declare occurrenceLabel: (occurrence: Occurrence) => string;
  declare addExampleToWord: (wordFile: ObsidianTFile, sentence: string, sourceFile?: ObsidianTFile | null, page?: number) => Promise<boolean>;
  declare extractSentence: (content: string, index: number) => string;
  declare t: (key: string, vars?: TranslationVars) => string;
  declare dictFolders: () => string[];
  declare attachPopoverResize: (popover: HTMLElement, target: HTMLElement) => void;
  declare scheduleHide: () => void;
  declare removePopover: () => void;
  declare rebuildIndex: (notify: boolean) => Promise<LexisStats>;
  declare getTags: (file: ObsidianTFile) => Set<string>;
  declare renderSentence: (el: HTMLElement, sentence: string, word: string, comp?: ObsidianComponent | null) => Promise<void>;
  declare renderInlineEntryInto: (el: HTMLElement, entry: LexisEntry, comp: ObsidianComponent) => Promise<void>;
  declare renderNoteInto: (el: HTMLElement, file: ObsidianTFile, comp: ObsidianComponent, keepLexis?: boolean, maskAnswers?: boolean) => Promise<void>;
  declare computeStats: () => StatsSummary;
  declare openHome: () => void;
  declare openReviewLog: (date?: string) => Promise<void>;
  declare openReview: () => void;
  declare collectVocabTags: () => string[];
  declare bridgeMoveWord: (payload: Record<string, unknown>) => Promise<BridgeResult>;
  declare bridgeAnnotate: (payload: Record<string, unknown>) => Promise<BridgeResult>;
  declare bridgeDeleteWord: (key: string) => Promise<BridgeResult>;
  declare bridgeTagWord: (payload: Record<string, unknown>) => Promise<BridgeResult>;
  declare cardHeading: (entry: LexisEntry) => Heading;
  declare colorForEntry: (entry: LexisEntry) => string;
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
        const dates = recentReviewDates(card);
        if (dates.length) curve.createDiv({ cls: "lexis-curve-history", text: this.t("curve.recentReviews", { dates: dates.map((date) => date.slice(5)).join(" · ") }) });
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
  highlightSource(span: HTMLElement): HighlightSource {
    const sourceDocument = span.ownerDocument;
    const frame = sourceDocument.defaultView?.frameElement;
    const locatedNode = frame || span;
    let file: ObsidianTFile | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as { containerEl?: HTMLElement; file?: ObsidianTFile };
      if (!file && view.containerEl?.contains(locatedNode)) file = view.file || null;
    });
    if (!file) file = this.app.workspace.getActiveFile();

    const pageElement = span.closest<HTMLElement>("[data-page-number]");
    const pageValue = pageElement?.getAttribute("data-page-number") || "";
    const page = Number.parseInt(pageValue, 10) || undefined;
    const pdfSource = pdfTargetSource(span);
    if (pdfSource) {
      const container = pdfSource.startContainer.parentElement?.closest('.textLayer');
      if (!container) return { file, sentence: '', page };
      const before = sourceDocument.createRange();
      before.selectNodeContents(container);
      before.setEnd(pdfSource.startContainer, pdfSource.startOffset);
      return { file, sentence: this.extractSentence(container.textContent || '', before.toString().length), page };
    }
    const textContainer = span.closest<HTMLElement>("p,li,blockquote,td,th,figcaption,h1,h2,h3,h4,h5,h6,.cm-line,.textLayer") || span.parentElement;
    if (!textContainer) return { file, sentence: "", page };
    try {
      const range = sourceDocument.createRange();
      range.selectNodeContents(textContainer);
      range.setEndBefore(span);
      const sentence = this.extractSentence(textContainer.textContent || "", range.toString().length);
      return { file, sentence, page };
    } catch {
      return { file, sentence: (span.textContent || "").trim(), page };
    }
  }
  renderPopoverControls(meta: HTMLElement, corner: HTMLElement, body: HTMLElement, entry: LexisEntry, sourceSpan: HTMLElement): void {
    renderReaderPopoverControls.call(this, { obsidian, Notice }, meta, corner, body, entry, sourceSpan);
  }
  async showPopover(spanEl: HTMLElement): Promise<void> {
    const key = spanEl.dataset.lexisKey;
    const entry = this.index.get(key);
    if (!entry) return;
    if (this._popover && this._popover.dataset.lexisKey === key) { window.clearTimeout(this._hideTimer); return; }
    if (!entry.inline) { this.recordEncounter(entry.file, "hover"); void this.hoverFeedback(entry.file); }
    this.removePopover();
    const pop = overlayDocumentFor(spanEl).body.createDiv({ cls: "lexis-popover" });
    pop.dataset.lexisKey = key;
    this.applyPopoverAppearance(pop);
    const scroll = pop.createDiv({ cls: "lexis-popover-scroll" });
    const title = scroll.createDiv({ cls: "lexis-popover-title" });
    const heading = this.cardHeading(entry);
    title.createSpan({ cls: "lexis-popover-title-main", text: heading.title });
    if (heading.subtitle) title.createSpan({ cls: "lexis-popover-alias", text: heading.subtitle });
    if (entry.colorToken) {
      const label = entryColorLabel(entry.colorToken);
      const color = title.createSpan({ cls: `lexis-popover-entry-color${label ? "" : " is-color-only"}`, text: label });
      color.setAttribute("title", entry.colorToken);
      color.style.setProperty("--lexis-entry-color", this.colorForEntry(entry));
    }
    title.addEventListener("click", () => { if (entry.inline) void this.openInlineEntry(entry, false); else this.openAndClose(entry.file); });
    const corner = scroll.createDiv({ cls: "lexis-popover-corner" });
    const meta = scroll.createDiv({ cls: "lexis-popover-meta" });
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
    const body = scroll.createDiv({ cls: "lexis-popover-body" });
    body.setText(this.t("common.loading"));
    pop.addEventListener("mouseenter", () => window.clearTimeout(this._hideTimer));
    pop.addEventListener("mouseleave", () => this.scheduleHide());
    spanEl.addEventListener("mouseleave", () => this.scheduleHide(), { once: true });
    this._popover = pop;
    this.attachPopoverResize(pop, spanEl);
    this.positionPopover(pop, spanEl);
    try {
      body.empty();
      const comp = new Component(); comp.load(); this._popoverComp = comp;
      this.renderPopoverControls(meta, corner, body, entry, spanEl);
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
    const hostWin = pop.ownerDocument.defaultView || window;
    const frameRect = ownerWin?.frameElement?.ownerDocument === pop.ownerDocument ? ownerWin.frameElement.getBoundingClientRect() : null;
    let left = r.left + (frameRect ? frameRect.left : 0), top = r.bottom + (frameRect ? frameRect.top : 0) + 6;
    if (left + pr.width > hostWin.innerWidth - 10) left = hostWin.innerWidth - pr.width - 10;
    if (left < 10) left = 10;
    if (top + pr.height > hostWin.innerHeight - 10) top = r.top + (frameRect ? frameRect.top : 0) - pr.height - 6;
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
    // 内联值保证主题样式无法盖掉用户设置；桌面实卡恢复上次拖拽后的实际尺寸。
    pop.setCssStyles({
      width: `${width}px`,
      height: "",
      maxHeight: `${height}px`,
      fontSize: `${fontSize}px`,
    });
  }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderUi.prototype);
  return {
    ...createReaderHomeBlocks(fmtDate),
    ...createReaderContent({ boundedSource, Component, renderLexisMarkdown }),
    ...descriptors,
  };
}

export { createReaderUi };
