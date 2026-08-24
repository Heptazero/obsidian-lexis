"use strict";

/*
 * Lexis —— 自建单词学习插件(源码按职责拆分，发布为移动端兼容的单文件 main.js)
 * Stage 0~2:文件夹→单词索引、阅读+实时预览高亮、悬浮卡(笔记结构 + 相关词 + 出现过的地方)。
 * Stage 3:FSRS 翻卡背单词,进度写进笔记 frontmatter。
 * 详细路线图见 LOG.md。
 */

const obsidian = require("obsidian");
const { Plugin, PluginSettingTab, Setting, Notice, TFolder, TFile, Component, MarkdownRenderer, ItemView, Modal, finishRenderMath } = obsidian;
const { createI18n } = require("./i18n");
const { buildCurveSVG } = require("./curve");
const { createReviewView } = require("./review-view");
const { createOccurrenceSearch } = require("./occurrence-search");

const LEXIS_REVIEW_VIEW = "lexis-review-view";
const LEXIS_HOME_VIEW = "lexis-home-view";

const DEFAULT_SETTINGS = {
  language: "zh",
  // 收录范围:多个文件夹(逗号/换行分隔) ∪ 携带任一标签的笔记(并集)。
  // vocabFolders / excludeTags 不放默认值,迁移与兜底在 loadSettings 里做(留默认会盖掉用户老值)。
  vocabTags: "", // 带任一此标签的笔记也算词库(与文件夹取并集)
  includeAliases: true,
  aliasSources: "", // 额外的别名来源属性名,逗号分隔(如 past,forms,variants)。留空只读 aliases/alias。
  // 内联条目库:带 lexis-inline 属性(或 #lexis-inline 标签)的笔记可用「词条::批注」维护轻量词条。
  inlineEntriesEnabled: true,
  inlineEntryDelimiter: "::",
  inlineCategoryColors: {}, // { "人物": "#d9534f" }，由资料笔记的标题分类自动生成设置项
  inlineCategoryOpacity: {}, // { "人物": 0.65 }，留空时跟随全局高亮透明度
  inlineCategoryHighlight: {}, // { "人物": false }，关闭后仍识别和显示悬浮批注，只隐藏高亮
  enableHighlight: true,
  enableLivePreview: true,
  highlightStyle: "wavy",
  highlightColor: "",
  highlightOpacity: 1,
  popoverWidth: 460,
  popoverMaxHeight: 420,
  popoverFontSize: 14,
  hoverDelayMs: 250,
  // 高亮渐隐:强度随 FSRS stability 单调变淡,归档词完全不高亮(见 fadeAlphaFor)
  fadeByMemory: true,
  fadeFloor: 0.25, // 淡到最后不低于这个透明度(0~1)
  // 悬停回流:悬停查释义时,如果到期日比 N 天后还远,拉近到今天,提醒尽快复习(只挪 due,不碰 stability)
  hoverFeedback: true,
  hoverFeedbackDays: 3,
  // 淘汰候选:入库满这么多天、且这么多天没自然相遇过,才会进候选列表(同一个阈值管两个条件)
  retireCandidateDays: 90,
  tagRules: [],
  showRelated: true,
  showOccurrences: true,
  includePdfOccurrences: true,
  occurrenceLimit: 6,
  occurrenceFolders: "",
  // Stage 3 (FSRS)
  requestRetention: 0.9,
  newPerDay: 20,
  maxReviewsPerSession: 200,
  reviewLog: {}, // { "YYYY-MM-DD": count } 供热力图(Stage 5)
  reviewHistory: {}, // { "词条路径": [{date, s, grade, retention}] } 供单词级记忆曲线
  showReviewMetadata: false,
  // Stage 4
  newWordTemplate: "template/单词模板.md",
  emptyNotePreset: "blank",
  // 划词出处模板:首行若为 Markdown 标题,其余内容作为每条出处的格式;留空则不自动写出处。
  occurrenceTemplate: "#### 出处\n> {{sentence}}{{sourceSuffix}}",
  // 批注小节标题:可以只填文字(默认按 #### 级别),也可以带级别(比如 "## 引用");留空用默认 "#### 批注"
  annotationHeading: "",
  // 卡片正面:note=单词→整篇;cloze=出处填空
  cardFront: "note",
  // 桌面端评分按钮底部间距(px)；移动端固定在原生工具栏上方。
  reviewBottomSpace: 70,
  // 浏览器扩展排除标签:打上任一此标签的单词不在网页高亮(多标签,逗号/空格分隔)。
  // excludeTags 不放默认值,迁移在 loadSettings 里做。
  // 浏览器桥接(本地 HTTP,只听 127.0.0.1,供 Chrome 扩展拉词库/划词添加)
  bridgeEnabled: false,
  bridgePort: 45945,
  bridgeToken: "",
  // 在 Obsidian 笔记里划词后,选区旁冒出"+ 加入词库"浮动药丸(阅读/编辑两种模式都生效)
  selectionPill: true,
  // 划词药丸上次选中的词典
  lastSelectionFolder: "",
  // 在 Obsidian 内置 PDF 阅读器里也高亮词库词(钩 pdf.js 文字层;扫描版无文字层则无效)
  enablePdfHighlight: true,
};

// ---------- 小工具 ----------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 词边界(支持中文):只有当词以英文字母/数字/下划线开头或结尾时才加 ASCII 边界
// (避免 cat 命中 category);中文/日文等无空格语言不加边界,否则 \b 永不命中。
const boundedSource = (word) => {
  const lb = /^[A-Za-z0-9_]/.test(word) ? "(?<![A-Za-z0-9_])" : "";
  const rb = /[A-Za-z0-9_]$/.test(word) ? "(?![A-Za-z0-9_])" : "";
  return lb + escapeRe(word) + rb;
};
const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// 从网页/富文本粘贴来的不换行空格会被 MarkdownRenderer 转成 &nbsp;，落进 TeX 后触发 MathJax 的 Misplaced &。
// 只规范传给渲染器的副本，不改用户笔记原文。
const renderLexisMarkdown = (app, md, el, sourcePath, comp) => {
  const clean = String(md == null ? "" : md).replace(/\u00a0/g, " ");
  return MarkdownRenderer.render
    ? MarkdownRenderer.render(app, clean, el, sourcePath, comp)
    : MarkdownRenderer.renderMarkdown(clean, el, sourcePath, comp);
};
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

const LexisReviewView = createReviewView({
  reviewViewType: LEXIS_REVIEW_VIEW,
  todayStr,
  renderLexisMarkdown,
});

// 外部阅读端（浏览器、未来的 Zotero）只通过这条本机桥接访问 Lexis。
// 这里负责 HTTP 生命周期与路由；词典规则和写入动作仍由 LexisPlugin 作为唯一真相处理。
class LexisBridge {
  constructor(plugin) {
    this.plugin = plugin;
    this.server = null;
  }

  get running() { return !!this.server; }

  generateToken() {
    const bytes = new Uint8Array(16);
    (window.crypto || crypto).getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  start() {
    if (this.server) return;
    let http;
    try { http = require("http"); } catch (_e) {}
    if (!http) { new Notice(this.plugin.t("notice.desktopBridge")); return; }
    const port = Number(this.plugin.settings.bridgePort) || 45945;
    const server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        try { res.writeHead(500); res.end(String(err && err.message || err)); } catch (_e) {}
      });
    });
    server.on("error", (err) => {
      this.server = null;
      const reason = err.code === "EADDRINUSE" ? this.plugin.t("notice.portBusy", { port }) : (err.code || err.message);
      new Notice(this.plugin.t("notice.bridgeFailed", { reason }));
    });
    server.listen(port, "127.0.0.1", () => this.plugin.updateStatusBar());
    this.server = server;
  }

  stop() {
    if (!this.server) return;
    try { this.server.close(); } catch (_e) {}
    this.server = null;
    this.plugin.updateStatusBar();
  }

  restart() {
    this.stop();
    if (this.plugin.settings.bridgeEnabled) this.start();
  }

  cors() {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "X-Lexis-Token, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    };
  }

  async handle(req, res) {
    const plugin = this.plugin;
    const cors = this.cors();
    const send = (code, obj) => {
      res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors));
      res.end(JSON.stringify(obj));
    };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, "http://127.0.0.1");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/ping" || path === "/") return send(200, { ok: true, app: "lexis", version: plugin.manifest.version, vault: plugin.app.vault.getName() });
    const token = req.headers["x-lexis-token"] || url.searchParams.get("token") || "";
    if (!plugin.settings.bridgeToken || token !== plugin.settings.bridgeToken) return send(401, { ok: false, error: "bad-token" });
    if (path === "/words" && req.method === "GET") return send(200, plugin.bridgeWordList());
    if (path === "/word" && req.method === "GET") return send(200, await plugin.bridgeWordDetail(url.searchParams.get("key") || url.searchParams.get("w")));
    if (path === "/word" && req.method === "DELETE") return send(200, await plugin.bridgeDeleteWord(url.searchParams.get("key") || ""));
    if (path === "/add" && req.method === "POST") return send(200, await plugin.bridgeAddWord(await this.readBody(req)));
    if (path === "/tag" && req.method === "POST") return send(200, await plugin.bridgeTagWord(await this.readBody(req)));
    if (path === "/note" && req.method === "POST") return send(200, await plugin.bridgeAnnotate(await this.readBody(req)));
    if (path === "/move" && req.method === "POST") return send(200, await plugin.bridgeMoveWord(await this.readBody(req)));
    if (path === "/encounter" && req.method === "POST") return send(200, await plugin.bridgeEncounter(await this.readBody(req)));
    return send(404, { ok: false, error: "not-found" });
  }

  readBody(req) {
    return new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); });
      req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (_e) { resolve({}); } });
      req.on("error", () => resolve({}));
    });
  }
}

module.exports = class LexisPlugin extends Plugin {
  async onload() {
    try {
    await this.loadSettings();
    this.i18n = createI18n(() => this.settings.language);
    this.applyReviewMetadataVisibility();

    this.index = new Map();
    this.vocabPaths = new Set();
    this.stats = { words: 0, aliases: 0, due: 0 };
    this._pattern = null;
    this._rebuildTimer = null;
    this._popover = null;
    this._popoverComp = null;
    this._hideTimer = null;
    this._showTimer = null;
    this._showTarget = null;
    this._occCache = new Map();
    this.occurrenceSearch = createOccurrenceSearch({
      app: this.app,
      loadPdfJs: () => obsidian.loadPdfJs(),
      boundedSource,
      extractSentence: (content, index) => this.extractSentence(content, index),
      markdownAllowed: (file) => !this.inVocabFolder(file.path) && !this.inlineSourcePaths?.has(file.path),
      inScope: (path, scope) => this.inScope(path, scope),
    });
    this.liveAvailable = false;
    this._encounters = {};
    this._encSaveTimer = 0;
    this._encounterDedup = {};
    this._passiveSeenToday = new Set();
    this._pageHighlightState = new WeakMap();
    this._reviewSessions = new WeakMap();
    await this.loadEncounters();
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (file instanceof TFile && this.inVocabFolder(file.path)) this.recordEncounter(file, "open");
      window.requestAnimationFrame(() => this.syncActivePageHighlightState());
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => this.syncActivePageHighlightState(leaf)));

    this.statusBarEl = this.addStatusBarItem();
    if (this.statusBarEl) {
      this.statusBarEl.style.cursor = "pointer";
      this.statusBarEl.setAttribute("aria-label", this.t("status.rebuildAria"));
      this.registerDomEvent(this.statusBarEl, "click", () => this.rebuildIndex(true));
    }

    this.addCommand({ id: "rebuild-index", name: this.t("command.rebuild"), callback: () => this.rebuildIndex(true) });
    this.addCommand({ id: "open-review", name: this.t("command.review"), callback: () => this.openReview() });
    this.addCommand({ id: "add-selected-word", name: this.t("command.addSelection"), callback: () => this.addSelectedWordCommand() });
    this.addCommand({ id: "open-home", name: this.t("command.home"), callback: () => this.openHome() });
    this.addCommand({
      id: "toggle-current-page-highlights",
      name: this.t("command.toggleHighlights"),
      checkCallback: (checking) => {
        const page = this.currentHighlightPage();
        if (!page) return false;
        if (checking) return true;
        this.toggleCurrentPageHighlights(page);
        return true;
      },
    });
    this.addRibbonIcon("graduation-cap", this.t("ribbon.home"), () => this.openHome());
    this.addRibbonIcon("brain", this.t("ribbon.review"), () => this.openReview());

    // ---------- 生命周期命令(归档/恢复/常驻),只对当前打开的词条笔记生效 ----------
    this.addCommand({
      id: "archive-word",
      name: this.t("command.archive"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.inVocabFolder(file.path) || this.readLifecycle(file).archived) return false;
        if (checking) return true;
        this.setArchived(file, true).then(() => new Notice(this.t("notice.archived", { word: file.basename })));
        return true;
      },
    });
    this.addCommand({
      id: "restore-word",
      name: this.t("command.restore"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.inVocabFolder(file.path) || !this.readLifecycle(file).archived) return false;
        if (checking) return true;
        new LexisRestoreModal(this.app, this, file).open();
        return true;
      },
    });
    this.addCommand({
      id: "toggle-pin-word",
      name: this.t("command.pin"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.inVocabFolder(file.path)) return false;
        if (checking) return true;
        const pinned = this.readLifecycle(file).pinned;
        this.setPinned(file, !pinned).then(() => new Notice(this.t(!pinned ? "notice.pinned" : "notice.unpinned", { word: file.basename })));
        return true;
      },
    });
    this.addCommand({
      id: "migrate-familiar-tag-to-archived",
      name: this.t("command.migrate"),
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path) && this.getTags(f).has("熟悉") && !this.readLifecycle(f).archived && !this.readLifecycle(f).retired);
        if (!files.length) { new Notice(this.t("notice.noFamiliar")); return; }
        for (const f of files) await this.app.fileManager.processFrontMatter(f, (fm) => { fm["lexis-status"] = "archived"; });
        this.rebuildIndex(false);
        new Notice(this.t("notice.migrated", { count: files.length }));
      },
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile) || !this.inVocabFolder(file.path)) return;
      const { archived, pinned } = this.readLifecycle(file);
      menu.addItem((it) => it.setTitle(this.t(archived ? "menu.restore" : "menu.archive")).setIcon(archived ? "archive-restore" : "archive").onClick(() => {
        if (archived) new LexisRestoreModal(this.app, this, file).open();
        else this.setArchived(file, true).then(() => new Notice(this.t("notice.archived", { word: file.basename })));
      }));
      menu.addItem((it) => it.setTitle(this.t(pinned ? "menu.unpin" : "menu.pin")).setIcon(pinned ? "pin-off" : "pin").onClick(() => {
        this.setPinned(file, !pinned).then(() => new Notice(this.t(!pinned ? "notice.pinned" : "notice.unpinned", { word: file.basename })));
      }));
    }));

    this.registerView(LEXIS_REVIEW_VIEW, (leaf) => new LexisReviewView(leaf, this));
    this.registerView(LEXIS_HOME_VIEW, (leaf) => new LexisHomeView(leaf, this));

    this.addSettingTab(new LexisSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((el, ctx) => this.highlightElement(el, ctx));
    this.registerMarkdownCodeBlockProcessor("lexis", (src, el, ctx) => this.renderLexisBlock(el, ctx, src));
    this.registerMarkdownCodeBlockProcessor("lexis-heatmap", (src, el) => this.renderHeatmap(el));
    this.registerMarkdownCodeBlockProcessor("lexis-home", (src, el) => this.renderHomeBlock(el));
    this.setupLiveExtension();
    this.setupPdfHighlight();
    this.setupEpubIframeHighlight();

    this.registerDomEvent(document, "mouseover", (e) => this.onMouseOver(e));
    this.registerDomEvent(document, "mouseout", (e) => this.onMouseOut(e));
    this.registerDomEvent(document, "click", (e) => this.onClick(e));
    this.registerDomEvent(window, "scroll", (e) => { if (this._popover && e.target instanceof Node && this._popover.contains(e.target)) return; this.removePopover(); this.removeSelPill(); }, { capture: true });
    // 划词添加:松开鼠标后,若选区在笔记里则冒出"+ 加入词库"药丸
    this.registerDomEvent(document, "mouseup", (e) => this.maybeShowSelPill(e));
    this.registerDomEvent(document, "keydown", (e) => { if (e.key === "Escape") this.removeSelPill(); });

    this.app.workspace.onLayoutReady(() => { this.rebuildIndex(false); this.syncActivePageHighlightState(); });
    this.registerEvent(this.app.vault.on("create", (f) => this.maybeRebuild(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => this.maybeRebuild(f)));
    this.registerEvent(this.app.vault.on("rename", (f, old) => this.maybeRebuild(f, old)));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      this._occCache.clear();
      if (file?.extension === "pdf") this.occurrenceSearch.invalidatePdf(file.path);
      if (this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(file?.path)) this.scheduleRebuild();
    }));
    // 词条元数据变化会影响别名、排除标签、配色和生命周期；无论是否启用“按标签收录”都要重建。
    // 同时保留未收录文件的判断，让它能因新增收录标签进入词库。
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      if (this.vocabPaths.has(file.path) || this.isVocabFile(file) || this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(file?.path)) this.scheduleRebuild();
    }));

    // 划词添加(右键菜单)
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
      const sel = (editor.getSelection() || "").trim();
      if (!sel || sel.length > 60) return;
      const label = sel.length > 16 ? sel.slice(0, 16) + "…" : sel;
      const dicts = this.dictFolders();
      if (dicts.length > 1) {
        // 多词典:每个文件夹一项「添加到 <folder>」
        for (const f of dicts) {
          menu.addItem((item) => item
            .setTitle(this.t("menu.addTo", { word: label, folder: f }))
            .setIcon("book-plus")
            .onClick(() => this.addWordFromSelection(sel, editor, view, f)));
        }
      } else {
        menu.addItem((item) => item
          .setTitle(this.t("menu.add", { word: label }))
          .setIcon("book-plus")
          .onClick(() => this.addWordFromSelection(sel, editor, view)));
      }
    }));

    // 外部阅读端桥接:Chrome 与未来 Zotero 共用同一条本机协议。
    this.bridge = new LexisBridge(this);
    if (this.settings.bridgeEnabled) {
      if (!this.settings.bridgeToken) { this.settings.bridgeToken = this.bridge.generateToken(); await this.saveSettings(); }
      this.bridge.start();
    }
    } catch (err) {
      console.error("[Lexis] onload 失败:", err?.stack || err);
      if (typeof Notice !== "undefined") new Notice(this.t("notice.loadFailed", { error: err?.message || err }));
    }
  }

  onunload() {
    window.clearTimeout(this._rebuildTimer);
    window.clearTimeout(this._hideTimer);
    window.clearTimeout(this._showTimer);
    if (this._encSaveTimer) { window.clearTimeout(this._encSaveTimer); this.saveEncounters(); }
    this.removePopover();
    this.removeSelPill();
    this.teardownPdfHighlight();
    this.teardownEpubIframeHighlight();
    this.bridge?.stop();
    document.body?.classList.remove("lexis-show-review-metadata");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if ((!this.settings.tagRules || !this.settings.tagRules.length) && this.settings.tagRulesText) {
      this.settings.tagRules = this.parseTagRulesText(this.settings.tagRulesText);
      delete this.settings.tagRulesText;
      await this.saveData(this.settings);
    }
    if (!Array.isArray(this.settings.tagRules)) this.settings.tagRules = [];
    if (!this.settings.inlineCategoryColors || typeof this.settings.inlineCategoryColors !== "object" || Array.isArray(this.settings.inlineCategoryColors)) this.settings.inlineCategoryColors = {};
    if (!this.settings.inlineCategoryOpacity || typeof this.settings.inlineCategoryOpacity !== "object" || Array.isArray(this.settings.inlineCategoryOpacity)) this.settings.inlineCategoryOpacity = {};
    if (!this.settings.inlineCategoryHighlight || typeof this.settings.inlineCategoryHighlight !== "object" || Array.isArray(this.settings.inlineCategoryHighlight)) this.settings.inlineCategoryHighlight = {};
    if (!this.settings.reviewLog) this.settings.reviewLog = {};
    if (!this.settings.reviewHistory || typeof this.settings.reviewHistory !== "object" || Array.isArray(this.settings.reviewHistory)) this.settings.reviewHistory = {};
    // 单值 → 多值迁移(收录文件夹 / 网页排除标签)。旧键不在 DEFAULT_SETTINGS,故能区分"未迁移"。
    if (this.settings.vocabFolders == null) this.settings.vocabFolders = this.settings.vocabFolder != null ? this.settings.vocabFolder : "01-word";
    if (this.settings.excludeTags == null) this.settings.excludeTags = this.settings.excludeTag || "";
    if (this.settings.vocabTags == null) this.settings.vocabTags = "";
    // 词典表:文件夹来源升级成 [{folder, template}]。从旧 vocabFolders 迁移(模板留空=用全局默认)。
    if (!Array.isArray(this.settings.dicts)) {
      this.settings.dicts = this.parseFolders(this.settings.vocabFolders).map((f) => ({ folder: f, template: "" }));
    }
  }

  t(key, vars) { return this.i18n ? this.i18n.t(key, vars) : key; }
  async saveSettings() { await this.saveData(this.settings); }
  applyReviewMetadataVisibility() {
    document.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata);
  }
  parseTagRulesText(text) {
    const rules = [];
    for (const line of (text || "").split("\n")) {
      const m = /^\s*#?([^:：]+)[:：]\s*(\S+)(?:\s+(wavy|underline|background))?\s*$/.exec(line);
      if (m) rules.push({ tag: m[1].trim(), color: m[2].trim(), style: m[3] || "" });
    }
    return rules;
  }

  // ---------- 词典桥接动作（由 Obsidian 卡片与外部阅读端共同调用） ----------
  // 网页划词/加出处:词不在库→新建,在库→加出处。来源是网址链接 [标题](url),不是 [[内链]]
  async bridgeAddWord(payload) {
    const word = String((payload && payload.word) || "").trim();
    if (!word) return { ok: false, error: "empty-word" };
    const name = this.sanitizeName(word);
    if (!name) return { ok: false, error: "bad-name" };
    const alias = String((payload && payload.alias) || "").trim();
    const sentence = String((payload && payload.sentence) || "").trim();
    const url = String((payload && payload.url) || "").trim();
    const title = String((payload && payload.title) || url || "").trim().replace(/[\[\]]/g, "");
    const source = url ? `[${title || url}](${url})` : "";
    const occurrence = (sentence || source) ? { word, sentence, source, date: todayStr() } : null;
    const dupKey = sentence || url;
    // 目标词典文件夹:payload.folder 命中词典表则用它,否则回退第一个
    const reqFolder = this.normalizeFolder((payload && payload.folder) || "");
    const folder = (reqFolder && this.dictFolders().includes(reqFolder)) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + name + ".md";
    let existing = this.app.vault.getAbstractFileByPath(targetPath);
    // 按路径没找到,不代表这个词不存在——它可能落在别的词典文件夹里(网页端加出处不带 folder 参数,
    // 拼出来的 targetPath 只会落在 primaryVocabFolder)。所以不管是不是在加别名,都按索引(标题或别名)兜底查一遍,
    // 找到就并入那个文件,而不是在错误的文件夹里新建重复笔记。(和 ob 内"设为别名"一致)
    if (!(existing instanceof TFile)) {
      const hit = this.index.get(word.toLowerCase());
      if (hit && hit.file instanceof TFile) existing = hit.file;
    }
    const injectAlias = (data) => {
      const re = /^---\r?\n([\s\S]*?)\r?\n---/;
      const fm = re.exec(data);
      const line = `  - ${alias}\n`;
      if (!fm) return `---\naliases:\n${line}---\n` + data;
      const body = fm[1];
      if (body.includes(alias)) return data; // 已有,不重复加
      if (/^aliases:/m.test(body)) {
        // 已有 aliases 键 → 追加到末尾
        return data.slice(0, fm.index) + `---\n` + body.replace(/^(aliases:.*)$/m, `$1\n${line}`) + `\n---` + data.slice(fm.index + fm[0].length);
      }
      // 没有 aliases 键 → 新增
      return data.slice(0, fm.index) + `---\n${body}\naliases:\n${line}---` + data.slice(fm.index + fm[0].length);
    };
    try {
      if (existing instanceof TFile) {
        if (alias) {
          if (this.app.vault.process) await this.app.vault.process(existing, injectAlias);
          else await this.app.vault.modify(existing, injectAlias(await this.app.vault.cachedRead(existing)));
          this.rebuildIndex(false);
          if (alias) { const ak = alias.toLowerCase(); if (!this.index.has(ak)) this.index.set(ak, { display: alias, file: existing, isAlias: true, tags: this.getTags(existing) }); }
        }
        if (occurrence) {
          const cur = await this.app.vault.cachedRead(existing);
          if (dupKey && cur.includes(dupKey)) return { ok: true, created: false, dup: true, word, file: existing.path };
          const apply = (data) => this.insertOccurrence(data, occurrence);
          if (this.app.vault.process) await this.app.vault.process(existing, apply);
          else await this.app.vault.modify(existing, apply(cur));
          this.recordEncounter(existing, "add");
        }
        if (!alias) this.scheduleRebuild();
        return { ok: true, created: false, word: existing.basename, alias: alias || undefined, file: existing.path };
      }
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      let content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word, date: todayStr() });
      if (occurrence) content = this.insertOccurrence(content, occurrence);
      // 别名注入到 frontmatter 再建文件,保证 metadataCache 第一时间就包含别名
      if (alias) content = injectAlias(content);
      const file = await this.app.vault.create(targetPath, content);
      this.recordEncounter(file, "add");
      this.rebuildIndex(false);
      // 保险:metadataCache 偶尔延迟,手动确保别名进索引
      if (alias) { const ak = alias.toLowerCase(); if (!this.index.has(ak)) this.index.set(ak, { display: alias, file, isAlias: true, tags: new Set() }); }
      return { ok: true, created: true, word, alias: alias || undefined, file: file.path };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  }
  async bridgeDeleteWord(key) {
    const k = String(key || "").toLowerCase();
    const e = this.index.get(k);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    if (e.inline) return { ok: false, error: "inline-readonly" };
    try {
      await this.app.vault.trash(e.file, true);
      this.rebuildIndex(false);
      return { ok: true, deleted: e.display, file: e.file.path };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  }
  async bridgeTagWord(payload) {
    const key = String((payload && payload.key) || "").toLowerCase();
    const tag = String((payload && payload.tag) || "").toLowerCase().replace(/^#/, "");
    const action = String((payload && payload.action) || "add");
    if (!tag) return { ok: false, error: "empty-tag" };
    const e = this.index.get(key);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    if (e.inline) return { ok: false, error: "inline-readonly" };
    try {
      let resultTags = [];
      // 用 Obsidian 官方 API 改 frontmatter:正确处理 null/字符串/数组/各种缩进,自动规范序列化
      await this.app.fileManager.processFrontMatter(e.file, (fm) => {
        let arr = fm.tags ?? fm.tag ?? [];
        if (typeof arr === "string") arr = arr.split(/[,，;；\s]+/);
        if (!Array.isArray(arr)) arr = [arr];
        arr = arr.map((s) => String(s).trim().replace(/^#/, "").toLowerCase()).filter((t) => t && t !== "null");
        if (action === "remove") arr = arr.filter((t) => t !== tag);
        else if (!arr.includes(tag)) arr.push(tag);
        arr = [...new Set(arr)];
        if (arr.length) fm.tags = arr; else delete fm.tags;
        // 用过 tag(单数)的笔记顺手清掉,避免两个键并存
        if (fm.tag != null) delete fm.tag;
        resultTags = arr;
      });
      this.rebuildIndex(false);
      // metadataCache 延迟兜底:手动更新索引中此词(及同文件别名)的 tags,让 /words 高亮配色即时刷新
      const tagSet = new Set(resultTags);
      for (const [k, v] of this.index) { if (v.file === e.file) v.tags = tagSet; }
      return { ok: true, key, tag, action: action === "remove" ? "removed" : "added", tags: resultTags };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  }
  // 把 line 追加到指定标题小节末尾(在子标题/代码块之前);没这个标题就在文末新建。
  // headingLine:完整标题行(级别 + 文字,比如 "#### 出处",可以是用户在设置里自定义的任意级别/文字);
  // legacyNames:识别时额外认的旧标题文字(不认级别,只认文字,比如"例句"改名"出处"前的老笔记),但新建小节永远用 headingLine。
  insertUnderHeading(data, headingLine, line, legacyNames) {
    const headingText = headingLine.replace(/^#{1,6}[ \t]*/, "").trim() || headingLine;
    const names = [headingText, ...(legacyNames || [])].map(escapeRe).join("|");
    const re = new RegExp("(^|\\n)#{1,6}[ \\t]*(?:" + names + ")[^\\n]*\\n");
    const m = re.exec(data);
    if (!m) return this.appendBeforeLexisBlock(data, `${headingLine}\n${line}`);
    const headEnd = m.index + m[0].length;
    const after = data.slice(headEnd);
    let stop = after.search(/\n#{1,6}[ \t]|\n```/);
    if (stop < 0) stop = after.length;
    let section = after.slice(0, stop).replace(/[ \t]*\n+$/, "");
    const tail = after.slice(stop);
    const sep = section ? "\n" : "";
    const newSection = section + sep + line + "\n";
    const tailFixed = /^\n*```/.test(tail) ? "\n" + tail.replace(/^\n+/, "") : tail;
    return data.slice(0, headEnd) + newSection + tailFixed;
  }
  appendBeforeLexisBlock(data, blockText) {
    const content = String(data || "");
    const match = /(^|\n)```lexis\b/.exec(content);
    const at = match ? match.index + match[1].length : -1;
    if (at >= 0) {
      const before = content.slice(0, at).replace(/\s*$/, "");
      const after = content.slice(at).replace(/^\n+/, "");
      return before + (before ? "\n\n" : "") + blockText.trim() + "\n\n" + after;
    }
    const before = content.replace(/\s*$/, "");
    return before + (before ? "\n\n" : "") + blockText.trim() + "\n";
  }
  renderTemplate(template, vars) {
    let out = String(template || "");
    for (const [key, value] of Object.entries(vars || {})) {
      out = out.replace(new RegExp(`\\{\\{${escapeRe(key)}\\}\\}`, "g"), String(value ?? ""));
    }
    return out;
  }
  occurrenceTemplateDefinition() {
    const raw = String(this.settings.occurrenceTemplate ?? DEFAULT_SETTINGS.occurrenceTemplate).trim();
    if (!raw) return null;
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    const first = (lines[0] || "").trim();
    if (/^#{1,6}[ \t]+/.test(first)) return { heading: first, item: lines.slice(1).join("\n").trim() };
    return { heading: "", item: raw };
  }
  occurrenceHeadingText() {
    const heading = this.occurrenceTemplateDefinition()?.heading || "";
    return heading.replace(/^#{1,6}[ \t]*/, "").trim();
  }
  occurrenceSentenceFromSection(section) {
    const item = this.occurrenceTemplateDefinition()?.item || "";
    const templateLine = item.split("\n").find((line) => line.includes("{{sentence}}"));
    if (templateLine) {
      const tokenRe = /\{\{(word|sentence|source|sourceSuffix|date)\}\}/g;
      const source = "(?:\\[\\[[^\\]]+\\]\\]|\\[[^\\]]+\\]\\([^\\n]+\\)|[^\\n]*?)";
      const sourceSuffix = `(?:\\s*——\\s*${source})?`;
      let pattern = "^\\s*", last = 0, match;
      const literal = (text) => escapeRe(text).replace(/\s+/g, "\\s+");
      while ((match = tokenRe.exec(templateLine))) {
        pattern += literal(templateLine.slice(last, match.index));
        if (match[1] === "sentence") pattern += "(.+?)";
        else if (match[1] === "source") pattern += source;
        else if (match[1] === "sourceSuffix") pattern += sourceSuffix;
        else pattern += "[^\\n]*?";
        last = match.index + match[0].length;
      }
      pattern += literal(templateLine.slice(last)) + "\\s*$";
      const re = new RegExp(pattern);
      for (const line of String(section || "").split("\n")) {
        const found = re.exec(line);
        if (found?.[1]) return found[1].trim();
      }
    }
    // 旧笔记兼容：固定引用行 + 行尾来源链接。
    const line = String(section || "").split("\n").map((s) => s.trim()).find((s) => s.startsWith(">"));
    if (!line) return "";
    return line.replace(/^>\s*/, "")
      .replace(/\s*——\s*(?:\[\[[^\]]*\]\]|\[[^\]]*\]\([^\n]+\))\s*$/, "")
      .trim();
  }
  insertOccurrence(data, vars) {
    const definition = this.occurrenceTemplateDefinition();
    if (!definition) return data;
    const source = String(vars?.source || "");
    const values = { ...vars, source, sourceSuffix: source ? ` —— ${source}` : "" };
    const item = this.renderTemplate(definition.item, values).trim();
    if (!item) return data;
    if (definition.heading) {
      const heading = this.renderTemplate(definition.heading, values).trim();
      return this.insertUnderHeading(data, heading, item, ["例句", "出处"]);
    }
    return this.appendBeforeLexisBlock(data, item);
  }
  // 批注小节标题行:设置里可以填完整一行(级别+文字,比如 "## 引用"),也可以只填文字(默认按 #### 级别);留空用默认 "#### 批注"
  annotationHeadingLine() {
    const v = (this.settings.annotationHeading || "").trim();
    if (!v) return "#### 批注";
    return /^#{1,6}[ \t]/.test(v) ? v : `#### ${v}`;
  }
  annotationHeadingText() { return this.annotationHeadingLine().replace(/^#{1,6}[ \t]*/, "").trim() || "批注"; }
  // 网页悬浮卡批注:纯文字写进已有词笔记的批注小节(词笔记里它自然落在出处等段附近)
  async bridgeAnnotate(payload) {
    const text = String((payload && (payload.note ?? payload.text)) || "").trim().replace(/\r?\n+/g, " ");
    if (!text) return { ok: false, error: "empty-note" };
    const key = String((payload && (payload.key ?? payload.word)) || "").trim().toLowerCase();
    const e = this.index.get(key);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    if (e.inline) return { ok: false, error: "inline-readonly" };
    const line = `> ${text}`;
    try {
      const apply = (data) => this.insertUnderHeading(data, this.annotationHeadingLine(), line, ["批注"]);
      if (this.app.vault.process) await this.app.vault.process(e.file, apply);
      else await this.app.vault.modify(e.file, apply(await this.app.vault.cachedRead(e.file)));
      this._occCache.clear();
      return { ok: true, key, file: e.file.path };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  }
  // 切掉开头的 frontmatter,返回 { fm, body }
  splitFrontmatter(content) {
    const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content || "");
    if (m && m.index === 0) return { fm: m[0], body: (content || "").slice(m[0].length) };
    return { fm: "", body: content || "" };
  }
  // 判断一篇词笔记是不是"只有模板骨架"(去掉 frontmatter / 代码块 / 批注小节 / 所有标题后没有任何文字)
  // 用于:移动到别的词典时,空骨架可以安全地重套新词典模板,有正文则只挪文件不动内容。
  isScaffoldOnly(content) {
    let s = this.splitFrontmatter(content).body;
    s = s.replace(/```[\s\S]*?```/g, "");                                    // 围栏代码块(lexis/heatmap 等)
    const annotNames = [this.annotationHeadingText(), "批注"].map(escapeRe).join("|");
    s = s.replace(new RegExp("(^|\\n)#{1,6}[ \\t][^\\n]*(?:" + annotNames + ")[\\s\\S]*?(?=\\n#{1,6}[ \\t]|$)", "g"), "\n"); // 批注小节(另行保留)
    s = s.replace(/^#{1,6}[ \t].*$/gm, "");                                  // 所有标题(模板骨架)
    return !/[A-Za-z0-9一-鿿]/.test(s);                      // 没有任何字母/数字/汉字 = 只是骨架
  }
  // 把已有词移动到另一个词典文件夹。默认只移动文件(正文/批注/出处全保留);
  // 但若该词笔记是空骨架且目标词典有自己的模板,则顺手重套模板——并把批注小节内容迁移过去。
  async bridgeMoveWord(payload) {
    const key = String((payload && (payload.key ?? payload.word)) || "").trim().toLowerCase();
    const folder = this.normalizeFolder((payload && payload.folder) || "");
    const e = this.index.get(key);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    if (e.inline) return { ok: false, error: "inline-readonly" };
    if (folder && !this.dictFolders().includes(folder)) return { ok: false, error: "bad-folder" };
    const target = (folder ? folder + "/" : "") + e.file.name;
    if (target === e.file.path) return { ok: true, key, file: e.file.path, moved: false };
    if (this.app.vault.getAbstractFileByPath(target)) return { ok: false, error: "exists" };
    try {
      let oldContent = "";
      try { oldContent = await this.app.vault.cachedRead(e.file); } catch (_e) {}
      const tplRaw = await this.templateForFolder(folder);
      const retemplate = tplRaw != null && tplRaw.trim() !== "" && this.isScaffoldOnly(oldContent);
      await this.ensureFolder(folder);
      await this.app.fileManager.renameFile(e.file, target);
      let reTemplated = false;
      if (retemplate) {
        const annot = this.extractSection(oldContent, [this.annotationHeadingText(), "批注"]).replace(/```[\s\S]*?```/g, "").trim(); // 迁移批注(去掉尾随的 lexis 代码块)
        const oldFm = this.splitFrontmatter(oldContent).fm;             // 保留原 frontmatter(标签/别名/复习数据)
        const filled = tplRaw.replace(/\{\{word\}\}/g, e.display).replace(/\{\{date\}\}/g, todayStr());
        const tplBody = this.splitFrontmatter(filled).body.replace(/^\s+/, "");
        let nc = (oldFm ? oldFm.replace(/\s*$/, "\n") : "") + (oldFm ? "\n" : "") + tplBody;
        if (annot) nc = this.insertUnderHeading(nc, this.annotationHeadingLine(), annot, ["批注"]);
        const fileNow = this.app.vault.getAbstractFileByPath(target);
        if (fileNow instanceof TFile) {
          if (this.app.vault.process) await this.app.vault.process(fileNow, () => nc);
          else await this.app.vault.modify(fileNow, nc);
          reTemplated = true;
        }
      }
      this.rebuildIndex(false);
      return { ok: true, key, file: target, folder, moved: true, reTemplated };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  }
  // 网页被动相遇:扩展按「词+当天」去重后批量报过来的 key 列表,这边再按同样的 (文件+当天) 去重记一次
  // (两边都去重不是多余——扩展端只挡"同一页反复扫描",挡不住"今天换个 tab 又开了同一个页面")。
  async bridgeEncounter(payload) {
    const keys = Array.isArray(payload && payload.keys) ? payload.keys : [];
    let recorded = 0;
    for (const k of keys) {
      const e = this.index.get(String(k || "").toLowerCase());
      if (e && !e.inline && e.file instanceof TFile) { this.passiveEncounter(e.file); recorded++; }
    }
    return { ok: true, recorded };
  }
  bridgeWordList() {
    const words = [];
    // 已归档/已淘汰的词不发给浏览器扩展——扩展自己没有这套生命周期概念,最简单的处理是压根不让它高亮
    for (const [key, e] of this.index) { if (e.archived || e.retired) continue; words.push({ key, word: e.display, alias: !!e.isAlias, inline: !!e.inline, tags: [...(e.tags || [])], file: e.file && e.file.path, color: this.colorForEntry(e), opacity: e.inline ? this.highlightAlphaForEntry(e) : undefined, visible: this.highlightVisibleForEntry(e), wstyle: this.styleKindForEntry(e) }); }
    return {
      ok: true, version: this.manifest.version, count: words.length, words,
      styleConfig: {
        tagRules: this.settings.tagRules || [],
        highlightColor: this.effectiveHighlightColor(),
        highlightOpacity: this.settings.highlightOpacity,
        highlightStyle: this.settings.highlightStyle,
        excludeTags: this.parseTags(this.settings.excludeTags),
        dicts: this.dictFolders(),
        dictColors: this.dictColorMap(),
        popoverWidth: this.settings.popoverWidth,
        popoverMaxHeight: this.settings.popoverMaxHeight,
        popoverFontSize: this.settings.popoverFontSize,
        hoverDelayMs: this.settings.hoverDelayMs,
      },
    };
  }
  // name 可以是单个标题文字,也可以是一个数组(比如当前自定义名字 + 旧的默认名字,任一命中都算)
  extractSection(md, name) {
    const names = (Array.isArray(name) ? name : [name]).map(escapeRe).join("|");
    const re = new RegExp("^#{1,6}[ \\t].*(?:" + names + ").*$", "m");
    const m = re.exec(md || "");
    if (!m) return "";
    const rest = md.slice(m.index + m[0].length);
    const next = /^#{1,6}[ \t]/m.exec(rest);
    return (next ? rest.slice(0, next.index) : rest).trim();
  }
  cardHeading(entry) {
    if (entry.inline) return { title: entry.display, subtitle: entry.category || "" };
    const title = entry.file?.basename || entry.display;
    const subtitle = entry.isAlias && entry.display.toLowerCase() !== title.toLowerCase() ? entry.display : "";
    return { title, subtitle };
  }
  bridgeMathCss() {
    const style = document.getElementById("MJX-CHTML-styles");
    return style?.sheet ? Array.from(style.sheet.cssRules, (rule) => rule.cssText).join("\n") : "";
  }
  async bridgeWordDetail(key) {
    const k = String(key || "").toLowerCase();
    const e = this.index.get(k);
    if (!e) return { ok: false, error: "not-found" };
    if (e.inline) {
      const heading = this.cardHeading(e);
      return {
        ok: true, word: e.display, base: e.display, file: e.file.path,
        vault: this.app.vault.getName(), inline: true, category: e.category, markdown: e.annotation || "*(无批注)*",
        title: heading.title, subtitle: heading.subtitle,
        html: await this.renderInlineEntryHtml(e),
      };
    }
    this.recordEncounter(e.file, "hover");
    this.hoverFeedback(e.file);
    let body = "";
    try {
      const raw = await this.app.vault.cachedRead(e.file);
      body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```lexis[\s\S]*?```/g, "");
      body = this.compactSections(body.trim());
    } catch (_e) {}
    const html = await this.bridgeFullHtml(e.file, e.display);
    const heading = this.cardHeading(e);
    return {
      ok: true, word: e.display, base: e.file && e.file.basename, file: e.file && e.file.path,
      vault: this.app.vault.getName(),
      title: heading.title, subtitle: heading.subtitle,
      alias: !!e.isAlias, tags: [...(e.tags || [])],
      meaning: this.extractSection(body, ["意思", "意义"]),
      markdown: body, html, mathCss: html.includes("<mjx-container") ? this.bridgeMathCss() : "",
    };
  }
  bridgeOlink(path, base) {
    const vault = encodeURIComponent(this.app.vault.getName());
    return `<a class="lexis-web-ilink" href="obsidian://open?vault=${vault}&file=${encodeURIComponent(path)}">${escHtml(base)}</a>`;
  }
  occurrenceLabel(occurrence) {
    if (!occurrence?.file) return "";
    return occurrence.page ? `${occurrence.file.basename} p.${occurrence.page}` : occurrence.file.basename;
  }
  occurrenceLinkPath(occurrence) {
    if (!occurrence?.file) return "";
    return occurrence.file.path + (occurrence.page ? `#page=${occurrence.page}` : "");
  }
  async renderInlineEntryHtml(entry) {
    const div = document.createElement("div");
    const comp = new Component(); comp.load();
    try {
      await this.renderInlineEntryInto(div, entry, comp);
      this.bridgePostProcess(div);
      return div.innerHTML;
    } finally { comp.unload(); }
  }
  bridgePostProcess(div) {
    const vault = encodeURIComponent(this.app.vault.getName());
    div.querySelectorAll("a.internal-link").forEach((a) => {
      const lp = a.getAttribute("data-href") || a.getAttribute("href") || a.textContent || "";
      a.setAttribute("href", `obsidian://open?vault=${vault}&file=${encodeURIComponent(lp)}`);
      a.removeAttribute("data-href");
      a.classList.add("lexis-web-ilink");
    });
    div.querySelectorAll("img").forEach((img) => { if (!/^https?:/i.test(img.getAttribute("src") || "")) img.remove(); });
    div.querySelectorAll(".internal-embed, iframe").forEach((x) => x.remove());
  }
  // 整篇笔记渲成 HTML,且 ```lexis 块在原位渲染(保持文档顺序),供浏览器扩展悬浮卡用
  async bridgeFullHtml(file, display) {
    let raw = "";
    try { raw = await this.app.vault.cachedRead(file); } catch (_e) { return ""; }
    raw = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
    // 把每个 lexis 块换成占位符,先整体渲染(保留标题与顺序),再回填各块算好的 HTML
    const blocks = [];
    raw = raw.replace(/```lexis\s*([\s\S]*?)```/g, (_w, inner) => { const i = blocks.length; blocks.push((inner || "").trim()); return `\n\n@@LEXIS${i}@@\n\n`; });
    const div = document.createElement("div");
    const comp = new Component(); comp.load();
    try {
      await renderLexisMarkdown(this.app, raw, div, file.path || "", comp);
    } catch (_e) {}
    for (let i = 0; i < blocks.length; i++) {
      const marker = `@@LEXIS${i}@@`;
      const host = Array.from(div.querySelectorAll("p, div, li")).find((el) => el.textContent.trim() === marker);
      const html = await this.lexisBlockHtml(file, display, blocks[i]);
      if (!host) continue;
      if (!html || !html.trim()) {
        // 块为空 → 连同它紧挨着的空标题一起去掉(等价于 compactSections 丢空段)
        const prev = host.previousElementSibling;
        host.remove();
        if (prev && /^H[1-6]$/.test(prev.tagName)) { const nx = prev.nextElementSibling; if (!nx || /^H[1-6]$/.test(nx.tagName)) prev.remove(); }
      } else {
        const wrap = document.createElement("div");
        wrap.innerHTML = html;
        host.replaceWith(...Array.from(wrap.childNodes));
      }
    }
    // 压缩空段标题:遍历 h1~h6,到下一个标题之间无内容且无 .lexis-web-* 块则删除
    (function compact(container) {
      const hs = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const rm = [];
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i], next = hs[i + 1] || null;
        let sib = h.nextElementSibling, ok = false;
        while (sib && sib !== next) {
          const nextSib = sib.nextElementSibling;
          if ((sib.textContent || "").trim()) { ok = true; break; }
          if (sib.querySelector && sib.querySelector(".lexis-web-sec,.lexis-web-rel,.lexis-web-occ,.lexis-web-curve,.lexis-web-dim")) { ok = true; break; }
          sib = nextSib;
        }
        if (!ok) rm.push(h);
      }
      for (const h of rm) h.remove();
    })(div);
    // MarkdownRenderer.render() resolve 时,LaTeX 的 MathJax 排版还在异步队列里没跑完;
    // 这里要把渲染好的 HTML 序列化发给浏览器扩展(扩展自己没有 MathJax),必须先等排版队列清空,
    // 不然抓到的还是没转换的公式源码,发过去以后就永远定格在那个状态了。
    if (finishRenderMath) { try { await finishRenderMath(); } catch (_e) {} }
    this.bridgePostProcess(div);
    const out = div.innerHTML;
    comp.unload();
    return out;
  }
  // 单个 ```lexis 块 → HTML(对应 renderLexisBlock 的各模式,带 obsidian:// 链接)
  async lexisBlockHtml(file, display, src) {
    const parts = (src || "").trim().split(/\s+/).filter(Boolean);
    const m = (parts[0] || "").toLowerCase();
    const typeArg = parts.slice(1).join(" ");
    const olink = (p, b) => this.bridgeOlink(p, b);
    const relMap = (bags, types) => { const map = new Map(); for (const t of types) for (const r of (bags[t] || [])) map.set(r.path, r.basename); return map; };
    // 派生词
    if (m === "derived" || m === "派生") {
      const resolved = this.app.metadataCache.resolvedLinks || {};
      const map = new Map();
      for (const s in resolved) if (this.inVocabFolder(s) && resolved[s] && resolved[s][file.path]) { const sf = this.app.vault.getAbstractFileByPath(s); if (sf) map.set(s, sf.basename); }
      let h = `<div class="lexis-web-sec">🌱 派生词 (${map.size})</div>`;
      if (!map.size) return h + `<div class="lexis-web-occ lexis-web-dim">(还没有单词链到这个词根)</div>`;
      return h + `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
    }
    const showCurve = m === "" || m === "curve" || m === "all";
    const showRelated = m === "" || m === "refs" || m === "ref" || m === "rel" || m === "related" || m === "all";
    const showOcc = (m === "" || m === "refs" || m === "ref" || m === "occ" || m === "all") && this.settings.showOccurrences;
    let html = "";
    if (showCurve) {
      const card = this.readCard(file);
      const svg = this.buildCurveSVG(card);
      if (svg) { const due = card.due ? ` · 下次复习 ${String(card.due).slice(0, 10)}` : ""; html += `<div class="lexis-web-sec">🧠 记忆曲线（复习日期 × 保留率${due}）</div><div class="lexis-web-curve">${svg}</div>`; }
    }
    if (showRelated && this.settings.showRelated) {
      try {
        const { out, inc } = await this.findTypedRelations(file);
        if ((m === "rel" || m === "related") && typeArg) {
          // 某标题下的块:只显示「反向未回链」的(正向手写链接已在正文里渲染了)
          const types = typeArg === "辨析" ? ["辨析", "相关"] : [typeArg];
          const outPaths = new Set(); for (const t of types) for (const r of (out[t] || [])) outPaths.add(r.path);
          const map = new Map(); for (const t of types) for (const r of (inc[t] || [])) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
          if (map.size) html += `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
        } else {
          // 不带类型(如悬浮卡空块):全部分类,各自带标题
          for (const t of ["近义词", "同根词", "形近词", "辨析", "相关"]) {
            const map = relMap(out, [t]); for (const [p, b] of relMap(inc, [t])) map.set(p, b);
            if (!map.size) continue;
            html += `<div class="lexis-web-sec">🔗 ${escHtml(t)}</div><div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
          }
        }
      } catch (_e) {}
    }
    if (showOcc) {
      try {
        const list = (await this.findOccurrences(display)).filter((o) => true);
        const curated = await this.getCuratedSourcePaths(file);
        const fresh = list.filter((o) => !curated.has(o.file.basename.toLowerCase()));
        html += `<div class="lexis-web-sec">📍 出现过的地方 (${fresh.length})</div>`;
        if (!fresh.length) html += `<div class="lexis-web-occ lexis-web-dim">(没有未收藏的新出处)</div>`;
        else {
          // 出处走 Markdown 渲染(不然 LaTeX 只会是原始 $...$ 文本),同批渲染完再统一 flush 一次数学排版队列
          const comp = new Component(); comp.load();
          const rendered = [];
          for (const o of fresh) {
            const d = document.createElement("div");
            await renderLexisMarkdown(this.app, o.sentence, d, file.path, comp);
            rendered.push({ d, o });
          }
          if (finishRenderMath) { try { await finishRenderMath(); } catch (_e) {} }
          for (const { d, o } of rendered) {
            this.boldMatchesInPlace(d, display);
            html += `<div class="lexis-web-occ">${d.innerHTML} <span class="lexis-web-occ-src">— ${olink(this.occurrenceLinkPath(o), this.occurrenceLabel(o))}</span></div>`;
          }
          comp.unload();
        }
      } catch (_e) {}
    }
    return html;
  }

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
  // 轻量词条只存在于一份资料笔记里,不建单独文件、也不参与 FSRS。最近标题是分类;设置页按分类统一配色。
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
        headingStack[level - 1] = heading[2].trim();
        continue;
      }
      const at = line.indexOf(delimiter);
      if (at < 0) continue;
      const left = line.slice(0, at).trim().replace(/^[-*+]\s+/, "");
      const right = line.slice(at + delimiter.length).trim();
      if (!left || /^#/.test(left)) continue;
      // 旧版 color:: 指令不再参与配色,但继续跳过它,避免被错误识别为词条。
      if (left.toLowerCase() === "color") continue;
      const categories = headingStack.filter(Boolean).reverse();
      const category = categories[0] || "";
      out.push({ display: left, file, isAlias: false, tags: new Set(), inline: true, annotation: right, category, categories, line: lineNo });
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
    const inlineCategoryCounts = new Map();
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
        for (const category of entry.categories || []) inlineCategoryCounts.set(category, (inlineCategoryCounts.get(category) || 0) + 1);
        // 单文件词典优先,避免同名人名/术语意外覆盖已有可复习词条。
        if (!index.has(key)) { index.set(key, entry); inlineEntries++; }
      }
      if (entries.length) selfKeysByPath.set(entries[0].file.path, own);
    }
    this.vocabPaths = vocabPaths;
    this.inlineSourcePaths = inlineSourcePaths;
    this.inlineCategories = [...inlineCategoryCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
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
  // 先取最近标题;没有专属色就依次回退到父标题。同名标题在所有资料笔记中共享一条设置规则。
  inlineCategoryColor(entry) {
    if (!entry?.inline) return "";
    const colors = this.settings.inlineCategoryColors || {};
    for (const category of entry.categories || [entry.category]) {
      const color = String(colors[category] || "").trim();
      if (color) return color;
    }
    return "";
  }
  // 分类透明度和颜色一样按「最近标题 → 父标题」回退；没有单独配置时，沿用全局透明度。
  inlineCategoryOpacity(entry) {
    if (!entry?.inline) return null;
    const opacities = this.settings.inlineCategoryOpacity || {};
    for (const category of entry.categories || [entry.category]) {
      if (!Object.prototype.hasOwnProperty.call(opacities, category)) continue;
      const opacity = Number(opacities[category]);
      if (!isNaN(opacity)) return Math.max(0.1, Math.min(1, opacity));
    }
    return null;
  }
  highlightVisibleForEntry(entry) {
    if (!entry?.inline) return true;
    const visibility = this.settings.inlineCategoryHighlight || {};
    for (const category of entry.categories || [entry.category]) {
      if (Object.prototype.hasOwnProperty.call(visibility, category)) return visibility[category] !== false;
    }
    return true;
  }
  highlightAlphaForEntry(entry) {
    const inlineOpacity = this.inlineCategoryOpacity(entry);
    const opacity = inlineOpacity == null ? (this.settings.highlightOpacity ?? 1) : inlineOpacity;
    return opacity * this.fadeAlphaFor(entry);
  }
  // 某文件所属词典(文件夹)的专属色;子文件夹归父词典,取最长匹配。网页和 ob 内共用同一份 dictColorMap
  dictColorForFile(file) {
    const path = file && file.path;
    if (!path) return null;
    const i = path.lastIndexOf("/");
    const wf = i > 0 ? path.slice(0, i) : "";
    if (!wf) return null;
    const map = this.dictColorMap();
    if (map[wf]) return map[wf];
    let best = null, bestLen = -1;
    for (const df in map) {
      if (df && (wf === df || wf.startsWith(df + "/")) && df.length > bestLen) { best = map[df]; bestLen = df.length; }
    }
    return best;
  }
  inlineStyleForEntry(entry, opts) {
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
    if (opts && opts.pdf) return "text-decoration:none;";
    // 已归档:span 照样包(hover/click 事件代理不能丢),但视觉上完全不显示——跟 PDF 那层"隐形代理"是同一个思路。
    if (entry && entry.archived) return "text-decoration:none;";
    if (!this.highlightVisibleForEntry(entry)) return "text-decoration:none;background:none;";
    const alpha = this.highlightAlphaForEntry(entry);
    const c = this.applyAlpha(color, alpha);
    if (styleKind === "background") return `background-color:${c};border-radius:3px;padding:0 1px;text-decoration:none;`;
    const line = styleKind === "underline" ? "solid" : "wavy";
    return `text-decoration:underline ${line} ${c};text-underline-offset:3px;`;
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
  wrapMatchesInElement(el, rejectSelector, styleOpts, excludeKeys) {
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
            if (!target?.matches?.(".page, .textLayer, .canvasWrapper, canvas")) continue;
            if (!target.closest?.(".page")) continue;
            const page = target.classList?.contains("page") ? target : target.closest(".page");
            const layer = target.classList?.contains("textLayer") ? target : page?.querySelector(":scope > .textLayer");
            if (layer) { this.markPdfGeometryChanging(layer); geometryChanged = true; }
            continue;
          }
          for (const node of mu.addedNodes) {
            if (!node || node.nodeType !== 1) continue;
            if (node.classList?.contains("lexis-hl") || node.closest?.(".lexis-hl")) continue;
            if (node.classList && node.classList.contains("textLayer")) { this.markPdfGeometryChanging(node); geometryChanged = true; }
            else if (node.querySelectorAll) node.querySelectorAll(".textLayer").forEach((l) => { this.markPdfGeometryChanging(l); geometryChanged = true; });
            const layer = node.closest && node.closest(".textLayer");
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
    if (getComputedStyle(page).position === "static") page.style.position = "relative";
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
    hl.style.cssText = `position:absolute;left:${layer.offsetLeft}px;top:${layer.offsetTop}px;width:${layerW}px;height:${layerH}px;z-index:1;pointer-events:none;`;
    hl.innerHTML = "";
    // 4. 遍历内联 .lexis-hl,在 overlay 层画出对应荧光笔矩形
    const spans = layer.querySelectorAll(".lexis-hl");
    for (const s of spans) {
      const key = s.dataset.lexisKey;
      if (!key) continue;
      const entry = this.index.get(key);
      if (!entry) continue;
      if (entry.archived || !this.highlightVisibleForEntry(entry)) continue; // 保留 hover 代理，只不画可视高亮
      try {
        const color = this.colorForEntry(entry);
        const alpha = Math.max(0.04, Math.min(0.75, this.highlightAlphaForEntry(entry) * 0.65));
        const rects = Array.from(s.getClientRects()).filter((r) => r.width && r.height);
        for (const rect of rects.length ? rects : [s.getBoundingClientRect()]) {
          const d = document.createElement("div");
          d.className = "lexis-pdf-hl";
          d.dataset.lexisKey = key;
          d.style.cssText = `position:absolute;left:${(rect.left - hlBB.left) / scaleX}px;top:${(rect.top - hlBB.top) / scaleY}px;width:${rect.width / scaleX}px;height:${rect.height / scaleY}px;background:${this.applyAlpha(color, alpha)};border-radius:2px;pointer-events:auto;`;
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
        if (!node || node.nodeType !== 1) continue;
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
      const { ViewPlugin, Decoration } = require("@codemirror/view");
      const { RangeSetBuilder, StateEffect } = require("@codemirror/state");
      const editorInfoField = obsidian.editorInfoField;
      const plugin = this;
      const refreshEffect = StateEffect.define();
      this._liveRefreshEffect = refreshEffect;
      const ext = ViewPlugin.fromClass(
        class {
          constructor(view) { this.decorations = this.build(view); }
          update(u) {
            const indexChanged = u.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshEffect)));
            if (u.docChanged || u.viewportChanged || indexChanged) this.decorations = this.build(u.view);
          }
          build(view) {
            const builder = new RangeSetBuilder();
            if (!plugin.settings.enableHighlight || !plugin.settings.enableLivePreview || !plugin._pattern) return builder.finish();
            let selfKeys = null;
            if (editorInfoField) {
              try { const info = view.state.field(editorInfoField, false); if (info?.file?.path) selfKeys = plugin.selfKeysFor(info.file.path); } catch (_e) {}
            }
            const regex = new RegExp(plugin._pattern, "gi");
            for (const { from, to } of view.visibleRanges) {
              const text = view.state.doc.sliceString(from, to);
              regex.lastIndex = 0;
              let m;
              while ((m = regex.exec(text))) {
                const key = m[0].toLowerCase();
                if (selfKeys && selfKeys.has(key)) { if (m[0].length === 0) regex.lastIndex++; continue; }
                const start = from + m.index, end = start + m[0].length;
                const entry = plugin.index.get(key);
                if (entry && !entry.inline) plugin.passiveEncounter(entry.file);
                builder.add(start, end, Decoration.mark({ class: "lexis-hl", attributes: { "data-lexis-key": key, style: plugin.inlineStyleForEntry(entry) } }));
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
  parseFolders(text) { return (text || "").split(/[,，\n]/).map((s) => this.normalizeFolder(s)).filter(Boolean); }
  parseTags(text) { return (text || "").split(/[,，;；\s]+/).map((s) => s.trim().replace(/^#/, "").toLowerCase()).filter(Boolean); }
  vocabTagSet() { return new Set(this.parseTags(this.settings.vocabTags)); }
  excludeTagSet() { return new Set(this.parseTags(this.settings.excludeTags)); }
  // 词典表的文件夹列表 = 文件夹来源的单一真相
  dictFolders() { return (this.settings.dicts || []).map((d) => this.normalizeFolder(d && d.folder)).filter(Boolean); }
  // 一条词的最终高亮色(优先级:标签规则 > 词典色 > 全局兜底),返回解析后的真实 hex —— 网页和 ob 同一套优先级
  colorForEntry(e) {
    let color = this.effectiveHighlightColor();           // 全局兜底(留空=主题色,已解析)
    const dc = this.dictColorForFile(e && e.file);         // 词典映射
    if (dc) color = dc;
    if (e && e.tags && this.settings.tagRules && this.settings.tagRules.length) { // 标签映射(最高)
      const rule = this.settings.tagRules.find((r) => r.tag && e.tags.has(r.tag.toLowerCase()));
      if (rule && rule.color) color = rule.color;
    }
    const inlineColor = this.inlineCategoryColor(e);
    if (inlineColor) color = inlineColor;
    return color;
  }
  // 一条词的最终线型(标签规则可覆盖全局)
  styleKindForEntry(e) {
    let s = this.settings.highlightStyle || "wavy";
    if (e && e.tags && this.settings.tagRules && this.settings.tagRules.length) {
      const rule = this.settings.tagRules.find((r) => r.tag && e.tags.has(r.tag.toLowerCase()));
      if (rule && rule.style) s = rule.style;
    }
    return s;
  }
  // 全局高亮色的"实际值":留空(=主题强调色)时解析成真实 hex 发给网页,否则网页只能看到 var(--text-accent) 这种 ob 专用变量、读不到
  effectiveHighlightColor() {
    const c = (this.settings.highlightColor || "").trim();
    if (c) return c;
    try { return cssColorToHex(getComputedStyle(document.body).getPropertyValue("--text-accent")); }
    catch (_e) { return "#7c5cff"; }
  }
  // { 规范化文件夹: 颜色 },只含设了专属色的词典;供网页按所属词典着色
  dictColorMap() {
    const m = {};
    for (const d of this.settings.dicts || []) {
      const f = this.normalizeFolder(d && d.folder);
      const c = (d && d.color || "").trim();
      if (f && c) m[f] = c;
    }
    return m;
  }
  primaryVocabFolder() { return this.dictFolders()[0] || ""; } // 新建单词时落地的文件夹(取第一个)
  inFolderScope(path) { const fs = this.dictFolders(); return fs.length ? this.inScope(path, fs) : false; }
  // 某文件夹对应的模板:命中某词典行 → 完全按它的 template(留空=空白笔记,不再回退全局);
  // 没有对应词典行(极少见)→ 才用全局默认 newWordTemplate。这样"没给这个词典选模板"= 空白,符合直觉。
  templateForFolder(folder) {
    const f = this.normalizeFolder(folder);
    const row = (this.settings.dicts || []).find((d) => d && this.normalizeFolder(d.folder) === f);
    const p = (row ? (row.template || "") : (this.settings.newWordTemplate || "")).trim();
    return this.readTemplatePath(p);
  }
  isVocabFile(file) {
    if (!file || !file.path) return false;
    if (this.inFolderScope(file.path)) return true;
    const ts = this.vocabTagSet();
    if (ts.size) { for (const t of this.getTags(file)) if (ts.has(t)) return true; }
    return false;
  }
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
    const scope = this.parseFolders(this.settings.occurrenceFolders);
    const results = await this.occurrenceSearch.find(word, { limit, scope, includePdf: this.settings.includePdfOccurrences !== false });
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
    if (!map.size) return;
    container.createDiv({ cls: "lexis-section-title", text: `🌱 派生词 (${map.size})` });
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
      const names = [this.occurrenceHeadingText(), "例句", "出处"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return new Set();
      const set = new Set();
      const re = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
      let mm;
      while ((mm = re.exec(m[1]))) {
        const base = mm[1].trim().split("/").pop().replace(/\.(?:md|pdf)$/i, "");
        set.add(base.toLowerCase());
      }
      return set;
    } catch (_e) { return new Set(); }
  }
  sourceLinkTarget(file) { return file?.extension === "md" ? file.basename : file?.name || ""; }
  async addExampleToWord(wordFile, sentence, sourceFile, page) {
    if (sourceFile) {
      const curated = await this.getCuratedSourcePaths(wordFile);
      if (curated.has(sourceFile.basename.toLowerCase())) { new Notice(this.t("notice.occurrenceExists")); return true; }
    }
    const occurrence = {
      word: wordFile.basename,
      sentence: (sentence || "").trim(),
      source: sourceFile ? (page ? `[[${this.sourceLinkTarget(sourceFile)}#page=${page}|${sourceFile.basename} p.${page}]]` : `[[${this.sourceLinkTarget(sourceFile)}]]`) : "",
      date: todayStr(),
    };
    const apply = (data) => this.insertOccurrence(data, occurrence);
    try {
      if (this.app.vault.process) await this.app.vault.process(wordFile, apply);
      else { const d = await this.app.vault.read(wordFile); await this.app.vault.modify(wordFile, apply(d)); }
      this.recordEncounter(wordFile, "add");
      new Notice(this.t("notice.occurrenceSaved"));
      return true;
    } catch (err) { new Notice(this.t("notice.occurrenceFailed", { error: err?.message || err })); return false; }
  }

  // ---------- 生命周期(归档/常驻/淘汰) ----------
  // 只叠加在算法结果之上:这里不碰 lexis-s/d/due 等 FSRS 内部字段,那些只由真实复习事件驱动(applySchedule)。
  readLifecycle(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const status = fm["lexis-status"];
    return { archived: status === "archived", retired: status === "retired", pinned: !!fm["lexis-pinned"] };
  }
  // 归档 = 退出高亮 + 暂停复习队列,悬停仍可查;取消归档("恢复")默认走这条,FSRS 进度原样保留。
  // 重置为新词是恢复时的另一个选项,见 LexisRestoreModal,不在这个函数里做。
  async setArchived(file, archived) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (archived) fm["lexis-status"] = "archived";
      else delete fm["lexis-status"];
    });
    this.rebuildIndex(false);
  }
  async setPinned(file, pinned) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (pinned) fm["lexis-pinned"] = true;
      else delete fm["lexis-pinned"];
    });
    this.rebuildIndex(false);
  }
  // 淘汰 = 归档而非删除:退出高亮与复习,文件保留,但比"归档"更彻底——悬停也不再触发(不像归档还留一个隐形代理 span)。
  // 只从"淘汰法庭"候选列表的操作按钮触发,没有独立的命令/右键菜单入口(候选判定本身已经是入口了)。
  async setRetired(file, retired) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (retired) fm["lexis-status"] = "retired";
      else delete fm["lexis-status"];
    });
    this.rebuildIndex(false);
  }

  // ---------- 相遇记账(阶段 2) ----------
  // 只做"强相遇"记账:悬停查释义 / 划词加出处 / 打开词条笔记本身,都是现成代码路径上加一行记账,
  // 不额外采集停留时长/滚动/点击深度。数据存进插件自己 data 目录下的 sidecar JSON,不写 frontmatter——
  // 悬停很频繁,写 frontmatter 会不停刷新笔记 mtime 和 git 历史。
  encountersPath() { return `${this.app.vault.configDir}/plugins/${this.manifest.id}/encounters.json`; }
  async loadEncounters() {
    try { this._encounters = JSON.parse(await this.app.vault.adapter.read(this.encountersPath())) || {}; }
    catch (_e) { this._encounters = {}; }
  }
  // key 用词条文件的标题(不是命中它的具体别名/拼法)——别名和标题指向同一个文件,相遇次数要合并,不能按 key 分裂计数
  // 短时间内反复触发同一类相遇(比如鼠标在同一个词上晃出晃入,连续弹好几次悬浮卡)只算一次,靠 (词+类型) 的冷却时间去重
  recordEncounter(file, type) {
    if (!(file instanceof TFile)) return;
    const k = file.basename.toLowerCase();
    const now = Date.now();
    const dedupKey = k + ":" + type;
    if (!this._encounterDedup) this._encounterDedup = {};
    const last = this._encounterDedup[dedupKey];
    if (last && now - last < 60000) return; // 60 秒内的重复相遇不重复计数
    this._encounterDedup[dedupKey] = now;
    const e = this._encounters[k] || (this._encounters[k] = { hoverCount: 0, encounterCount: 0, lastEncounter: "" });
    e.encounterCount = (e.encounterCount || 0) + 1;
    if (type === "hover") e.hoverCount = (e.hoverCount || 0) + 1;
    e.lastEncounter = todayStr();
    if (this._encSaveTimer) window.clearTimeout(this._encSaveTimer);
    this._encSaveTimer = window.setTimeout(() => this.saveEncounters(), 1500); // 内存攒批、防抖落盘,不是每次相遇都写一次盘
  }
  // 被动相遇(阶段 4):高亮装饰在打开的文件里实际渲染出来,就算词出现在你面前过一次——比悬停更弱的信号,
  // 只证明"出现过",不证明"注意到了"。按「词+当天」去重,不是每次重渲染(滚动/切标签页/实时预览重算)都记一次。
  // 这个检查要挂在高亮渲染的热路径上(每个匹配到的 span 都会过一遍),所以只用一次 Set.has,不做更重的事。
  passiveEncounter(file) {
    if (!(file instanceof TFile)) return;
    const dayKey = file.path + "|" + todayStr();
    if (this._passiveSeenToday.has(dayKey)) return;
    this._passiveSeenToday.add(dayKey);
    this.recordEncounter(file, "passive");
  }
  async saveEncounters() {
    this._encSaveTimer = 0;
    try { await this.app.vault.adapter.write(this.encountersPath(), JSON.stringify(this._encounters)); } catch (_e) {}
  }
  // 悬停 = 一次失败的提取(没想起来才要查)。这个词的到期日如果还很远,说明"排期偏晚了",拉近一点提醒尽快复习——
  // 只挪 lexis-due,绝不碰 stability/difficulty,也不伪造一次复习评分(FSRS 内部状态只能由真实复习事件驱动)。
  async hoverFeedback(file) {
    if (!this.settings.hoverFeedback || !(file instanceof TFile)) return;
    if (this.readLifecycle(file).archived) return; // 已归档:悬停只记账,不回流
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    if (fm["lexis-s"] == null || !fm["lexis-due"]) return; // 还没背过/没有到期日可提前
    const today = todayStr();
    const due = String(fm["lexis-due"]).slice(0, 10);
    const threshold = addDaysStr(today, this.settings.hoverFeedbackDays ?? 3);
    if (due <= threshold) return; // 本来就不算远,不用管
    await this.app.fileManager.processFrontMatter(file, (fm2) => { fm2["lexis-due"] = today; });
  }

  // ---------- FSRS 调度 ----------
  readCard(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    return {
      s: fm["lexis-s"], d: fm["lexis-d"], due: fm["lexis-due"], last: fm["lexis-last"],
      reps: fm["lexis-reps"], lapses: fm["lexis-lapses"],
      history: Array.isArray(this.settings.reviewHistory?.[file.path]) ? this.settings.reviewHistory[file.path] : [],
    };
  }
  cardRetrievability(card, date = todayStr()) {
    const s = Number(card?.s);
    if (!s || isNaN(s) || !card?.last) return 0;
    return FSRS.retrievability(Math.max(0, daysBetween(card.last, date)), s);
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
  async logReview(file, sched, grade, retentionBefore) {
    const t = todayStr();
    this.settings.reviewLog[t] = (this.settings.reviewLog[t] || 0) + 1;
    if (file?.path) {
      const history = Array.isArray(this.settings.reviewHistory[file.path]) ? this.settings.reviewHistory[file.path] : [];
      history.push({ date: t, s: round2(sched.s), grade, retention: Math.round(Math.max(0, Math.min(1, retentionBefore)) * 100) });
      this.settings.reviewHistory[file.path] = history.slice(-64);
    }
    await this.saveSettings();
  }
  async undoReviewLog(file) {
    const t = todayStr();
    if (this.settings.reviewLog[t]) {
      this.settings.reviewLog[t]--;
      if (this.settings.reviewLog[t] <= 0) delete this.settings.reviewLog[t];
    }
    const history = file?.path && this.settings.reviewHistory[file.path];
    if (Array.isArray(history) && history.length) history.pop();
    await this.saveSettings();
  }
  async getFirstExample(file) {
    try {
      const raw = await this.app.vault.cachedRead(file);
      if (!this.occurrenceHeadingText()) return this.occurrenceSentenceFromSection(raw);
      const names = [this.occurrenceHeadingText(), "例句", "出处"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return "";
      return this.occurrenceSentenceFromSection(m[1]);
    } catch (_e) { return ""; }
  }
  buildCloze(sentence, word) { return sentence.replace(new RegExp(boundedSource(word), "ig"), "______"); }
  humanInterval(days) {
    if (days < 1) return this.t("interval.ltDay");
    if (days < 30) return this.t("interval.days", { count: days });
    if (days < 365) return this.t("interval.months", { count: Math.round(days / 30) });
    return this.t("interval.years", { count: (days / 365).toFixed(1) });
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
      if (fm["lexis-status"] === "archived" || fm["lexis-status"] === "retired") continue; // 已归档/已淘汰:计入总数,但不计入待复习/新词(复习队列已暂停)
      if (fm["lexis-s"] == null) { fresh++; due++; }
      else if (!fm["lexis-due"] || String(fm["lexis-due"]).slice(0, 10) <= today) due++;
    }
    return { total, due, fresh };
  }
  buildQueue(options) {
    options = options || {};
    const today = todayStr();
    let files = this.app.vault.getMarkdownFiles().filter((f) => { if (!this.inVocabFolder(f.path)) return false; const lc = this.readLifecycle(f); return !lc.archived && !lc.retired; });
    if (options.folder) {
      const folder = this.normalizeFolder(options.folder);
      files = files.filter((f) => this.inScope(f.path, [folder]));
    }
    if (options.tag) { const tl = options.tag.toLowerCase(); files = files.filter((f) => this.getTags(f).has(tl)); }
    const due = [], fresh = [];
    for (const f of files) { const card = this.readCard(f); if (card.s == null || isNaN(Number(card.s))) fresh.push({ file: f, card }); else if (!card.due || String(card.due).slice(0, 10) <= today) due.push({ file: f, card }); }
    let queue;
    if (options.order === "frequency") { queue = due.concat(fresh).sort((a, b) => this.freqVal(a.file) - this.freqVal(b.file)); }
    else if (options.order === "random") { queue = due.concat(fresh); for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; } }
    else { due.sort((a, b) => String(a.card.due || "").localeCompare(String(b.card.due || ""))); queue = due.concat(fresh.slice(0, this.settings.newPerDay || 20)); }
    return queue.slice(0, this.settings.maxReviewsPerSession || 200);
  }
  // ---------- 淘汰法庭(阶段 3) ----------
  // 硬条件筛子,不做加权评分:全部满足才入列,判决权在用户(淘汰/留下/已掌握三个按钮,见 LexisHomeView)。
  async buildRetireCandidates() {
    const days = this.settings.retireCandidateDays ?? 90;
    const today = todayStr();
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path));
    const out = [];
    for (const f of files) {
      const lc = this.readLifecycle(f);
      if (lc.pinned || lc.archived || lc.retired) continue; // 常驻/已归档/已淘汰:永远不进候选
      const created = fmtDate(new Date(f.stat.ctime));
      if (daysBetween(created, today) < days) continue; // 入库不够久
      const enc = this._encounters[f.basename.toLowerCase()];
      const lastEncounter = (enc && enc.lastEncounter) || created; // 从没相遇过就用入库日期当基准
      const sinceLast = daysBetween(lastEncounter, today);
      if (sinceLast < days) continue; // 最近还自然相遇过,不算候选
      let occCount = 0;
      try { occCount = (await this.findOccurrences(f.basename)).length; } catch (_e) {}
      out.push({
        file: f, display: f.basename, created, lastEncounter, sinceLast,
        encounterCount: (enc && enc.encounterCount) || 0,
        hoverCount: (enc && enc.hoverCount) || 0,
        occCount,
      });
    }
    out.sort((a, b) => b.sinceLast - a.sinceLast);
    return out;
  }
  async openReview(options) {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_REVIEW_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf(true); await leaf.setViewState({ type: LEXIS_REVIEW_VIEW, active: true }); }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisReviewView) { leaf.view.options = options || {}; leaf.view.refresh(); }
  }
  saveReviewSession(leaf, state) { if (leaf && state) this._reviewSessions.set(leaf, state); }
  takeReviewSession(leaf) {
    if (!leaf) return null;
    const state = this._reviewSessions.get(leaf) || null;
    this._reviewSessions.delete(leaf);
    return state;
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
  async readTemplatePath(p) {
    p = (p || "").trim();
    if (!p) return null;
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f instanceof TFile) { try { return await this.app.vault.read(f); } catch (_e) {} }
    return null;
  }
  // 无模板可选纯空白，或只放一个内置的出处面板；用户自己的模板始终优先。
  minimalSkeleton() { return this.settings.emptyNotePreset === "occ" ? "```lexis\nocc\n```\n" : ""; }
  getSelectionSentence(editor) {
    try { const from = editor.getCursor("from"); const line = editor.getLine(from.line) || ""; return this.extractSentence(line, from.ch || 0); } catch (_e) { return ""; }
  }
  getReadingSentence() {
    try { const sel = window.getSelection(); if (!sel || !sel.anchorNode) return ""; const text = sel.anchorNode.textContent || ""; return this.extractSentence(text, sel.anchorOffset || 0); } catch (_e) { return ""; }
  }
  // 当前选区所在 PDF 页码(pdf.js 在 .page 上挂 data-page-number);取不到返回 0
  currentPdfPage() {
    try {
      const sel = window.getSelection();
      const n = sel && sel.anchorNode;
      const el = n ? (n.nodeType === 1 ? n : n.parentElement) : null;
      const page = el && el.closest && el.closest("[data-page-number]");
      const v = page && page.getAttribute("data-page-number");
      return v ? parseInt(v, 10) || 0 : 0;
    } catch (_e) { return 0; }
  }
  addSelectedWordCommand() {
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    let word = "", editor = null;
    if (view && view.editor && view.getMode && view.getMode() === "source") { word = (view.editor.getSelection() || "").trim(); editor = view.editor; }
    if (!word) { const sel = window.getSelection(); word = (sel ? sel.toString() : "").trim(); }
    if (!word) { new Notice(this.t("notice.selectWord")); return; }
    this.addWordFromSelection(word, editor, view);
  }
  async addWordFromSelection(word, editor, view, targetFolder, { openExisting = false } = {}) {
    const clean = (word || "").trim();
    const fileName = this.sanitizeName(clean);
    if (!fileName) { new Notice(this.t("notice.invalidWord")); return; }
    const reqFolder = this.normalizeFolder(targetFolder || "");
    const folder = (reqFolder && this.dictFolders().includes(reqFolder)) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + fileName + ".md";
    let existing = this.app.vault.getAbstractFileByPath(targetPath);
    // 路径不同名也可能已经是某词条的标题或别名(比如刚被"设为别名"并入了别的文件)——按索引兜底查,别重复建
    if (!(existing instanceof TFile)) {
      const hit = this.index.get(clean.toLowerCase());
      if (hit && hit.file instanceof TFile) existing = hit.file;
    }
    const srcFile = (view && view.file) || this.app.workspace.getActiveFile();
    const sentence = editor ? this.getSelectionSentence(editor) : this.getReadingSentence();
    // 从 PDF 划词加词时,新词笔记开到新标签页,免得把正在读的 PDF 顶掉
    const fromPdf = srcFile && srcFile.extension === "pdf" && !editor;
    if (existing) {
      new Notice(this.t(openExisting ? "notice.exists" : "notice.existsNoOpen", { word: existing.basename }));
      if (openExisting) this.app.workspace.getLeaf(fromPdf ? "tab" : false).openFile(existing);
      return;
    }
    try {
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      let content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word: clean, date: todayStr() });
      // 出处写进正文(而不是 frontmatter 属性),好看且笔记里直接可见
      if (sentence || srcFile) {
        // PDF 出处带上页码,链接可直接跳到那一页
        let sub = "", disp = srcFile ? srcFile.basename : "";
        if (fromPdf) {
          const pg = this.currentPdfPage();
          if (pg) { sub = `#page=${pg}`; disp = `${srcFile.basename} p.${pg}`; }
        }
        const sourceTarget = this.sourceLinkTarget(srcFile);
        const source = srcFile ? (sub ? `[[${sourceTarget}${sub}|${disp}]]` : `[[${sourceTarget}]]`) : "";
        content = this.insertOccurrence(content, { word: clean, sentence: sentence || "", source, date: todayStr() });
      }
      const file = await this.app.vault.create(targetPath, content);
      this.recordEncounter(file, "add");
      // 划词添加只写入并留在原文；"添加"不再暗含一次页面跳转。
      new Notice(this.t(fromPdf ? "notice.addedPdf" : "notice.created", { word: fileName }));
      await this.rebuildIndex(false);
    } catch (err) { new Notice(this.t("notice.createFailed", { error: err?.message || err })); }
  }
  // 遗忘曲线 SVG(FSRS 衰减)
  buildCurveSVG(card) {
    return buildCurveSVG(card, {
      requestRetention: this.settings.requestRetention,
      nextInterval: FSRS.nextInterval,
      retrievability: FSRS.retrievability,
      addDaysStr,
      daysBetween,
      todayStr,
    });
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
        el.createDiv({ cls: "lexis-curve" }).innerHTML = svg;
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
      const sum = det.createEl("summary", { text: `📍 出现过的地方 (${list.length})` });
      const occWrap = det.createDiv();
      const comp = new Component(); comp.load();
      for (const o of list) {
        const dd = occWrap.createDiv({ cls: "lexis-occ" });
        await this.renderSentence(dd, o.sentence, word, comp);
        const add = dd.createSpan({ cls: "lexis-occ-add", text: " ➕" });
        add.setAttribute("title", "收藏到出处");
        add.addEventListener("click", async () => {
          if (add.dataset.done) return;
          add.dataset.done = "1";
          if (await this.addExampleToWord(file, o.sentence, o.file, o.page)) { add.setText(" ✓"); add.style.cursor = "default"; add.removeAttribute("title"); } else delete add.dataset.done;
        });
        const s2 = dd.createSpan({ cls: "lexis-occ-src", text: " ↗ " + this.occurrenceLabel(o) });
        s2.addEventListener("click", () => this.openOccurrence(o.file, word, o.page));
      }
    }
    if (el.children.length === countBefore) el.remove();
  }

  // ---------- 悬浮卡 ----------
  isHighlightTarget(t) { return !!(t && t.classList && (t.classList.contains("lexis-hl") || t.classList.contains("lexis-pdf-hl"))); }
  onMouseOver(e) {
    const t = e.target;
    if (!this.isHighlightTarget(t)) return;
    window.clearTimeout(this._hideTimer);
    if (this._popover?.dataset.lexisKey === t.dataset.lexisKey) return;
    if (this._showTarget === t) return;
    window.clearTimeout(this._showTimer);
    this._showTarget = t;
    const open = () => {
      this._showTimer = null;
      if (this._showTarget === t && t.isConnected) this.showPopover(t);
    };
    const delay = Math.max(0, Number(this.settings.hoverDelayMs) || 0);
    if (delay) this._showTimer = window.setTimeout(open, delay); else open();
  }
  onMouseOut(e) {
    const t = e.target;
    if (!this.isHighlightTarget(t)) return;
    if (this._showTarget === t) {
      window.clearTimeout(this._showTimer);
      this._showTimer = null;
      this._showTarget = null;
    }
    if (this._popover?.dataset.lexisKey === t.dataset.lexisKey) this.scheduleHide();
  }
  onClick(e) {
    const t = e.target;
    if (t && t.classList && (t.classList.contains("lexis-hl") || t.classList.contains("lexis-pdf-hl"))) {
      const entry = this.index.get(t.dataset.lexisKey);
      if (entry) {
        e.preventDefault();
        if (entry.inline) this.openInlineEntry(entry, e.ctrlKey || e.metaKey);
        else { this.app.workspace.getLeaf(e.ctrlKey || e.metaKey ? "tab" : false).openFile(entry.file); this.removePopover(); }
      }
    } else if (this._popover && !this._popover.contains(t)) this.removePopover();
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
  maybeShowSelPill(e, fromEpubIframe) {
    if (!this.settings.selectionPill) return;
    const tgt = e && e.target;
    // 点到自己的 UI(药丸/悬浮卡/菜单)不处理,避免抢选区
    if (tgt && tgt.closest && tgt.closest(".lexis-sel-pill, .lexis-popover, .menu")) return;
    const sourceDoc = (tgt && tgt.ownerDocument) || document;
    const sourceWin = sourceDoc.defaultView || window;
    let sel, text;
    try { sel = sourceWin.getSelection(); text = sel ? sel.toString().trim() : ""; } catch (_e) { return; }
    if (!text || text.length > 60 || /[\n\r]/.test(text)) { this.removeSelPill(); return; }
    // 选区必须落在 Markdown 笔记内容、PDF 文字层,或已识别的 EPUB iframe 里。
    const node = sel.anchorNode;
    const host = node ? (node.nodeType === 1 ? node : node.parentElement) : null;
    if (!host || !host.closest || (!fromEpubIframe && !host.closest(".markdown-source-view, .markdown-reading-view, .markdown-preview-view, .pdf-viewer, .pdf-container, .pdf-embed, .textLayer"))) { this.removeSelPill(); return; }
    let rect; try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (_e) { return; }
    if (!rect || (!rect.width && !rect.height)) { this.removeSelPill(); return; }
    if (sourceWin !== window && sourceWin.frameElement) {
      const frameRect = sourceWin.frameElement.getBoundingClientRect();
      rect = { left: rect.left + frameRect.left, right: rect.right + frameRect.left, top: rect.top + frameRect.top, bottom: rect.bottom + frameRect.top, width: rect.width, height: rect.height };
    }
    this.removeSelPill();
    const known = this.index.has(text.toLowerCase());
    const pill = document.body.createDiv({ cls: "lexis-sel-pill" });
    // 阻止 mousedown 收起选区/夺焦(事件冒泡到 pill 即可覆盖子按钮)
    pill.addEventListener("mousedown", (ev) => ev.preventDefault());
    if (known) {
      const b = pill.createSpan({ cls: "lexis-sel-pill-btn", text: `📖 ${this.t("selection.openExisting")}` });
      b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); this.addFromPill(text, undefined, { openExisting: true }); });
    } else {
      const dicts = this.dictFolders();
      let selectedFolder = this.preferredSelectionFolder();
      const folderLabel = (f) => String(f || this.t("common.root")).split("/").pop();
      const addB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "＋" });
      addB.setAttribute("title", this.t("selection.add"));
      addB.setAttribute("aria-label", this.t("selection.add"));
      addB.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this.addFromPill(text, selectedFolder);
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
            this.rememberSelectionFolder(f);
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
        new LexisAliasPicker(this.app, this, text, (entry) => this.attachAlias(text, entry.file)).open();
      });
    }
    // 定位:选区下方略偏左;贴边时夹回视口
    const top = Math.min(rect.bottom + 6, window.innerHeight - 36);
    const left = Math.max(6, Math.min(rect.left, window.innerWidth - pill.offsetWidth - 6));
    pill.style.top = top + "px";
    pill.style.left = left + "px";
    this._selPill = pill;
  }
  preferredSelectionFolder() {
    const dicts = this.dictFolders();
    const saved = this.normalizeFolder(this.settings.lastSelectionFolder || "");
    return dicts.includes(saved) ? saved : (dicts[0] || "");
  }
  async rememberSelectionFolder(folder) {
    const value = this.normalizeFolder(folder || "");
    if (!this.dictFolders().includes(value) || this.settings.lastSelectionFolder === value) return;
    this.settings.lastSelectionFolder = value;
    await this.saveSettings();
  }
  async addFromPill(text, folder, options) {
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    const editor = (view && view.getMode && view.getMode() === "source" && view.editor) ? view.editor : null;
    this.removeSelPill();
    if (folder) await this.rememberSelectionFolder(folder);
    await this.addWordFromSelection(text, editor, view, folder, options);
  }
  // 把 alias 写进某词条文件的 frontmatter aliases(已存在则跳过,幂等)
  async addAliasToFile(file, alias) {
    if (!(file instanceof TFile) || !alias) return;
    const inject = (data) => {
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
  async attachAlias(aliasText, file) {
    aliasText = (aliasText || "").trim();
    if (!aliasText || !(file instanceof TFile)) return;
    if (aliasText.toLowerCase() === file.basename.toLowerCase()) { new Notice(this.t("notice.aliasSelf", { word: aliasText })); return; }
    try {
      await this.addAliasToFile(file, aliasText);
      this.rebuildIndex(false);
      const ak = aliasText.toLowerCase();
      if (!this.index.has(ak)) this.index.set(ak, { display: aliasText, file, isAlias: true, tags: this.getTags(file) });
      new Notice(this.t("notice.aliasAdded", { alias: aliasText, word: file.basename }));
    } catch (err) { new Notice(this.t("notice.aliasFailed", { error: err?.message || err })); }
  }
  openAndClose(file) { this.app.workspace.getLeaf(false).openFile(file); this.removePopover(); }
  async openInlineEntry(entry, newTab) {
    const leaf = this.app.workspace.getLeaf(newTab ? "tab" : false);
    await leaf.openFile(entry.file);
    try {
      const editor = leaf.view?.editor;
      if (editor) {
        const offset = String(editor.getValue() || "").split(/\r?\n/).slice(0, entry.line || 0).reduce((n, line) => n + line.length + 1, 0);
        const pos = editor.offsetToPos(offset);
        editor.setCursor(pos);
        editor.scrollIntoView({ from: pos, to: pos }, true);
      }
    } catch (_e) {}
    this.removePopover();
  }
  async openOccurrence(file, word, page) {
    let leaf = this._occLeaf;
    if (!leaf || !leaf.parent) { leaf = this.app.workspace.getLeaf("tab"); this._occLeaf = leaf; }
    await leaf.openFile(file, page ? { eState: { subpath: `#page=${page}` } } : undefined);
    this.app.workspace.revealLeaf(leaf);
    try {
      const ed = leaf.view && leaf.view.editor;
      if (ed && word) {
        const m = new RegExp(boundedSource(word), "i").exec(ed.getValue());
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
        else { const c = Number(log[ds]) || 0; total += c; if (c > 0) cell.addClass("lexis-hm-l" + Math.min(4, Math.ceil((c / max) * 4))); cell.setAttribute("title", this.t("home.heatmapDay", { date: ds, count: c })); }
        cur.setDate(cur.getDate() + 1);
      }
    }
    el.createDiv({ cls: "lexis-hm-caption", text: this.t("home.heatmapCaption", { weeks, count: total }) });
  }
  // ```lexis-home``` 代码块:笔记里内嵌一份主页摘要(统计 + 热力图),点热力图或按钮跳到真正的主页/开始复习
  renderHomeBlock(el) {
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
  boldMatchesInPlace(el, word) {
    const re = new RegExp(boundedSource(word), "ig");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    for (const node of targets) {
      const text = node.nodeValue;
      re.lastIndex = 0;
      if (!re.test(text)) continue;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const b = document.createElement("b");
        b.textContent = m[0];
        frag.appendChild(b);
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }
  // 出处预览:走 Markdown 渲染管线(LaTeX/加粗斜体等才能正常显示),渲染完再把命中词包一层 <b>
  async renderSentence(el, sentence, word, comp) {
    el.empty();
    const useComp = comp || new Component();
    if (!comp) useComp.load();
    await renderLexisMarkdown(this.app, sentence, el, "", useComp);
    this.boldMatchesInPlace(el, word);
  }
  compactSections(md) { return md.replace(/^#{2,6}[ \t].*\n(?:[ \t]*\n)*(?=#{1,6}[ \t]|$)/gm, "").trim(); }
  stripForPreview(content) {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```lexis[\s\S]*?```/g, "").trim();
  }
  async renderNoteInto(el, file, comp, keepLexis) {
    const raw = await this.app.vault.cachedRead(file);
    let stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
    if (!keepLexis) stripped = stripped.replace(/```lexis[\s\S]*?```/g, "");
    const md = this.compactSections(stripped.trim()) || "*(空)*";
    el.empty();
    await renderLexisMarkdown(this.app, md, el, file.path, comp);
    // 渲染后清理:两标题之间无实际内容(文本/lexis 块)则删除前一个标题
    (function compact(container) {
      const hs = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const rm = [];
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i], next = hs[i + 1] || null;
        let sib = h.nextElementSibling, ok = false;
        while (sib && sib !== next) {
          const ns = sib.nextElementSibling;
          if ((sib.textContent || "").trim()) { ok = true; break; }
          if (sib.querySelector && sib.querySelector(".lexis-section-title,.lexis-curve,.lexis-related,.lexis-occ,.lexis-occ-details,img,svg,video,iframe")) { ok = true; break; }
          sib = ns;
        }
        if (!ok) rm.push(h);
      }
      for (const h of rm) h.remove();
    })(el);
  }
  async renderInlineEntryInto(el, entry, comp) {
    el.empty();
    const md = entry.annotation || "*(无批注)*";
    const content = el.createDiv({ cls: "lexis-inline-annotation" });
    await renderLexisMarkdown(this.app, md, content, entry.file.path, comp);
  }
  renderPopoverControls(meta, corner, body, entry) {
    if (entry.inline) return;
    const baseKey = entry.file?.basename || entry.display;
    const path = entry.file?.path || "";
    const slash = path.lastIndexOf("/");
    const folder = slash > 0 ? path.slice(0, slash) : "";
    const shortFolder = (f) => String(f || this.t("common.root")).split("/").pop();
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
      input.addEventListener("keydown", async (e) => {
        if (e.key === "Escape") { row.remove(); return; }
        if (e.key !== "Enter") return;
        e.preventDefault();
        const note = input.value.trim();
        if (!note) { row.remove(); return; }
        input.disabled = true;
        const result = await this.bridgeAnnotate({ key: baseKey, note });
        new Notice(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
        this.removePopover();
      });
      body.prepend(row);
      input.focus();
    });
    const delBtn = corner.createEl("button", { cls: "lexis-popover-action is-danger", text: "🗑" });
    delBtn.setAttribute("title", this.t("popover.deleteEntry"));
    delBtn.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (!window.confirm(this.t("popover.deleteConfirm", { word: entry.display }))) return;
      const result = await this.bridgeDeleteWord(baseKey);
      new Notice(result.ok ? this.t("notice.deleted", { word: entry.display }) : this.t("notice.deleteFailed", { error: result.error || this.t("common.failed") }));
      this.removePopover();
    });

    const tagWrap = body.createDiv({ cls: "lexis-popover-tags" });
    const tags = new Set(entry.tags || []);
    const renderTags = () => {
      tagWrap.empty();
      for (const tag of [...tags].sort()) {
        const pill = tagWrap.createSpan({ cls: "lexis-popover-tag", text: `#${tag}` });
        const remove = pill.createSpan({ cls: "lexis-popover-tag-remove", text: " ×" });
        remove.setAttribute("title", this.t("popover.deleteTag"));
        remove.addEventListener("click", async (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const result = await this.bridgeTagWord({ key: baseKey, tag, action: "remove" });
          if (result.ok) { tags.delete(tag); entry.tags = new Set(result.tags); renderTags(); }
        });
      }
      const add = tagWrap.createSpan({ cls: "lexis-popover-tag is-add", text: tags.size ? "+" : this.t("popover.addTag") });
      add.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const menu = new obsidian.Menu();
        for (const tag of this.collectVocabTags().filter((t) => !tags.has(t))) menu.addItem((it) => it.setTitle(`#${tag}`).setIcon("tag").onClick(async () => {
          const result = await this.bridgeTagWord({ key: baseKey, tag, action: "add" });
          if (result.ok) { tags.add(tag); entry.tags = new Set(result.tags); renderTags(); }
        }));
        menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
      });
    };
    renderTags();
  }
  async showPopover(spanEl) {
    const key = spanEl.dataset.lexisKey;
    const entry = this.index.get(key);
    if (!entry) return;
    if (this._popover && this._popover.dataset.lexisKey === key) { window.clearTimeout(this._hideTimer); return; }
    if (!entry.inline) { this.recordEncounter(entry.file, "hover"); this.hoverFeedback(entry.file); }
    this.removePopover();
    const pop = document.createElement("div");
    pop.className = "lexis-popover";
    pop.dataset.lexisKey = key;
    this.applyPopoverAppearance(pop);
    const title = pop.createDiv({ cls: "lexis-popover-title" });
    const heading = this.cardHeading(entry);
    title.createSpan({ cls: "lexis-popover-title-main", text: heading.title });
    if (heading.subtitle) title.createSpan({ cls: "lexis-popover-alias", text: heading.subtitle });
    title.addEventListener("click", () => entry.inline ? this.openInlineEntry(entry, false) : this.openAndClose(entry.file));
    const corner = pop.createDiv({ cls: "lexis-popover-corner" });
    const meta = pop.createDiv({ cls: "lexis-popover-meta" });
    if (!entry.inline) {
      pop.addClass("has-corner-actions");
      const archiveBtn = meta.createSpan({ cls: "lexis-popover-archive", text: entry.archived ? `↩ ${this.t("popover.restore")}` : `📦 ${this.t("popover.archive")}` });
      archiveBtn.setAttribute("title", this.t(entry.archived ? "popover.restoreTitle" : "popover.archiveTitle"));
      archiveBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (entry.archived) new LexisRestoreModal(this.app, this, entry.file).open();
        else this.setArchived(entry.file, true).then(() => new Notice(this.t("notice.archived", { word: entry.file.basename })));
        this.removePopover();
      });
    }
    const body = pop.createDiv({ cls: "lexis-popover-body" });
    body.setText(this.t("common.loading"));
    pop.addEventListener("mouseenter", () => window.clearTimeout(this._hideTimer));
    pop.addEventListener("mouseleave", () => this.scheduleHide());
    spanEl.addEventListener("mouseleave", () => this.scheduleHide(), { once: true });
    document.body.appendChild(pop);
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
        this.findOccurrences(entry.display).then(async (rawList) => {
          if (this._popover !== pop) return;
          const curated = await this.getCuratedSourcePaths(entry.file);
          const list = rawList.filter((o) => !curated.has(o.file.basename.toLowerCase()));
          occTitle.setText(`📍 ${this.t("popover.occurrences", { count: list.length })}`);
          occWrap.empty();
          if (!list.length) occWrap.createDiv({ cls: "lexis-occ", text: this.t("popover.noOccurrences") });
          else for (const o of list) {
            const d = occWrap.createDiv({ cls: "lexis-occ" });
            await this.renderSentence(d, o.sentence, entry.display, this._popoverComp);
            const add = d.createSpan({ cls: "lexis-occ-add", text: " ➕" });
            add.setAttribute("title", this.t("popover.addOccurrence"));
            add.addEventListener("click", async () => {
              if (add.dataset.done) return;
              add.dataset.done = "1";
              if (await this.addExampleToWord(entry.file, o.sentence, o.file, o.page)) { add.setText(" ✓"); add.style.cursor = "default"; add.removeAttribute("title"); } else delete add.dataset.done;
            });
            const src = d.createSpan({ cls: "lexis-occ-src", text: " ↗ " + this.occurrenceLabel(o) });
            src.addEventListener("click", () => this.openOccurrence(o.file, entry.display, o.page));
          }
          this.positionPopover(pop, spanEl);
        });
      }
      this.positionPopover(pop, spanEl);
    } catch (err) { body.setText(this.t("popover.readFailed", { error: err?.message || err })); }
  }
  positionPopover(pop, spanEl) {
    const r = spanEl.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const ownerWin = spanEl.ownerDocument?.defaultView;
    const frameRect = ownerWin && ownerWin !== window && ownerWin.frameElement ? ownerWin.frameElement.getBoundingClientRect() : null;
    let left = r.left + (frameRect ? frameRect.left : 0), top = r.bottom + (frameRect ? frameRect.top : 0) + 6;
    if (left + pr.width > window.innerWidth - 10) left = window.innerWidth - pr.width - 10;
    if (left < 10) left = 10;
    if (top + pr.height > window.innerHeight - 10) top = r.top + (frameRect ? frameRect.top : 0) - pr.height - 6;
    if (top < 10) top = 10;
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  applyPopoverAppearance(pop) {
    if (!pop) return;
    const width = Math.max(260, Number(this.settings.popoverWidth) || 460);
    const height = Math.max(160, Number(this.settings.popoverMaxHeight) || 420);
    const fontSize = Math.max(11, Number(this.settings.popoverFontSize) || 14);
    pop.style.setProperty("--lexis-popover-width", `${width}px`);
    pop.style.setProperty("--lexis-popover-height", `${height}px`);
    pop.style.setProperty("--lexis-popover-font-size", `${fontSize}px`);
    // 内联值保证主题样式无法盖掉用户设置；预览卡用实际高度演示“最大高度”。
    pop.style.width = `${width}px`;
    pop.style.fontSize = `${fontSize}px`;
    const isPreview = pop.classList?.contains("lexis-popover-preview");
    pop.style.maxHeight = isPreview ? `${height}px` : "";
    pop.style.height = isPreview ? `${height}px` : "";
  }
};

// ---------- 别名选择器:给"设为别名"选目标词条(标题或别名都可搜到) ----------
class LexisAliasPicker extends (obsidian.FuzzySuggestModal || class {}) {
  constructor(app, plugin, aliasText, onPick) {
    super(app);
    this.plugin = plugin;
    this.aliasText = aliasText;
    this.onPick = onPick;
    if (this.setPlaceholder) this.setPlaceholder(this.plugin.t("selection.aliasPrompt", { alias: aliasText }));
  }
  getItems() {
    const seen = new Set(), out = [];
    for (const e of this.plugin.index.values()) {
      if (!e || !e.file) continue;
      const k = e.file.path + "|" + (e.display || "");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out;
  }
  getItemText(e) { return e.isAlias ? this.plugin.t("selection.aliasItem", { alias: e.display, word: e.file.basename }) : e.display; }
  onChooseItem(e) { if (e && e.file) this.onPick(e); }
}

// ---------- 恢复:归档词要不要保留 FSRS 进度,二选一 ----------
class LexisRestoreModal extends Modal {
  constructor(app, plugin, file) {
    super(app);
    this.plugin = plugin;
    this.file = file;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("lexis-restore-modal");
    contentEl.createEl("h3", { text: this.plugin.t("restore.title", { word: this.file.basename }) });
    contentEl.createEl("p", { text: this.plugin.t("restore.question") });
    const row = contentEl.createDiv({ cls: "lexis-modal-btns" });
    const keepBtn = row.createEl("button", { cls: "mod-cta", text: this.plugin.t("restore.keep") });
    keepBtn.addEventListener("click", async () => {
      await this.plugin.setArchived(this.file, false);
      new Notice(this.plugin.t("restore.kept", { word: this.file.basename }));
      this.close();
    });
    const resetBtn = row.createEl("button", { text: this.plugin.t("restore.reset") });
    resetBtn.addEventListener("click", async () => {
      await this.app.fileManager.processFrontMatter(this.file, (fm) => {
        delete fm["lexis-status"];
        delete fm["lexis-s"]; delete fm["lexis-d"]; delete fm["lexis-due"];
        delete fm["lexis-last"]; delete fm["lexis-reps"]; delete fm["lexis-lapses"];
      });
      delete this.plugin.settings.reviewHistory[this.file.path];
      await this.plugin.saveSettings();
      this.plugin.rebuildIndex(false);
      new Notice(this.plugin.t("restore.resetDone", { word: this.file.basename }));
      this.close();
    });
  }
  onClose() { this.contentEl.empty(); }
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
    stats.createDiv({ cls: "lexis-stat", text: `⏰ ${this.plugin.t("home.due", { count: st.due })}` });
    stats.createDiv({ cls: "lexis-stat", text: `✨ ${this.plugin.t("home.new", { count: st.fresh })}` });
    stats.createDiv({ cls: "lexis-stat", text: `📚 ${this.plugin.t("home.total", { count: st.total })}` });
    this.plugin.renderHeatmap(c.createDiv({ cls: "lexis-hm-wrap" }));

    c.createEl("h4", { text: this.plugin.t("home.start") });
    const folders = this.plugin.dictFolders();
    let selFolder = "", selOrder = "due";
    new Setting(c).setName(this.plugin.t("home.reviewFolder")).addDropdown((dd) => { dd.addOption("", this.plugin.t("common.all")); for (const folder of folders) dd.addOption(folder, folder); dd.setValue(selFolder); dd.onChange((v) => { selFolder = v; }); });
    new Setting(c).setName(this.plugin.t("home.order")).addDropdown((dd) => { dd.addOption("due", this.plugin.t("home.dueFirst")).addOption("frequency", this.plugin.t("home.frequency")).addOption("random", this.plugin.t("home.random")).setValue(selOrder); dd.onChange((v) => { selOrder = v; }); });
    new Setting(c).addButton((b) => b.setButtonText(`▶ ${this.plugin.t("home.start")}`).setCta().onClick(() => this.plugin.openReview({ folder: selFolder, order: selOrder })))
      .addExtraButton((b) => b.setIcon("refresh-cw").setTooltip(this.plugin.t("common.refresh")).onClick(() => this.render()));

    this.renderRetireCandidates(c);
  }
  // 淘汰法庭:硬条件筛出来的候选,证据摆出来,判决权在用户——平时不主动打扰,只有打开主页才会看到。
  async renderRetireCandidates(c) {
    const days = this.plugin.settings.retireCandidateDays ?? 90;
    const wrap = c.createDiv({ cls: "lexis-retire-wrap" });
    wrap.createEl("h4", { text: `🗑️ ${this.plugin.t("home.retire")}` });
    // 阈值直接在主页调,不用跑去设置页;拖动时防抖,别每挪一格就重算一遍(候选计算要挨个查出处数,不便宜)
    new Setting(wrap).setName(this.plugin.t("home.retireThreshold")).setDesc(this.plugin.t("home.retireThresholdDesc"))
      .addSlider((s) => s.setLimits(14, 365, 1).setValue(days).setDynamicTooltip().onChange((v) => {
        this.plugin.settings.retireCandidateDays = v;
        this.plugin.saveSettings();
        if (this._retireRenderTimer) window.clearTimeout(this._retireRenderTimer);
        this._retireRenderTimer = window.setTimeout(() => this.render(), 400);
      }));
    const listWrap = wrap.createDiv();
    listWrap.setText(this.plugin.t("home.calculating"));
    let candidates;
    try { candidates = await this.plugin.buildRetireCandidates(); } catch (_e) { candidates = []; }
    if (!listWrap.isConnected) return; // 算的过程中视图已经关掉/刷新了,別再画
    listWrap.empty();
    if (!candidates.length) { listWrap.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noCandidates") }); return; }
    const selected = new Set();
    const rowByPath = new Map();
    const removeRows = (paths) => { for (const p of paths) { const row = rowByPath.get(p); if (row) row.remove(); rowByPath.delete(p); selected.delete(p); } };
    for (const cand of candidates) {
      const row = listWrap.createDiv({ cls: "lexis-retire-row" });
      rowByPath.set(cand.file.path, row);
      const cb = row.createEl("input", { type: "checkbox", cls: "lexis-retire-cb" });
      cb.addEventListener("change", () => { if (cb.checked) selected.add(cand.file.path); else selected.delete(cand.file.path); });
      const info = row.createDiv({ cls: "lexis-retire-info" });
      const nameEl = info.createEl("a", { text: cand.display, href: "#", cls: "lexis-retire-name" });
      nameEl.addEventListener("click", (e) => { e.preventDefault(); this.plugin.app.workspace.getLeaf(false).openFile(cand.file); });
      info.createDiv({ cls: "lexis-retire-meta", text: this.plugin.t("home.candidateMeta", { created: cand.created, encounters: cand.encounterCount, hovers: cand.hoverCount, occurrences: cand.occCount, days: cand.sinceLast }) });
      const btns = row.createDiv({ cls: "lexis-retire-btns" });
      const evictBtn = btns.createEl("button", { text: `🗑️ ${this.plugin.t("home.evict")}` });
      evictBtn.addEventListener("click", async () => { await this.plugin.setRetired(cand.file, true); removeRows([cand.file.path]); });
      const pinBtn = btns.createEl("button", { text: `📌 ${this.plugin.t("home.keep")}` });
      pinBtn.addEventListener("click", async () => { await this.plugin.setPinned(cand.file, true); removeRows([cand.file.path]); });
      const archiveBtn = btns.createEl("button", { text: `📦 ${this.plugin.t("home.mastered")}` });
      archiveBtn.addEventListener("click", async () => { await this.plugin.setArchived(cand.file, true); removeRows([cand.file.path]); });
    }
    const bulk = wrap.createDiv({ cls: "lexis-retire-bulk" });
    const bulkRun = async (fn) => { const paths = [...selected]; for (const p of paths) { const f = this.plugin.app.vault.getAbstractFileByPath(p); if (f) await fn(f); } removeRows(paths); };
    bulk.createEl("button", { text: this.plugin.t("home.bulkEvict") }).addEventListener("click", () => bulkRun((f) => this.plugin.setRetired(f, true)));
    bulk.createEl("button", { text: this.plugin.t("home.bulkKeep") }).addEventListener("click", () => bulkRun((f) => this.plugin.setPinned(f, true)));
    bulk.createEl("button", { text: this.plugin.t("home.bulkMastered") }).addEventListener("click", () => bulkRun((f) => this.plugin.setArchived(f, true)));
  }
  onClose() {}
}

// 输入时模糊匹配建议。AbstractInputSuggest 在 Obsidian 1.0+ 运行时可用;
// 输入时模糊匹配建议。AbstractInputSuggest 在 Obsidian 1.0+ 运行时可用;
// 缺失时 `|| class {}` 避免 extends undefined 报错,且调用处会跳过实例化。
// opts.multi=true 时按最后一个分隔符后的"活动 token"匹配,选中后追加(用于逗号/空格分隔的标签/属性多值字段)。
class PathSuggest extends (obsidian.AbstractInputSuggest || class {}) {
  constructor(app, inputEl, getItems, onPick, opts) {
    super(app, inputEl);
    this.getItems = getItems;
    this.onPick = onPick;
    this.multi = !!(opts && opts.multi);
    this.sep = (opts && opts.sep) || " ";
  }
  _split() {
    const v = (this.inputEl && this.inputEl.value) || "";
    const m = v.match(/[^\s,，;；]*$/);
    const token = m ? m[0] : "";
    return { before: v.slice(0, v.length - token.length), token };
  }
  getSuggestions(query) {
    let items = this.getItems();
    let q;
    if (this.multi) {
      const { token } = this._split();
      q = token.toLowerCase();
      const chosen = new Set(((this.inputEl && this.inputEl.value) || "").toLowerCase().split(/[\s,，;；]+/).filter(Boolean));
      items = items.filter((p) => p.toLowerCase() === token.toLowerCase() || !chosen.has(p.toLowerCase()));
    } else {
      q = (query || "").toLowerCase();
    }
    return items.filter((p) => p.toLowerCase().includes(q)).slice(0, 50);
  }
  renderSuggestion(value, el) { el.setText(value); }
  selectSuggestion(value) {
    if (this.multi) {
      // 多值:把选中项追加到当前列表后,重新触发建议(列表保持打开),可以接着选下一个
      const { before } = this._split();
      const out = before + value + this.sep;
      if (this.inputEl) this.inputEl.value = out;
      if (this.onPick) this.onPick(out);
      if (typeof this.setValue === "function") this.setValue(out); // 触发 input 事件,刷新并保持下拉
      if (this.inputEl) this.inputEl.focus();
      return;
    }
    if (typeof this.setValue === "function") this.setValue(value);
    if (this.inputEl) this.inputEl.value = value;
    if (typeof this.close === "function") this.close();
    if (this.onPick) this.onPick(value);
  }
}

class LexisSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  section(containerEl, title, { open = false, desc = "" } = {}) {
    const details = containerEl.createEl("details", { cls: "lexis-settings-section" });
    details.open = open;
    const summary = details.createEl("summary");
    summary.createSpan({ text: title });
    if (desc) summary.createSpan({ cls: "lexis-settings-section-hint", text: desc });
    return details.createDiv({ cls: "lexis-settings-section-body" });
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const t = (key, vars) => this.plugin.t(key, vars);
    const accentHex = cssColorToHex(getComputedStyle(document.body).getPropertyValue("--text-accent"));
    const save = () => this.plugin.saveSettings();
    const refresh = () => this.plugin.refreshAllViews();
    containerEl.createEl("h3", { text: t("settings.title") });

    new Setting(containerEl).setName(t("language.name"))
      .addDropdown((dd) => dd.addOption("zh", t("language.zh")).addOption("en", t("language.en")).setValue(this.plugin.settings.language || "zh").onChange(async (value) => {
        this.plugin.settings.language = value === "en" ? "en" : "zh";
        await save();
        this.plugin.refreshAllViews();
        this.app.workspace.iterateAllLeaves((leaf) => {
          const type = leaf?.view?.getViewType?.();
          if (type === LEXIS_HOME_VIEW || type === LEXIS_REVIEW_VIEW) leaf.view.render?.();
        });
        new Notice(t("language.reload"));
        this.display();
      }));

    const folders = this.app.vault.getAllLoadedFiles().filter((f) => f instanceof TFolder).map((f) => f.path).filter((p) => p && p !== "/").sort();
    const mdFiles = this.app.vault.getMarkdownFiles().map((f) => f.path).sort();
    const hasSuggest = !!obsidian.AbstractInputSuggest;
    const allTags = (() => {
      const s = new Set(this.plugin.collectVocabTags());
      try { const tg = this.app.metadataCache.getTags() || {}; for (const k in tg) s.add(k.replace(/^#/, "").toLowerCase()); } catch (_e) {}
      return [...s].filter(Boolean).sort();
    })();
    const allProps = (() => {
      try { const infos = this.app.metadataCache.getAllPropertyInfos ? this.app.metadataCache.getAllPropertyInfos() : null; if (infos) return Object.values(infos).map((x) => x && x.name).filter(Boolean).sort(); } catch (_e) {}
      return [];
    })();
    const tagSuggest = (comp, apply) => { if (hasSuggest) new PathSuggest(this.app, comp.inputEl, () => allTags, (v) => { comp.setValue(v); apply(v); }, { multi: true }); };

    const dictSection = this.section(containerEl, t("settings.dictionary"), { open: true });
    new Setting(dictSection).setDesc(t("settings.dictionaryDesc")).setHeading();
    const dictsWrap = dictSection.createDiv();
    const renderDicts = () => {
      dictsWrap.empty();
      (this.plugin.settings.dicts || []).forEach((d, i) => {
        const row = dictsWrap.createDiv();
        row.style.display = "flex"; row.style.gap = "6px"; row.style.marginBottom = "6px"; row.style.alignItems = "center";
        const fIn = new obsidian.TextComponent(row);
        fIn.setPlaceholder(t("settings.folderPlaceholder")).setValue(d.folder || "");
        fIn.inputEl.style.flex = "1";
        const onFolder = async (v) => { d.folder = (v || "").trim(); await save(); this.plugin.rebuildIndex(false); this.renderStats(); };
        fIn.onChange(onFolder);
        const tIn = new obsidian.TextComponent(row);
        tIn.setPlaceholder(t("settings.templatePlaceholder")).setValue(d.template || "");
        tIn.inputEl.style.flex = "1.4";
        const onTpl = async (v) => { d.template = (v || "").trim(); await save(); };
        tIn.onChange(onTpl);
        if (hasSuggest) {
          new PathSuggest(this.app, fIn.inputEl, () => folders, (v) => { fIn.setValue(v); onFolder(v); });
          new PathSuggest(this.app, tIn.inputEl, () => mdFiles, (v) => { tIn.setValue(v); onTpl(v); });
        }
        // 每个词典可选专属高亮色(留空=跟随全局/主题色)。用 obsidian.ColorComponent,和「按标签着色」一致
        const globalColor = this.plugin.settings.highlightColor || accentHex;
        const cComp = new obsidian.ColorComponent(row);
        const swatch = () => cComp.colorPickerEl || cComp.containerEl || null;
        const markInherit = (inherit) => { const el = swatch(); if (el) { el.style.opacity = inherit ? "0.4" : "1"; el.title = inherit ? t("settings.followGlobal") : t("settings.dictionaryColor"); } };
        cComp.setValue(d.color || globalColor);
        markInherit(!d.color);
        cComp.onChange(async (v) => { d.color = v; markInherit(false); await save(); refresh(); });
        new obsidian.ExtraButtonComponent(row).setIcon("reset").setTooltip(t("settings.resetGlobal")).onClick(async () => { d.color = ""; cComp.setValue(globalColor); markInherit(true); await save(); refresh(); });
        new obsidian.ExtraButtonComponent(row).setIcon("trash").setTooltip(t("settings.deleteDictionary")).onClick(async () => { this.plugin.settings.dicts.splice(i, 1); await save(); this.plugin.rebuildIndex(false); renderDicts(); this.renderStats(); });
      });
      const addDict = dictsWrap.createEl("button", { text: t("settings.addDictionary") });
      addDict.style.marginTop = "2px";
      addDict.addEventListener("click", async () => { this.plugin.settings.dicts.push({ folder: "", template: "" }); await save(); renderDicts(); });
    };
    renderDicts();
    new Setting(dictSection).setName(t("settings.tagsAsEntries")).setDesc(t("settings.tagsAsEntriesDesc"))
      .addText((t) => {
        t.setPlaceholder("词汇 术语").setValue(this.plugin.settings.vocabTags);
        const apply = async (v) => { this.plugin.settings.vocabTags = v; await save(); this.plugin.rebuildIndex(true); this.renderStats(); };
        t.onChange(apply); tagSuggest(t, apply);
      });
    new Setting(dictSection).setName(t("settings.includeAliases"))
      .addToggle((t) => t.setValue(this.plugin.settings.includeAliases).onChange(async (v) => { this.plugin.settings.includeAliases = v; await save(); this.plugin.rebuildIndex(false); this.renderStats(); }));
    new Setting(dictSection).setName(t("settings.aliasProperties")).setDesc(t("settings.aliasPropertiesDesc"))
      .addText((t) => {
        t.setPlaceholder("past,forms,variants").setValue(this.plugin.settings.aliasSources);
        const apply = async (v) => { this.plugin.settings.aliasSources = (v || "").trim(); await save(); if (this.plugin.settings.includeAliases) { this.plugin.rebuildIndex(false); this.renderStats(); } };
        t.onChange(apply);
        if (hasSuggest) new PathSuggest(this.app, t.inputEl, () => allProps, (v) => { t.setValue(v); apply(v); }, { multi: true, sep: "," });
      });

    const inlineSection = this.section(containerEl, t("settings.inline"), { desc: t("settings.inlineDesc") });
    new Setting(inlineSection).setName(t("settings.enableInline")).setDesc(t("settings.enableInlineDesc"))
      .addToggle((t) => t.setValue(this.plugin.settings.inlineEntriesEnabled).onChange(async (v) => { this.plugin.settings.inlineEntriesEnabled = v; await save(); await this.plugin.rebuildIndex(false); this.renderStats(); }));
    new Setting(inlineSection).setName(t("settings.inlineDelimiter")).setDesc(t("settings.inlineDelimiterDesc"))
      .addText((t) => t.setPlaceholder("::").setValue(this.plugin.inlineDelimiter()).onChange(async (v) => { this.plugin.settings.inlineEntryDelimiter = (v || "").trim() || "::"; await save(); await this.plugin.rebuildIndex(false); this.renderStats(); }));
    const categoryColorsWrap = inlineSection.createDiv();
    const renderCategoryColors = () => {
      categoryColorsWrap.empty();
      const categories = this.plugin.inlineCategories || [];
      if (!categories.length) {
        categoryColorsWrap.createEl("p", { cls: "setting-item-description", text: t("settings.noInlineCategories") });
        return;
      }
      for (const { name, count } of categories) {
        const colors = this.plugin.settings.inlineCategoryColors;
        const opacities = this.plugin.settings.inlineCategoryOpacity;
        const visibility = this.plugin.settings.inlineCategoryHighlight;
        const opacity = Object.prototype.hasOwnProperty.call(opacities, name) ? Number(opacities[name]) : this.plugin.settings.highlightOpacity;
        new Setting(categoryColorsWrap).setName(name).setDesc(t("settings.entryCount", { count }))
          .addToggle((toggle) => toggle.setTooltip(t("settings.showHighlight")).setValue(visibility[name] !== false).onChange(async (v) => { visibility[name] = v; await save(); refresh(); }))
          .addColorPicker((cp) => cp.setValue(colors[name] || accentHex).onChange(async (v) => { colors[name] = v; await save(); refresh(); }))
          .addSlider((s) => s.setLimits(0.1, 1, 0.05).setValue(isNaN(opacity) ? this.plugin.settings.highlightOpacity : opacity).setDynamicTooltip().onChange(async (v) => { opacities[name] = v; await save(); refresh(); }))
          .addExtraButton((b) => b.setIcon("reset").setTooltip(t("settings.resetInlineStyle")).onClick(async () => { delete colors[name]; delete opacities[name]; await save(); refresh(); renderCategoryColors(); }));
      }
    };
    new Setting(inlineSection).setName(t("settings.colorByHeading")).setDesc(t("settings.colorByHeadingDesc"))
      .addButton((b) => b.setButtonText(t("settings.refreshCategories")).onClick(async () => { await this.plugin.rebuildIndex(false); renderCategoryColors(); this.renderStats(); }));
    renderCategoryColors();

    const hlSection = this.section(containerEl, t("settings.highlight"));
    new Setting(hlSection).setName(t("settings.enableHighlight")).addToggle((toggle) => toggle.setValue(this.plugin.settings.enableHighlight).onChange(async (v) => { this.plugin.settings.enableHighlight = v; await save(); refresh(); }));
    new Setting(hlSection).setName(t("settings.livePreview")).setDesc(this.plugin.liveAvailable ? "" : t("settings.unsupported"))
      .addToggle((t) => t.setValue(this.plugin.settings.enableLivePreview).setDisabled(!this.plugin.liveAvailable).onChange(async (v) => { this.plugin.settings.enableLivePreview = v; await save(); refresh(); }));
    new Setting(hlSection).setName(t("settings.selectionPill"))
      .addToggle((t) => t.setValue(this.plugin.settings.selectionPill).onChange(async (v) => { this.plugin.settings.selectionPill = v; await save(); if (!v) this.plugin.removeSelPill(); }));
    new Setting(hlSection).setName(t("settings.pdfHighlight")).setDesc(t("settings.pdfHighlightDesc"))
      .addToggle((t) => t.setValue(this.plugin.settings.enablePdfHighlight).onChange(async (v) => { this.plugin.settings.enablePdfHighlight = v; await save(); if (v) this.plugin.setupPdfHighlight(); else { this.plugin.teardownPdfHighlight(); this.plugin.rescanPdfLayers(); } }));
    new Setting(hlSection).setName(t("settings.highlightStyle"))
      .addDropdown((dd) => dd.addOption("wavy", t("settings.wavy")).addOption("underline", t("settings.underline")).addOption("background", t("settings.background")).setValue(this.plugin.settings.highlightStyle).onChange(async (v) => { this.plugin.settings.highlightStyle = v; await save(); refresh(); }));
    new Setting(hlSection).setName(t("settings.highlightColor"))
      .addColorPicker((cp) => { this._colorComp = cp; cp.setValue(this.plugin.settings.highlightColor || accentHex).onChange(async (v) => { this.plugin.settings.highlightColor = v; await save(); refresh(); }); })
      .addExtraButton((b) => b.setIcon("reset").setTooltip(t("settings.resetTheme")).onClick(async () => { this.plugin.settings.highlightColor = ""; if (this._colorComp) this._colorComp.setValue(accentHex); await save(); refresh(); }));
    new Setting(hlSection).setName(t("settings.opacity"))
      .addSlider((s) => s.setLimits(0.1, 1, 0.05).setValue(this.plugin.settings.highlightOpacity).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.highlightOpacity = v; await save(); refresh(); }));
    new Setting(hlSection).setName(t("settings.fade")).setDesc(t("settings.fadeDesc"))
      .addToggle((t) => t.setValue(this.plugin.settings.fadeByMemory).onChange(async (v) => { this.plugin.settings.fadeByMemory = v; await save(); refresh(); }));
    new Setting(hlSection).setName(t("settings.fadeFloor"))
      .addSlider((s) => s.setLimits(0, 0.9, 0.05).setValue(this.plugin.settings.fadeFloor).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.fadeFloor = v; await save(); refresh(); }));
    const excludeSetting = new Setting(hlSection).setName(t("settings.excludeTags")).setDesc(t("settings.excludeTagsDesc"));
    excludeSetting.settingEl.addClass("lexis-tags-setting");
    const excludeEditor = excludeSetting.controlEl.createDiv({ cls: "lexis-tag-editor" });
    const excludeChips = excludeEditor.createDiv({ cls: "lexis-tag-editor-chips" });
    const excludeAdd = excludeEditor.createDiv({ cls: "lexis-tag-editor-add" });
    const excludeInput = new obsidian.TextComponent(excludeAdd).setPlaceholder(t("settings.addExcludedTag"));
    const excludedTags = () => [...new Set(this.plugin.parseTags(this.plugin.settings.excludeTags))];
    const saveExcludedTags = async (tags) => {
      this.plugin.settings.excludeTags = tags.join(" ");
      await save();
      await this.plugin.rebuildIndex(false);
    };
    const renderExcludedTags = () => {
      excludeChips.empty();
      for (const tag of excludedTags()) {
        const chip = excludeChips.createEl("button", { cls: "lexis-tag-editor-chip", attr: { type: "button", title: t("settings.removeExcludedTag", { tag }) } });
        chip.createSpan({ text: `#${tag}` });
        chip.createSpan({ cls: "lexis-tag-editor-remove", text: "×" });
        chip.addEventListener("click", async () => { await saveExcludedTags(excludedTags().filter((value) => value !== tag)); renderExcludedTags(); });
      }
    };
    const addExcludedTags = async (raw) => {
      const incoming = this.plugin.parseTags(raw);
      if (!incoming.length) return;
      await saveExcludedTags([...new Set([...excludedTags(), ...incoming])]);
      excludeInput.setValue("");
      renderExcludedTags();
      excludeInput.inputEl.focus();
    };
    excludeInput.inputEl.addEventListener("keydown", (event) => {
      if (["Enter", ",", "，", ";", "；"].includes(event.key)) {
        event.preventDefault();
        addExcludedTags(excludeInput.inputEl.value);
      } else if (event.key === "Backspace" && !excludeInput.inputEl.value) {
        const tags = excludedTags();
        if (tags.length) { tags.pop(); saveExcludedTags(tags).then(renderExcludedTags); }
      }
    });
    new obsidian.ExtraButtonComponent(excludeAdd).setIcon("plus").setTooltip(t("settings.addExcludedTag")).onClick(() => addExcludedTags(excludeInput.inputEl.value));
    if (hasSuggest) new PathSuggest(this.app, excludeInput.inputEl, () => allTags.filter((tag) => !excludedTags().includes(tag)), (value) => addExcludedTags(value));
    renderExcludedTags();

    const tagColorSection = this.section(containerEl, t("settings.tagColors"));
    const rulesWrap = tagColorSection.createDiv();
    const renderRules = () => {
      rulesWrap.empty();
      const grid = rulesWrap.createDiv({ cls: "lexis-rule-grid" });
      this.plugin.settings.tagRules.forEach((rule, i) => {
        const cell = grid.createDiv({ cls: "lexis-rule" });
        const tagIn = new obsidian.TextComponent(cell).setPlaceholder(t("settings.tagPlaceholder")).setValue(rule.tag);
        const applyTag = async (v) => { rule.tag = (v || "").trim(); await save(); refresh(); };
        tagIn.onChange(applyTag);
        if (hasSuggest) new PathSuggest(this.app, tagIn.inputEl, () => allTags, (v) => { tagIn.setValue(v); applyTag(v); });
        new obsidian.ColorComponent(cell).setValue(rule.color || accentHex).onChange(async (v) => { rule.color = v; await save(); refresh(); });
        new obsidian.DropdownComponent(cell).addOption("", t("common.default")).addOption("wavy", t("settings.wavy")).addOption("underline", t("settings.underline")).addOption("background", t("settings.background")).setValue(rule.style || "").onChange(async (v) => { rule.style = v; await save(); refresh(); });
        new obsidian.ExtraButtonComponent(cell).setIcon("trash").setTooltip(t("common.delete")).onClick(async () => { this.plugin.settings.tagRules.splice(i, 1); await save(); refresh(); renderRules(); });
      });
      const addRule = rulesWrap.createEl("button", { text: t("settings.addTagRule") });
      addRule.style.marginTop = "2px";
      addRule.addEventListener("click", async () => { this.plugin.settings.tagRules.push({ tag: "", color: accentHex, style: "" }); await save(); renderRules(); });
    };
    renderRules();

    const cardSection = this.section(containerEl, t("settings.popover"));
    const preview = cardSection.createDiv({ cls: "lexis-popover lexis-popover-preview" });
    preview.createDiv({ cls: "lexis-popover-title", text: "Yalda · 人物" });
    preview.createDiv({ cls: "lexis-popover-body", text: t("settings.popoverPreview") });
    const updateCards = () => {
      this.plugin.applyPopoverAppearance(preview);
      const doc = preview.ownerDocument || document;
      doc.querySelectorAll(".lexis-popover:not(.lexis-popover-preview)").forEach((el) => this.plugin.applyPopoverAppearance(el));
    };
    updateCards();
    new Setting(cardSection).setName(t("settings.popoverWidth"))
      .addSlider((s) => s.setLimits(280, 800, 10).setValue(this.plugin.settings.popoverWidth).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.popoverWidth = v; updateCards(); await save(); }));
    new Setting(cardSection).setName(t("settings.popoverHeight")).setDesc(t("settings.popoverHeightDesc"))
      .addSlider((s) => s.setLimits(200, 800, 10).setValue(this.plugin.settings.popoverMaxHeight).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.popoverMaxHeight = v; updateCards(); await save(); }));
    new Setting(cardSection).setName(t("settings.popoverFont"))
      .addSlider((s) => s.setLimits(11, 24, 1).setValue(this.plugin.settings.popoverFontSize).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.popoverFontSize = v; updateCards(); await save(); }));
    new Setting(cardSection).setName(t("settings.hoverDelay")).setDesc(t("settings.hoverDelayDesc"))
      .addSlider((s) => s.setLimits(0, 3, 0.1).setValue((this.plugin.settings.hoverDelayMs || 0) / 1000).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.hoverDelayMs = Math.round(v * 1000); await save(); }));
    new Setting(cardSection).setName(t("settings.showRelated")).addToggle((toggle) => toggle.setValue(this.plugin.settings.showRelated).onChange(async (v) => { this.plugin.settings.showRelated = v; await save(); }));
    new Setting(cardSection).setName(t("settings.showOccurrences")).setDesc(t("settings.showOccurrencesDesc"))
      .addToggle((t) => t.setValue(this.plugin.settings.showOccurrences).onChange(async (v) => { this.plugin.settings.showOccurrences = v; await save(); }));
    new Setting(cardSection).setName(t("settings.pdfOccurrences")).setDesc(t("settings.pdfOccurrencesDesc"))
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.includePdfOccurrences !== false).onChange(async (v) => { this.plugin.settings.includePdfOccurrences = v; this.plugin._occCache.clear(); await save(); }));
    new Setting(cardSection).setName(t("settings.occurrenceLimit")).addSlider((s) => s.setLimits(1, 15, 1).setValue(this.plugin.settings.occurrenceLimit).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.occurrenceLimit = v; await save(); this.plugin._occCache.clear(); }));
    new Setting(cardSection).setName(t("settings.occurrenceScope")).setDesc(t("settings.occurrenceScopeDesc"))
      .addText((input) => input.setPlaceholder(t("settings.wholeVault")).setValue(this.plugin.settings.occurrenceFolders).onChange(async (v) => { this.plugin.settings.occurrenceFolders = v.trim(); await save(); this.plugin._occCache.clear(); }));

    const addSection = this.section(containerEl, t("settings.selectionAdd"));
    new Setting(addSection).setName(t("settings.emptyNotePreset")).setDesc(t("settings.emptyNotePresetDesc"))
      .addDropdown((dropdown) => dropdown
        .addOption("blank", t("settings.emptyNoteBlank"))
        .addOption("occ", t("settings.emptyNoteOccurrences"))
        .setValue(this.plugin.settings.emptyNotePreset || "blank")
        .onChange(async (value) => { this.plugin.settings.emptyNotePreset = value === "occ" ? "occ" : "blank"; await save(); }));
    new Setting(addSection).setName(t("settings.defaultTemplate")).setDesc(t("settings.defaultTemplateDesc"))
      .addText((input) => {
        input.setPlaceholder("template/word.md").setValue(this.plugin.settings.newWordTemplate);
        const onTpl = async (v) => { this.plugin.settings.newWordTemplate = (v || "").trim(); await save(); };
        input.onChange(onTpl);
        if (hasSuggest) new PathSuggest(this.app, input.inputEl, () => mdFiles, (v) => { input.setValue(v); onTpl(v); });
      });
    const occurrenceSetting = new Setting(addSection).setName(t("settings.occurrenceTemplate")).setDesc(t("settings.occurrenceTemplateDesc"))
      .addTextArea((input) => input
        .setPlaceholder(DEFAULT_SETTINGS.occurrenceTemplate)
        .setValue(this.plugin.settings.occurrenceTemplate ?? DEFAULT_SETTINGS.occurrenceTemplate)
        .onChange(async (v) => { this.plugin.settings.occurrenceTemplate = v; await save(); }));
    occurrenceSetting.settingEl.addClass("lexis-template-setting");
    const occurrenceTextarea = occurrenceSetting.controlEl.querySelector("textarea");
    if (occurrenceTextarea) occurrenceTextarea.rows = 4;

    const fsrsSection = this.section(containerEl, t("settings.review"));
    new Setting(fsrsSection).setName(t("settings.retention")).setDesc(t("settings.retentionDesc"))
      .addSlider((s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.requestRetention = v; await save(); }));
    new Setting(fsrsSection).setName(t("settings.newLimit")).addSlider((s) => s.setLimits(0, 100, 5).setValue(this.plugin.settings.newPerDay).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.newPerDay = v; await save(); }));
    new Setting(fsrsSection).setName(t("settings.sessionLimit")).addSlider((s) => s.setLimits(10, 500, 10).setValue(this.plugin.settings.maxReviewsPerSession).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.maxReviewsPerSession = v; await save(); }));
    new Setting(fsrsSection).setName(t("settings.cardFront")).setDesc(t("settings.cardFrontDesc"))
      .addDropdown((dd) => dd.addOption("note", t("settings.noteCard")).addOption("cloze", t("settings.clozeCard")).setValue(this.plugin.settings.cardFront).onChange(async (v) => { this.plugin.settings.cardFront = v; await save(); }));
    new Setting(fsrsSection).setName(t("settings.showReviewMetadata")).setDesc(t("settings.showReviewMetadataDesc"))
      .addToggle((toggle) => toggle.setValue(!!this.plugin.settings.showReviewMetadata).onChange(async (value) => {
        this.plugin.settings.showReviewMetadata = value;
        this.plugin.applyReviewMetadataVisibility();
        await save();
      }));
    new Setting(fsrsSection).setName(t("settings.ratingOffset")).setDesc(t("settings.ratingOffsetDesc"))
      .addSlider((s) => s.setLimits(0, 200, 5).setValue(this.plugin.settings.reviewBottomSpace).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.reviewBottomSpace = v; await save(); }));
    new Setting(fsrsSection).setName(t("home.start")).addButton((b) => b.setButtonText(t("settings.openReview")).setCta().onClick(() => this.plugin.openReview()));
    new Setting(fsrsSection).setName(t("settings.hoverFeedback")).setDesc(t("settings.hoverFeedbackDesc"))
      .addToggle((t) => t.setValue(this.plugin.settings.hoverFeedback).onChange(async (v) => { this.plugin.settings.hoverFeedback = v; await save(); }));
    new Setting(fsrsSection).setName(t("settings.feedbackDays")).setDesc(t("settings.feedbackDaysDesc"))
      .addSlider((s) => s.setLimits(1, 30, 1).setValue(this.plugin.settings.hoverFeedbackDays).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.hoverFeedbackDays = v; await save(); }));
    new Setting(fsrsSection).setName(t("settings.retireDays")).setDesc(t("settings.retireDaysDesc"))
      .addSlider((s) => s.setLimits(14, 365, 1).setValue(this.plugin.settings.retireCandidateDays).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.retireCandidateDays = v; await save(); }));

    const bridgeSection = this.section(containerEl, t("settings.bridge"), { desc: t("settings.bridgeDesc") });
    new Setting(bridgeSection).setName(t("settings.annotationHeading")).setDesc(t("settings.annotationHeadingDesc"))
      .addText((t) => t.setPlaceholder("#### 批注").setValue(this.plugin.settings.annotationHeading).onChange(async (v) => { this.plugin.settings.annotationHeading = v; await save(); }));
    new Setting(bridgeSection).setName(t("settings.enableBridge"))
      .addToggle((t) => t.setValue(this.plugin.settings.bridgeEnabled).onChange(async (v) => {
        this.plugin.settings.bridgeEnabled = v;
        if (v && !this.plugin.settings.bridgeToken) this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken();
        await save();
        this.plugin.bridge.restart();
        this.display();
      }));
    new Setting(bridgeSection).setName(t("settings.port")).setDesc(t("settings.portDesc"))
      .addText((t) => t.setValue(String(this.plugin.settings.bridgePort)).onChange(async (v) => { const n = parseInt(v, 10); if (n >= 1024 && n <= 65535) { this.plugin.settings.bridgePort = n; await save(); } }))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip(t("settings.restartBridge")).onClick(() => { this.plugin.bridge.restart(); new Notice(t("notice.bridgeRestarted")); }));
    new Setting(bridgeSection).setName(t("settings.token")).setDesc(t("settings.tokenDesc"))
      .addText((input) => { input.setValue(this.plugin.settings.bridgeToken || t("settings.tokenPending")).setDisabled(true); input.inputEl.style.width = "260px"; })
      .addExtraButton((b) => b.setIcon("copy").setTooltip(t("settings.copyToken")).onClick(async () => { if (this.plugin.settings.bridgeToken) { await navigator.clipboard.writeText(this.plugin.settings.bridgeToken); new Notice(t("notice.tokenCopied")); } }))
      .addExtraButton((b) => b.setIcon("refresh-cw").setTooltip(t("settings.regenerateToken")).onClick(async () => { this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken(); await save(); this.plugin.bridge.restart(); this.display(); }));

    new Setting(containerEl).setName(t("settings.rebuild")).addButton((b) => b.setButtonText(t("settings.rebuildNow")).onClick(() => { this.plugin.rebuildIndex(true); this.renderStats(); }));
    this.statsEl = containerEl.createEl("p", { cls: "lexis-stats" });
    this.renderStats();
  }

  renderStats() {
    if (!this.statsEl) return;
    const s = this.plugin.stats;
    this.statsEl.setText(this.plugin.t("settings.stats", { words: s.words, aliases: s.aliases, inline: s.inlineEntries || 0, due: s.due || 0 }));
  }
}
