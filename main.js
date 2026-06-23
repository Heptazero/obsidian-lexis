"use strict";

/*
 * Lexis —— 自建单词学习插件(纯 JS,无构建,改了不被商店更新覆盖)
 * Stage 0~2:文件夹→单词索引、阅读+实时预览高亮、悬浮卡(笔记结构 + 相关词 + 出现过的地方)。
 * Stage 3:FSRS 翻卡背单词,进度写进笔记 frontmatter。
 * 详细路线图见 LOG.md。
 */

const obsidian = require("obsidian");
const { Plugin, PluginSettingTab, Setting, Notice, TFolder, TFile, Component, MarkdownRenderer, ItemView } = obsidian;

const LEXIS_REVIEW_VIEW = "lexis-review-view";
const LEXIS_HOME_VIEW = "lexis-home-view";

const DEFAULT_SETTINGS = {
  vocabFolder: "01-word",
  includeAliases: true,
  enableHighlight: true,
  enableLivePreview: true,
  highlightStyle: "wavy",
  highlightColor: "",
  highlightOpacity: 1,
  tagRules: [],
  showRelated: true,
  showOccurrences: true,
  occurrenceLimit: 6,
  occurrenceFolders: "",
  // Stage 3 (FSRS)
  requestRetention: 0.9,
  newPerDay: 20,
  maxReviewsPerSession: 200,
  reviewLog: {}, // { "YYYY-MM-DD": count } 供热力图(Stage 5)
  // Stage 4
  newWordTemplate: "template/单词模板.md",
  // 卡片正面:note=单词→整篇;cloze=例句填空
  cardFront: "note",
};

// ---------- 小工具 ----------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const round2 = (x) => Math.round(x * 100) / 100;
function cssColorToHex(c) {
  if (!c) return "#888888";
  if (/^#[0-9a-fA-F]{6}$/.test(c.trim())) return c.trim();
  const tmp = document.createElement("div");
  tmp.style.color = c; document.body.appendChild(tmp);
  const rgb = getComputedStyle(tmp).color; tmp.remove();
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return "#888888";
  return "#" + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, "0")).join("");
}
function fmtDate(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function todayStr() { return fmtDate(new Date()); }
function parseDate(s) { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function addDaysStr(baseStr, days) { const d = baseStr ? parseDate(baseStr) : new Date(); d.setDate(d.getDate() + days); return fmtDate(d); }
function daysBetween(aStr, bStr) { return Math.max(0, Math.round((parseDate(bStr) - parseDate(aStr)) / 86400000)); }

// ---------- FSRS ----------
const FSRS_W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const FSRS_DECAY = -0.5;
const FSRS_FACTOR = Math.pow(0.9, 1 / FSRS_DECAY) - 1;
const MAX_IVL = 36500;
const FSRS = {
  clampD: (d) => Math.min(10, Math.max(1, d)),
  initStability: (g) => Math.max(0.1, FSRS_W[g - 1]),
  initDifficulty: (g) => FSRS.clampD(FSRS_W[4] - Math.exp(FSRS_W[5] * (g - 1)) + 1),
  linearDamping: (delta, d) => (delta * (10 - d)) / 9,
  meanReversion: (init, cur) => FSRS_W[7] * init + (1 - FSRS_W[7]) * cur,
  nextDifficulty(d, g) { const delta = -FSRS_W[6] * (g - 3); const dd = d + FSRS.linearDamping(delta, d); return FSRS.clampD(FSRS.meanReversion(FSRS.initDifficulty(4), dd)); },
  retrievability(t, s) { return Math.pow(1 + FSRS_FACTOR * t / s, FSRS_DECAY); },
  nextRecallStability(d, s, r, g) { const hard = g === 2 ? FSRS_W[15] : 1; const easy = g === 4 ? FSRS_W[16] : 1; return s * (1 + Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9]) * (Math.exp((1 - r) * FSRS_W[10]) - 1) * hard * easy); },
  nextForgetStability(d, s, r) { return FSRS_W[11] * Math.pow(d, -FSRS_W[12]) * (Math.pow(s + 1, FSRS_W[13]) - 1) * Math.exp((1 - r) * FSRS_W[14]); },
  nextInterval(s, R) { const ivl = (s / FSRS_FACTOR) * (Math.pow(R, 1 / FSRS_DECAY) - 1); return Math.min(MAX_IVL, Math.max(1, Math.round(ivl))); },
};

module.exports = class LexisPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.index = new Map();
    this.stats = { words: 0, aliases: 0, due: 0 };
    this._pattern = null;
    this._rebuildTimer = null;
    this._popover = null;
    this._popoverComp = null;
    this._hideTimer = null;
    this._occCache = new Map();
    this.liveAvailable = false;

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.style.cursor = "pointer";
    this.statusBarEl.setAttribute("aria-label", "Lexis:点击重建索引(图标右键可开始背单词)");
    this.registerDomEvent(this.statusBarEl, "click", () => this.rebuildIndex(true));

    this.addCommand({ id: "rebuild-index", name: "重建单词索引", callback: () => this.rebuildIndex(true) });
    this.addCommand({ id: "open-review", name: "开始背单词", callback: () => this.openReview() });
    this.addCommand({ id: "add-selected-word", name: "把选中的词加为单词", callback: () => this.addSelectedWordCommand() });
    this.addCommand({ id: "open-home", name: "打开 Lexis 主页", callback: () => this.openHome() });
    this.addRibbonIcon("graduation-cap", "Lexis 主页", () => this.openHome());
    this.addRibbonIcon("brain", "Lexis 背单词", () => this.openReview());

    this.registerView(LEXIS_REVIEW_VIEW, (leaf) => new LexisReviewView(leaf, this));
    this.registerView(LEXIS_HOME_VIEW, (leaf) => new LexisHomeView(leaf, this));

    this.addSettingTab(new LexisSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((el, ctx) => this.highlightElement(el, ctx));
    this.registerMarkdownCodeBlockProcessor("lexis", (src, el, ctx) => this.renderLexisBlock(el, ctx, src));
    this.registerMarkdownCodeBlockProcessor("lexis-heatmap", (src, el) => this.renderHeatmap(el));
    this.setupLiveExtension();

    this.registerDomEvent(document, "mouseover", (e) => this.onMouseOver(e));
    this.registerDomEvent(document, "click", (e) => this.onClick(e));
    this.registerDomEvent(window, "scroll", (e) => { if (this._popover && e.target instanceof Node && this._popover.contains(e.target)) return; this.removePopover(); }, { capture: true });

    this.app.workspace.onLayoutReady(() => this.rebuildIndex(false));
    this.registerEvent(this.app.vault.on("create", (f) => this.maybeRebuild(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => this.maybeRebuild(f)));
    this.registerEvent(this.app.vault.on("rename", (f, old) => this.maybeRebuild(f, old)));
    this.registerEvent(this.app.vault.on("modify", () => this._occCache.clear()));

    // 划词添加(右键菜单)
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
      const sel = (editor.getSelection() || "").trim();
      if (!sel || sel.length > 60) return;
      menu.addItem((item) => item
        .setTitle(`Lexis:添加到单词库 “${sel.length > 16 ? sel.slice(0, 16) + "…" : sel}”`)
        .setIcon("book-plus")
        .onClick(() => this.addWordFromSelection(sel, editor, view)));
    }));
  }

  onunload() {
    window.clearTimeout(this._rebuildTimer);
    window.clearTimeout(this._hideTimer);
    this.removePopover();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if ((!this.settings.tagRules || !this.settings.tagRules.length) && this.settings.tagRulesText) {
      this.settings.tagRules = this.parseTagRulesText(this.settings.tagRulesText);
      delete this.settings.tagRulesText;
      await this.saveData(this.settings);
    }
    if (!Array.isArray(this.settings.tagRules)) this.settings.tagRules = [];
    if (!this.settings.reviewLog) this.settings.reviewLog = {};
  }
  async saveSettings() { await this.saveData(this.settings); }
  parseTagRulesText(text) {
    const rules = [];
    for (const line of (text || "").split("\n")) {
      const m = /^\s*#?([^:：]+)[:：]\s*(\S+)(?:\s+(wavy|underline|background))?\s*$/.exec(line);
      if (m) rules.push({ tag: m[1].trim(), color: m[2].trim(), style: m[3] || "" });
    }
    return rules;
  }

  // ---------- 索引 ----------
  normalizeFolder(p) { return (p || "").trim().replace(/^\/+|\/+$/g, ""); }
  inVocabFolder(path) {
    const folder = this.normalizeFolder(this.settings.vocabFolder);
    if (!folder) return false;
    return path === folder || path.startsWith(folder + "/");
  }
  maybeRebuild(file, oldPath) {
    const p = (file && file.path) || "";
    this._occCache.clear();
    if (this.inVocabFolder(p) || (oldPath && this.inVocabFolder(oldPath))) this.scheduleRebuild();
  }
  scheduleRebuild() {
    window.clearTimeout(this._rebuildTimer);
    this._rebuildTimer = window.setTimeout(() => this.rebuildIndex(false), 800);
  }
  extractAliases(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm) return [];
    let raw = fm.aliases ?? fm.alias ?? [];
    if (typeof raw === "string") raw = raw.split(/[,，;；]/);
    if (!Array.isArray(raw)) raw = [raw];
    return raw.map((x) => String(x).trim()).filter((x) => x && x.toLowerCase() !== "null");
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
  rebuildIndex(notify) {
    const folder = this.normalizeFolder(this.settings.vocabFolder);
    const index = new Map();
    const today = todayStr();
    let words = 0, aliases = 0, due = 0;
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path));
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter || {};
      const tags = this.getTags(file);
      const display = file.basename;
      const key = display.toLowerCase();
      if (!index.has(key)) { index.set(key, { display, file, isAlias: false, tags }); words++; }
      if (this.settings.includeAliases) {
        for (const a of this.extractAliases(file)) {
          const ak = a.toLowerCase();
          if (!index.has(ak)) { index.set(ak, { display: a, file, isAlias: true, tags }); aliases++; }
        }
      }
      if (fm["lexis-s"] == null || !fm["lexis-due"] || String(fm["lexis-due"]).slice(0, 10) <= today) due++;
    }
    this.index = index;
    this.stats = { words, aliases, due };
    this._occCache.clear();
    this.buildMatcher();
    this.updateStatusBar();
    this.refreshAllViews();
    if (notify) {
      const aliasPart = this.settings.includeAliases ? `(含 ${aliases} 个别名)` : "";
      new Notice(`Lexis:从「${folder || "/"}」识别到 ${words} 个单词${aliasPart}`);
    }
    return this.stats;
  }
  buildMatcher() {
    const keys = [...this.index.keys()].filter((k) => k.length >= 2);
    keys.sort((a, b) => b.length - a.length);
    if (!keys.length) { this._pattern = null; return; }
    this._pattern = "\\b(?:" + keys.map(escapeRe).join("|") + ")\\b";
  }
  updateStatusBar() {
    if (!this.statusBarEl) return;
    const aliasPart = this.settings.includeAliases && this.stats.aliases ? ` +${this.stats.aliases}别名` : "";
    const duePart = this.stats.due ? ` · ⏰${this.stats.due}` : "";
    this.statusBarEl.setText(`📕 ${this.stats.words} 词${aliasPart}${duePart}`);
  }

  // ---------- 着色 ----------
  applyAlpha(color, alpha) {
    if (alpha == null || alpha >= 1) return color;
    const pct = Math.max(0, Math.min(100, Math.round(alpha * 100)));
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
  }
  inlineStyleForEntry(entry) {
    let color = this.settings.highlightColor || "var(--text-accent)";
    let styleKind = this.settings.highlightStyle || "wavy";
    if (entry?.tags && this.settings.tagRules?.length) {
      const rule = this.settings.tagRules.find((r) => r.tag && entry.tags.has(r.tag.toLowerCase()));
      if (rule) { if (rule.color) color = rule.color; if (rule.style) styleKind = rule.style; }
    }
    const c = this.applyAlpha(color, this.settings.highlightOpacity);
    if (styleKind === "background") return `background-color:${c};border-radius:3px;padding:0 1px;text-decoration:none;`;
    const line = styleKind === "underline" ? "solid" : "wavy";
    return `text-decoration:underline ${line} ${c};text-underline-offset:3px;`;
  }
  refreshAllViews() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const pm = leaf?.view?.previewMode;
      if (pm && typeof pm.rerender === "function") pm.rerender(true);
    });
    if (this.liveAvailable) this.app.workspace.updateOptions();
  }

  // ---------- 阅读模式高亮 ----------
  highlightElement(el, ctx) {
    if (!this.settings.enableHighlight || !this._pattern || !this.index.size) return;
    if (el.closest && el.closest(".lexis-popover")) return;
    if (ctx && ctx.sourcePath && this.inVocabFolder(ctx.sourcePath)) return;
    const regex = new RegExp(this._pattern, "gi");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || p.closest("code,pre,a,.lexis-hl,.lexis-popover,.math,.tag")) return NodeFilter.FILTER_REJECT;
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
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = regex.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const entry = this.index.get(m[0].toLowerCase());
        const span = document.createElement("span");
        span.className = "lexis-hl";
        span.textContent = m[0];
        span.dataset.lexisKey = m[0].toLowerCase();
        span.setAttribute("style", this.inlineStyleForEntry(entry));
        frag.appendChild(span);
        last = m.index + m[0].length;
        if (m[0].length === 0) regex.lastIndex++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  // ---------- 实时预览高亮 ----------
  setupLiveExtension() {
    try {
      const { ViewPlugin, Decoration } = require("@codemirror/view");
      const { RangeSetBuilder } = require("@codemirror/state");
      const editorInfoField = obsidian.editorInfoField;
      const plugin = this;
      const ext = ViewPlugin.fromClass(
        class {
          constructor(view) { this.decorations = this.build(view); }
          update(u) { if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view); }
          build(view) {
            const builder = new RangeSetBuilder();
            if (!plugin.settings.enableHighlight || !plugin.settings.enableLivePreview || !plugin._pattern) return builder.finish();
            if (editorInfoField) {
              try { const info = view.state.field(editorInfoField, false); if (info?.file?.path && plugin.inVocabFolder(info.file.path)) return builder.finish(); } catch (_e) {}
            }
            const regex = new RegExp(plugin._pattern, "gi");
            for (const { from, to } of view.visibleRanges) {
              const text = view.state.doc.sliceString(from, to);
              regex.lastIndex = 0;
              let m;
              while ((m = regex.exec(text))) {
                const start = from + m.index, end = start + m[0].length;
                const entry = plugin.index.get(m[0].toLowerCase());
                builder.add(start, end, Decoration.mark({ class: "lexis-hl", attributes: { "data-lexis-key": m[0].toLowerCase(), style: plugin.inlineStyleForEntry(entry) } }));
                if (m[0].length === 0) regex.lastIndex++;
              }
            }
            return builder.finish();
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

  // ---------- 出处 & 相关词 ----------
  parseFolders(text) { return (text || "").split(/[,，]/).map((s) => this.normalizeFolder(s)).filter(Boolean); }
  inScope(path, scope) { if (!scope.length) return true; return scope.some((f) => path === f || path.startsWith(f + "/")); }
  extractSentence(content, idx) {
    const bound = /[.!?。！？\n]/;
    let s = idx; while (s > 0 && !bound.test(content[s - 1])) s--;
    let e = idx; while (e < content.length && !bound.test(content[e])) e++;
    let sent = content.slice(s, e + 1).replace(/\s+/g, " ").trim();
    if (sent.length > 220) sent = sent.slice(0, 220) + "…";
    return sent;
  }
  async findOccurrences(word) {
    const key = word.toLowerCase();
    if (this._occCache.has(key)) return this._occCache.get(key);
    const limit = this.settings.occurrenceLimit || 6;
    const re = new RegExp("\\b" + escapeRe(word) + "\\b", "i");
    const scope = this.parseFolders(this.settings.occurrenceFolders);
    const files = this.app.vault.getMarkdownFiles().filter((f) => !this.inVocabFolder(f.path) && this.inScope(f.path, scope));
    const results = [];
    for (const f of files) {
      if (results.length >= limit) break;
      let content;
      try { content = await this.app.vault.cachedRead(f); } catch (_e) { continue; }
      const idx = content.search(re);
      if (idx < 0) continue;
      results.push({ file: f, sentence: this.extractSentence(content, idx) });
    }
    this._occCache.set(key, results);
    return results;
  }
  findRelated(file) {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const set = new Set();
    for (const src in resolved) { if (resolved[src][file.path] && this.inVocabFolder(src) && src !== file.path) set.add(src); }
    const out = resolved[file.path] || {};
    for (const dest in out) { if (this.inVocabFolder(dest) && dest !== file.path) set.add(dest); }
    return [...set].map((p) => this.app.vault.getAbstractFileByPath(p)).filter(Boolean);
  }
  parseSectionLinks(raw, known) {
    const clean = raw.replace(/```[\s\S]*?```/g, "").replace(/^---\n[\s\S]*?\n---/, "");
    const out = [];
    let cur = "相关";
    const linkRe = /\[\[([^\]|#\n]+)(?:\|[^\]\n]*)?\]\]/g;
    for (const line of clean.split("\n")) {
      const h = /^#{1,6}\s*(.+?)\s*$/.exec(line);
      if (h) { cur = known.find((t) => h[1].includes(t)) || "相关"; continue; }
      let m; linkRe.lastIndex = 0;
      while ((m = linkRe.exec(line))) out.push({ type: cur, target: m[1].trim() });
    }
    return out;
  }
  async findTypedRelations(file) {
    const KNOWN = ["近义词", "同根词", "形近词", "辨析"];
    const out = {}, inc = {};
    const put = (bag, type, tf) => { if (!tf || tf.path === file.path) return; (bag[type] = bag[type] || new Map()).set(tf.path, tf.basename); };
    // 出链:本词笔记里每个 [[link]] 在哪个段下
    try {
      const raw = await this.app.vault.cachedRead(file);
      for (const { type, target } of this.parseSectionLinks(raw, KNOWN)) {
        const tf = this.app.metadataCache.getFirstLinkpathDest(target, file.path);
        if (tf && this.inVocabFolder(tf.path)) put(out, type, tf);
      }
    } catch (_e) {}
    // 入链:其它词在哪个段下链了本词(实现双向)
    const resolved = this.app.metadataCache.resolvedLinks || {};
    for (const src in resolved) {
      if (!this.inVocabFolder(src) || src === file.path || !resolved[src][file.path]) continue;
      const srcFile = this.app.vault.getAbstractFileByPath(src);
      if (!srcFile) continue;
      try {
        const raw = await this.app.vault.cachedRead(srcFile);
        let matched = false;
        for (const { type, target } of this.parseSectionLinks(raw, KNOWN)) {
          const tf = this.app.metadataCache.getFirstLinkpathDest(target, src);
          if (tf && tf.path === file.path) { put(inc, type, srcFile); matched = true; }
        }
        if (!matched) put(inc, "相关", srcFile);
      } catch (_e) {}
    }
    const toArr = (bag) => { const o = {}; for (const t in bag) o[t] = [...bag[t].entries()].map(([path, basename]) => ({ path, basename })); return o; };
    return { out: toArr(out), inc: toArr(inc) };
  }
  async renderDerivedWords(container, file) {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const map = new Map();
    for (const src in resolved) {
      if (this.inVocabFolder(src) && resolved[src] && resolved[src][file.path]) {
        const sf = this.app.vault.getAbstractFileByPath(src);
        if (sf) map.set(src, sf.basename);
      }
    }
    container.createDiv({ cls: "lexis-section-title", text: `🌱 派生词 (${map.size})` });
    if (!map.size) { container.createDiv({ cls: "lexis-occ", text: "(还没有单词链到这个词根)" }); return; }
    const w = container.createDiv({ cls: "lexis-related" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
  }
  relLink(w, path, basename) {
    const a = w.createEl("a", { text: basename, href: "#" });
    a.addEventListener("click", (e) => { e.preventDefault(); const f = this.app.vault.getAbstractFileByPath(path); if (f) { this.app.workspace.getLeaf(false).openFile(f); this.removePopover(); } });
  }
  async renderTypedRelations(container, file) {
    const { out, inc } = await this.findTypedRelations(file);
    const order = ["近义词", "同根词", "形近词", "辨析", "相关"];
    let n = 0;
    for (const t of order) {
      const map = new Map();
      for (const r of (out[t] || [])) map.set(r.path, r.basename);
      for (const r of (inc[t] || [])) map.set(r.path, r.basename);
      if (!map.size) continue;
      container.createDiv({ cls: "lexis-section-title", text: "🔗 " + t });
      const w = container.createDiv({ cls: "lexis-related" });
      for (const [path, basename] of map) { this.relLink(w, path, basename); n++; }
    }
    return n;
  }
  async renderReverseRelations(container, file, type) {
    const { out, inc } = await this.findTypedRelations(file);
    const types = type === "辨析" ? ["辨析", "相关"] : [type];
    const outPaths = new Set();
    for (const t of types) for (const r of (out[t] || [])) outPaths.add(r.path);
    const map = new Map();
    for (const t of types) for (const r of (inc[t] || [])) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
    if (!map.size) return 0;
    const w = container.createDiv({ cls: "lexis-related lexis-rel-reverse" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
    return map.size;
  }
  async getCuratedSourcePaths(wordFile) {
    try {
      const raw = await this.app.vault.cachedRead(wordFile);
      const m = /####\s*例句([\s\S]*?)(?=\n#{1,6}\s|\n```|$)/.exec(raw);
      if (!m) return new Set();
      const set = new Set();
      const re = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
      let mm;
      while ((mm = re.exec(m[1]))) { const base = mm[1].trim().split("/").pop().replace(/\.md$/, ""); set.add(base.toLowerCase()); }
      return set;
    } catch (_e) { return new Set(); }
  }
  async addExampleToWord(wordFile, sentence, sourceFile) {
    if (sourceFile) {
      const curated = await this.getCuratedSourcePaths(wordFile);
      if (curated.has(sourceFile.basename.toLowerCase())) { new Notice("Lexis:这条已经在例句里了"); return true; }
    }
    const link = sourceFile ? ` —— [[${sourceFile.path}|${sourceFile.basename}]]` : "";
    const line = `> ${(sentence || "").trim()}${link}`;
    const apply = (data) => /####\s*例句/.test(data) ? data.replace(/(####\s*例句[^\n]*\n)/, `$1${line}\n`) : data.replace(/\s*$/, "") + `\n\n#### 例句\n${line}\n`;
    try {
      if (this.app.vault.process) await this.app.vault.process(wordFile, apply);
      else { const d = await this.app.vault.read(wordFile); await this.app.vault.modify(wordFile, apply(d)); }
      new Notice("Lexis:已收藏到例句");
      return true;
    } catch (err) { new Notice("Lexis 收藏失败:" + (err?.message || err)); return false; }
  }

  // ---------- FSRS 调度 ----------
  readCard(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    return { s: fm["lexis-s"], d: fm["lexis-d"], due: fm["lexis-due"], last: fm["lexis-last"], reps: fm["lexis-reps"], lapses: fm["lexis-lapses"] };
  }
  scheduleCard(card, grade) {
    const R = this.settings.requestRetention || 0.9;
    let reps = (Number(card.reps) || 0) + 1, lapses = Number(card.lapses) || 0, S, D;
    const today = todayStr();
    if (card.s == null || isNaN(Number(card.s))) {
      S = FSRS.initStability(grade); D = FSRS.initDifficulty(grade);
    } else {
      const t = card.last ? daysBetween(card.last, today) : 0;
      const r = FSRS.retrievability(t, Number(card.s));
      D = FSRS.nextDifficulty(Number(card.d), grade);
      if (grade === 1) { S = FSRS.nextForgetStability(Number(card.d), Number(card.s), r); lapses++; }
      else { S = FSRS.nextRecallStability(Number(card.d), Number(card.s), r, grade); }
    }
    S = Math.max(0.01, S);
    const interval = FSRS.nextInterval(S, R);
    return { s: S, d: D, reps, lapses, interval, due: addDaysStr(today, interval) };
  }
  async applySchedule(file, sched) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm["lexis-s"] = round2(sched.s);
      fm["lexis-d"] = round2(sched.d);
      fm["lexis-due"] = sched.due;
      fm["lexis-last"] = todayStr();
      fm["lexis-reps"] = sched.reps;
      fm["lexis-lapses"] = sched.lapses;
    });
  }
  async logReview() {
    const t = todayStr();
    this.settings.reviewLog[t] = (this.settings.reviewLog[t] || 0) + 1;
    await this.saveSettings();
  }
  async getFirstExample(file) {
    try {
      const raw = await this.app.vault.cachedRead(file);
      const m = /####\s*例句([\s\S]*?)(?=\n#{1,6}\s|\n```|$)/.exec(raw);
      if (!m) return "";
      const line = m[1].split("\n").map((s) => s.trim()).find((s) => s.startsWith(">"));
      if (!line) return "";
      return line.replace(/^>\s*/, "").replace(/\s*——\s*\[\[[^\]]*\]\].*$/, "").trim();
    } catch (_e) { return ""; }
  }
  buildCloze(sentence, word) { return sentence.replace(new RegExp("\\b" + escapeRe(word) + "\\b", "ig"), "______"); }
  humanInterval(days) {
    if (days < 1) return "<1天";
    if (days < 30) return days + "天";
    if (days < 365) return Math.round(days / 30) + "个月";
    return (days / 365).toFixed(1) + "年";
  }
  freqVal(file) { const fm = this.app.metadataCache.getFileCache(file)?.frontmatter; const n = parseInt(String(fm && fm.frequency).replace(/[^0-9]/g, ""), 10); return isNaN(n) ? Infinity : n; }
  collectVocabTags() { const s = new Set(); for (const f of this.app.vault.getMarkdownFiles()) { if (!this.inVocabFolder(f.path)) continue; for (const t of this.getTags(f)) s.add(t); } return [...s].sort(); }
  computeStats() {
    const today = todayStr();
    let total = 0, due = 0, fresh = 0;
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!this.inVocabFolder(f.path)) continue;
      total++;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
      if (fm["lexis-s"] == null) { fresh++; due++; }
      else if (!fm["lexis-due"] || String(fm["lexis-due"]).slice(0, 10) <= today) due++;
    }
    return { total, due, fresh };
  }
  buildQueue(options) {
    options = options || {};
    const today = todayStr();
    let files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path));
    if (options.tag) { const tl = options.tag.toLowerCase(); files = files.filter((f) => this.getTags(f).has(tl)); }
    const due = [], fresh = [];
    for (const f of files) { const card = this.readCard(f); if (card.s == null || isNaN(Number(card.s))) fresh.push({ file: f, card }); else if (!card.due || String(card.due).slice(0, 10) <= today) due.push({ file: f, card }); }
    let queue;
    if (options.order === "frequency") { queue = due.concat(fresh).sort((a, b) => this.freqVal(a.file) - this.freqVal(b.file)); }
    else if (options.order === "random") { queue = due.concat(fresh); for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; } }
    else { due.sort((a, b) => String(a.card.due || "").localeCompare(String(b.card.due || ""))); queue = due.concat(fresh.slice(0, this.settings.newPerDay || 20)); }
    return queue.slice(0, this.settings.maxReviewsPerSession || 200);
  }
  async openReview(options) {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_REVIEW_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf(true); await leaf.setViewState({ type: LEXIS_REVIEW_VIEW, active: true }); }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisReviewView) { leaf.view.options = options || {}; leaf.view.refresh(); }
  }
  async openHome() {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_HOME_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getRightLeaf(false); await leaf.setViewState({ type: LEXIS_HOME_VIEW, active: true }); }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisHomeView) leaf.view.render();
  }

  // ---------- 划词添加 ----------
  sanitizeName(name) { return (name || "").replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim(); }
  async ensureFolder(folder) {
    if (!folder) return;
    if (!this.app.vault.getAbstractFileByPath(folder)) { try { await this.app.vault.createFolder(folder); } catch (_e) {} }
  }
  async readTemplate() {
    const p = (this.settings.newWordTemplate || "").trim();
    if (!p) return null;
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f instanceof TFile) { try { return await this.app.vault.read(f); } catch (_e) {} }
    return null;
  }
  minimalSkeleton() { return "---\ntags:\n---\n\n#### 意思\n\n#### 词根\n\n"; }
  getSelectionSentence(editor) {
    try { const from = editor.getCursor("from"); const line = editor.getLine(from.line) || ""; return this.extractSentence(line, from.ch || 0); } catch (_e) { return ""; }
  }
  getReadingSentence() {
    try { const sel = window.getSelection(); if (!sel || !sel.anchorNode) return ""; const text = sel.anchorNode.textContent || ""; return this.extractSentence(text, sel.anchorOffset || 0); } catch (_e) { return ""; }
  }
  addSelectedWordCommand() {
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    let word = "", editor = null;
    if (view && view.editor && view.getMode && view.getMode() === "source") { word = (view.editor.getSelection() || "").trim(); editor = view.editor; }
    if (!word) { const sel = window.getSelection(); word = (sel ? sel.toString() : "").trim(); }
    if (!word) { new Notice("Lexis:请先选中一个词"); return; }
    this.addWordFromSelection(word, editor, view);
  }
  async addWordFromSelection(word, editor, view) {
    const clean = (word || "").trim();
    const fileName = this.sanitizeName(clean);
    if (!fileName) { new Notice("Lexis:无效的单词"); return; }
    const folder = this.normalizeFolder(this.settings.vocabFolder);
    const targetPath = (folder ? folder + "/" : "") + fileName + ".md";
    const existing = this.app.vault.getAbstractFileByPath(targetPath);
    const srcFile = (view && view.file) || this.app.workspace.getActiveFile();
    const sentence = editor ? this.getSelectionSentence(editor) : this.getReadingSentence();
    if (existing) {
      new Notice(`Lexis:「${fileName}」已存在,打开它`);
      this.app.workspace.getLeaf(false).openFile(existing);
      return;
    }
    try {
      await this.ensureFolder(folder);
      const tpl = await this.readTemplate();
      let content = (tpl != null ? tpl : this.minimalSkeleton()).replace(/\{\{word\}\}/g, clean).replace(/\{\{date\}\}/g, todayStr());
      // 出处写进正文(而不是 frontmatter 属性),好看且笔记里直接可见
      if (sentence || srcFile) {
        const link = srcFile ? ` —— [[${srcFile.path}|${srcFile.basename}]]` : "";
        content = content.replace(/\s*$/, "") + `\n\n#### 例句\n> ${sentence || ""}${link}\n`;
      }
      const file = await this.app.vault.create(targetPath, content);
      new Notice(`Lexis:已创建「${fileName}」`);
      await this.app.workspace.getLeaf(false).openFile(file);
      this.scheduleRebuild();
    } catch (err) { new Notice("Lexis 创建失败:" + (err?.message || err)); }
  }
  // 遗忘曲线 SVG(FSRS 衰减)
  buildCurveSVG(card) {
    const s = Number(card.s);
    if (!s || isNaN(s)) return null;
    const R = this.settings.requestRetention || 0.9;
    const ivl = FSRS.nextInterval(s, R);
    const maxT = Math.max(ivl * 1.6, 2);
    const W = 340, H = 96, pad = 6;
    const X = (t) => pad + (W - 2 * pad) * (t / maxT);
    const Y = (r) => pad + (H - 2 * pad) * (1 - r);
    let d = "";
    const N = 48;
    for (let i = 0; i <= N; i++) { const t = maxT * i / N; const r = FSRS.retrievability(t, s); d += (i ? " L" : "M") + X(t).toFixed(1) + " " + Y(r).toFixed(1); }
    const elapsed = card.last ? Math.min(daysBetween(card.last, todayStr()), maxT) : 0;
    const tx = X(elapsed), ry = Y(R), cy = Y(FSRS.retrievability(elapsed, s));
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">` +
      `<line x1="${pad}" y1="${ry.toFixed(1)}" x2="${W - pad}" y2="${ry.toFixed(1)}" stroke="var(--text-faint)" stroke-dasharray="3 3" stroke-width="1"/>` +
      `<path d="${d}" fill="none" stroke="var(--interactive-accent)" stroke-width="2"/>` +
      `<line x1="${tx.toFixed(1)}" y1="${pad}" x2="${tx.toFixed(1)}" y2="${H - pad}" stroke="var(--text-accent)" stroke-width="1"/>` +
      `<circle cx="${tx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="var(--text-accent)"/>` +
      `</svg>`;
  }
  // 笔记内 ```lexis 代码块:曲线 + 相关词 + 出现过的地方
  async renderLexisBlock(el, ctx, src) {
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof TFile)) { el.setText("Lexis:无法识别当前笔记"); return; }
    const word = file.basename;
    el.addClass("lexis-block");
    const parts = (src || "").trim().split(/\s+/).filter(Boolean);
    const m = (parts[0] || "").toLowerCase();
    const typeArg = parts.slice(1).join(" ");
    if (m === "derived" || m === "派生") { await this.renderDerivedWords(el, file); return; }
    const showCurve = m === "" || m === "curve" || m === "all";
    const showRelated = m === "" || m === "refs" || m === "ref" || m === "rel" || m === "related" || m === "all";
    const showOcc = (m === "" || m === "refs" || m === "ref" || m === "occ" || m === "all") && this.settings.showOccurrences;

    if (showCurve) {
      const card = this.readCard(file);
      const svg = this.buildCurveSVG(card);
      if (svg) {
        const due = card.due ? ` · 下次 ${String(card.due).slice(0, 10)}` : "";
        el.createDiv({ cls: "lexis-section-title", text: `🧠 记忆曲线(稳定度 ${round2(Number(card.s))} 天${due})` });
        el.createDiv({ cls: "lexis-curve" }).innerHTML = svg;
      } else el.createDiv({ cls: "lexis-section-title", text: "🧠 记忆曲线(还没复习过)" });
    }

    if (showRelated) {
      if ((m === "rel" || m === "related") && typeArg) await this.renderReverseRelations(el, file, typeArg);
      else await this.renderTypedRelations(el, file);
    }

    if (showOcc) {
      const det = el.createEl("details", { cls: "lexis-occ-details" });
      const sum = det.createEl("summary", { text: "📍 出现过的地方 …" });
      const occWrap = det.createDiv();
      const curated = await this.getCuratedSourcePaths(file);
      const list = (await this.findOccurrences(word)).filter((o) => !curated.has(o.file.basename.toLowerCase()));
      sum.setText(`📍 出现过的地方 (${list.length})`);
      if (!list.length) occWrap.createDiv({ cls: "lexis-occ", text: "(没有未收藏的新出处)" });
      else for (const o of list) {
        const dd = occWrap.createDiv({ cls: "lexis-occ" });
        this.renderSentence(dd, o.sentence, word);
        const add = dd.createSpan({ cls: "lexis-occ-add", text: " ➕" });
        add.setAttribute("title", "收藏到例句");
        add.addEventListener("click", async () => {
          if (add.dataset.done) return;
          add.dataset.done = "1";
          if (await this.addExampleToWord(file, o.sentence, o.file)) { add.setText(" ✓"); add.style.cursor = "default"; add.removeAttribute("title"); } else delete add.dataset.done;
        });
        const s2 = dd.createSpan({ cls: "lexis-occ-src", text: " ↗ " + o.file.basename });
        s2.addEventListener("click", () => this.openOccurrence(o.file, word));
      }
    }
  }

  // ---------- 悬浮卡 ----------
  onMouseOver(e) { const t = e.target; if (t && t.classList && t.classList.contains("lexis-hl")) this.showPopover(t); }
  onClick(e) {
    const t = e.target;
    if (t && t.classList && t.classList.contains("lexis-hl")) {
      const entry = this.index.get(t.dataset.lexisKey);
      if (entry) { e.preventDefault(); this.app.workspace.getLeaf(e.ctrlKey || e.metaKey ? "tab" : false).openFile(entry.file); this.removePopover(); }
    } else if (this._popover && !this._popover.contains(t)) this.removePopover();
  }
  scheduleHide() { window.clearTimeout(this._hideTimer); this._hideTimer = window.setTimeout(() => this.removePopover(), 220); }
  removePopover() {
    if (this._popoverComp) { this._popoverComp.unload(); this._popoverComp = null; }
    if (this._popover) { this._popover.remove(); this._popover = null; }
  }
  openAndClose(file) { this.app.workspace.getLeaf(false).openFile(file); this.removePopover(); }
  async openOccurrence(file, word) {
    let leaf = this._occLeaf;
    if (!leaf || !leaf.parent) { leaf = this.app.workspace.getLeaf("tab"); this._occLeaf = leaf; }
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
    try {
      const ed = leaf.view && leaf.view.editor;
      if (ed && word) {
        const m = new RegExp("\\b" + escapeRe(word) + "\\b", "i").exec(ed.getValue());
        if (m) { const pos = ed.offsetToPos(m.index); ed.setCursor(pos); ed.scrollIntoView({ from: pos, to: ed.offsetToPos(m.index + word.length) }, true); }
      }
    } catch (_e) {}
    this.removePopover();
  }
  renderHeatmap(el) {
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
        else { const c = Number(log[ds]) || 0; total += c; if (c > 0) { cell.addClass("lexis-hm-l" + Math.min(4, Math.ceil((c / max) * 4))); cell.setAttribute("title", ds + ":" + c + " 次"); } else cell.setAttribute("title", ds + ":0"); }
        cur.setDate(cur.getDate() + 1);
      }
    }
    el.createDiv({ cls: "lexis-hm-caption", text: `近 ${weeks} 周 · 共 ${total} 次复习` });
  }
  renderSentence(el, sentence, word) {
    const re = new RegExp("(" + escapeRe(word) + ")", "ig");
    let last = 0, m; re.lastIndex = 0;
    while ((m = re.exec(sentence))) {
      if (m.index > last) el.appendChild(document.createTextNode(sentence.slice(last, m.index)));
      el.createEl("b", { text: m[0] });
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < sentence.length) el.appendChild(document.createTextNode(sentence.slice(last)));
  }
  compactSections(md) { return md.replace(/^#{2,6}[ \t].*\n(?:[ \t]*\n)*(?=#{1,6}[ \t]|$)/gm, "").trim(); }
  stripForPreview(content) {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```lexis[\s\S]*?```/g, "").trim();
  }
  async renderNoteInto(el, file, comp) {
    const raw = await this.app.vault.cachedRead(file);
    const md = this.compactSections(this.stripForPreview(raw)) || "*(空)*";
    el.empty();
    if (MarkdownRenderer.render) await MarkdownRenderer.render(this.app, md, el, file.path, comp);
    else await MarkdownRenderer.renderMarkdown(md, el, file.path, comp);
  }
  async showPopover(spanEl) {
    const key = spanEl.dataset.lexisKey;
    const entry = this.index.get(key);
    if (!entry) return;
    if (this._popover && this._popover.dataset.lexisKey === key) { window.clearTimeout(this._hideTimer); return; }
    this.removePopover();
    const pop = document.createElement("div");
    pop.className = "lexis-popover";
    pop.dataset.lexisKey = key;
    const title = pop.createDiv({ cls: "lexis-popover-title" });
    title.createSpan({ text: entry.display });
    if (entry.isAlias) title.createSpan({ cls: "lexis-popover-alias", text: `别名 → ${entry.file.basename}` });
    title.addEventListener("click", () => this.openAndClose(entry.file));
    const body = pop.createDiv({ cls: "lexis-popover-body" });
    body.setText("加载中…");
    pop.addEventListener("mouseenter", () => window.clearTimeout(this._hideTimer));
    pop.addEventListener("mouseleave", () => this.scheduleHide());
    spanEl.addEventListener("mouseleave", () => this.scheduleHide(), { once: true });
    document.body.appendChild(pop);
    this._popover = pop;
    this.positionPopover(pop, spanEl);
    try {
      body.empty();
      const comp = new Component(); comp.load(); this._popoverComp = comp;
      const contentEl = body.createDiv();
      await this.renderNoteInto(contentEl, entry.file, comp);
      if (this.settings.showRelated) {
        const div = body.createDiv({ cls: "lexis-divider" });
        const n = await this.renderTypedRelations(body, entry.file);
        if (!n) div.remove();
      }
      if (this.settings.showOccurrences) {
        body.createDiv({ cls: "lexis-divider" });
        const occTitle = body.createDiv({ cls: "lexis-section-title", text: "📍 出现过的地方 …" });
        const occWrap = body.createDiv();
        occWrap.setText("搜索中…");
        this.findOccurrences(entry.display).then(async (rawList) => {
          if (this._popover !== pop) return;
          const curated = await this.getCuratedSourcePaths(entry.file);
          const list = rawList.filter((o) => !curated.has(o.file.basename.toLowerCase()));
          occTitle.setText(`📍 出现过的地方 (${list.length})`);
          occWrap.empty();
          if (!list.length) occWrap.createDiv({ cls: "lexis-occ", text: "(没有未收藏的新出处)" });
          else for (const o of list) {
            const d = occWrap.createDiv({ cls: "lexis-occ" });
            this.renderSentence(d, o.sentence, entry.display);
            const add = d.createSpan({ cls: "lexis-occ-add", text: " ➕" });
            add.setAttribute("title", "收藏到例句");
            add.addEventListener("click", async () => {
              if (add.dataset.done) return;
              add.dataset.done = "1";
              if (await this.addExampleToWord(entry.file, o.sentence, o.file)) { add.setText(" ✓"); add.style.cursor = "default"; add.removeAttribute("title"); } else delete add.dataset.done;
            });
            const src = d.createSpan({ cls: "lexis-occ-src", text: " ↗ " + o.file.basename });
            src.addEventListener("click", () => this.openOccurrence(o.file, entry.display));
          }
          this.positionPopover(pop, spanEl);
        });
      }
      this.positionPopover(pop, spanEl);
    } catch (err) { body.setText("读取失败:" + (err?.message || err)); }
  }
  positionPopover(pop, spanEl) {
    const r = spanEl.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let left = r.left, top = r.bottom + 6;
    if (left + pr.width > window.innerWidth - 10) left = window.innerWidth - pr.width - 10;
    if (left < 10) left = 10;
    if (top + pr.height > window.innerHeight - 10) top = r.top - pr.height - 6;
    if (top < 10) top = 10;
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
};

// ---------- 背单词复习视图 ----------
class LexisReviewView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.queue = []; this.pos = 0; this.reviewed = 0; this.revealed = false; this.undoStack = []; this.options = {}; }
  getViewType() { return LEXIS_REVIEW_VIEW; }
  getDisplayText() { return "Lexis 背单词"; }
  getIcon() { return "brain"; }
  async onOpen() { this.registerDomEvent(window, "keydown", (e) => this.onKey(e)); this.refresh(); }
  onClose() { if (this._comp) this._comp.unload(); }
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
      await this.plugin.renderNoteInto(this.backEl, this.currentItem.file, this._comp);
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
    // 空格始终拦截(防止焦点落在某个评分按钮上被空格误触发 → "跳到下一个"的 bug)
    if (e.code === "Space") { e.preventDefault(); if (!this.revealed) this.reveal(); return; }
    if (this.revealed && ["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); this.grade(Number(e.key)); }
  }
  async applyClozeFront(wordEl, item) {
    const ex = await this.plugin.getFirstExample(item.file);
    if (!ex || this.currentItem !== item) return; // 无例句则保持单词;卡片已切走则放弃
    wordEl.addClass("lexis-rv-cloze");
    wordEl.setText(this.plugin.buildCloze(ex, item.file.basename));
  }
  skip() {
    if (this.pos >= this.queue.length) return;
    this.queue.push(this.queue[this.pos]); // 稍后再出现
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
  }
}

// ---------- Lexis 主页 ----------
class LexisHomeView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return LEXIS_HOME_VIEW; }
  getDisplayText() { return "Lexis"; }
  getIcon() { return "graduation-cap"; }
  async onOpen() { this.render(); }
  render() {
    const c = this.contentEl; c.empty(); c.addClass("lexis-home");
    c.createEl("h3", { text: "📕 Lexis" });
    const st = this.plugin.computeStats();
    const stats = c.createDiv({ cls: "lexis-home-stats" });
    stats.createDiv({ cls: "lexis-stat", text: `⏰ 待复习 ${st.due}` });
    stats.createDiv({ cls: "lexis-stat", text: `✨ 新词 ${st.fresh}` });
    stats.createDiv({ cls: "lexis-stat", text: `📚 总计 ${st.total}` });
    this.plugin.renderHeatmap(c.createDiv({ cls: "lexis-hm-wrap" }));

    c.createEl("h4", { text: "开始复习" });
    const tags = this.plugin.collectVocabTags();
    let selTag = "", selOrder = "due";
    new Setting(c).setName("集合").addDropdown((dd) => { dd.addOption("", "全部"); for (const t of tags) dd.addOption(t, "#" + t); dd.setValue(selTag); dd.onChange((v) => { selTag = v; }); });
    new Setting(c).setName("顺序").addDropdown((dd) => { dd.addOption("due", "到期优先").addOption("frequency", "词频(高频先)").addOption("random", "随机").setValue(selOrder); dd.onChange((v) => { selOrder = v; }); });
    new Setting(c).addButton((b) => b.setButtonText("▶ 开始复习").setCta().onClick(() => this.plugin.openReview({ tag: selTag, order: selOrder })))
      .addExtraButton((b) => b.setIcon("refresh-cw").setTooltip("刷新").onClick(() => this.render()));
  }
  onClose() {}
}

class LexisSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const accentHex = cssColorToHex(getComputedStyle(document.body).getPropertyValue("--text-accent"));
    const save = () => this.plugin.saveSettings();
    const refresh = () => this.plugin.refreshAllViews();
    containerEl.createEl("h3", { text: "Lexis 设置" });

    const folders = this.app.vault.getAllLoadedFiles().filter((f) => f instanceof TFolder).map((f) => f.path).filter((p) => p && p !== "/").sort();

    new Setting(containerEl).setName("单词库文件夹").setDesc("这个文件夹(含子文件夹)里每个笔记的标题都会被当作一个单词。")
      .addDropdown((dd) => {
        for (const p of folders) dd.addOption(p, p);
        if (this.plugin.settings.vocabFolder && !folders.includes(this.plugin.settings.vocabFolder)) dd.addOption(this.plugin.settings.vocabFolder, this.plugin.settings.vocabFolder + "(当前)");
        dd.setValue(this.plugin.settings.vocabFolder);
        dd.onChange(async (v) => { this.plugin.settings.vocabFolder = v; await save(); this.plugin.rebuildIndex(true); this.renderStats(); });
      });
    new Setting(containerEl).setName("别名也算单词").setDesc("把单词笔记 frontmatter 里的 aliases 也加入识别与高亮。")
      .addToggle((t) => t.setValue(this.plugin.settings.includeAliases).onChange(async (v) => { this.plugin.settings.includeAliases = v; await save(); this.plugin.rebuildIndex(false); this.renderStats(); }));

    containerEl.createEl("h4", { text: "高亮" });
    new Setting(containerEl).setName("启用高亮").addToggle((t) => t.setValue(this.plugin.settings.enableHighlight).onChange(async (v) => { this.plugin.settings.enableHighlight = v; await save(); refresh(); }));
    new Setting(containerEl).setName("实时预览也高亮(编辑模式)").setDesc(this.plugin.liveAvailable ? "编辑时也显示高亮。" : "⚠️ 当前环境无法加载 CodeMirror,不可用。")
      .addToggle((t) => t.setValue(this.plugin.settings.enableLivePreview).setDisabled(!this.plugin.liveAvailable).onChange(async (v) => { this.plugin.settings.enableLivePreview = v; await save(); refresh(); }));
    new Setting(containerEl).setName("默认高亮线型").setDesc("没被标签规则覆盖时使用。")
      .addDropdown((dd) => dd.addOption("wavy", "波浪下划线").addOption("underline", "实线下划线").addOption("background", "背景色").setValue(this.plugin.settings.highlightStyle).onChange(async (v) => { this.plugin.settings.highlightStyle = v; await save(); refresh(); }));
    new Setting(containerEl).setName("默认高亮颜色").setDesc("点色块选色;右侧按钮恢复主题色。")
      .addColorPicker((cp) => { this._colorComp = cp; cp.setValue(this.plugin.settings.highlightColor || accentHex).onChange(async (v) => { this.plugin.settings.highlightColor = v; await save(); refresh(); }); })
      .addExtraButton((b) => b.setIcon("reset").setTooltip("恢复主题色").onClick(async () => { this.plugin.settings.highlightColor = ""; if (this._colorComp) this._colorComp.setValue(accentHex); await save(); refresh(); }));
    new Setting(containerEl).setName("透明度").setDesc("对所有颜色(含主题色)都生效。")
      .addSlider((s) => s.setLimits(0.1, 1, 0.05).setValue(this.plugin.settings.highlightOpacity).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.highlightOpacity = v; await save(); refresh(); }));

    containerEl.createEl("h4", { text: "按标签着色" });
    containerEl.createEl("p", { cls: "setting-item-description", text: "给某标签的单词指定专属颜色/线型。命中单词笔记 tags 的第一条规则。" });
    const rulesWrap = containerEl.createDiv();
    const renderRules = () => {
      rulesWrap.empty();
      const grid = rulesWrap.createDiv({ cls: "lexis-rule-grid" });
      this.plugin.settings.tagRules.forEach((rule, i) => {
        const cell = grid.createDiv({ cls: "lexis-rule" });
        new obsidian.TextComponent(cell).setPlaceholder("标签").setValue(rule.tag).onChange(async (v) => { rule.tag = v.trim(); await save(); refresh(); });
        new obsidian.ColorComponent(cell).setValue(rule.color || accentHex).onChange(async (v) => { rule.color = v; await save(); refresh(); });
        new obsidian.DropdownComponent(cell).addOption("", "默认").addOption("wavy", "波浪").addOption("underline", "实线").addOption("background", "背景").setValue(rule.style || "").onChange(async (v) => { rule.style = v; await save(); refresh(); });
        new obsidian.ExtraButtonComponent(cell).setIcon("trash").setTooltip("删除").onClick(async () => { this.plugin.settings.tagRules.splice(i, 1); await save(); refresh(); renderRules(); });
      });
      new Setting(rulesWrap).addButton((b) => b.setButtonText("+ 添加标签规则").onClick(async () => { this.plugin.settings.tagRules.push({ tag: "", color: accentHex, style: "" }); await save(); renderRules(); }));
    };
    renderRules();

    containerEl.createEl("h4", { text: "悬浮卡" });
    new Setting(containerEl).setName("显示相关词").addToggle((t) => t.setValue(this.plugin.settings.showRelated).onChange(async (v) => { this.plugin.settings.showRelated = v; await save(); }));
    new Setting(containerEl).setName("显示「出现过的地方」").setDesc("全文搜索这个词出现过的句子(无需双链)。")
      .addToggle((t) => t.setValue(this.plugin.settings.showOccurrences).onChange(async (v) => { this.plugin.settings.showOccurrences = v; await save(); }));
    new Setting(containerEl).setName("出处数量上限").addSlider((s) => s.setLimits(1, 15, 1).setValue(this.plugin.settings.occurrenceLimit).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.occurrenceLimit = v; await save(); this.plugin._occCache.clear(); }));
    new Setting(containerEl).setName("出处搜索范围").setDesc("文件夹,逗号分隔;留空=全库。例:07-material")
      .addText((t) => t.setPlaceholder("留空=全库").setValue(this.plugin.settings.occurrenceFolders).onChange(async (v) => { this.plugin.settings.occurrenceFolders = v.trim(); await save(); this.plugin._occCache.clear(); }));

    containerEl.createEl("h4", { text: "划词添加" });
    new Setting(containerEl).setName("新词模板文件").setDesc("阅读时选中词→右键「添加到单词库」建新文件时套用的模板;留空=极简骨架。模板里可用 {{word}} {{date}} 占位。")
      .addText((t) => t.setPlaceholder("template/单词模板.md").setValue(this.plugin.settings.newWordTemplate).onChange(async (v) => { this.plugin.settings.newWordTemplate = v.trim(); await save(); }));

    containerEl.createEl("h4", { text: "背单词 (FSRS)" });
    new Setting(containerEl).setName("目标记忆保留率").setDesc("越高复习越频繁。默认 0.9。")
      .addSlider((s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.requestRetention = v; await save(); }));
    new Setting(containerEl).setName("每天新词上限").addSlider((s) => s.setLimits(0, 100, 5).setValue(this.plugin.settings.newPerDay).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.newPerDay = v; await save(); }));
    new Setting(containerEl).setName("每轮最多复习").addSlider((s) => s.setLimits(10, 500, 10).setValue(this.plugin.settings.maxReviewsPerSession).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.maxReviewsPerSession = v; await save(); }));
    new Setting(containerEl).setName("卡片正面").setDesc("整篇=正面单词、背面笔记;填空=正面例句挖空、背面笔记(需先收藏例句,没有则退回显示单词)。")
      .addDropdown((dd) => dd.addOption("note", "单词 → 整篇").addOption("cloze", "例句填空").setValue(this.plugin.settings.cardFront).onChange(async (v) => { this.plugin.settings.cardFront = v; await save(); }));
    new Setting(containerEl).setName("开始背单词").addButton((b) => b.setButtonText("打开复习").setCta().onClick(() => this.plugin.openReview()));

    new Setting(containerEl).setName("重建索引").addButton((b) => b.setButtonText("立即重建").onClick(() => { this.plugin.rebuildIndex(true); this.renderStats(); }));
    this.statsEl = containerEl.createEl("p", { cls: "lexis-stats" });
    this.renderStats();
  }

  renderStats() {
    if (!this.statsEl) return;
    const s = this.plugin.stats;
    this.statsEl.setText(`当前索引:${s.words} 个单词,${s.aliases} 个别名,${s.due || 0} 个待复习。`);
  }
}
