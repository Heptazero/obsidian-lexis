"use strict";

import { Decoration, type DecorationSet, type EditorView, type ViewUpdate, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, type Extension, type StateEffectType } from "@codemirror/state";
import * as obsidian from "obsidian";
import type { App, MarkdownPostProcessorContext, Notice as ObsidianNotice, TFile, View, WorkspaceLeaf } from "obsidian";
import type { OccurrenceSearch } from "./occurrence-search";
import type { DictionarySetting, InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats } from "./types";

type HighlightStyleOptions = { external?: boolean; pdf?: boolean };
type HighlightPage = { leaf: WorkspaceLeaf; container: HTMLElement; key: string };
type HighlightPageState = { key: string; hidden: boolean };
type TranslationVars = Record<string, string | number | boolean>;

interface HighlightDependencies {
  FSRS: unknown;
  Notice: typeof ObsidianNotice;
  boundedSource: (value: string) => string;
  todayStr: () => string;
}

function createHighlightEngine({ Notice, boundedSource, todayStr }: HighlightDependencies): PropertyDescriptorMap {
  class HighlightEngine {
  declare app: App;
  declare settings: LexisSettings;
  declare index: Map<string, LexisEntry>;
  declare stats: LexisStats;
  declare inlineCategoryOccurrences: InlineCategoryOccurrence[];
  declare inlineCategories: { name: string; count: number }[];
  declare vocabPaths: Set<string>;
  declare inlineSourcePaths: Set<string>;
  declare _selfKeysByPath: Map<string, Set<string>>;
  declare _occCache: Map<string, unknown>;
  declare _indexBuildId: number;
  declare _rebuildTimer: number;
  declare _pattern: string | null;
  declare statusBarEl: HTMLElement | null;
  declare bridge: { running: boolean } | null;
  declare liveAvailable: boolean;
  declare _liveRefreshEffect: StateEffectType<void> | null;
  declare _pageHighlightState: WeakMap<WorkspaceLeaf, HighlightPageState>;
  declare rescanPdfLayers: () => void;
  declare rescanEpubIframes: () => void;
  declare occurrenceSearch: OccurrenceSearch;
  declare saveSettings: () => Promise<void>;
  declare isVocabFile: (file: TFile | null | undefined) => boolean;
  declare inFolderScope: (path: string) => boolean;
  declare excludeTagSet: () => Set<string>;
  declare dictFolders: () => string[];
  declare vocabTagSet: () => Set<string>;
  declare t: (key: string, vars?: TranslationVars) => string;
  declare effectiveHighlightColor: () => string;
  declare colorForEntry: (entry: LexisEntry) => string;
  declare passiveEncounter: (file: TFile) => void;
  declare maybeShowSelPill: (event: MouseEvent, external?: boolean) => void;
  declare onMouseOver: (event: MouseEvent) => void;
  declare onMouseOut: (event: MouseEvent) => void;
  declare onClick: (event: MouseEvent) => void;
  declare removePopover: () => void;
  declare registerEditorExtension: (extension: Extension) => void;
  // ---------- 索引 ----------
  normalizeFolder(p: string): string { return (p || "").trim().replace(/^\/+|\/+$/g, ""); }
  // 单一真相:rebuildIndex 算出的命中路径集合。支持"文件夹∪标签"两种收录,且 14 处调用点签名不变。
  inVocabFolder(path: string): boolean { return this.vocabPaths ? this.vocabPaths.has(path) : false; }
  // 词条自身的标题/别名 key 集合:该词条笔记内文出现自己的标题时不高亮自己,但别的词库词照常高亮。
  selfKeysFor(path: string): Set<string> | null { return (this._selfKeysByPath && this._selfKeysByPath.get(path)) || null; }
  maybeRebuild(file: TFile | null, oldPath?: string) {
    const p = (file && file.path) || "";
    this._occCache.clear();
    if (file?.extension === "pdf") this.occurrenceSearch?.invalidatePdf(file.path);
    if (oldPath && /\.pdf$/i.test(oldPath)) this.occurrenceSearch?.invalidatePdf(oldPath);
    if (oldPath && p && this.settings.reviewHistory?.[oldPath]) {
      this.settings.reviewHistory[p] = this.settings.reviewHistory[oldPath];
      delete this.settings.reviewHistory[oldPath];
      void this.saveSettings();
    }
    if (this.isVocabFile(file) || this.vocabPaths.has(p) || this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(p) || (oldPath && (this.inFolderScope(oldPath) || this.vocabPaths.has(oldPath) || this.inlineSourcePaths?.has(oldPath)))) this.scheduleRebuild();
  }
  scheduleRebuild() {
    window.clearTimeout(this._rebuildTimer);
    this._rebuildTimer = window.setTimeout(() => { void this.rebuildIndex(false); }, 800);
  }
  inlineDelimiter() { return String(this.settings.inlineEntryDelimiter || "::").trim() || "::"; }
  isInlineSourceFile(file: TFile | null | undefined): boolean {
    if (!this.settings.inlineEntriesEnabled || !file?.path) return false;
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
    const marker = fm["lexis-inline"];
    if (marker === true || marker === 1 || (typeof marker === "string" && /^(true|yes|1)$/i.test(marker))) return true;
    return this.getTags(file).has("lexis-inline");
  }
  // 轻量词条只存在于一份资料笔记里,不建单独文件、也不参与 FSRS。最近标题负责分组,上级标题只提供设置页层级与精确跳转。
  parseInlineEntries(content: string, file: TFile): LexisEntry[] {
    const delimiter = this.inlineDelimiter();
    const lines = String(content || "").split(/\r?\n/);
    let firstContentLine = 0;
    if (lines[0]?.trim() === "---") {
      const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
      if (end >= 0) firstContentLine = end + 1;
    }
    const out: LexisEntry[] = [];
    const headingStack: { name: string; level: number; line: number }[] = [];
    let inFence = false;
    for (let lineNo = firstContentLine; lineNo < lines.length; lineNo++) {
      const line = lines[lineNo];
      if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      const heading = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        headingStack.length = level;
        headingStack[level - 1] = { name: heading[2].trim(), level, line: lineNo };
        continue;
      }
      const at = line.indexOf(delimiter);
      if (at < 0) continue;
      const left = line.slice(0, at).trim().replace(/^[-*+]\s+/, "");
      const right = line.slice(at + delimiter.length).trim();
      if (!left || /^#/.test(left)) continue;
      // 旧版 color:: 指令不再参与配色,但继续跳过它,避免被错误识别为词条。
      if (left.toLowerCase() === "color") continue;
      const headingPath = headingStack.filter(Boolean).map((item) => ({ ...item }));
      const categories = headingPath.map((item) => item.name).reverse();
      const category = categories[0] || "";
      out.push({ display: left, file, isAlias: false, tags: new Set(), inline: true, annotation: right, category, categories, headingPath, line: lineNo });
    }
    return out;
  }
  extractAliases(file: TFile): string[] {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
    if (!fm) return [];
    // 始终包含 Obsidian 标准属性,外加用户配置的自定义属性(并集)
    const extra = (this.settings.aliasSources || "").split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
    const sources = [...new Set(["aliases", "alias", ...extra])];
    const seen = new Set<string>();
    const results: string[] = [];
    for (const src of sources) {
      const raw = fm[src];
      if (raw == null || raw === "") continue;
      const values: unknown[] = typeof raw === "string" ? raw.split(/[,，;；]/) : Array.isArray(raw) ? raw : [raw];
      for (const x of values) {
        const s = typeof x === "string" || typeof x === "number" ? String(x).trim() : "";
        if (!s || s.toLowerCase() === "null") continue;
        if (!seen.has(s)) { seen.add(s); results.push(s); }
      }
    }
    return results;
  }
  getTags(file: TFile): Set<string> {
    const cache = this.app.metadataCache.getFileCache(file);
    const set = new Set<string>();
    const fm = cache?.frontmatter as Record<string, unknown> | undefined;
    if (fm) {
      const rawTags = fm.tags ?? fm.tag ?? [];
      const tags: unknown[] = typeof rawTags === "string" ? rawTags.split(/[,，;；\s]+/) : Array.isArray(rawTags) ? rawTags : [rawTags];
      for (const value of tags) { const s = typeof value === "string" || typeof value === "number" ? String(value).trim().replace(/^#/, "") : ""; if (s && s.toLowerCase() !== "null") set.add(s.toLowerCase()); }
    }
    if (cache?.tags) for (const tg of cache.tags) { const s = (tg.tag || "").replace(/^#/, ""); if (s) set.add(s.toLowerCase()); }
    return set;
  }
  async rebuildIndex(notify: boolean): Promise<LexisStats> {
    const buildId = (this._indexBuildId || 0) + 1;
    this._indexBuildId = buildId;
    const index = new Map<string, LexisEntry>();
    const selfKeysByPath = new Map<string, Set<string>>();
    const today = todayStr();
    let words = 0, aliases = 0, inlineEntries = 0, due = 0;
    const inlineCategoryOccurrences = new Map<string, InlineCategoryOccurrence>();
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.isVocabFile(f));
    const vocabPaths = new Set(files.map((f) => f.path));
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter || {};
      const tags = this.getTags(file);
      const display = file.basename;
      const key = display.toLowerCase();
      const own = new Set([key]);
      // 生命周期(归档/常驻/淘汰)+ FSRS stability 缓存,供高亮渐隐/淘汰候选复用;都是每文件算一次,标题和别名共用
      const archived = fm["lexis-status"] === "archived";
      const retired = fm["lexis-status"] === "retired";
      const pinned = !!fm["lexis-pinned"];
      const sRaw = Number(fm["lexis-s"]);
      const cardS = fm["lexis-s"] == null || isNaN(sRaw) ? null : sRaw;
      if (!index.has(key)) { index.set(key, { display, file, isAlias: false, tags, archived, retired, pinned, cardS }); words++; }
      if (this.settings.includeAliases) {
        for (const a of this.extractAliases(file)) {
          const ak = a.toLowerCase();
          own.add(ak);
          if (!index.has(ak)) { index.set(ak, { display: a, file, isAlias: true, tags, archived, retired, pinned, cardS }); aliases++; }
        }
      }
      selfKeysByPath.set(file.path, own);
      if (!archived && !retired && (fm["lexis-s"] == null || !fm["lexis-due"] || String(fm["lexis-due"]).slice(0, 10) <= today)) due++;
    }
    const inlineFiles = this.app.vault.getMarkdownFiles().filter((f) => this.isInlineSourceFile(f));
    const inlineSourcePaths = new Set(inlineFiles.map((f) => f.path));
    const parsed = await Promise.all(inlineFiles.map(async (file) => {
      try { return this.parseInlineEntries(await this.app.vault.cachedRead(file), file); }
      catch { return []; }
    }));
    // 异步读取期间若已有更新的重建开始,旧结果不能覆盖新索引。
    if (buildId !== this._indexBuildId) return this.stats;
    for (const entries of parsed) {
      const own = new Set<string>();
      for (const entry of entries) {
        const key = entry.display.toLowerCase();
        own.add(key);
        const headingPath = entry.headingPath || [];
        const heading = headingPath[headingPath.length - 1];
        if (heading) {
          // 同一文件内的同名最近标题视为一个子集；Markdown 祖先标题不参与分类。
          const id = `${entry.file.path}::${heading.name}`;
          let node = inlineCategoryOccurrences.get(id);
          if (!node) {
            node = { id, name: heading.name, level: heading.level, line: heading.line, file: entry.file, count: 0 };
            inlineCategoryOccurrences.set(id, node);
          }
          node.count++;
        }
        // 单文件词典优先,避免同名人名/术语意外覆盖已有可复习词条。
        if (!index.has(key)) { index.set(key, entry); inlineEntries++; }
      }
      if (entries.length) selfKeysByPath.set(entries[0].file.path, own);
    }
    this.vocabPaths = vocabPaths;
    this.inlineSourcePaths = inlineSourcePaths;
    const legacyRank = new Map((this.settings.inlineCategoryOrder || []).map((name, index) => [name, index]));
    this.inlineCategoryOccurrences = [...inlineCategoryOccurrences.values()].sort((a, b) => {
      const ar = legacyRank.has(a.name) ? legacyRank.get(a.name) : Number.MAX_SAFE_INTEGER;
      const br = legacyRank.has(b.name) ? legacyRank.get(b.name) : Number.MAX_SAFE_INTEGER;
      return ar - br || a.name.localeCompare(b.name) || a.file.path.localeCompare(b.file.path) || a.line - b.line;
    });
    const categories = new Map<string, { name: string; count: number }>();
    for (const node of this.inlineCategoryOccurrences) {
      const current = categories.get(node.name) || { name: node.name, count: 0 };
      current.count += node.count;
      categories.set(node.name, current);
    }
    this.inlineCategories = [...categories.values()].sort((a, b) => {
      const ar = legacyRank.has(a.name) ? legacyRank.get(a.name) : Number.MAX_SAFE_INTEGER;
      const br = legacyRank.has(b.name) ? legacyRank.get(b.name) : Number.MAX_SAFE_INTEGER;
      return ar - br || a.name.localeCompare(b.name);
    });
    this.index = index;
    this._selfKeysByPath = selfKeysByPath;
    this.stats = { words, aliases, inlineEntries, due };
    this._occCache.clear();
    this.buildMatcher();
    this.updateStatusBar();
    this.refreshAllViews();
    if (notify) {
      const aliasPart = this.settings.includeAliases ? this.t("notice.aliasCount", { count: aliases }) : "";
      const nf = this.dictFolders().length, nt = this.vocabTagSet().size;
      const scope = [nf ? this.t("notice.scopeFolders", { count: nf }) : "", nt ? this.t("notice.scopeTags", { count: nt }) : ""].filter(Boolean).join(" + ") || this.t("notice.scopeEmpty");
      const inlinePart = inlineEntries ? this.t("notice.inlineCount", { count: inlineEntries }) : "";
      new Notice(this.t("notice.indexBuilt", { scope, words, aliases: aliasPart, inline: inlinePart }));
    }
    return this.stats;
  }
  buildMatcher() {
    // 英文单字母(a/I)噪声大,过滤;但单个汉字等非 ASCII 字符常是有意义的词,保留
    let keys = [...this.index.keys()].filter((key) => key.length >= 2 || [...key].some((character) => (character.codePointAt(0) || 0) > 127));
    // 排除标签:打了任一此标签的词,库内也不高亮(和网页端一致)
    const exc = this.excludeTagSet();
    if (exc.size) keys = keys.filter((k) => { const e = this.index.get(k); return !(e && e.tags && [...e.tags].some((t) => exc.has(t))); });
    // 已淘汰的词:比归档更彻底,连隐形代理 span 都不留,悬停也不再触发
    keys = keys.filter((k) => { const e = this.index.get(k); return !(e && e.retired); });
    keys.sort((a, b) => b.length - a.length);
    if (!keys.length) { this._pattern = null; return; }
    this._pattern = keys.map(boundedSource).join("|");
  }
  updateStatusBar() {
    if (!this.statusBarEl) return;
    const aliasPart = this.settings.includeAliases && this.stats.aliases ? this.t("status.aliases", { count: this.stats.aliases }) : "";
    const inlinePart = this.stats.inlineEntries ? this.t("status.inline", { count: this.stats.inlineEntries }) : "";
    const duePart = this.stats.due ? ` · ⏰${this.stats.due}` : "";
    const bridgePart = this.bridge?.running ? " · 🌐" : "";
    this.statusBarEl.setText(this.t("status.summary", { words: this.stats.words, aliases: aliasPart, inline: inlinePart, due: duePart, bridge: bridgePart }));
  }

  // ---------- 着色 ----------
  applyAlpha(color: string, alpha: number | null): string {
    if (alpha == null || alpha >= 1) return color;
    const pct = Math.max(0, Math.min(100, Math.round(alpha * 100)));
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
  }
  // 高亮渐隐:强度是 FSRS stability 的单调函数,不用 retrievability——后者哪怕不复习也会随日历时间天天变,
  // 会导致高亮"没事自己变淡/变浓",违反"复习几轮才肉眼可见变淡"的直觉;stability 只在真实复习事件后才变,足够稳定。
  // progress = s/(s+K) 是个 0→1、单调递增、边际递减的曲线(K 是"淡一半"所需的天数,先内置常量,不开放成设置——
  // 用户只需要控制"最淡到哪"这个下限,具体曲线形状留给实现)。从未复习过的新词(cardS 为 null)固定全强度。
  fadeAlphaFor(entry: LexisEntry): number {
    if (!this.settings.fadeByMemory) return 1;
    const s = entry && entry.cardS;
    if (s == null) return 1;
    const K = 20;
    const progress = s / (s + K);
    const floor = Math.max(0, Math.min(1, this.settings.fadeFloor ?? 0.25));
    return 1 - progress * (1 - floor);
  }
  inlineClassificationMode() { return this.settings.inlineClassificationMode === "file" ? "file" : "heading"; }
  inlineSourceKey(entry: LexisEntry): string { return entry.file.path && entry.category ? `${entry.file.path}::${entry.category}` : ""; }
  // 最近标题模式让所有同名标题共享外观；文件模式让同一来源文件共享外观。Markdown 祖先标题不参与。
  inlineCategoryColor(entry: LexisEntry): string {
    if (!entry?.inline) return "";
    const fileMode = this.inlineClassificationMode() === "file";
    const colors = fileMode ? (this.settings.inlineFileColors || {}) : (this.settings.inlineCategoryColors || {});
    const key = fileMode ? entry.file?.path : entry.category;
    return String(colors[key || ""] || "").trim();
  }
  // 分类透明度使用和颜色相同的分类键；没有单独配置时沿用全局透明度。
  inlineCategoryOpacity(entry: LexisEntry): number | null {
    if (!entry?.inline) return null;
    const fileMode = this.inlineClassificationMode() === "file";
    const opacities = fileMode ? (this.settings.inlineFileOpacity || {}) : (this.settings.inlineCategoryOpacity || {});
    const key = fileMode ? entry.file?.path : entry.category;
    if (!key || !Object.prototype.hasOwnProperty.call(opacities, key)) return null;
    const opacity = Number(opacities[key]);
    return isNaN(opacity) ? null : Math.max(0.1, Math.min(1, opacity));
  }
  highlightVisibleForEntry(entry: LexisEntry): boolean {
    if (!entry?.inline) return true;
    const fileMode = this.inlineClassificationMode() === "file";
    const parents = fileMode ? (this.settings.inlineFileHighlight || {}) : (this.settings.inlineCategoryHighlight || {});
    const parentKey = fileMode ? entry.file?.path : entry.category;
    if (parentKey && parents[parentKey] === false) return false;
    const sourceKey = this.inlineSourceKey(entry);
    return !sourceKey || (this.settings.inlineSourceHighlight || {})[sourceKey] !== false;
  }
  highlightAlphaForEntry(entry: LexisEntry): number {
    let opacity = this.settings.highlightOpacity ?? 1;
    const dictionaryOpacity = this.dictOpacityForFile(entry?.file);
    if (dictionaryOpacity != null) opacity = dictionaryOpacity;
    if (entry?.tags && this.settings.tagRules?.length) {
      const rule = this.settings.tagRules.find((item) => item.tag && entry.tags.has(item.tag.toLowerCase()));
      if (rule?.opacity != null && !isNaN(Number(rule.opacity))) opacity = Number(rule.opacity);
    }
    const inlineOpacity = this.inlineCategoryOpacity(entry);
    if (inlineOpacity != null) opacity = inlineOpacity;
    return Math.max(0.1, Math.min(1, opacity)) * this.fadeAlphaFor(entry);
  }
  // 某文件所属词典(文件夹)的专属色;子文件夹归父词典,取最长匹配。网页和 ob 内共用同一份 dictColorMap
  dictColorForFile(file: TFile | null | undefined): string | null {
    const row = this.dictSettingForFile(file);
    return row && String(row.color || "").trim() || null;
  }
  dictOpacityForFile(file: TFile | null | undefined): number | null {
    const row = this.dictSettingForFile(file);
    if (!row || row.opacity == null || isNaN(Number(row.opacity))) return null;
    return Math.max(0.1, Math.min(1, Number(row.opacity)));
  }
  dictSettingForFile(file: TFile | null | undefined): DictionarySetting | null {
    const path = file && file.path;
    if (!path) return null;
    const i = path.lastIndexOf("/");
    const wf = i > 0 ? path.slice(0, i) : "";
    if (!wf) return null;
    let best: DictionarySetting | null = null, bestLen = -1;
    for (const row of this.settings.dicts || []) {
      const folder = this.normalizeFolder(row?.folder);
      if (folder && (wf === folder || wf.startsWith(folder + "/")) && folder.length > bestLen) { best = row; bestLen = folder.length; }
    }
    return best;
  }
  inlineStyleForEntry(entry: LexisEntry | undefined, opts: HighlightStyleOptions = {}): string {
    // EPUB 内容在独立 iframe 中，读不到 Obsidian 主文档的 --text-accent；跨文档时必须注入解析后的实际颜色。
    let color = opts?.external ? this.effectiveHighlightColor() : (this.settings.highlightColor || "var(--text-accent)");
    let styleKind = this.settings.highlightStyle || "wavy";
    // 优先级:内联标题分类色 > 标签规则 > 词典色 > 全局色(和网页端 inlineStyleFor 完全一致)
    const dc = this.dictColorForFile(entry && entry.file);
    if (dc) color = dc;
    if (entry?.tags && this.settings.tagRules?.length) {
      const rule = this.settings.tagRules.find((r) => r.tag && entry.tags.has(r.tag.toLowerCase()));
      if (rule) { if (rule.color) color = rule.color; if (rule.style) styleKind = rule.style; }
    }
    const inlineColor = this.inlineCategoryColor(entry);
    if (inlineColor) color = inlineColor;
    // PDF:文字层 opacity 0.2,内嵌高亮不可见 → 单独建一层叠在 Canvas 之上、textLayer 之下,
    // 用内联 .lexis-hl 隐形做事件代理,视觉高亮画在独立 overlay 层里。
    if (opts && opts.pdf) return "--lexis-hl-underline:none;--lexis-hl-background:transparent;";
    // 已归档:span 照样包(hover/click 事件代理不能丢),但视觉上完全不显示——跟 PDF 那层"隐形代理"是同一个思路。
    if (entry && entry.archived) return "--lexis-hl-underline:none;--lexis-hl-background:transparent;";
    if (entry && !this.highlightVisibleForEntry(entry)) return "--lexis-hl-underline:none;--lexis-hl-background:transparent;";
    const alpha = entry ? this.highlightAlphaForEntry(entry) : this.settings.highlightOpacity;
    const c = this.applyAlpha(color, alpha);
    if (styleKind === "background") return `--lexis-hl-underline:none;--lexis-hl-background:${c};border-radius:3px;padding:0 1px;`;
    if (styleKind === "underline") {
      return `--lexis-hl-underline:linear-gradient(${c},${c});--lexis-hl-underline-size:100% 1px;--lexis-hl-background:transparent;`;
    }
    const wave = `linear-gradient(135deg,transparent 40%,${c} 40%,${c} 60%,transparent 60%),linear-gradient(45deg,transparent 40%,${c} 40%,${c} 60%,transparent 60%)`;
    return `--lexis-hl-underline:${wave};--lexis-hl-underline-size:4px 2px,4px 2px;--lexis-hl-background:transparent;`;
  }
  currentHighlightPage(leaf: WorkspaceLeaf | null = this.app.workspace.getMostRecentLeaf()): HighlightPage | null {
    if (!leaf) return null;
    const view = leaf.view as View & { file?: TFile };
    const type = view?.getViewType?.();
    if (type !== "markdown" && type !== "pdf") return null;
    const container = view.containerEl;
    if (!container?.classList) return null;
    const file = view.file || this.app.workspace.getActiveFile();
    return { leaf, container, key: `${type}:${file?.path || ""}` };
  }
  pageHighlightState(page: HighlightPage): HighlightPageState {
    let state = this._pageHighlightState.get(page.leaf);
    if (!state || state.key !== page.key) {
      state = { key: page.key, hidden: false };
      this._pageHighlightState.set(page.leaf, state);
    }
    return state;
  }
  applyPageHighlightState(page: HighlightPage, state: HighlightPageState): void {
    page.container.classList.toggle("lexis-page-highlights-hidden", state.hidden);
  }
  syncActivePageHighlightState(leaf: WorkspaceLeaf | null = this.app.workspace.getMostRecentLeaf()): void {
    const page = this.currentHighlightPage(leaf);
    if (!page) {
      leaf?.view?.containerEl?.classList?.remove("lexis-page-highlights-hidden");
      return;
    }
    this.applyPageHighlightState(page, this.pageHighlightState(page));
  }
  toggleCurrentPageHighlights(page: HighlightPage | null = this.currentHighlightPage()): void {
    if (!page) return;
    const state = this.pageHighlightState(page);
    state.hidden = !state.hidden;
    this.applyPageHighlightState(page, state);
    if (state.hidden) this.removePopover();
    new Notice(this.t(state.hidden ? "notice.highlightsHidden" : "notice.highlightsShown"));
  }
  refreshAllViews() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as View & { previewMode?: { rerender(force: boolean): void }; editor?: { cm?: EditorView } };
      const pm = view.previewMode;
      if (pm && typeof pm.rerender === "function") pm.rerender(true);
      const cm = view.editor?.cm;
      if (this._liveRefreshEffect && cm?.dispatch) {
        try { cm.dispatch({ effects: this._liveRefreshEffect.of(undefined) }); } catch { /* A closing editor may reject a late refresh. */ }
      }
    });
    if (this.liveAvailable) this.app.workspace.updateOptions();
    this.rescanPdfLayers();
    this.rescanEpubIframes();
  }

  // ---------- 阅读模式高亮 ----------
  highlightElement(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (!this.settings.enableHighlight || !this._pattern || !this.index.size) return;
    if (el.closest && el.closest(".lexis-popover")) return;
    const selfKeys = ctx && ctx.sourcePath ? this.selfKeysFor(ctx.sourcePath) : null;
    this.wrapMatchesInElement(el, "code,pre,a,.lexis-hl,.lexis-popover,.math,.tag", {}, selfKeys);
  }
  // 把 el 内文本节点里命中词库的片段包成 <span class="lexis-hl">(供阅读模式 + PDF 复用)。
  // rejectSelector:父元素命中则跳过该文本节点(避免重复包/包进代码块等)。
  // excludeKeys:命中这些 key 时只留纯文本不高亮(词条笔记里不高亮自己的标题/别名,但别的词照常高亮)。
  wrapMatchesInElement(el: HTMLElement, rejectSelector: string, styleOpts: HighlightStyleOptions = {}, excludeKeys: Set<string> | null = null): void {
    if (!this._pattern || !this.index.size) return;
    const doc = el.ownerDocument || document;
    const regex = new RegExp(this._pattern, "gi");
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || (rejectSelector && p.closest(rejectSelector))) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) if (n.nodeType === Node.TEXT_NODE) targets.push(n as Text);
    for (const node of targets) {
      const text = node.nodeValue || "";
      regex.lastIndex = 0;
      if (!regex.test(text)) continue;
      regex.lastIndex = 0;
      const frag = createFragment();
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text))) {
        if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
        const key = m[0].toLowerCase();
        if (excludeKeys && excludeKeys.has(key)) {
          frag.appendChild(doc.createTextNode(m[0]));
          last = m.index + m[0].length;
          if (m[0].length === 0) regex.lastIndex++;
          continue;
        }
        const entry = this.index.get(key);
        if (entry && !entry.inline) this.passiveEncounter(entry.file);
        const span = doc.body.createSpan();
        span.className = "lexis-hl";
        span.textContent = m[0];
        span.dataset.lexisKey = key;
        span.setAttribute("style", this.inlineStyleForEntry(entry, styleOpts));
        frag.appendChild(span);
        last = m.index + m[0].length;
        if (m[0].length === 0) regex.lastIndex++;
      }
      if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }
  }


  // ---------- 实时预览高亮 ----------
  setupLiveExtension() {
    try {
      const editorInfoField = obsidian.editorInfoField;
      const refreshEffect = StateEffect.define<void>();
      this._liveRefreshEffect = refreshEffect;
      const buildDecorations = (view: EditorView): DecorationSet => {
        const builder = new RangeSetBuilder<Decoration>();
        if (!this.settings.enableHighlight || !this.settings.enableLivePreview || !this._pattern) return builder.finish();
        let selfKeys: Set<string> | null = null;
        if (editorInfoField) {
          try {
            const info = view.state.field(editorInfoField, false);
            if (info?.file?.path) selfKeys = this.selfKeysFor(info.file.path);
          } catch { /* Some editor states do not expose editorInfoField. */ }
        }
        const regex = new RegExp(this._pattern, "gi");
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(text))) {
            const key = match[0].toLowerCase();
            if (selfKeys?.has(key)) {
              if (match[0].length === 0) regex.lastIndex++;
              continue;
            }
            const start = from + match.index;
            const end = start + match[0].length;
            const entry = this.index.get(key);
            if (entry && !entry.inline) this.passiveEncounter(entry.file);
            builder.add(start, end, Decoration.mark({ class: "lexis-hl", attributes: { "data-lexis-key": key, style: this.inlineStyleForEntry(entry) } }));
            if (match[0].length === 0) regex.lastIndex++;
          }
        }
        return builder.finish();
      };
      const ext = ViewPlugin.fromClass(
        class {
          decorations: DecorationSet;
          constructor(view: EditorView) { this.decorations = buildDecorations(view); }
          update(update: ViewUpdate) {
            const indexChanged = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(refreshEffect)));
            if (update.docChanged || update.viewportChanged || indexChanged) this.decorations = buildDecorations(update.view);
          }
        },
        { decorations: (v) => v.decorations }
      );
      this.registerEditorExtension(ext);
      this.liveAvailable = true;
    } catch (err) {
      this.liveAvailable = false;
      console.warn("[Lexis] 实时预览高亮不可用:", err);
    }
  }

  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(HighlightEngine.prototype);
  return descriptors;
}

export { createHighlightEngine };
