"use strict";

import { Decoration, type DecorationSet, type EditorView, type ViewUpdate, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, type Extension, type StateEffectType } from "@codemirror/state";
import * as obsidian from "obsidian";
import type { App, MarkdownPostProcessorContext, Notice as ObsidianNotice, TFile, View, WorkspaceLeaf } from "obsidian";
import type { OccurrenceSearch } from "./occurrence-search";
import { refreshReadingHighlightsInPlace } from "./reading-highlights";
import type { DictionarySetting, InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats } from "./types";
import { createHighlightIndex } from "./highlight-index";
import type { CanvasEdgeHighlights } from "./canvas-edge-highlights";
import { resolveEntryColorToken } from "./entry-colors";

type HighlightStyleOptions = { external?: boolean; pdf?: boolean };
type HighlightPage = { leaf: WorkspaceLeaf; container: HTMLElement; key: string };
type HighlightPageState = { key: string; hidden: boolean };
type TranslationVars = Record<string, string | number | boolean>;

interface HighlightDependencies {
  FSRS: unknown;
  Notice: typeof ObsidianNotice;
  boundedSource: (value: string) => string;
  compactMixedScriptSpacing: (value: string) => string;
  todayStr: () => string;
}

function createHighlightEngine({ Notice, boundedSource, compactMixedScriptSpacing, todayStr }: HighlightDependencies): PropertyDescriptorMap {
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
  declare _indexKeysByCompact: Map<string, string>;
  declare _matchKeysByCompact: Map<string, string>;
  declare statusBarEl: HTMLElement | null;
  declare bridge: { running: boolean } | null;
  declare liveAvailable: boolean;
  declare _liveRefreshEffect: StateEffectType<void> | null;
  declare _pageHighlightState: WeakMap<WorkspaceLeaf, HighlightPageState>;
  declare _canvasEdgeHighlights: CanvasEdgeHighlights;
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
  declare maybeShowSelPill: (event: MouseEvent, external?: boolean) => void;
  declare onMouseOver: (event: MouseEvent) => void;
  declare onMouseOut: (event: MouseEvent) => void;
  declare onClick: (event: MouseEvent) => void;
  declare removePopover: () => void;
  declare registerEditorExtension: (extension: Extension) => void;
  declare normalizeFolder: (path: string) => string;
  declare selfKeysFor: (path: string) => Set<string> | null;
  declare resolveMatchKey: (value: string) => string;
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
  highlightVisibleForEntry(entry: LexisEntry, includeDictionary = true): boolean {
    if (includeDictionary && this.dictSettingForFile(entry?.file)?.highlight === false) return false;
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
    // 优先级:词条角色/直写色 > 内联分类 > 标签 > 词典 > 全局。
    const dc = this.dictColorForFile(entry && entry.file);
    if (dc) color = dc;
    if (entry?.tags && this.settings.tagRules?.length) {
      const rule = this.settings.tagRules.find((r) => r.tag && entry.tags.has(r.tag.toLowerCase()));
      if (rule) { if (rule.color) color = rule.color; if (rule.style) styleKind = rule.style; }
    }
    const inlineColor = this.inlineCategoryColor(entry);
    if (inlineColor) color = inlineColor;
    const entryColor = resolveEntryColorToken(entry?.colorToken, this.settings.entryColors);
    if (entryColor) color = entryColor;
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
      const view = leaf.view as View & { file?: TFile; previewMode?: { containerEl: HTMLElement }; editor?: { cm?: EditorView } };
      const pm = view.previewMode;
      if (pm?.containerEl) {
        refreshReadingHighlightsInPlace(pm.containerEl, (root) => {
          if (!this.settings.enableHighlight || !this._pattern || !this.index.size) return;
          const selfKeys = this.selfKeysFor(view.file?.path || "");
          const sections = Array.from(root.querySelectorAll<HTMLElement>(".markdown-preview-section"));
          const targets = sections.length ? sections.filter((section) => !section.parentElement?.closest(".markdown-preview-section")) : [root];
          for (const target of targets) {
            this.wrapMatchesInElement(target, "code,pre,a,.lexis-hl,.lexis-popover,.math,.tag", {}, selfKeys);
          }
        });
      }
      const cm = view.editor?.cm;
      if (this._liveRefreshEffect && cm?.dispatch) {
        try { cm.dispatch({ effects: this._liveRefreshEffect.of(undefined) }); } catch { /* A closing editor may reject a late refresh. */ }
      }
    });
    if (this.liveAvailable) this.app.workspace.updateOptions();
    this.rescanPdfLayers();
    this.rescanEpubIframes();
    this._canvasEdgeHighlights?.refresh();
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
        const key = this.resolveMatchKey(m[0]);
        if (excludeKeys && excludeKeys.has(key)) {
          frag.appendChild(doc.createTextNode(m[0]));
          last = m.index + m[0].length;
          if (m[0].length === 0) regex.lastIndex++;
          continue;
        }
        const entry = this.index.get(key);
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
            const key = this.resolveMatchKey(match[0]);
            if (selfKeys?.has(key)) {
              if (match[0].length === 0) regex.lastIndex++;
              continue;
            }
            const start = from + match.index;
            const end = start + match[0].length;
            const entry = this.index.get(key);
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
  return { ...createHighlightIndex({ Notice, boundedSource, compactMixedScriptSpacing, todayStr }), ...descriptors };
}

export { createHighlightEngine };
