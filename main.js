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
  // 收录范围:多个文件夹(逗号/换行分隔) ∪ 携带任一标签的笔记(并集)。
  // vocabFolders / excludeTags 不放默认值,迁移与兜底在 loadSettings 里做(留默认会盖掉用户老值)。
  vocabTags: "", // 带任一此标签的笔记也算词库(与文件夹取并集)
  includeAliases: true,
  aliasSources: "", // 额外的别名来源属性名,逗号分隔(如 past,forms,variants)。留空只读 aliases/alias。
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
  // 移动端/桌面端 评分按钮底部间距(px)
  reviewBottomSpace: 70,
  // 浏览器扩展排除标签:打上任一此标签的单词不在网页高亮(多标签,逗号/空格分隔)。
  // excludeTags 不放默认值,迁移在 loadSettings 里做。
  // 浏览器桥接(本地 HTTP,只听 127.0.0.1,供 Chrome 扩展拉词库/划词添加)
  bridgeEnabled: false,
  bridgePort: 45945,
  bridgeToken: "",
  // 划词 pill 上是否显示"文件夹/词典"选择段(默认关,避免拥挤;关掉则新词进第一个词典,可在悬浮卡里改)
  pillFolderPicker: false,
  // 在 Obsidian 笔记里划词后,选区旁冒出"+ 加入词库"浮动药丸(阅读/编辑两种模式都生效)
  selectionPill: true,
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
    try {
    await this.loadSettings();

    this.index = new Map();
    this.vocabPaths = new Set();
    this.stats = { words: 0, aliases: 0, due: 0 };
    this._pattern = null;
    this._rebuildTimer = null;
    this._popover = null;
    this._popoverComp = null;
    this._hideTimer = null;
    this._occCache = new Map();
    this.liveAvailable = false;

    this.statusBarEl = this.addStatusBarItem();
    if (this.statusBarEl) {
      this.statusBarEl.style.cursor = "pointer";
      this.statusBarEl.setAttribute("aria-label", "Lexis:点击重建索引(图标右键可开始背单词)");
      this.registerDomEvent(this.statusBarEl, "click", () => this.rebuildIndex(true));
    }

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
    this.setupPdfHighlight();

    this.registerDomEvent(document, "mouseover", (e) => this.onMouseOver(e));
    this.registerDomEvent(document, "click", (e) => this.onClick(e));
    this.registerDomEvent(window, "scroll", (e) => { if (this._popover && e.target instanceof Node && this._popover.contains(e.target)) return; this.removePopover(); this.removeSelPill(); }, { capture: true });
    // 划词添加:松开鼠标后,若选区在笔记里则冒出"+ 加入词库"药丸
    this.registerDomEvent(document, "mouseup", (e) => this.maybeShowSelPill(e));
    this.registerDomEvent(document, "keydown", (e) => { if (e.key === "Escape") this.removeSelPill(); });
    // PDF 缩放(ctrl/⌘+滚轮)后重排文字层 → 去抖重扫高亮,免得手动点一下才对齐
    this.registerDomEvent(document, "wheel", (e) => { if ((e.ctrlKey || e.metaKey) && e.target && e.target.closest && e.target.closest(".pdf-viewer, .pdf-container, .pdf-embed")) this.rescanPdfSoon(); }, { passive: true, capture: true });

    this.app.workspace.onLayoutReady(() => this.rebuildIndex(false));
    this.registerEvent(this.app.vault.on("create", (f) => this.maybeRebuild(f)));
    this.registerEvent(this.app.vault.on("delete", (f) => this.maybeRebuild(f)));
    this.registerEvent(this.app.vault.on("rename", (f, old) => this.maybeRebuild(f, old)));
    this.registerEvent(this.app.vault.on("modify", () => this._occCache.clear()));
    // 改 frontmatter 增减标签时,让笔记进/出按标签收录的词库(仅配了 vocabTags 才有意义;有 800ms 防抖)
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      if (this.vocabTagSet().size && (this.isVocabFile(file) || this.vocabPaths.has(file.path))) this.scheduleRebuild();
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
            .setTitle(`Lexis:添加“${label}”到 ${f}`)
            .setIcon("book-plus")
            .onClick(() => this.addWordFromSelection(sel, editor, view, f)));
        }
      } else {
        menu.addItem((item) => item
          .setTitle(`Lexis:添加到单词库 “${label}”`)
          .setIcon("book-plus")
          .onClick(() => this.addWordFromSelection(sel, editor, view)));
      }
    }));

    // 浏览器桥接(Stage 0):本地 HTTP 服务,供 Chrome 扩展通信
    this._server = null;
    if (this.settings.bridgeEnabled) {
      if (!this.settings.bridgeToken) { this.settings.bridgeToken = this.genToken(); await this.saveSettings(); }
      this.startBridge();
    }
    } catch (err) {
      console.error("[Lexis] onload 失败:", err?.stack || err);
      if (typeof Notice !== "undefined") new Notice("Lexis 加载失败:" + (err?.message || err));
    }
  }

  onunload() {
    window.clearTimeout(this._rebuildTimer);
    window.clearTimeout(this._hideTimer);
    this.removePopover();
    this.removeSelPill();
    this.teardownPdfHighlight();
    this.stopBridge();
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
    // 单值 → 多值迁移(收录文件夹 / 网页排除标签)。旧键不在 DEFAULT_SETTINGS,故能区分"未迁移"。
    if (this.settings.vocabFolders == null) this.settings.vocabFolders = this.settings.vocabFolder != null ? this.settings.vocabFolder : "01-word";
    if (this.settings.excludeTags == null) this.settings.excludeTags = this.settings.excludeTag || "";
    if (this.settings.vocabTags == null) this.settings.vocabTags = "";
    // 词典表:文件夹来源升级成 [{folder, template}]。从旧 vocabFolders 迁移(模板留空=用全局默认)。
    if (!Array.isArray(this.settings.dicts)) {
      this.settings.dicts = this.parseFolders(this.settings.vocabFolders).map((f) => ({ folder: f, template: "" }));
    }
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

  // ---------- 浏览器桥接(本地 HTTP) ----------
  genToken() {
    const a = new Uint8Array(16);
    (window.crypto || crypto).getRandomValues(a);
    return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  startBridge() {
    if (this._server) return;
    let http;
    try { http = require("http"); } catch (_e) {}
    if (!http) { new Notice("Lexis:此平台不支持本地浏览器桥接(需桌面端)"); return; }
    const port = Number(this.settings.bridgePort) || 45945;
    const server = http.createServer((req, res) => { this.handleBridge(req, res).catch((err) => { try { res.writeHead(500); res.end(String(err && err.message || err)); } catch (_e) {} }); });
    server.on("error", (err) => {
      this._server = null;
      new Notice("Lexis 桥接启动失败:" + (err.code === "EADDRINUSE" ? `端口 ${port} 被占用` : (err.code || err.message)));
    });
    server.listen(port, "127.0.0.1", () => { this.updateStatusBar(); });
    this._server = server;
  }
  stopBridge() {
    if (this._server) { try { this._server.close(); } catch (_e) {} this._server = null; if (this.statusBarEl) this.updateStatusBar(); }
  }
  restartBridge() { this.stopBridge(); if (this.settings.bridgeEnabled) this.startBridge(); }
  bridgeCors() {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "X-Lexis-Token, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
  }
  async handleBridge(req, res) {
    const cors = this.bridgeCors();
    const send = (code, obj) => { res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors)); res.end(JSON.stringify(obj)); };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, "http://127.0.0.1");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    // /ping 不需要 token,供扩展探测连通性
    if (path === "/ping" || path === "/") return send(200, { ok: true, app: "lexis", version: this.manifest.version, vault: this.app.vault.getName() });
    // 其余接口都要 token
    const token = req.headers["x-lexis-token"] || url.searchParams.get("token") || "";
    if (!this.settings.bridgeToken || token !== this.settings.bridgeToken) return send(401, { ok: false, error: "bad-token" });
    if (path === "/words" && req.method === "GET") return send(200, this.bridgeWordList());
    if (path === "/word" && req.method === "GET") return send(200, await this.bridgeWordDetail(url.searchParams.get("key") || url.searchParams.get("w")));
    if (path === "/word" && req.method === "DELETE") return send(200, await this.bridgeDeleteWord(url.searchParams.get("key") || ""));
    if (path === "/add" && req.method === "POST") return send(200, await this.bridgeAddWord(await this.readBody(req)));
    if (path === "/tag" && req.method === "POST") return send(200, await this.bridgeTagWord(await this.readBody(req)));
    if (path === "/note" && req.method === "POST") return send(200, await this.bridgeAnnotate(await this.readBody(req)));
    if (path === "/move" && req.method === "POST") return send(200, await this.bridgeMoveWord(await this.readBody(req)));
    return send(404, { ok: false, error: "not-found" });
  }
  readBody(req) {
    return new Promise((resolve) => {
      let data = "";
      req.on("data", (c) => { data += c; if (data.length > 1e6) req.destroy(); });
      req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (_e) { resolve({}); } });
      req.on("error", () => resolve({}));
    });
  }
  // 网页划词/加例句:词不在库→新建,在库→加例句。来源是网址链接 [标题](url),不是 [[内链]]
  async bridgeAddWord(payload) {
    const word = String((payload && payload.word) || "").trim();
    if (!word) return { ok: false, error: "empty-word" };
    const name = this.sanitizeName(word);
    if (!name) return { ok: false, error: "bad-name" };
    const alias = String((payload && payload.alias) || "").trim();
    const sentence = String((payload && payload.sentence) || "").trim();
    const url = String((payload && payload.url) || "").trim();
    const title = String((payload && payload.title) || url || "").trim().replace(/[\[\]]/g, "");
    const link = url ? ` —— [${title || url}](${url})` : "";
    const line = (sentence || url) ? `> ${sentence}${link}` : "";
    const dupKey = sentence || url;
    // 目标词典文件夹:payload.folder 命中词典表则用它,否则回退第一个
    const reqFolder = this.normalizeFolder((payload && payload.folder) || "");
    const folder = (reqFolder && this.dictFolders().includes(reqFolder)) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + name + ".md";
    const existing = this.app.vault.getAbstractFileByPath(targetPath);
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
        if (line) {
          const cur = await this.app.vault.cachedRead(existing);
          if (dupKey && cur.includes(dupKey)) return { ok: true, created: false, dup: true, word, file: existing.path };
          const apply = (data) => this.insertExampleLine(data, line);
          if (this.app.vault.process) await this.app.vault.process(existing, apply);
          else await this.app.vault.modify(existing, apply(cur));
        }
        if (!alias) this.scheduleRebuild();
        return { ok: true, created: false, word, alias: alias || undefined, file: existing.path };
      }
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      let content = (tpl != null ? tpl : this.minimalSkeleton()).replace(/\{\{word\}\}/g, word).replace(/\{\{date\}\}/g, todayStr());
      if (line) content = this.insertExampleLine(content, line);
      // 别名注入到 frontmatter 再建文件,保证 metadataCache 第一时间就包含别名
      if (alias) content = injectAlias(content);
      const file = await this.app.vault.create(targetPath, content);
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
  // 把一条例句插到「#### 例句」段的末尾(已有例句之后、```lexis occ``` 代码块之前);没有该段就在文末新建
  // 把 line 追加到指定 #### 标题小节末尾(在子标题/代码块之前);没这个标题就在文末新建。
  insertUnderHeading(data, heading, line) {
    const re = new RegExp("(^|\\n)#{2,6}[ \\t]*" + escapeRe(heading) + "[^\\n]*\\n");
    const m = re.exec(data);
    if (!m) {
      // 没这个标题就新建:优先插在末尾的 ```lexis 代码块之前(让批注紧跟正文/例句,而非落在出处热力图之后),否则文末
      const block = data.search(/\n```lexis\b/);
      if (block >= 0) return data.slice(0, block).replace(/\s*$/, "") + `\n\n#### ${heading}\n${line}\n` + data.slice(block);
      return data.replace(/\s*$/, "") + `\n\n#### ${heading}\n${line}\n`;
    }
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
  insertExampleLine(data, line) { return this.insertUnderHeading(data, "例句", line); }
  // 网页悬浮卡批注:纯文字写进已有词笔记的 #### 批注 小节(词笔记里它自然落在例句等段附近)
  async bridgeAnnotate(payload) {
    const text = String((payload && (payload.note ?? payload.text)) || "").trim().replace(/\r?\n+/g, " ");
    if (!text) return { ok: false, error: "empty-note" };
    const key = String((payload && (payload.key ?? payload.word)) || "").trim().toLowerCase();
    const e = this.index.get(key);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    const line = `> ${text}`;
    try {
      const apply = (data) => this.insertUnderHeading(data, "批注", line);
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
    s = s.replace(/(^|\n)#{2,6}[ \t][^\n]*批注[\s\S]*?(?=\n#{1,6}[ \t]|$)/g, "\n"); // 批注小节(另行保留)
    s = s.replace(/^#{1,6}[ \t].*$/gm, "");                                  // 所有标题(模板骨架)
    return !/[A-Za-z0-9一-鿿]/.test(s);                      // 没有任何字母/数字/汉字 = 只是骨架
  }
  // 把已有词移动到另一个词典文件夹。默认只移动文件(正文/批注/例句全保留);
  // 但若该词笔记是空骨架且目标词典有自己的模板,则顺手重套模板——并把 #### 批注 内容迁移过去。
  async bridgeMoveWord(payload) {
    const key = String((payload && (payload.key ?? payload.word)) || "").trim().toLowerCase();
    const folder = this.normalizeFolder((payload && payload.folder) || "");
    const e = this.index.get(key);
    if (!e || !e.file) return { ok: false, error: "not-found" };
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
        const annot = this.extractSection(oldContent, "批注").replace(/```[\s\S]*?```/g, "").trim(); // 迁移批注(去掉尾随的 lexis 代码块)
        const oldFm = this.splitFrontmatter(oldContent).fm;             // 保留原 frontmatter(标签/别名/复习数据)
        const filled = tplRaw.replace(/\{\{word\}\}/g, e.display).replace(/\{\{date\}\}/g, todayStr());
        const tplBody = this.splitFrontmatter(filled).body.replace(/^\s+/, "");
        let nc = (oldFm ? oldFm.replace(/\s*$/, "\n") : "") + (oldFm ? "\n" : "") + tplBody;
        if (annot) nc = this.insertUnderHeading(nc, "批注", annot);
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
  bridgeWordList() {
    const words = [];
    for (const [key, e] of this.index) words.push({ key, word: e.display, alias: !!e.isAlias, tags: [...(e.tags || [])], file: e.file && e.file.path, color: this.colorForEntry(e), wstyle: this.styleKindForEntry(e) });
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
        pillFolderPicker: !!this.settings.pillFolderPicker,
      },
    };
  }
  extractSection(md, name) {
    const re = new RegExp("^#{2,6}[ \\t].*" + escapeRe(name) + ".*$", "m");
    const m = re.exec(md || "");
    if (!m) return "";
    const rest = md.slice(m.index + m[0].length);
    const next = /^#{1,6}[ \t]/m.exec(rest);
    return (next ? rest.slice(0, next.index) : rest).trim();
  }
  async bridgeWordDetail(key) {
    const k = String(key || "").toLowerCase();
    const e = this.index.get(k);
    if (!e) return { ok: false, error: "not-found" };
    let body = "";
    try {
      const raw = await this.app.vault.cachedRead(e.file);
      body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```lexis[\s\S]*?```/g, "");
      body = this.compactSections(body.trim());
    } catch (_e) {}
    const html = await this.bridgeFullHtml(e.file, e.display);
    return {
      ok: true, word: e.display, base: e.file && e.file.basename, file: e.file && e.file.path,
      vault: this.app.vault.getName(),
      alias: !!e.isAlias, tags: [...(e.tags || [])],
      meaning: this.extractSection(body, "意思") || this.extractSection(body, "意义") || "",
      markdown: body, html,
    };
  }
  bridgeOlink(path, base) {
    const vault = encodeURIComponent(this.app.vault.getName());
    return `<a class="lexis-web-ilink" href="obsidian://open?vault=${vault}&file=${encodeURIComponent(path)}">${escHtml(base)}</a>`;
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
      if (MarkdownRenderer.render) await MarkdownRenderer.render(this.app, raw, div, file.path || "", comp);
      else await MarkdownRenderer.renderMarkdown(raw, div, file.path || "", comp);
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
    const boldWord = (sentence) => {
      const re = new RegExp("(" + escapeRe(display) + ")", "ig");
      let out = "", last = 0, mm; re.lastIndex = 0;
      while ((mm = re.exec(sentence))) { if (mm.index > last) out += escHtml(sentence.slice(last, mm.index)); out += "<b>" + escHtml(mm[0]) + "</b>"; last = mm.index + mm[0].length; if (mm[0].length === 0) re.lastIndex++; }
      return out + escHtml(sentence.slice(last));
    };
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
      if (svg) { const due = card.due ? ` · 下次 ${String(card.due).slice(0, 10)}` : ""; html += `<div class="lexis-web-sec">🧠 记忆曲线(稳定度 ${round2(Number(card.s))} 天${due})</div><div class="lexis-web-curve">${svg}</div>`; }
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
        else for (const o of fresh) html += `<div class="lexis-web-occ">${boldWord(o.sentence)} <span class="lexis-web-occ-src">— ${olink(o.file.path, o.file.basename)}</span></div>`;
      } catch (_e) {}
    }
    return html;
  }

  // ---------- 索引 ----------
  normalizeFolder(p) { return (p || "").trim().replace(/^\/+|\/+$/g, ""); }
  // 单一真相:rebuildIndex 算出的命中路径集合。支持"文件夹∪标签"两种收录,且 14 处调用点签名不变。
  inVocabFolder(path) { return this.vocabPaths ? this.vocabPaths.has(path) : false; }
  maybeRebuild(file, oldPath) {
    const p = (file && file.path) || "";
    this._occCache.clear();
    if (this.isVocabFile(file) || this.vocabPaths.has(p) || (oldPath && (this.inFolderScope(oldPath) || this.vocabPaths.has(oldPath)))) this.scheduleRebuild();
  }
  scheduleRebuild() {
    window.clearTimeout(this._rebuildTimer);
    this._rebuildTimer = window.setTimeout(() => this.rebuildIndex(false), 800);
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
  rebuildIndex(notify) {
    const index = new Map();
    const today = todayStr();
    let words = 0, aliases = 0, due = 0;
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.isVocabFile(f));
    this.vocabPaths = new Set(files.map((f) => f.path));
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
      const nf = this.dictFolders().length, nt = this.vocabTagSet().size;
      const scope = [nf ? `${nf} 个文件夹` : "", nt ? `${nt} 个标签` : ""].filter(Boolean).join(" + ") || "(空)";
      new Notice(`Lexis:从 ${scope} 识别到 ${words} 个单词${aliasPart}`);
    }
    return this.stats;
  }
  buildMatcher() {
    // 英文单字母(a/I)噪声大,过滤;但单个汉字等非 ASCII 字符常是有意义的词,保留
    const keys = [...this.index.keys()].filter((k) => k.length >= 2 || /[^\x00-\x7f]/.test(k));
    keys.sort((a, b) => b.length - a.length);
    if (!keys.length) { this._pattern = null; return; }
    this._pattern = keys.map(boundedSource).join("|");
  }
  updateStatusBar() {
    if (!this.statusBarEl) return;
    const aliasPart = this.settings.includeAliases && this.stats.aliases ? ` +${this.stats.aliases}别名` : "";
    const duePart = this.stats.due ? ` · ⏰${this.stats.due}` : "";
    const bridgePart = this._server ? " · 🌐" : "";
    this.statusBarEl.setText(`📕 ${this.stats.words} 词${aliasPart}${duePart}${bridgePart}`);
  }

  // ---------- 着色 ----------
  applyAlpha(color, alpha) {
    if (alpha == null || alpha >= 1) return color;
    const pct = Math.max(0, Math.min(100, Math.round(alpha * 100)));
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
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
    let color = this.settings.highlightColor || "var(--text-accent)";
    let styleKind = this.settings.highlightStyle || "wavy";
    // 优先级:标签规则 > 词典色 > 全局色(和网页端 inlineStyleFor 完全一致)
    const dc = this.dictColorForFile(entry && entry.file);
    if (dc) color = dc;
    if (entry?.tags && this.settings.tagRules?.length) {
      const rule = this.settings.tagRules.find((r) => r.tag && entry.tags.has(r.tag.toLowerCase()));
      if (rule) { if (rule.color) color = rule.color; if (rule.style) styleKind = rule.style; }
    }
    // PDF:文字层 opacity 0.2,内嵌高亮不可见 → 单独建一层叠在 Canvas 之上、textLayer 之下,
    // 用内联 .lexis-hl 隐形做事件代理,视觉高亮画在独立 overlay 层里。
    if (opts && opts.pdf) return "text-decoration:none;";
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
    this.rescanPdfLayers();
  }

  // ---------- 阅读模式高亮 ----------
  highlightElement(el, ctx) {
    if (!this.settings.enableHighlight || !this._pattern || !this.index.size) return;
    if (el.closest && el.closest(".lexis-popover")) return;
    if (ctx && ctx.sourcePath && this.inVocabFolder(ctx.sourcePath)) return;
    this.wrapMatchesInElement(el, "code,pre,a,.lexis-hl,.lexis-popover,.math,.tag");
  }
  // 把 el 内文本节点里命中词库的片段包成 <span class="lexis-hl">(供阅读模式 + PDF 复用)。
  // rejectSelector:父元素命中则跳过该文本节点(避免重复包/包进代码块等)。
  wrapMatchesInElement(el, rejectSelector, styleOpts) {
    if (!this._pattern || !this.index.size) return;
    const regex = new RegExp(this._pattern, "gi");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
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
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = regex.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const entry = this.index.get(m[0].toLowerCase());
        const span = document.createElement("span");
        span.className = "lexis-hl";
        span.textContent = m[0];
        span.dataset.lexisKey = m[0].toLowerCase();
        span.setAttribute("style", this.inlineStyleForEntry(entry, styleOpts));
        frag.appendChild(span);
        last = m.index + m[0].length;
        if (m[0].length === 0) regex.lastIndex++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  // ---------- PDF 高亮(钩 pdf.js 文字层) ----------
  // ob 内置 PDF 阅读器 = pdf.js,.textLayer 在主 DOM(无 iframe),文字层文字是透明的、
  // 仅供选中复制;我们把命中词包成 .lexis-hl(下划线/背景色显式带颜色,所以透明文字上也看得见),
  // 顺带白嫖现成的 document 级 mouseover/click → 悬浮卡 + 跳转。翻页/缩放时 pdf.js 重建文字层,
  // 用 MutationObserver 重扫;.lexis-hl 在 rejectSelector 里,重扫不会重复包。
  setupPdfHighlight() {
    if (this._pdfObserver) { this._pdfObserver.disconnect(); this._pdfObserver = null; }
    if (this._pdfTimer) { window.clearTimeout(this._pdfTimer); this._pdfTimer = 0; }
    if (!this.settings.enablePdfHighlight || typeof MutationObserver === "undefined") return;
    this._pdfPending = new Set();
    const flush = () => {
      this._pdfTimer = 0;
      const items = [...this._pdfPending]; this._pdfPending.clear();
      // 扫描时先断开观察,免得自己包高亮产生的 DOM 变动又触发一轮
      if (this._pdfObserver) this._pdfObserver.disconnect();
      for (const layer of items) { try { if (layer.isConnected) this.scanPdfLayer(layer); } catch (_e) {} }
      if (this._pdfObserver) try { this._pdfObserver.observe(document.body, { childList: true, subtree: true }); } catch (_e) {}
    };
    this._pdfObserver = new MutationObserver((muts) => {
      try {
        for (const mu of muts) {
          for (const node of mu.addedNodes) {
            if (!node || node.nodeType !== 1) continue;
            if (node.classList && node.classList.contains("textLayer")) this._pdfPending.add(node);
            else if (node.querySelectorAll) node.querySelectorAll(".textLayer").forEach((l) => this._pdfPending.add(l));
            const layer = node.closest && node.closest(".textLayer");
            if (layer) this._pdfPending.add(layer);
          }
        }
      } catch (_e) {}
      // 去抖:等 pdf.js 把这一页/这次缩放的文字层完全铺好、位置定了再扫,避免扫早了对不齐
      if (this._pdfPending.size) { window.clearTimeout(this._pdfTimer); this._pdfTimer = window.setTimeout(flush, 140); }
    });
    this._pdfObserver.observe(document.body, { childList: true, subtree: true });
    // 首次:扫描已经打开的 PDF
    try { document.querySelectorAll(".textLayer").forEach((l) => this.scanPdfLayer(l)); } catch (_e) {}
  }
  // 缩放(ctrl/⌘+滚轮)后,pdf.js 会重排文字层但可能不重建 → 高亮位置对不上;去抖后整层清掉重扫,强制对齐
  rescanPdfSoon() {
    if (!this.settings.enablePdfHighlight) return;
    window.clearTimeout(this._pdfRescanTimer);
    this._pdfRescanTimer = window.setTimeout(() => this.rescanPdfLayers(), 220);
  }
  scanPdfLayer(layer) {
    if (!this.settings.enablePdfHighlight || !this.settings.enableHighlight) return;
    // 1. 在 textLayer 里注入隐形 .lexis-hl(仅事件代理,无视觉样式)
    this.wrapMatchesInElement(layer, ".lexis-hl,.lexis-popover", { pdf: true });
    // 2. 建独立高亮 overlay,叠在 Canvas 上、textLayer 下(不沾 textLayer 的 opacity)
    const page = layer.parentElement;
    let hl = page.querySelector(".lexis-pdf-hl-layer");
    if (!hl) {
      hl = document.createElement("div");
      hl.className = "lexis-pdf-hl-layer";
      const canvas = page.querySelector("canvas");
      if (canvas) canvas.insertAdjacentElement("afterend", hl);
      else layer.insertAdjacentElement("beforebegin", hl);
    }
    const hlBB = layer.getBoundingClientRect();
    const pageBB = page.getBoundingClientRect();
    hl.style.cssText = `position:absolute;left:${hlBB.left - pageBB.left}px;top:${hlBB.top - pageBB.top}px;width:${hlBB.width}px;height:${hlBB.height}px;z-index:1;pointer-events:none;`;
    hl.innerHTML = "";
    // 3. 遍历内联 .lexis-hl,在 overlay 层画出对应荧光笔矩形
    const spans = layer.querySelectorAll(".lexis-hl");
    for (const s of spans) {
      const key = s.dataset.lexisKey;
      if (!key) continue;
      const entry = this.index.get(key);
      if (!entry) continue;
      try {
        const color = (() => {
          const dc = this.dictColorForFile(entry.file);
          if (dc) return dc;
          if (this.settings.highlightColor) return this.settings.highlightColor;
          return "var(--text-accent)";
        })();
        const o = this.settings.highlightOpacity;
        const alpha = Math.max(0.15, Math.min(0.6, (o == null ? 1 : o) * 0.6));
        const rect = s.getBoundingClientRect();
        const d = document.createElement("div");
        d.className = "lexis-pdf-hl";
        d.dataset.lexisKey = key;
        d.style.cssText = `position:absolute;left:${rect.left - hlBB.left}px;top:${rect.top - hlBB.top}px;width:${rect.width}px;height:${rect.height}px;background:${this.applyAlpha(color, alpha)};border-radius:2px;pointer-events:auto;`;
        hl.appendChild(d);
      } catch (_e) {}
    }
  }
  teardownPdfHighlight() {
    if (this._pdfObserver) { this._pdfObserver.disconnect(); this._pdfObserver = null; }
    if (this._pdfTimer) { window.clearTimeout(this._pdfTimer); this._pdfTimer = 0; }
    if (this._pdfRescanTimer) { window.clearTimeout(this._pdfRescanTimer); this._pdfRescanTimer = 0; }
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
  parseFolders(text) { return (text || "").split(/[,，\n]/).map((s) => this.normalizeFolder(s)).filter(Boolean); }
  parseTags(text) { return (text || "").split(/[,，;；\s]+/).map((s) => s.trim().replace(/^#/, "").toLowerCase()).filter(Boolean); }
  vocabTagSet() { return new Set(this.parseTags(this.settings.vocabTags)); }
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
    const re = new RegExp(boundedSource(word), "i");
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
  buildCloze(sentence, word) { return sentence.replace(new RegExp(boundedSource(word), "ig"), "______"); }
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
  async readTemplatePath(p) {
    p = (p || "").trim();
    if (!p) return null;
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f instanceof TFile) { try { return await this.app.vault.read(f); } catch (_e) {} }
    return null;
  }
  // 无模板时的空白骨架:只留最简 frontmatter(供标签/别名/复习数据),正文空白,不硬塞小节标题
  minimalSkeleton() { return "---\ntags:\n---\n\n"; }
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
    if (!word) { new Notice("Lexis:请先选中一个词"); return; }
    this.addWordFromSelection(word, editor, view);
  }
  async addWordFromSelection(word, editor, view, targetFolder) {
    const clean = (word || "").trim();
    const fileName = this.sanitizeName(clean);
    if (!fileName) { new Notice("Lexis:无效的单词"); return; }
    const reqFolder = this.normalizeFolder(targetFolder || "");
    const folder = (reqFolder && this.dictFolders().includes(reqFolder)) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + fileName + ".md";
    const existing = this.app.vault.getAbstractFileByPath(targetPath);
    const srcFile = (view && view.file) || this.app.workspace.getActiveFile();
    const sentence = editor ? this.getSelectionSentence(editor) : this.getReadingSentence();
    // 从 PDF 划词加词时,新词笔记开到新标签页,免得把正在读的 PDF 顶掉
    const fromPdf = srcFile && srcFile.extension === "pdf" && !editor;
    if (existing) {
      new Notice(`Lexis:「${fileName}」已存在,打开它`);
      this.app.workspace.getLeaf(fromPdf ? "tab" : false).openFile(existing);
      return;
    }
    try {
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      let content = (tpl != null ? tpl : this.minimalSkeleton()).replace(/\{\{word\}\}/g, clean).replace(/\{\{date\}\}/g, todayStr());
      // 出处写进正文(而不是 frontmatter 属性),好看且笔记里直接可见
      if (sentence || srcFile) {
        // PDF 出处带上页码,链接可直接跳到那一页
        let sub = "", disp = srcFile ? srcFile.basename : "";
        if (fromPdf) {
          const pg = this.currentPdfPage();
          if (pg) { sub = `#page=${pg}`; disp = `${srcFile.basename} p.${pg}`; }
        }
        const link = srcFile ? ` —— [[${srcFile.path}${sub}|${disp}]]` : "";
        content = content.replace(/\s*$/, "") + `\n\n#### 例句\n> ${sentence || ""}${link}\n`;
      }
      const file = await this.app.vault.create(targetPath, content);
      if (fromPdf) {
        // 从 PDF 加词:留在 PDF 页面,不打开新词笔记;立刻重建索引→当场高亮
        new Notice(`Lexis:已加入「${fileName}」,已在 PDF 高亮`);
        this.rebuildIndex(false);
      } else {
        new Notice(`Lexis:已创建「${fileName}」`);
        await this.app.workspace.getLeaf(false).openFile(file);
        this.scheduleRebuild();
      }
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
    const countBefore = el.children.length;
    if (m === "derived" || m === "派生") { await this.renderDerivedWords(el, file); if (el.children.length === countBefore) el.remove(); return; }
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
      for (const o of list) {
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
    if (el.children.length === countBefore) el.remove();
  }

  // ---------- 悬浮卡 ----------
  onMouseOver(e) { const t = e.target; if (t && t.classList && (t.classList.contains("lexis-hl") || t.classList.contains("lexis-pdf-hl"))) this.showPopover(t); }
  onClick(e) {
    const t = e.target;
    if (t && t.classList && (t.classList.contains("lexis-hl") || t.classList.contains("lexis-pdf-hl"))) {
      const entry = this.index.get(t.dataset.lexisKey);
      if (entry) { e.preventDefault(); this.app.workspace.getLeaf(e.ctrlKey || e.metaKey ? "tab" : false).openFile(entry.file); this.removePopover(); }
    } else if (this._popover && !this._popover.contains(t)) this.removePopover();
  }
  scheduleHide() { window.clearTimeout(this._hideTimer); this._hideTimer = window.setTimeout(() => this.removePopover(), 220); }
  removePopover() {
    if (this._popoverComp) { this._popoverComp.unload(); this._popoverComp = null; }
    if (this._popover) { this._popover.remove(); this._popover = null; }
  }
  // ---------- 划词添加药丸(普通笔记,阅读/编辑两种模式) ----------
  removeSelPill() { if (this._selPill) { this._selPill.remove(); this._selPill = null; } }
  maybeShowSelPill(e) {
    if (!this.settings.selectionPill) return;
    const tgt = e && e.target;
    // 点到自己的 UI(药丸/悬浮卡/菜单)不处理,避免抢选区
    if (tgt && tgt.closest && tgt.closest(".lexis-sel-pill, .lexis-popover, .menu")) return;
    let sel, text;
    try { sel = window.getSelection(); text = sel ? sel.toString().trim() : ""; } catch (_e) { return; }
    if (!text || text.length > 60 || /[\n\r]/.test(text)) { this.removeSelPill(); return; }
    // 选区必须落在 Markdown 笔记内容 或 PDF 文字层里(其它面板/设置一律不弹)
    const node = sel.anchorNode;
    const host = node ? (node.nodeType === 1 ? node : node.parentElement) : null;
    if (!host || !host.closest || !host.closest(".markdown-source-view, .markdown-reading-view, .markdown-preview-view, .pdf-viewer, .pdf-container, .pdf-embed, .textLayer")) { this.removeSelPill(); return; }
    let rect; try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (_e) { return; }
    if (!rect || (!rect.width && !rect.height)) { this.removeSelPill(); return; }
    this.removeSelPill();
    const known = this.index.has(text.toLowerCase());
    const pill = document.body.createDiv({ cls: "lexis-sel-pill" });
    pill.setText(known ? "📖 已有,打开" : "➕ 加入词库");
    // 阻止 mousedown 收起选区/夺焦
    pill.addEventListener("mousedown", (ev) => ev.preventDefault());
    pill.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const dicts = this.dictFolders();
      if (!known && dicts.length > 1) {
        const menu = new obsidian.Menu();
        for (const f of dicts) menu.addItem((it) => it.setTitle(f || "(库根目录)").setIcon("book-plus").onClick(() => this.addFromPill(text, f)));
        menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
      } else {
        this.addFromPill(text);
      }
    });
    // 定位:选区下方略偏左;贴边时夹回视口
    const top = Math.min(rect.bottom + 6, window.innerHeight - 36);
    const left = Math.max(6, Math.min(rect.left, window.innerWidth - pill.offsetWidth - 6));
    pill.style.top = top + "px";
    pill.style.left = left + "px";
    this._selPill = pill;
  }
  addFromPill(text, folder) {
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    const editor = (view && view.getMode && view.getMode() === "source" && view.editor) ? view.editor : null;
    this.removeSelPill();
    this.addWordFromSelection(text, editor, view, folder);
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
  async renderNoteInto(el, file, comp, keepLexis) {
    const raw = await this.app.vault.cachedRead(file);
    let stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
    if (!keepLexis) stripped = stripped.replace(/```lexis[\s\S]*?```/g, "");
    const md = this.compactSections(stripped.trim()) || "*(空)*";
    el.empty();
    if (MarkdownRenderer.render) await MarkdownRenderer.render(this.app, md, el, file.path, comp);
    else await MarkdownRenderer.renderMarkdown(md, el, file.path, comp);
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
    // 评分栏置底:空余空间推到底部 + 可配置的底部间距
    const bs = this.plugin.settings.reviewBottomSpace || 70;
    if (document.body.classList.contains("is-phone")) {
      const spacer = document.createElement("div");
      spacer.style.flex = "1";
      c.insertBefore(spacer, this.rateBar);
    }
    this.rateBar.style.marginBottom = bs + "px";
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
    c.style.paddingBottom = (this.plugin.settings.reviewBottomSpace || 70) + "px";
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

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const accentHex = cssColorToHex(getComputedStyle(document.body).getPropertyValue("--text-accent"));
    const save = () => this.plugin.saveSettings();
    const refresh = () => this.plugin.refreshAllViews();
    containerEl.createEl("h3", { text: "Lexis 设置" });

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

    new Setting(containerEl).setName("词典(文件夹 → 模板)").setHeading();
    new Setting(containerEl).setDesc(`每行一个词典:文件夹(含子文件夹)里每个笔记标题都算一个词条,各词典可指定自己的新词模板(留空=建空白笔记,不套任何模板)。新词默认落到第一行。已有文件夹:${folders.slice(0, 8).join("、") || "(无)"}${folders.length > 8 ? "…" : ""}`);
    const dictsWrap = containerEl.createDiv();
    const renderDicts = () => {
      dictsWrap.empty();
      (this.plugin.settings.dicts || []).forEach((d, i) => {
        const row = dictsWrap.createDiv();
        row.style.display = "flex"; row.style.gap = "6px"; row.style.marginBottom = "6px"; row.style.alignItems = "center";
        const fIn = new obsidian.TextComponent(row);
        fIn.setPlaceholder("文件夹 如 01-word").setValue(d.folder || "");
        fIn.inputEl.style.flex = "1";
        const onFolder = async (v) => { d.folder = (v || "").trim(); await save(); this.plugin.rebuildIndex(false); this.renderStats(); };
        fIn.onChange(onFolder);
        const tIn = new obsidian.TextComponent(row);
        tIn.setPlaceholder("模板路径,留空=空白笔记").setValue(d.template || "");
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
        const markInherit = (inherit) => { const el = swatch(); if (el) { el.style.opacity = inherit ? "0.4" : "1"; el.title = inherit ? "未设置,跟随全局/主题色;点选即设为这个词典的专属色" : "这个词典的专属高亮色(库内+网页)"; } };
        cComp.setValue(d.color || globalColor);
        markInherit(!d.color);
        cComp.onChange(async (v) => { d.color = v; markInherit(false); await save(); refresh(); });
        new obsidian.ExtraButtonComponent(row).setIcon("reset").setTooltip("恢复跟随全局/主题色").onClick(async () => { d.color = ""; cComp.setValue(globalColor); markInherit(true); await save(); refresh(); });
        new obsidian.ExtraButtonComponent(row).setIcon("trash").setTooltip("删除这个词典").onClick(async () => { this.plugin.settings.dicts.splice(i, 1); await save(); this.plugin.rebuildIndex(false); renderDicts(); this.renderStats(); });
      });
      const addDict = dictsWrap.createEl("button", { text: "+ 添加词典" });
      addDict.style.marginTop = "2px";
      addDict.addEventListener("click", async () => { this.plugin.settings.dicts.push({ folder: "", template: "" }); await save(); renderDicts(); });
    };
    renderDicts();
    new Setting(containerEl).setName("按标签收录").setDesc("带任一此标签的笔记也算词库(与文件夹取并集),逗号或空格分隔。留空=只按文件夹。")
      .addText((t) => {
        t.setPlaceholder("词汇 术语").setValue(this.plugin.settings.vocabTags);
        const apply = async (v) => { this.plugin.settings.vocabTags = v; await save(); this.plugin.rebuildIndex(true); this.renderStats(); };
        t.onChange(apply); tagSuggest(t, apply);
      });
    new Setting(containerEl).setName("别名也算单词").setDesc("启用后,单词笔记 frontmatter 里的别名也会被识别与高亮。")
      .addToggle((t) => t.setValue(this.plugin.settings.includeAliases).onChange(async (v) => { this.plugin.settings.includeAliases = v; await save(); this.plugin.rebuildIndex(false); this.renderStats(); }));
    new Setting(containerEl).setName("别名属性名").setDesc("除 aliases/alias 外,还从哪些 frontmatter 属性读取别名(逗号分隔)。例:past,forms,variants· 适合存过去式、复数等变形。")
      .addText((t) => {
        t.setPlaceholder("past,forms,variants").setValue(this.plugin.settings.aliasSources);
        const apply = async (v) => { this.plugin.settings.aliasSources = (v || "").trim(); await save(); if (this.plugin.settings.includeAliases) { this.plugin.rebuildIndex(false); this.renderStats(); } };
        t.onChange(apply);
        if (hasSuggest) new PathSuggest(this.app, t.inputEl, () => allProps, (v) => { t.setValue(v); apply(v); }, { multi: true, sep: "," });
      });

    containerEl.createEl("h4", { text: "高亮" });
    new Setting(containerEl).setName("启用高亮").addToggle((t) => t.setValue(this.plugin.settings.enableHighlight).onChange(async (v) => { this.plugin.settings.enableHighlight = v; await save(); refresh(); }));
    new Setting(containerEl).setName("实时预览也高亮(编辑模式)").setDesc(this.plugin.liveAvailable ? "编辑时也显示高亮。" : "⚠️ 当前环境无法加载 CodeMirror,不可用。")
      .addToggle((t) => t.setValue(this.plugin.settings.enableLivePreview).setDisabled(!this.plugin.liveAvailable).onChange(async (v) => { this.plugin.settings.enableLivePreview = v; await save(); refresh(); }));
    new Setting(containerEl).setName("划词冒出「加入词库」药丸").setDesc("在笔记里(阅读/编辑模式)选中一段文字,松开鼠标后选区旁出现浮动按钮,点一下即建词并记出处。")
      .addToggle((t) => t.setValue(this.plugin.settings.selectionPill).onChange(async (v) => { this.plugin.settings.selectionPill = v; await save(); if (!v) this.plugin.removeSelPill(); }));
    new Setting(containerEl).setName("PDF 里也高亮").setDesc("在 Obsidian 内置 PDF 阅读器里高亮词库词,可悬浮看释义、点击跳转。仅对有文字层的 PDF 有效(扫描版/纯图片 PDF 无效)。")
      .addToggle((t) => t.setValue(this.plugin.settings.enablePdfHighlight).onChange(async (v) => { this.plugin.settings.enablePdfHighlight = v; await save(); if (v) this.plugin.setupPdfHighlight(); else { this.plugin.teardownPdfHighlight(); this.plugin.rescanPdfLayers(); } }));
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
        const tagIn = new obsidian.TextComponent(cell).setPlaceholder("标签").setValue(rule.tag);
        const applyTag = async (v) => { rule.tag = (v || "").trim(); await save(); refresh(); };
        tagIn.onChange(applyTag);
        if (hasSuggest) new PathSuggest(this.app, tagIn.inputEl, () => allTags, (v) => { tagIn.setValue(v); applyTag(v); });
        new obsidian.ColorComponent(cell).setValue(rule.color || accentHex).onChange(async (v) => { rule.color = v; await save(); refresh(); });
        new obsidian.DropdownComponent(cell).addOption("", "默认").addOption("wavy", "波浪").addOption("underline", "实线").addOption("background", "背景").setValue(rule.style || "").onChange(async (v) => { rule.style = v; await save(); refresh(); });
        new obsidian.ExtraButtonComponent(cell).setIcon("trash").setTooltip("删除").onClick(async () => { this.plugin.settings.tagRules.splice(i, 1); await save(); refresh(); renderRules(); });
      });
      const addRule = rulesWrap.createEl("button", { text: "+ 添加标签规则" });
      addRule.style.marginTop = "2px";
      addRule.addEventListener("click", async () => { this.plugin.settings.tagRules.push({ tag: "", color: accentHex, style: "" }); await save(); renderRules(); });
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
    new Setting(containerEl).setName("默认模板(兜底)").setDesc("仅当新词落到没在上面列出的文件夹时才用(正常都会命中某个词典,用不到);词典模板留空 = 空白笔记,不再回退到这里。模板里可用 {{word}} {{date}} 占位。")
      .addText((t) => {
        t.setPlaceholder("template/单词模板.md").setValue(this.plugin.settings.newWordTemplate);
        const onTpl = async (v) => { this.plugin.settings.newWordTemplate = (v || "").trim(); await save(); };
        t.onChange(onTpl);
        if (hasSuggest) new PathSuggest(this.app, t.inputEl, () => mdFiles, (v) => { t.setValue(v); onTpl(v); });
      });

    containerEl.createEl("h4", { text: "背单词 (FSRS)" });
    new Setting(containerEl).setName("目标记忆保留率").setDesc("越高复习越频繁。默认 0.9。")
      .addSlider((s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.requestRetention = v; await save(); }));
    new Setting(containerEl).setName("每天新词上限").addSlider((s) => s.setLimits(0, 100, 5).setValue(this.plugin.settings.newPerDay).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.newPerDay = v; await save(); }));
    new Setting(containerEl).setName("每轮最多复习").addSlider((s) => s.setLimits(10, 500, 10).setValue(this.plugin.settings.maxReviewsPerSession).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.maxReviewsPerSession = v; await save(); }));
    new Setting(containerEl).setName("卡片正面").setDesc("整篇=正面单词、背面笔记;填空=正面例句挖空、背面笔记(需先收藏例句,没有则退回显示单词)。")
      .addDropdown((dd) => dd.addOption("note", "单词 → 整篇").addOption("cloze", "例句填空").setValue(this.plugin.settings.cardFront).onChange(async (v) => { this.plugin.settings.cardFront = v; await save(); }));
    new Setting(containerEl).setName("评分按钮底部间距").setDesc("答案区下方评分按钮与底部的距离(px)。移动端需留出导航栏空间,默认 70。")
      .addSlider((s) => s.setLimits(0, 200, 5).setValue(this.plugin.settings.reviewBottomSpace).setDynamicTooltip().onChange(async (v) => { this.plugin.settings.reviewBottomSpace = v; await save(); }));
    new Setting(containerEl).setName("开始背单词").addButton((b) => b.setButtonText("打开复习").setCta().onClick(() => this.plugin.openReview()));

    containerEl.createEl("h4", { text: "浏览器扩展(桥接)" });
    containerEl.createEl("p", { cls: "setting-item-description", text: "在本机开一个只监听 127.0.0.1 的小服务,供 Chrome 扩展拉词库高亮、划词加词。数据不出本机。Obsidian 关掉后服务也停。" });
    // 排除标签:带任一此标签的单词不会在网页高亮
    const vocabTagsHint = this.plugin.collectVocabTags().slice(0, 10).join("、");
    new Setting(containerEl).setName("排除标签").setDesc(`带任一此标签的单词不在网页高亮(Obsidian 里不受影响),逗号或空格分隔。留空=不排除。词库标签:${vocabTagsHint || "(无)"}`)
      .addText((t) => {
        t.setPlaceholder("已掌握 暂缓").setValue(this.plugin.settings.excludeTags);
        const apply = async (v) => { this.plugin.settings.excludeTags = v; await save(); };
        t.onChange(apply); tagSuggest(t, apply);
      });
    new Setting(containerEl).setName("划词 pill 显示词典选择").setDesc("开启后,网页划词加新词的小条上会多一个文件夹下拉,可当场选落到哪个词典(需多个词典)。关闭则新词进第一个词典,之后在悬浮卡里点文件夹小标可改。")
      .addToggle((t) => t.setValue(this.plugin.settings.pillFolderPicker).onChange(async (v) => { this.plugin.settings.pillFolderPicker = v; await save(); }));
    new Setting(containerEl).setName("启用本地桥接").setDesc(`开启后浏览器访问 http://127.0.0.1:${this.plugin.settings.bridgePort}/ping 应返回 ok。`)
      .addToggle((t) => t.setValue(this.plugin.settings.bridgeEnabled).onChange(async (v) => {
        this.plugin.settings.bridgeEnabled = v;
        if (v && !this.plugin.settings.bridgeToken) this.plugin.settings.bridgeToken = this.plugin.genToken();
        await save();
        this.plugin.restartBridge();
        this.display();
      }));
    new Setting(containerEl).setName("端口").setDesc("改完需要重新开关一次桥接生效。")
      .addText((t) => t.setValue(String(this.plugin.settings.bridgePort)).onChange(async (v) => { const n = parseInt(v, 10); if (n >= 1024 && n <= 65535) { this.plugin.settings.bridgePort = n; await save(); } }))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip("重启桥接").onClick(() => { this.plugin.restartBridge(); new Notice("Lexis:桥接已重启"); }));
    new Setting(containerEl).setName("访问令牌").setDesc("扩展用它连接,防止别的网页乱连。点复制粘到扩展里。")
      .addText((t) => { t.setValue(this.plugin.settings.bridgeToken || "(启用后生成)").setDisabled(true); t.inputEl.style.width = "260px"; })
      .addExtraButton((b) => b.setIcon("copy").setTooltip("复制令牌").onClick(async () => { if (this.plugin.settings.bridgeToken) { await navigator.clipboard.writeText(this.plugin.settings.bridgeToken); new Notice("Lexis:令牌已复制"); } }))
      .addExtraButton((b) => b.setIcon("refresh-cw").setTooltip("重新生成(旧扩展需重填)").onClick(async () => { this.plugin.settings.bridgeToken = this.plugin.genToken(); await save(); this.plugin.restartBridge(); this.display(); }));

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