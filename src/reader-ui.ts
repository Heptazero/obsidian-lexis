"use strict";

import * as obsidian from "obsidian";
import type { App, Component as ObsidianComponent, Editor, MarkdownPostProcessorContext, Notice as ObsidianNotice, TFile as ObsidianTFile, WorkspaceLeaf } from "obsidian";
import type { Occurrence } from "./occurrence-search";
import { overlayDocumentFor } from "./reader-interactions";
import type { InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats, ReviewHistoryEvent } from "./types";

type CurveCard = { s?: number | null; due?: string | null; last?: string | null; history?: ReviewHistoryEvent[] };
type BridgeResult = { ok: boolean; error?: string; tags?: string[] };
type TranslationVars = Record<string, string | number | boolean>;
type StatsSummary = { due: number; fresh: number; total: number };
type Heading = { title: string; subtitle: string };
type HighlightSource = { file: ObsidianTFile | null; sentence: string; page?: number };
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
  openRestoreModal: (app: App, plugin: object, file: ObsidianTFile) => void;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"; }

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

function createReaderUi({ buildCurveSVG, FSRS, addDaysStr, daysBetween, todayStr, fmtDate, TFile, Notice, boundedSource, escapeRe, Component, renderLexisMarkdown, openRestoreModal }: ReaderUiDependencies): PropertyDescriptorMap {
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
    const occurrenceBtn = meta.createEl("button", { cls: "lexis-popover-action", text: this.t("popover.addCurrentOccurrence") });
    occurrenceBtn.setAttribute("title", this.t("popover.addCurrentOccurrenceTitle"));
    occurrenceBtn.addEventListener("click", (ev) => { void (async () => {
      ev.preventDefault(); ev.stopPropagation();
      const source = this.highlightSource(sourceSpan);
      occurrenceBtn.disabled = true;
      if (await this.addExampleToWord(entry.file, source.sentence, source.file, source.page)) {
        occurrenceBtn.setText("✓");
        occurrenceBtn.removeAttribute("title");
      } else occurrenceBtn.disabled = false;
    })(); });
    const noteBtn = corner.createEl("button", { cls: "lexis-popover-action", text: "✎" });
    noteBtn.setAttribute("title", this.t("popover.addNote"));
    noteBtn.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const existing = body.querySelector(".lexis-popover-note-row");
      if (existing) { existing.querySelector("input")?.focus(); return; }
      const row = body.createDiv({ cls: "lexis-popover-note-row" });
      const input = row.createEl("input", { attr: { type: "text", placeholder: this.t("popover.notePlaceholder") } });
      const imageInput = row.createEl("input", { cls: "lexis-popover-note-file", attr: { type: "file", accept: "image/*" } });
      const imageBtn = row.createEl("button", { cls: "lexis-popover-note-image", attr: { type: "button", title: this.t("popover.addImage") } });
      obsidian.setIcon(imageBtn, "image-plus");
      input.addEventListener("click", (e) => e.stopPropagation());
      imageBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); imageInput.click(); });
      imageInput.addEventListener("click", (e) => e.stopPropagation());
      imageInput.addEventListener("change", () => { void (async () => {
        const image = imageInput.files?.[0];
        if (!image) return;
        input.disabled = true;
        imageBtn.disabled = true;
        const result = await this.bridgeAnnotate({ key: baseKey, note: input.value.trim(), image });
        new Notice(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
        if (result.ok) this.removePopover();
        else { input.disabled = false; imageBtn.disabled = false; imageInput.value = ""; }
      })(); });
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
    const pop = overlayDocumentFor(spanEl).body.createDiv({ cls: "lexis-popover" });
    pop.dataset.lexisKey = key;
    this.applyPopoverAppearance(pop);
    const scroll = pop.createDiv({ cls: "lexis-popover-scroll" });
    const title = scroll.createDiv({ cls: "lexis-popover-title" });
    const heading = this.cardHeading(entry);
    title.createSpan({ cls: "lexis-popover-title-main", text: heading.title });
    if (heading.subtitle) title.createSpan({ cls: "lexis-popover-alias", text: heading.subtitle });
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
    const isPreview = pop.classList.contains("lexis-popover-preview");
    const coarsePointer = pop.ownerDocument.defaultView?.matchMedia?.("(pointer: coarse)").matches;
    pop.setCssStyles({
      width: `${width}px`,
      height: !isPreview && !coarsePointer ? `${height}px` : "",
      maxHeight: `${height}px`,
      fontSize: `${fontSize}px`,
    });
  }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderUi.prototype);
  return descriptors;
}

export { createReaderUi };
