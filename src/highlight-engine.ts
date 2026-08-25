"use strict";

import { Decoration, type DecorationSet, type EditorView, type ViewUpdate, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder, StateEffect } from "@codemirror/state";
import * as obsidian from "obsidian";
import type { InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats } from "./types";

function createHighlightEngine({ FSRS, Notice, boundedSource, todayStr }) {
  class HighlightEngine {
  [key: string]: any;
  declare settings: LexisSettings;
  declare index: Map<string, LexisEntry>;
  declare stats: LexisStats;
  declare inlineCategoryOccurrences: InlineCategoryOccurrence[];
  // ---------- 索引 ----------
  normalizeFolder(p) { return (p || "").trim().replace(/^\/+|\/+$/g, ""); }
  // 单一真相:rebuildIndex 算出的命中路径集合。支持"文件夹∪标签"两种收录,且 14 处调用点签名不变。
  inVocabFolder(path) { return this.vocabPaths ? this.vocabPaths.has(path) : false; }
  // 词条自身的标题/别名 key 集合:该词条笔记内文出现自己的标题时不高亮自己,但别的词库词照常高亮。
  selfKeysFor(path) { return (this._selfKeysByPath && this._selfKeysByPath.get(path)) || null; }
  maybeRebuild(file, oldPath) {
    const p = (file && file.path) || "";
    this._occCache.clear();
    if (file?.extension === "pdf") this.occurrenceSearch?.invalidatePdf(file.path);
    if (oldPath && /\.pdf$/i.test(oldPath)) this.occurrenceSearch?.invalidatePdf(oldPath);
    if (oldPath && p && this.settings.reviewHistory?.[oldPath]) {
      this.settings.reviewHistory[p] = this.settings.reviewHistory[oldPath];
      delete this.settings.reviewHistory[oldPath];
      this.saveSettings();
    }
    if (this.isVocabFile(file) || this.vocabPaths.has(p) || this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(p) || (oldPath && (this.inFolderScope(oldPath) || this.vocabPaths.has(oldPath) || this.inlineSourcePaths?.has(oldPath)))) this.scheduleRebuild();
  }
  scheduleRebuild() {
    window.clearTimeout(this._rebuildTimer);
    this._rebuildTimer = window.setTimeout(() => this.rebuildIndex(false), 800);
  }
  inlineDelimiter() { return String(this.settings.inlineEntryDelimiter || "::").trim() || "::"; }
  isInlineSourceFile(file) {
    if (!this.settings.inlineEntriesEnabled || !file?.path) return false;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const marker = fm["lexis-inline"];
    if (marker === true || marker === 1 || /^(true|yes|1)$/i.test(String(marker || ""))) return true;
    return this.getTags(file).has("lexis-inline");
  }
  // 轻量词条只存在于一份资料笔记里,不建单独文件、也不参与 FSRS。最近标题负责分组,上级标题只提供设置页层级与精确跳转。
  parseInlineEntries(content, file) {
    const delimiter = this.inlineDelimiter();
    const lines = String(content || "").split(/\r?\n/);
    let firstContentLine = 0;
    if (lines[0]?.trim() === "---") {
      const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
      if (end >= 0) firstContentLine = end + 1;
    }
    const out = [];
    const headingStack = [];
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
  extractAliases(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) return [];
    // 始终包含 Obsidian 标准属性,外加用户配置的自定义属性(并集)
    const extra = (this.settings.aliasSources || "").split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
    const sources = [...new Set(["aliases", "alias", ...extra])];
    const seen = new Set();
    const results = [];
    for (const src of sources) {
      let raw = fm[src];
      if (raw == null || raw === "") continue;
      if (typeof raw === "string") raw = raw.split(/[,，;；]/);
      if (!Array.isArray(raw)) raw = [raw];
      for (const x of raw) {
        const s = String(x).trim();
        if (!s || s.toLowerCase() === "null") continue;
        if (!seen.has(s)) { seen.add(s); results.push(s); }
      }
    }
    return results;
  }
  getTags(file) {
    const cache = this.app.metadataCache.getFileCache(file);
    const set = new Set();
    const fm = cache?.frontmatter;
    if (fm) {
      let t = fm.tags ?? fm.tag ?? [];
      if (typeof t === "string") t = t.split(/[,，;；\s]+/);
      if (!Array.isArray(t)) t = [t];
      for (const x of t) { const s = String(x).trim().replace(/^#/, ""); if (s && s.toLowerCase() !== "null") set.add(s.toLowerCase()); }
    }
    if (cache?.tags) for (const tg of cache.tags) { const s = (tg.tag || "").replace(/^#/, ""); if (s) set.add(s.toLowerCase()); }
    return set;
  }
  async rebuildIndex(notify) {
    const buildId = (this._indexBuildId || 0) + 1;
    this._indexBuildId = buildId;
    const index = new Map();
    const selfKeysByPath = new Map();
    const today = todayStr();
    let words = 0, aliases = 0, inlineEntries = 0, due = 0;
    const inlineCategoryOccurrences = new Map();
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
      catch (_e) { return []; }
    }));
    // 异步读取期间若已有更新的重建开始,旧结果不能覆盖新索引。
    if (buildId !== this._indexBuildId) return this.stats;
    for (const entries of parsed) {
      const own = new Set();
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
    const categories = new Map();
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
    let keys = [...this.index.keys()].filter((k) => k.length >= 2 || /[^\x00-\x7f]/.test(k));
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
  applyAlpha(color, alpha) {
    if (alpha == null || alpha >= 1) return color;
    const pct = Math.max(0, Math.min(100, Math.round(alpha * 100)));
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
  }
  // 高亮渐隐:强度是 FSRS stability 的单调函数,不用 retrievability——后者哪怕不复习也会随日历时间天天变,
  // 会导致高亮"没事自己变淡/变浓",违反"复习几轮才肉眼可见变淡"的直觉;stability 只在真实复习事件后才变,足够稳定。
  // progress = s/(s+K) 是个 0→1、单调递增、边际递减的曲线(K 是"淡一半"所需的天数,先内置常量,不开放成设置——
  // 用户只需要控制"最淡到哪"这个下限,具体曲线形状留给实现)。从未复习过的新词(cardS 为 null)固定全强度。
  fadeAlphaFor(entry) {
    if (!this.settings.fadeByMemory) return 1;
    const s = entry && entry.cardS;
    if (s == null) return 1;
    const K = 20;
    const progress = s / (s + K);
    const floor = Math.max(0, Math.min(1, this.settings.fadeFloor ?? 0.25));
    return 1 - progress * (1 - floor);
  }
  inlineClassificationMode() { return this.settings.inlineClassificationMode === "file" ? "file" : "heading"; }
  inlineSourceKey(entry) { return entry?.file?.path && entry?.category ? `${entry.file.path}::${entry.category}` : ""; }
  // 最近标题模式让所有同名标题共享外观；文件模式让同一来源文件共享外观。Markdown 祖先标题不参与。
  inlineCategoryColor(entry) {
    if (!entry?.inline) return "";
    const fileMode = this.inlineClassificationMode() === "file";
    const colors = fileMode ? (this.settings.inlineFileColors || {}) : (this.settings.inlineCategoryColors || {});
    const key = fileMode ? entry.file?.path : entry.category;
    return String(colors[key] || "").trim();
  }
  // 分类透明度使用和颜色相同的分类键；没有单独配置时沿用全局透明度。
  inlineCategoryOpacity(entry) {
    if (!entry?.inline) return null;
    const fileMode = this.inlineClassificationMode() === "file";
    const opacities = fileMode ? (this.settings.inlineFileOpacity || {}) : (this.settings.inlineCategoryOpacity || {});
    const key = fileMode ? entry.file?.path : entry.category;
    if (!Object.prototype.hasOwnProperty.call(opacities, key)) return null;
    const opacity = Number(opacities[key]);
    return isNaN(opacity) ? null : Math.max(0.1, Math.min(1, opacity));
  }
  highlightVisibleForEntry(entry) {
    if (!entry?.inline) return true;
    const fileMode = this.inlineClassificationMode() === "file";
    const parents = fileMode ? (this.settings.inlineFileHighlight || {}) : (this.settings.inlineCategoryHighlight || {});
    const parentKey = fileMode ? entry.file?.path : entry.category;
    if (parents[parentKey] === false) return false;
    const sourceKey = this.inlineSourceKey(entry);
    return !sourceKey || (this.settings.inlineSourceHighlight || {})[sourceKey] !== false;
  }
  highlightAlphaForEntry(entry) {
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
  dictColorForFile(file) {
    const row = this.dictSettingForFile(file);
    return row && String(row.color || "").trim() || null;
  }
  dictOpacityForFile(file) {
    const row = this.dictSettingForFile(file);
    if (!row || row.opacity == null || isNaN(Number(row.opacity))) return null;
    return Math.max(0.1, Math.min(1, Number(row.opacity)));
  }
  dictSettingForFile(file) {
    const path = file && file.path;
    if (!path) return null;
    const i = path.lastIndexOf("/");
    const wf = i > 0 ? path.slice(0, i) : "";
    if (!wf) return null;
    let best = null, bestLen = -1;
    for (const row of this.settings.dicts || []) {
      const folder = this.normalizeFolder(row?.folder);
      if (folder && (wf === folder || wf.startsWith(folder + "/")) && folder.length > bestLen) { best = row; bestLen = folder.length; }
    }
    return best;
  }
  inlineStyleForEntry(entry, opts: { external?: boolean; pdf?: boolean } = {}) {
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
    if (opts && opts.pdf) return "--lexis-hl-line:none;--lexis-hl-background:transparent;";
    // 已归档:span 照样包(hover/click 事件代理不能丢),但视觉上完全不显示——跟 PDF 那层"隐形代理"是同一个思路。
    if (entry && entry.archived) return "--lexis-hl-line:none;--lexis-hl-background:transparent;";
    if (!this.highlightVisibleForEntry(entry)) return "--lexis-hl-line:none;--lexis-hl-background:transparent;";
    const alpha = this.highlightAlphaForEntry(entry);
    const c = this.applyAlpha(color, alpha);
    if (styleKind === "background") return `--lexis-hl-line:none;--lexis-hl-background:${c};border-radius:3px;padding:0 1px;`;
    const line = styleKind === "underline" ? "solid" : "wavy";
    return `--lexis-hl-line:underline;--lexis-hl-line-style:${line};--lexis-hl-line-color:${c};--lexis-hl-background:transparent;`;
  }
  currentHighlightPage(leaf = this.app.workspace.activeLeaf) {
    const view = leaf?.view;
    const type = view?.getViewType?.();
    if (type !== "markdown" && type !== "pdf") return null;
    const container = view.containerEl;
    if (!container?.classList) return null;
    const file = view.file || this.app.workspace.getActiveFile();
    return { leaf, container, key: `${type}:${file?.path || ""}` };
  }
  pageHighlightState(page) {
    let state = this._pageHighlightState.get(page.leaf);
    if (!state || state.key !== page.key) {
      state = { key: page.key, hidden: false };
      this._pageHighlightState.set(page.leaf, state);
    }
    return state;
  }
  applyPageHighlightState(page, state) {
    page.container.classList.toggle("lexis-page-highlights-hidden", state.hidden);
  }
  syncActivePageHighlightState(leaf = this.app.workspace.activeLeaf) {
    const page = this.currentHighlightPage(leaf);
    if (!page) {
      leaf?.view?.containerEl?.classList?.remove("lexis-page-highlights-hidden");
      return;
    }
    this.applyPageHighlightState(page, this.pageHighlightState(page));
  }
  toggleCurrentPageHighlights(page = this.currentHighlightPage()) {
    if (!page) return;
    const state = this.pageHighlightState(page);
    state.hidden = !state.hidden;
    this.applyPageHighlightState(page, state);
    if (state.hidden) this.removePopover();
    new Notice(this.t(state.hidden ? "notice.highlightsHidden" : "notice.highlightsShown"));
  }
  refreshAllViews() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const pm = leaf?.view?.previewMode;
      if (pm && typeof pm.rerender === "function") pm.rerender(true);
      const cm = leaf?.view?.editor?.cm;
      if (this._liveRefreshEffect && cm?.dispatch) {
        try { cm.dispatch({ effects: this._liveRefreshEffect.of(null) }); } catch (_e) {}
      }
    });
    if (this.liveAvailable) this.app.workspace.updateOptions();
    this.rescanPdfLayers();
    this.rescanEpubIframes();
  }

  // ---------- 阅读模式高亮 ----------
  highlightElement(el, ctx) {
    if (!this.settings.enableHighlight || !this._pattern || !this.index.size) return;
    if (el.closest && el.closest(".lexis-popover")) return;
    const selfKeys = ctx && ctx.sourcePath ? this.selfKeysFor(ctx.sourcePath) : null;
    this.wrapMatchesInElement(el, "code,pre,a,.lexis-hl,.lexis-popover,.math,.tag", null, selfKeys);
  }
  // 把 el 内文本节点里命中词库的片段包成 <span class="lexis-hl">(供阅读模式 + PDF 复用)。
  // rejectSelector:父元素命中则跳过该文本节点(避免重复包/包进代码块等)。
  // excludeKeys:命中这些 key 时只留纯文本不高亮(词条笔记里不高亮自己的标题/别名,但别的词照常高亮)。
  wrapMatchesInElement(el, rejectSelector, styleOpts = null, excludeKeys = null) {
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
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    for (const node of targets) {
      const text = node.nodeValue;
      regex.lastIndex = 0;
      if (!regex.test(text)) continue;
      regex.lastIndex = 0;
      const frag = doc.createDocumentFragment();
      let last = 0, m;
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
        const span = doc.createElement("span");
        span.className = "lexis-hl";
        span.textContent = m[0];
        span.dataset.lexisKey = key;
        span.setAttribute("style", this.inlineStyleForEntry(entry, styleOpts));
        frag.appendChild(span);
        last = m.index + m[0].length;
        if (m[0].length === 0) regex.lastIndex++;
      }
      if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  // ---------- PDF 高亮(钩 pdf.js 文字层) ----------
  // pdf.js 会把同一行甚至同一个词拆成多个 span。普通 TreeWalker 只能逐文本节点匹配，
  // 所以 PDF 先按几何位置还原短的视觉行，再把跨片段命中映射回原文本节点。
  pdfTextRuns(layer) {
    const doc = layer.ownerDocument || document;
    const walker = doc.createTreeWalker(layer, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest(".lexis-hl,.lexis-popover")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const parts = [];
    let node;
    while ((node = walker.nextNode())) {
      try {
        const range = doc.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        range.detach?.();
        if (!rect.width || !rect.height) continue;
        parts.push({ node, text: node.nodeValue, rect });
      } catch (_e) {}
    }

    const runs = [];
    for (const part of parts) {
      const last = runs[runs.length - 1];
      const center = part.rect.top + part.rect.height / 2;
      const sameLine = last && Math.abs(center - last.center) <= Math.max(2, Math.min(last.height, part.rect.height) * 0.45);
      const gap = last ? part.rect.left - last.right : 0;
      // 同一高度但横向相距很远，通常是双栏的另一栏，必须拆成两个视觉行。
      const sameRun = sameLine && gap >= -2 && gap <= Math.max(24, Math.min(last.height, part.rect.height) * 2.5);
      if (!sameRun) {
        runs.push({ parts: [part], left: part.rect.left, right: part.rect.right, top: part.rect.top, center, height: part.rect.height });
        continue;
      }
      last.parts.push(part);
      last.right = Math.max(last.right, part.rect.right);
      last.top = Math.min(last.top, part.rect.top);
      last.height = Math.max(last.height, part.rect.height);
      last.center = (last.center * (last.parts.length - 1) + center) / last.parts.length;
    }
    return runs;
  }

  pdfRunStream(run) {
    const text = [];
    const map = [];
    const appendSpace = (source) => {
      if (!text.length || text[text.length - 1] === " ") return;
      text.push(" "); map.push(source || null);
    };
    const appendPart = (part) => {
      for (let i = 0; i < part.text.length; i++) {
        const ch = part.text[i];
        if (/\s/.test(ch)) appendSpace({ node: part.node, offset: i });
        else { text.push(ch); map.push({ node: part.node, offset: i }); }
      }
    };
    let previous = null;
    for (const part of run.parts) {
      if (previous && !/\s$/.test(previous.text) && !/^\s/.test(part.text)) {
        const gap = part.rect.left - previous.rect.right;
        const threshold = Math.max(1.5, Math.min(previous.rect.height, part.rect.height) * 0.16);
        if (gap > threshold) appendSpace(null);
      }
      appendPart(part);
      previous = part;
    }
    while (text[0] === " ") { text.shift(); map.shift(); }
    while (text[text.length - 1] === " ") { text.pop(); map.pop(); }
    return { text: text.join(""), map };
  }

  wrapPdfFragmentMatches(layer) {
    if (!this._pattern || !this.index.size) return;
    const runs = this.pdfTextRuns(layer);
    if (!runs.length) return;
    const streams = runs.map((run) => this.pdfRunStream(run));
    const candidates = [];
    const nodeOrder = new WeakMap();
    let order = 0;
    for (const run of runs) for (const part of run.parts) if (!nodeOrder.has(part.node)) nodeOrder.set(part.node, order++);

    const collect = (stream, accepts, droppedHyphen) => {
      const regex = new RegExp(this._pattern, "gi");
      let match;
      while ((match = regex.exec(stream.text))) {
        const refs = stream.map.slice(match.index, match.index + match[0].length).filter(Boolean);
        if (!refs.length || !accepts(refs)) {
          if (!match[0].length) regex.lastIndex++;
          continue;
        }
        const key = match[0].toLowerCase();
        const entry = this.index.get(key);
        if (!entry) continue;
        const byNode = new Map();
        for (const ref of refs) {
          const current = byNode.get(ref.node);
          if (current) { current.start = Math.min(current.start, ref.offset); current.end = Math.max(current.end, ref.offset + 1); }
          else byNode.set(ref.node, { node: ref.node, start: ref.offset, end: ref.offset + 1 });
        }
        if (droppedHyphen && byNode.has(droppedHyphen.node)) {
          const segment = byNode.get(droppedHyphen.node);
          segment.end = Math.max(segment.end, droppedHyphen.offset + 1);
        }
        const segments = [...byNode.values()].sort((a, b) => nodeOrder.get(a.node) - nodeOrder.get(b.node));
        candidates.push({ key, entry, segments, length: match[0].length });
        if (!match[0].length) regex.lastIndex++;
      }
    };

    // 先处理同一视觉行内被多个 span 拆开的词。
    for (let i = 0; i < runs.length; i++) {
      collect(streams[i], (refs) => new Set(refs.map((ref) => ref.node)).size > 1, null);
    }

    // 再连接真正相邻的上下行。只在同一栏、相邻行距内找下一行，避免双栏串接。
    for (let i = 0; i < runs.length; i++) {
      const current = runs[i];
      let nextIndex = -1, bestScore = Infinity;
      for (let j = i + 1; j < Math.min(runs.length, i + 9); j++) {
        const next = runs[j];
        const dy = next.top - current.top;
        const lineHeight = Math.max(current.height, next.height);
        if (dy <= lineHeight * 0.45 || dy > lineHeight * 3) continue;
        const dx = Math.abs(next.left - current.left);
        if (dx > Math.max(32, lineHeight * 3)) continue;
        const score = dy + dx * 0.2;
        if (score < bestScore) { bestScore = score; nextIndex = j; }
      }
      if (nextIndex < 0) continue;
      const left = streams[i], right = streams[nextIndex];
      if (!left.text || !right.text) continue;
      const leftNodes = new Set(runs[i].parts.map((part) => part.node));
      const rightNodes = new Set(runs[nextIndex].parts.map((part) => part.node));
      const crossesLines = (refs) => refs.some((ref) => leftNodes.has(ref.node)) && refs.some((ref) => rightNodes.has(ref.node));
      const combine = (leftText, leftMap, separator) => ({
        text: leftText + separator + right.text,
        map: leftMap.concat(separator ? [null] : [], right.map),
      });
      const hyphen = /[-\u00ad\u2010\u2011]$/.test(left.text);
      if (hyphen) {
        const dropped = left.map[left.map.length - 1];
        collect(combine(left.text.slice(0, -1), left.map.slice(0, -1), ""), crossesLines, dropped);
        // 保留真正属于词条的连字符，例如 state-of-the-art。
        collect(combine(left.text, left.map, ""), crossesLines, null);
      } else {
        // 换行可能发生在词内/中日韩文本中，也可能等价于一个普通空格；两种都是明确的 PDF 行缝语义。
        collect(combine(left.text, left.map, ""), crossesLines, null);
        collect(combine(left.text, left.map, " "), crossesLines, null);
      }
    }

    // 同一物理字符只接受最长命中，防止短词覆盖跨行长词；随后从后往前切文本节点。
    candidates.sort((a, b) => b.length - a.length || a.segments[0].start - b.segments[0].start);
    const used = new WeakMap();
    const accepted = [];
    const signatures = new Set();
    for (const candidate of candidates) {
      const signature = candidate.key + "|" + candidate.segments.map((s) => `${nodeOrder.get(s.node)}:${s.start}-${s.end}`).join(",");
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      const overlaps = candidate.segments.some((segment) => (used.get(segment.node) || []).some((range) => segment.start < range.end && segment.end > range.start));
      if (overlaps) continue;
      for (const segment of candidate.segments) {
        const ranges = used.get(segment.node) || [];
        ranges.push(segment); used.set(segment.node, ranges);
      }
      accepted.push(candidate);
    }

    const rangesByNode = new Map();
    for (const candidate of accepted) {
      if (!candidate.entry.inline) this.passiveEncounter(candidate.entry.file);
      for (const segment of candidate.segments) {
        const ranges = rangesByNode.get(segment.node) || [];
        ranges.push({ ...segment, key: candidate.key, entry: candidate.entry });
        rangesByNode.set(segment.node, ranges);
      }
    }
    const doc = layer.ownerDocument || document;
    for (const [textNode, ranges] of rangesByNode) {
      ranges.sort((a, b) => b.start - a.start);
      for (const range of ranges) {
        textNode.splitText(range.end);
        const matched = textNode.splitText(range.start);
        const span = doc.createElement("span");
        span.className = "lexis-hl";
        span.dataset.lexisKey = range.key;
        span.setAttribute("style", this.inlineStyleForEntry(range.entry, { pdf: true }));
        matched.parentNode.replaceChild(span, matched);
        span.appendChild(matched);
      }
    }
  }

  // ob 内置 PDF 阅读器 = pdf.js,.textLayer 在主 DOM(无 iframe),文字层文字是透明的、
  // 仅供选中复制;我们把命中词包成 .lexis-hl(下划线/背景色显式带颜色,所以透明文字上也看得见),
  // 顺带白嫖现成的 document 级 mouseover/click → 悬浮卡 + 跳转。翻页/缩放时 pdf.js 重建文字层,
  // 用 MutationObserver 重扫;.lexis-hl 在 rejectSelector 里,重扫不会重复包。
  setupPdfHighlight() {
    if (this._pdfObserver) { this._pdfObserver.disconnect(); this._pdfObserver = null; }
    if (this._pdfRaf) { window.cancelAnimationFrame(this._pdfRaf); this._pdfRaf = 0; }
    if (this._pdfResizeObserver) { try { this._pdfResizeObserver.disconnect(); } catch (_e) {} this._pdfResizeObserver = null; }
    if (this._pdfResizeTimer) { window.clearTimeout(this._pdfResizeTimer); this._pdfResizeTimer = 0; }
    this._pdfObservedLayers = new WeakSet();
    if (!this.settings.enablePdfHighlight || typeof MutationObserver === "undefined") return;
    this._pdfPending = new Set();
    const flush = () => {
      this._pdfRaf = 0;
      const items = [...this._pdfPending]; this._pdfPending.clear();
      for (const layer of items) { try { if (layer.isConnected) this.scanPdfLayer(layer); } catch (_e) {} }
      try { document.querySelectorAll(".lexis-pdf-hl-layer.is-geometry-changing").forEach((el) => el.classList.remove("is-geometry-changing")); } catch (_e) {}
    };
    const scheduleFlush = (delay) => {
      if (delay) {
        window.clearTimeout(this._pdfResizeTimer);
        this._pdfResizeTimer = window.setTimeout(() => {
          this._pdfResizeTimer = 0;
          if (!this._pdfRaf) this._pdfRaf = window.requestAnimationFrame(flush);
        }, delay);
      } else if (this._pdfPending.size && !this._pdfRaf) this._pdfRaf = window.requestAnimationFrame(flush);
    };
    if (typeof ResizeObserver !== "undefined") {
      this._pdfResizeObserver = new ResizeObserver((entries) => {
        try {
          for (const ent of entries) {
            const t = ent && ent.target;
            const layer = t && (t.classList?.contains("textLayer") ? t : t.querySelector?.(".textLayer"));
            if (layer) this.markPdfGeometryChanging(layer);
          }
        } catch (_e) {}
        if (this._pdfPending.size) scheduleFlush(220);
      });
    }
    this._pdfObserver = new MutationObserver((muts) => {
      let geometryChanged = false;
      try {
        for (const mu of muts) {
          if (mu.type === "attributes") {
            const target = mu.target;
            if (!(target instanceof Element) || !target.matches(".page, .textLayer, .canvasWrapper, canvas")) continue;
            if (!target.closest(".page")) continue;
            const page = target.classList.contains("page") ? target : target.closest(".page");
            const layer = target.classList.contains("textLayer") ? target : page?.querySelector(":scope > .textLayer");
            if (layer) { this.markPdfGeometryChanging(layer); geometryChanged = true; }
            continue;
          }
          for (const node of mu.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.classList.contains("lexis-hl") || node.closest(".lexis-hl")) continue;
            if (node.classList.contains("textLayer")) { this.markPdfGeometryChanging(node); geometryChanged = true; }
            else node.querySelectorAll(".textLayer").forEach((l) => { this.markPdfGeometryChanging(l); geometryChanged = true; });
            const layer = node.closest(".textLayer");
            if (layer) { this.markPdfGeometryChanging(layer); geometryChanged = true; }
          }
        }
      } catch (_e) {}
      if (geometryChanged) scheduleFlush(220);
    });
    this._pdfObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    // 首次:扫描已经打开的 PDF
    try { document.querySelectorAll(".textLayer").forEach((l) => this.scanPdfLayer(l)); } catch (_e) {}
  }
  observePdfLayer(layer) {
    if (!this._pdfResizeObserver || !layer || this._pdfObservedLayers?.has(layer)) return;
    try {
      this._pdfObservedLayers.add(layer);
      this._pdfResizeObserver.observe(layer);
      if (layer.parentElement) this._pdfResizeObserver.observe(layer.parentElement);
    } catch (_e) {}
  }
  markPdfGeometryChanging(layer) {
    if (!layer?.isConnected) return;
    this._pdfPending?.add(layer);
    try { layer.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.add("is-geometry-changing"); } catch (_e) {}
  }
  scanPdfLayer(layer) {
    if (!this.settings.enablePdfHighlight || !this.settings.enableHighlight) return;
    this.observePdfLayer(layer);
    // 1. PDF 专属跨片段匹配先抢占长词，再用通用匹配器补单节点命中。
    this.wrapPdfFragmentMatches(layer);
    // 2. 在 textLayer 里注入隐形 .lexis-hl(仅事件代理,无视觉样式)
    this.wrapMatchesInElement(layer, ".lexis-hl,.lexis-popover", { pdf: true });
    // 3. 建独立高亮 overlay,叠在 Canvas 上、textLayer 下(不沾 textLayer 的 opacity)
    const page = layer.parentElement;
    // pdf.js 的 canvas 实际包在 .canvasWrapper 里,插到 canvas 后面会落进那层容器,
    // 定位/裁切都跟着 canvasWrapper 走,容易跟 textLayer 对不齐——直接挂在 .page 下、textLayer 前面最稳。
    if (getComputedStyle(page).position === "static") page.setCssStyles({ position: "relative" });
    let hl = page.querySelector(":scope > .lexis-pdf-hl-layer");
    if (!hl) {
      hl = document.createElement("div");
      hl.className = "lexis-pdf-hl-layer";
      layer.insertAdjacentElement("beforebegin", hl);
    }
    const hlBB = layer.getBoundingClientRect();
    const layerW = layer.offsetWidth || layer.clientWidth || hlBB.width || 1;
    const layerH = layer.offsetHeight || layer.clientHeight || hlBB.height || 1;
    const scaleX = hlBB.width ? hlBB.width / layerW : 1;
    const scaleY = hlBB.height ? hlBB.height / layerH : 1;
    hl.setCssStyles({
      position: "absolute",
      left: `${layer.offsetLeft}px`,
      top: `${layer.offsetTop}px`,
      width: `${layerW}px`,
      height: `${layerH}px`,
      zIndex: "1",
      pointerEvents: "none",
    });
    hl.empty();
    // 4. 遍历内联 .lexis-hl,在 overlay 层画出对应荧光笔矩形
    const spans = layer.querySelectorAll(".lexis-hl") as NodeListOf<HTMLElement>;
    for (const s of spans) {
      const key = s.dataset.lexisKey;
      if (!key) continue;
      const entry = this.index.get(key);
      if (!entry) continue;
      if (entry.archived || !this.highlightVisibleForEntry(entry)) continue; // 保留 hover 代理，只不画可视高亮
      try {
        const color = this.colorForEntry(entry);
        const alpha = Math.max(0.04, Math.min(0.75, this.highlightAlphaForEntry(entry) * 0.65));
        const rects = (Array.from(s.getClientRects()) as DOMRect[]).filter((r) => r.width && r.height);
        for (const rect of rects.length ? rects : [s.getBoundingClientRect()]) {
          const d = document.createElement("div");
          d.className = "lexis-pdf-hl";
          d.dataset.lexisKey = key;
          d.setCssStyles({
            position: "absolute",
            left: `${(rect.left - hlBB.left) / scaleX}px`,
            top: `${(rect.top - hlBB.top) / scaleY}px`,
            width: `${rect.width / scaleX}px`,
            height: `${rect.height / scaleY}px`,
            background: this.applyAlpha(color, alpha),
            borderRadius: "2px",
            pointerEvents: "auto",
          });
          hl.appendChild(d);
        }
      } catch (_e) {}
    }
  }
  teardownPdfHighlight() {
    if (this._pdfObserver) { this._pdfObserver.disconnect(); this._pdfObserver = null; }
    if (this._pdfRaf) { window.cancelAnimationFrame(this._pdfRaf); this._pdfRaf = 0; }
    if (this._pdfResizeObserver) { try { this._pdfResizeObserver.disconnect(); } catch (_e) {} this._pdfResizeObserver = null; }
    if (this._pdfResizeTimer) { window.clearTimeout(this._pdfResizeTimer); this._pdfResizeTimer = 0; }
    this._pdfObservedLayers = null;
    try { document.querySelectorAll(".lexis-pdf-hl-layer").forEach((l) => l.remove()); } catch (_e) {}
    try {
      document.querySelectorAll(".textLayer .lexis-hl").forEach((s) => {
        const t = document.createTextNode(s.textContent || "");
        s.parentNode && s.parentNode.replaceChild(t, s);
      });
    } catch (_e) {}
  }
  // 词库/配色变化后,清掉 PDF 里旧高亮再重扫(.lexis-hl 拆回纯文本)
  rescanPdfLayers() {
    try {
      document.querySelectorAll(".textLayer .lexis-hl").forEach((s) => {
        const t = document.createTextNode(s.textContent || "");
        s.parentNode && s.parentNode.replaceChild(t, s);
      });
      document.querySelectorAll(".lexis-pdf-hl-layer").forEach((l) => l.remove());
      document.querySelectorAll(".textLayer").forEach((l) => { l.normalize(); this.scanPdfLayer(l); });
    } catch (_e) {}
  }

  // ---------- 第三方 EPUB 阅读器高亮 ----------
  // EPUB Marginalia 与 ePub Reader 都用 epub.js,章节放在同源 iframe 中。
  // 主文档的事件/TreeWalker 无法穿透 iframe,所以只对 epub.js 的 iframe 单独注入。
  isEpubIframe(frame) {
    return !!(frame && frame.tagName === "IFRAME" && (
      frame.hasAttribute("enable-annotation") ||
      frame.matches?.(".epub-reader-area iframe, .epub-container iframe, .epub-view iframe") ||
      frame.closest?.(".epub-reader-area, .epub-container, .epub-view")
    ));
  }
  setupEpubIframeHighlight() {
    this.teardownEpubIframeHighlight();
    this._epubIframeFrames = new WeakSet();
    this._epubIframeDocs = new Map();
    this._epubIframeObserver = new MutationObserver((muts) => {
      for (const mu of muts) for (const node of mu.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (this.isEpubIframe(node)) this.observeEpubIframe(node);
        node.querySelectorAll?.("iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe").forEach((frame) => this.observeEpubIframe(frame));
      }
    });
    this._epubIframeObserver.observe(document.body, { childList: true, subtree: true });
    this.rescanEpubIframes();
  }
  observeEpubIframe(frame) {
    if (!this.isEpubIframe(frame)) return;
    if (!this._epubIframeFrames.has(frame)) {
      this._epubIframeFrames.add(frame);
      frame.addEventListener("load", () => this.scanEpubIframe(frame));
    }
    this.scanEpubIframe(frame);
  }
  scanEpubIframe(frame) {
    if (!this.settings.enableHighlight || !this.isEpubIframe(frame)) return;
    let doc;
    try { doc = frame.contentDocument; } catch (_e) { return; }
    if (!doc?.body) return;
    // 插件重载/配色变化后 iframe 可能还留着旧 span；先拆回文本再按当前索引与实际颜色重建。
    doc.querySelectorAll(".lexis-hl").forEach((span) => {
      const textNode = doc.createTextNode(span.textContent || "");
      span.parentNode?.replaceChild(textNode, span);
    });
    doc.body.normalize();
    this.wrapMatchesInElement(doc.body, "script,style,code,pre,.lexis-hl,.lexis-popover", { external: true });
    if (this._epubIframeDocs.has(doc)) return;
    const over = (e) => this.onMouseOver(e);
    const out = (e) => this.onMouseOut(e);
    const click = (e) => this.onClick(e);
    const mouseup = (e) => this.maybeShowSelPill(e, true);
    doc.addEventListener("mouseover", over);
    doc.addEventListener("mouseout", out);
    doc.addEventListener("click", click);
    doc.addEventListener("mouseup", mouseup);
    this._epubIframeDocs.set(doc, { over, out, click, mouseup });
  }
  rescanEpubIframes() {
    try { document.querySelectorAll("iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe").forEach((frame) => this.observeEpubIframe(frame)); } catch (_e) {}
  }
  teardownEpubIframeHighlight() {
    if (this._epubIframeObserver) { this._epubIframeObserver.disconnect(); this._epubIframeObserver = null; }
    if (this._epubIframeDocs) {
      for (const [doc, hooks] of this._epubIframeDocs) {
        try { doc.removeEventListener("mouseover", hooks.over); doc.removeEventListener("mouseout", hooks.out); doc.removeEventListener("click", hooks.click); doc.removeEventListener("mouseup", hooks.mouseup); } catch (_e) {}
      }
    }
    this._epubIframeDocs = null;
    this._epubIframeFrames = null;
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
          } catch (_error) {}
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
