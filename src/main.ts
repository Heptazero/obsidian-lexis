"use strict";

/*
 * Lexis —— 自建单词学习插件(源码按职责拆分，发布为移动端兼容的单文件 main.js)
 * Stage 0~2:文件夹→单词索引、阅读+实时预览高亮、悬浮卡(笔记结构 + 相关词 + 出现过的地方)。
 * Stage 3:FSRS 翻卡背单词,进度写进笔记 frontmatter。
 * 详细路线图见 LOG.md。
 */

import * as obsidian from "obsidian";
import { Plugin, PluginSettingTab, Setting, Notice, Platform, TFolder, TFile, Component, MarkdownRenderer, ItemView, Modal, finishRenderMath } from "obsidian";
import { createI18n } from "./i18n";
import { buildCurveSVG } from "./curve";
import { createReviewView } from "./review-view";
import { createOccurrenceSearch } from "./occurrence-search";
import { createBridgeServer } from "./bridge-server";
import { createBridgeApi } from "./bridge-api";
import { createHighlightEngine } from "./highlight-engine";
import { createReaderUi } from "./reader-ui";
import { addAppearanceButton, createReorderController, moveItem } from "./settings-controls";
import { createTemplateProvider } from "./template-provider";
import { createSettingsTab } from "./settings-tab";
import type { Occurrence, OccurrenceSearch, PdfJsRuntime } from "./occurrence-search";
import type { HighlightStyle, InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats, ReviewHistoryEvent, TagRule } from "./types";

const LEXIS_REVIEW_VIEW = "lexis-review-view";
const LEXIS_HOME_VIEW = "lexis-home-view";

type DefaultLexisSettings = Omit<LexisSettings, "dicts" | "vocabFolders" | "excludeTags">;

const DEFAULT_SETTINGS: DefaultLexisSettings = {
  language: "zh",
  // 收录范围:多个文件夹(逗号/换行分隔) ∪ 携带任一标签的笔记(并集)。
  // vocabFolders / excludeTags 不放默认值,迁移与兜底在 loadSettings 里做(留默认会盖掉用户老值)。
  vocabTags: "", // 带任一此标签的笔记也算词库(与文件夹取并集)
  includeAliases: true,
  aliasSources: "", // 额外的别名来源属性名,逗号分隔(如 past,forms,variants)。留空只读 aliases/alias。
  // 内联条目库:带 lexis-inline 属性(或 #lexis-inline 标签)的笔记可用「词条::批注」维护轻量词条。
  inlineEntriesEnabled: true,
  inlineEntryDelimiter: "::",
  inlineClassificationMode: "heading", // heading=同名最近标题共用外观；file=同一来源文件共用外观
  inlineCategoryColors: {}, // { "人物": "#d9534f" }，由资料笔记的标题分类自动生成设置项
  inlineCategoryOpacity: {}, // { "人物": 0.65 }，留空时跟随全局高亮透明度
  inlineCategoryHighlight: {}, // { "人物": false }，关闭后仍识别和显示悬浮批注，只隐藏高亮
  inlineFileColors: {}, // { "资料/小说.md": "#d9534f" }，按文件分类时使用
  inlineFileOpacity: {},
  inlineFileHighlight: {},
  inlineSourceHighlight: {}, // { "资料/小说.md::人物": false }，父级下单独关闭某个子集
  inlineCollapsedGroups: {},
  inlineCategoryOrder: [], // 设置页分类顺序；新发现的分类追加在末尾
  inlineFileOrder: [],
  inlineCategoryOrderByParent: {}, // 每个分类父级独立保存子集顺序
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
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 词边界(支持中文):只有当词以英文字母/数字/下划线开头或结尾时才加 ASCII 边界
// (避免 cat 命中 category);中文/日文等无空格语言不加边界,否则 \b 永不命中。
const boundedSource = (word: string): string => {
  const lb = /^[A-Za-z0-9_]/.test(word) ? "\\b" : "";
  const rb = /[A-Za-z0-9_]$/.test(word) ? "\\b" : "";
  return lb + escapeRe(word) + rb;
};
const escHtml = (s: string | number | null | undefined): string => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
// 从网页/富文本粘贴来的不换行空格会被 MarkdownRenderer 转成 &nbsp;，落进 TeX 后触发 MathJax 的 Misplaced &。
// 只规范传给渲染器的副本，不改用户笔记原文。
const renderLexisMarkdown = (app: obsidian.App, md: string, el: HTMLElement, sourcePath: string, comp: Component): Promise<void> => {
  const clean = String(md == null ? "" : md).replace(/\u00a0/g, " ");
  return MarkdownRenderer.render(app, clean, el, sourcePath, comp);
};
const round2 = (x: number): number => Math.round(x * 100) / 100;
function cssColorToHex(c: string): string {
  if (!c) return "#888888";
  if (/^#[0-9a-fA-F]{6}$/.test(c.trim())) return c.trim();
  const tmp = activeDocument.body.createDiv();
  tmp.setCssStyles({ color: c });
  const rgb = tmp.win.getComputedStyle(tmp).color; tmp.remove();
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return "#888888";
  return "#" + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, "0")).join("");
}
function fmtDate(d: Date): string { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function todayStr() { return fmtDate(new Date()); }
function parseDate(s: string): Date { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function addDaysStr(baseStr: string, days: number): string { const d = baseStr ? parseDate(baseStr) : new Date(); d.setDate(d.getDate() + days); return fmtDate(d); }
function daysBetween(aStr: string, bStr: string): number { return Math.max(0, Math.round((parseDate(bStr).getTime() - parseDate(aStr).getTime()) / 86400000)); }

// ---------- FSRS ----------
const FSRS_W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const FSRS_DECAY = -0.5;
const FSRS_FACTOR = Math.pow(0.9, 1 / FSRS_DECAY) - 1;
const MAX_IVL = 36500;
const FSRS = {
  clampD: (d: number) => Math.min(10, Math.max(1, d)),
  initStability: (g: number) => Math.max(0.1, FSRS_W[g - 1]),
  initDifficulty: (g: number) => FSRS.clampD(FSRS_W[4] - Math.exp(FSRS_W[5] * (g - 1)) + 1),
  linearDamping: (delta: number, d: number) => (delta * (10 - d)) / 9,
  meanReversion: (init: number, cur: number) => FSRS_W[7] * init + (1 - FSRS_W[7]) * cur,
  nextDifficulty(d: number, g: number) { const delta = -FSRS_W[6] * (g - 3); const dd = d + FSRS.linearDamping(delta, d); return FSRS.clampD(FSRS.meanReversion(FSRS.initDifficulty(4), dd)); },
  retrievability(t: number, s: number) { return Math.pow(1 + FSRS_FACTOR * t / s, FSRS_DECAY); },
  nextRecallStability(d: number, s: number, r: number, g: number) { const hard = g === 2 ? FSRS_W[15] : 1; const easy = g === 4 ? FSRS_W[16] : 1; return s * (1 + Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9]) * (Math.exp((1 - r) * FSRS_W[10]) - 1) * hard * easy); },
  nextForgetStability(d: number, s: number, r: number) { return FSRS_W[11] * Math.pow(d, -FSRS_W[12]) * (Math.pow(s + 1, FSRS_W[13]) - 1) * Math.exp((1 - r) * FSRS_W[14]); },
  nextInterval(s: number, retention: number) { const ivl = (s / FSRS_FACTOR) * (Math.pow(retention, 1 / FSRS_DECAY) - 1); return Math.min(MAX_IVL, Math.max(1, Math.round(ivl))); },
};

const LexisReviewView = createReviewView({
  reviewViewType: LEXIS_REVIEW_VIEW,
  todayStr,
  renderLexisMarkdown,
});

const LexisBridge = createBridgeServer({ Notice, Platform });

type TranslationVars = Record<string, string | number | boolean | null | undefined>;
type ReviewCard = { s?: number | null; d?: number | null; due?: string | null; last?: string | null; reps?: number | null; lapses?: number | null; history?: ReviewHistoryEvent[] };
type Schedule = { s: number; d: number; due: string; reps: number; lapses: number; interval: number };
type Lifecycle = { archived: boolean; retired: boolean; pinned: boolean };
type Relation = { path: string; basename: string };
type RelationBag = Record<string, Relation[]>;
type ReviewOptions = { folder?: string; tag?: string; order?: "due" | "frequency" | "random" };
type ReviewItem = { file: TFile; card: ReviewCard };
type Encounter = { hoverCount: number; encounterCount: number; lastEncounter: string };
type RetireCandidate = { file: TFile; display: string; created: string; lastEncounter: string; encounterCount: number; hoverCount: number; occCount: number; sinceLast: number };
type BridgeRuntime = { running: boolean; generateToken(): string; start(): void; stop(): void; restart(): void };
type AddSelectionOptions = { openExisting?: boolean };
type HighlightPage = { leaf: obsidian.WorkspaceLeaf; container: HTMLElement; key: string };
type MenuItemWithSubmenu = obsidian.MenuItem & { setSubmenu(): obsidian.Menu };

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

class LexisPlugin extends Plugin {
  declare settings: LexisSettings;
  declare index: Map<string, LexisEntry>;
  declare stats: LexisStats;
  declare inlineCategoryOccurrences: InlineCategoryOccurrence[];
  declare inlineCategories: { name: string; count: number }[];
  declare vocabPaths: Set<string>;
  declare inlineSourcePaths: Set<string>;
  declare i18n: ReturnType<typeof createI18n>;
  declare templateProvider: ReturnType<typeof createTemplateProvider>;
  declare occurrenceSearch: OccurrenceSearch;
  declare bridge: BridgeRuntime | null;
  declare liveAvailable: boolean;
  declare statusBarEl: HTMLElement | null;
  declare _pattern: string | null;
  declare _rebuildTimer: number | null;
  declare _popover: HTMLElement | null;
  declare _popoverComp: Component | null;
  declare _hideTimer: number | null;
  declare _showTimer: number | null;
  declare _showTarget: HTMLElement | null;
  declare _occCache: Map<string, Occurrence[]>;
  declare _encounters: Record<string, Encounter>;
  declare _encSaveTimer: number;
  declare _encounterDedup: Record<string, number>;
  declare _passiveSeenToday: Set<string>;
  declare _pageHighlightState: WeakMap<obsidian.WorkspaceLeaf, { key: string; hidden: boolean }>;
  declare _reviewSessions: WeakMap<object, unknown>;
  declare highlightElement: (el: HTMLElement, ctx: obsidian.MarkdownPostProcessorContext) => void;
  declare renderLexisBlock: (el: HTMLElement, ctx: obsidian.MarkdownPostProcessorContext, src: string) => Promise<void>;
  declare renderHeatmap: (el: HTMLElement) => void;
  declare renderHomeBlock: (el: HTMLElement) => void;
  declare setupLiveExtension: () => void;
  declare setupPdfHighlight: () => void;
  declare setupEpubIframeHighlight: () => void;
  declare teardownPdfHighlight: () => void;
  declare teardownEpubIframeHighlight: () => void;
  declare onMouseOver: (event: MouseEvent) => void;
  declare onMouseOut: (event: MouseEvent) => void;
  declare onClick: (event: MouseEvent) => void;
  declare maybeShowSelPill: (event: MouseEvent) => void;
  declare removePopover: () => void;
  declare removeSelPill: () => void;
  declare currentHighlightPage: () => HighlightPage | null;
  declare toggleCurrentPageHighlights: (page: HighlightPage) => void;
  declare syncActivePageHighlightState: (leaf?: obsidian.WorkspaceLeaf | null) => void;
  declare maybeRebuild: (file: TFile | null, oldPath?: string) => void;
  declare scheduleRebuild: () => void;
  declare isInlineSourceFile: (file: TFile | null | undefined) => boolean;
  declare rebuildIndex: (notify: boolean) => Promise<LexisStats>;
  declare renderNoteInto: (el: HTMLElement, file: TFile, component: Component) => Promise<void>;
  declare insertOccurrence: (data: string, vars: Record<string, unknown>) => string;
  declare normalizeFolder: (folder: string) => string;
  declare inVocabFolder: (path: string) => boolean;
  declare getTags: (file: TFile) => Set<string>;
  declare dictColorForFile: (file: TFile | null | undefined) => string | null;
  declare inlineCategoryColor: (entry: LexisEntry) => string;
  declare occurrenceHeadingText: () => string;
  declare occurrenceSentenceFromSection: (section: string) => string;
  declare renderTemplate: (template: string, vars: Record<string, unknown>) => string;
  declare inlineDelimiter: () => string;
  declare openInlineEntry: (entry: LexisEntry, newTab: boolean) => Promise<void>;
  declare applyPopoverAppearance: (popover: HTMLElement) => void;
  declare updateStatusBar: () => void;
  declare bridgeWordList: () => unknown;
  declare bridgeWordDetail: (key: string | null) => Promise<unknown>;
  declare bridgeDeleteWord: (key: string) => Promise<unknown>;
  declare bridgeAddWord: (payload: Record<string, unknown>) => Promise<unknown>;
  declare bridgeTagWord: (payload: Record<string, unknown>) => Promise<unknown>;
  declare bridgeAnnotate: (payload: Record<string, unknown>) => Promise<unknown>;
  declare bridgeMoveWord: (payload: Record<string, unknown>) => Promise<unknown>;
  declare bridgeEncounter: (payload: Record<string, unknown>) => Promise<unknown>;

  async onload() {
    try {
    await this.loadSettings();
    this.i18n = createI18n(() => this.settings.language);
    this.templateProvider = createTemplateProvider({
      app: this.app,
      TFile,
      getSettings: () => this.settings,
      normalizeFolder: (folder) => this.normalizeFolder(folder),
      readTemplatePath: (path) => this.readTemplatePath(path),
    });
    this.applyReviewMetadataVisibility();

    this.index = new Map();
    this.vocabPaths = new Set();
    this.stats = { words: 0, aliases: 0, inlineEntries: 0, due: 0 };
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
      loadPdfJs: () => (obsidian as typeof obsidian & { loadPdfJs(): Promise<PdfJsRuntime> }).loadPdfJs(),
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
      this.statusBarEl.setCssStyles({ cursor: "pointer" });
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
        void this.setArchived(file, true).then(() => new Notice(this.t("notice.archived", { word: file.basename })));
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
        void this.setPinned(file, !pinned).then(() => new Notice(this.t(!pinned ? "notice.pinned" : "notice.unpinned", { word: file.basename })));
        return true;
      },
    });
    this.addCommand({
      id: "migrate-familiar-tag-to-archived",
      name: this.t("command.migrate"),
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path) && this.getTags(f).has("熟悉") && !this.readLifecycle(f).archived && !this.readLifecycle(f).retired);
        if (!files.length) { new Notice(this.t("notice.noFamiliar")); return; }
        for (const f of files) await this.app.fileManager.processFrontMatter(f, (fm: Record<string, unknown>) => { fm["lexis-status"] = "archived"; });
        await this.rebuildIndex(false);
        new Notice(this.t("notice.migrated", { count: files.length }));
      },
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof TFile) || !this.inVocabFolder(file.path)) return;
      const { archived, pinned } = this.readLifecycle(file);
      menu.addItem((it) => it.setTitle(this.t(archived ? "menu.restore" : "menu.archive")).setIcon(archived ? "archive-restore" : "archive").onClick(() => {
        if (archived) new LexisRestoreModal(this.app, this, file).open();
        else void this.setArchived(file, true).then(() => new Notice(this.t("notice.archived", { word: file.basename })));
      }));
      menu.addItem((it) => it.setTitle(this.t(pinned ? "menu.unpin" : "menu.pin")).setIcon(pinned ? "pin-off" : "pin").onClick(() => {
        void this.setPinned(file, !pinned).then(() => new Notice(this.t(!pinned ? "notice.pinned" : "notice.unpinned", { word: file.basename })));
      }));
    }));

    this.registerView(LEXIS_REVIEW_VIEW, (leaf) => new LexisReviewView(leaf, this as unknown as ConstructorParameters<typeof LexisReviewView>[1]));
    this.registerView(LEXIS_HOME_VIEW, (leaf) => new LexisHomeView(leaf, this));

    this.addSettingTab(new LexisSettingTab(this.app, this as unknown as ConstructorParameters<typeof LexisSettingTab>[1]));

    this.registerMarkdownPostProcessor((el, ctx) => this.highlightElement(el, ctx));
    this.registerMarkdownCodeBlockProcessor("lexis", (src, el, ctx) => this.renderLexisBlock(el, ctx, src));
    this.registerMarkdownCodeBlockProcessor("lexis-heatmap", (src, el) => this.renderHeatmap(el));
    this.registerMarkdownCodeBlockProcessor("lexis-home", (src, el) => this.renderHomeBlock(el));
    this.setupLiveExtension();
    this.setupPdfHighlight();
    this.setupEpubIframeHighlight();

    this.registerDomEvent(activeDocument, "mouseover", (e) => this.onMouseOver(e));
    this.registerDomEvent(activeDocument, "mouseout", (e) => this.onMouseOut(e));
    this.registerDomEvent(activeDocument, "click", (e) => this.onClick(e));
    this.registerDomEvent(window, "scroll", (e) => {
      const target = e.target as Node | null;
      if (this._popover && target?.instanceOf?.(Node) && this._popover.contains(target)) return;
      this.removePopover(); this.removeSelPill();
    }, { capture: true });
    // 划词添加:松开鼠标后,若选区在笔记里则冒出"+ 加入词库"药丸
    this.registerDomEvent(activeDocument, "mouseup", (e) => this.maybeShowSelPill(e));
    this.registerDomEvent(activeDocument, "keydown", (e) => { if (e.key === "Escape") this.removeSelPill(); });

    this.app.workspace.onLayoutReady(() => { void this.rebuildIndex(false); this.syncActivePageHighlightState(); });
    this.registerEvent(this.app.vault.on("create", (f) => { if (f instanceof TFile) this.maybeRebuild(f); }));
    this.registerEvent(this.app.vault.on("delete", (f) => { if (f instanceof TFile) this.maybeRebuild(f); }));
    this.registerEvent(this.app.vault.on("rename", (f, old) => { if (f instanceof TFile) this.maybeRebuild(f, old); }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      this._occCache.clear();
      if (file instanceof TFile && file.extension === "pdf") this.occurrenceSearch.invalidatePdf(file.path);
      if ((file instanceof TFile && this.isInlineSourceFile(file)) || this.inlineSourcePaths?.has(file.path)) this.scheduleRebuild();
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
        menu.addItem((item) => {
          item.setTitle(this.t("menu.add", { word: label })).setIcon("book-plus");
          const submenu = (item as MenuItemWithSubmenu).setSubmenu();
          for (const folder of dicts) {
            submenu.addItem((choice) => choice
              .setTitle(folder)
              .setIcon("folder")
              .onClick(() => this.addWordFromSelection(sel, editor, view, folder)));
          }
        });
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
      console.error("[Lexis] onload 失败:", err);
      new Notice(this.t("notice.loadFailed", { error: errorMessage(err) }));
    }
  }

  onunload() {
    window.clearTimeout(this._rebuildTimer);
    window.clearTimeout(this._hideTimer);
    window.clearTimeout(this._showTimer);
    if (this._encSaveTimer) { window.clearTimeout(this._encSaveTimer); void this.saveEncounters(); }
    this.removePopover();
    this.removeSelPill();
    this.teardownPdfHighlight();
    this.teardownEpubIframeHighlight();
    this.bridge?.stop();
    activeDocument.body?.classList.remove("lexis-show-review-metadata");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as LexisSettings;
    if ((!this.settings.tagRules || !this.settings.tagRules.length) && this.settings.tagRulesText) {
      this.settings.tagRules = this.parseTagRulesText(this.settings.tagRulesText);
      delete this.settings.tagRulesText;
      await this.saveData(this.settings);
    }
    if (!Array.isArray(this.settings.tagRules)) this.settings.tagRules = [];
    if (!this.settings.inlineCategoryColors || typeof this.settings.inlineCategoryColors !== "object" || Array.isArray(this.settings.inlineCategoryColors)) this.settings.inlineCategoryColors = {};
    if (!this.settings.inlineCategoryOpacity || typeof this.settings.inlineCategoryOpacity !== "object" || Array.isArray(this.settings.inlineCategoryOpacity)) this.settings.inlineCategoryOpacity = {};
    if (!this.settings.inlineCategoryHighlight || typeof this.settings.inlineCategoryHighlight !== "object" || Array.isArray(this.settings.inlineCategoryHighlight)) this.settings.inlineCategoryHighlight = {};
    if (!["heading", "file"].includes(this.settings.inlineClassificationMode)) this.settings.inlineClassificationMode = "heading";
    if (!this.settings.inlineFileColors || typeof this.settings.inlineFileColors !== "object" || Array.isArray(this.settings.inlineFileColors)) this.settings.inlineFileColors = {};
    if (!this.settings.inlineFileOpacity || typeof this.settings.inlineFileOpacity !== "object" || Array.isArray(this.settings.inlineFileOpacity)) this.settings.inlineFileOpacity = {};
    if (!this.settings.inlineFileHighlight || typeof this.settings.inlineFileHighlight !== "object" || Array.isArray(this.settings.inlineFileHighlight)) this.settings.inlineFileHighlight = {};
    if (!this.settings.inlineSourceHighlight || typeof this.settings.inlineSourceHighlight !== "object" || Array.isArray(this.settings.inlineSourceHighlight)) this.settings.inlineSourceHighlight = {};
    if (!this.settings.inlineCollapsedGroups || typeof this.settings.inlineCollapsedGroups !== "object" || Array.isArray(this.settings.inlineCollapsedGroups)) this.settings.inlineCollapsedGroups = {};
    if (!Array.isArray(this.settings.inlineCategoryOrder)) this.settings.inlineCategoryOrder = [];
    if (!Array.isArray(this.settings.inlineFileOrder)) this.settings.inlineFileOrder = [];
    if (!this.settings.inlineCategoryOrderByParent || typeof this.settings.inlineCategoryOrderByParent !== "object" || Array.isArray(this.settings.inlineCategoryOrderByParent)) this.settings.inlineCategoryOrderByParent = {};
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

  t(key: string, vars?: TranslationVars): string { return this.i18n ? this.i18n.t(key, vars) : key; }
  async saveSettings() { await this.saveData(this.settings); }
  applyReviewMetadataVisibility() {
    activeDocument.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata);
  }
  parseTagRulesText(text: string): TagRule[] {
    const rules: TagRule[] = [];
    for (const line of (text || "").split("\n")) {
      const m = /^\s*#?([^:：]+)[:：]\s*(\S+)(?:\s+(wavy|underline|background))?\s*$/.exec(line);
      if (m) rules.push({ tag: m[1].trim(), color: m[2].trim(), style: (m[3] || "") as HighlightStyle | "" });
    }
    return rules;
  }

  // ---------- 出处 & 相关词 ----------
  parseFolders(text: string): string[] { return (text || "").split(/[,，\n]/).map((s) => this.normalizeFolder(s)).filter(Boolean); }
  parseTags(text: string): string[] { return (text || "").split(/[,，;；\s]+/).map((s) => s.trim().replace(/^#/, "").toLowerCase()).filter(Boolean); }
  vocabTagSet() { return new Set(this.parseTags(this.settings.vocabTags)); }
  excludeTagSet() { return new Set(this.parseTags(this.settings.excludeTags)); }
  // 词典表的文件夹列表 = 文件夹来源的单一真相
  dictFolders() { return (this.settings.dicts || []).map((d) => this.normalizeFolder(d && d.folder)).filter(Boolean); }
  // 一条词的最终高亮色(优先级:标签规则 > 词典色 > 全局兜底),返回解析后的真实 hex —— 网页和 ob 同一套优先级
  colorForEntry(e: LexisEntry): string {
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
  styleKindForEntry(e: LexisEntry): HighlightStyle {
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
    try { return cssColorToHex(activeDocument.defaultView?.getComputedStyle(activeDocument.body).getPropertyValue("--text-accent") || ""); }
    catch { return "#7c5cff"; }
  }
  // { 规范化文件夹: 颜色 },只含设了专属色的词典;供网页按所属词典着色
  dictColorMap(): Record<string, string> {
    const m: Record<string, string> = {};
    for (const d of this.settings.dicts || []) {
      const f = this.normalizeFolder(d && d.folder);
      const c = (d && d.color || "").trim();
      if (f && c) m[f] = c;
    }
    return m;
  }
  primaryVocabFolder() { return this.dictFolders()[0] || ""; } // 新建单词时落地的文件夹(取第一个)
  inFolderScope(path: string): boolean { const fs = this.dictFolders(); return fs.length ? this.inScope(path, fs) : false; }
  // 某文件夹对应的模板:命中某词典行 → 完全按它的 template(留空=空白笔记,不再回退全局);
  // 没有对应词典行(极少见)→ 才用全局默认 newWordTemplate。这样"没给这个词典选模板"= 空白,符合直觉。
  templateForFolder(folder: string): Promise<string | null> {
    return this.templateProvider.readLexis(folder);
  }
  isVocabFile(file: TFile | null | undefined): boolean {
    if (!file || !file.path) return false;
    if (this.inFolderScope(file.path)) return true;
    const ts = this.vocabTagSet();
    if (ts.size) { for (const t of this.getTags(file)) if (ts.has(t)) return true; }
    return false;
  }
  inScope(path: string, scope: string[]): boolean { if (!scope.length) return true; return scope.some((f) => path === f || path.startsWith(f + "/")); }
  extractSentence(content: string, idx: number): string {
    const bound = /[.!?。！？\n]/;
    let s = idx; while (s > 0 && !bound.test(content[s - 1])) s--;
    let e = idx; while (e < content.length && !bound.test(content[e])) e++;
    let sent = content.slice(s, e + 1).replace(/\s+/g, " ").trim();
    if (sent.length > 220) sent = sent.slice(0, 220) + "…";
    return sent;
  }
  async findOccurrences(word: string): Promise<Occurrence[]> {
    const key = word.toLowerCase();
    if (this._occCache.has(key)) return this._occCache.get(key);
    const limit = this.settings.occurrenceLimit || 6;
    const scope = this.parseFolders(this.settings.occurrenceFolders);
    const results = await this.occurrenceSearch.find(word, { limit, scope, includePdf: this.settings.includePdfOccurrences !== false });
    this._occCache.set(key, results);
    return results;
  }
  findRelated(file: TFile): TFile[] {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const set = new Set<string>();
    for (const src in resolved) { if (resolved[src][file.path] && this.inVocabFolder(src) && src !== file.path) set.add(src); }
    const out = resolved[file.path] || {};
    for (const dest in out) { if (this.inVocabFolder(dest) && dest !== file.path) set.add(dest); }
    return [...set].map((p) => this.app.vault.getAbstractFileByPath(p)).filter((file): file is TFile => file instanceof TFile);
  }
  parseSectionLinks(raw: string, known: string[]): { type: string; target: string }[] {
    const clean = raw.replace(/```[\s\S]*?```/g, "").replace(/^---\n[\s\S]*?\n---/, "");
    const out: { type: string; target: string }[] = [];
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
  async findTypedRelations(file: TFile): Promise<{ out: RelationBag; inc: RelationBag }> {
    const KNOWN = ["近义词", "同根词", "形近词", "辨析"];
    const out: Record<string, Map<string, string>> = {}, inc: Record<string, Map<string, string>> = {};
    const put = (bag: Record<string, Map<string, string>>, type: string, tf: TFile | null) => { if (!tf || tf.path === file.path) return; (bag[type] = bag[type] || new Map<string, string>()).set(tf.path, tf.basename); };
    // 出链:本词笔记里每个 [[link]] 在哪个段下
    try {
      const raw = await this.app.vault.cachedRead(file);
      for (const { type, target } of this.parseSectionLinks(raw, KNOWN)) {
        const tf = this.app.metadataCache.getFirstLinkpathDest(target, file.path);
        if (tf && this.inVocabFolder(tf.path)) put(out, type, tf);
      }
    } catch { /* A relation panel can render from the remaining links. */ }
    // 入链:其它词在哪个段下链了本词(实现双向)
    const resolved = this.app.metadataCache.resolvedLinks || {};
    for (const src in resolved) {
      if (!this.inVocabFolder(src) || src === file.path || !resolved[src][file.path]) continue;
      const srcFile = this.app.vault.getAbstractFileByPath(src);
      if (!(srcFile instanceof TFile)) continue;
      try {
        const raw = await this.app.vault.cachedRead(srcFile);
        let matched = false;
        for (const { type, target } of this.parseSectionLinks(raw, KNOWN)) {
          const tf = this.app.metadataCache.getFirstLinkpathDest(target, src);
          if (tf && tf.path === file.path) { put(inc, type, srcFile); matched = true; }
        }
        if (!matched) put(inc, "相关", srcFile);
      } catch { /* Skip unreadable related notes. */ }
    }
    const toArr = (bag: Record<string, Map<string, string>>): RelationBag => { const result: RelationBag = {}; for (const type in bag) result[type] = [...bag[type].entries()].map(([path, basename]) => ({ path, basename })); return result; };
    return { out: toArr(out), inc: toArr(inc) };
  }
  async renderDerivedWords(container: HTMLElement, file: TFile): Promise<void> {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const map = new Map<string, string>();
    for (const src in resolved) {
      if (this.inVocabFolder(src) && resolved[src] && resolved[src][file.path]) {
        const sf = this.app.vault.getAbstractFileByPath(src);
        if (sf instanceof TFile) map.set(src, sf.basename);
      }
    }
    if (!map.size) return;
    container.createDiv({ cls: "lexis-section-title", text: `🌱 派生词 (${map.size})` });
    const w = container.createDiv({ cls: "lexis-related" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
  }
  relLink(w: HTMLElement, path: string, basename: string): void {
    const a = w.createEl("a", { text: basename, href: "#" });
    a.addEventListener("click", (e) => { e.preventDefault(); const f = this.app.vault.getAbstractFileByPath(path); if (f instanceof TFile) { void this.app.workspace.getLeaf(false).openFile(f); this.removePopover(); } });
  }
  async renderTypedRelations(container: HTMLElement, file: TFile): Promise<number> {
    const { out, inc } = await this.findTypedRelations(file);
    const order = ["近义词", "同根词", "形近词", "辨析", "相关"];
    let n = 0;
    for (const t of order) {
      const map = new Map<string, string>();
      for (const r of (out[t] || [])) map.set(r.path, r.basename);
      for (const r of (inc[t] || [])) map.set(r.path, r.basename);
      if (!map.size) continue;
      container.createDiv({ cls: "lexis-section-title", text: "🔗 " + t });
      const w = container.createDiv({ cls: "lexis-related" });
      for (const [path, basename] of map) { this.relLink(w, path, basename); n++; }
    }
    return n;
  }
  async renderReverseRelations(container: HTMLElement, file: TFile, type: string): Promise<number> {
    const { out, inc } = await this.findTypedRelations(file);
    const types = type === "辨析" ? ["辨析", "相关"] : [type];
    const outPaths = new Set<string>();
    for (const t of types) for (const r of (out[t] || [])) outPaths.add(r.path);
    const map = new Map<string, string>();
    for (const t of types) for (const r of (inc[t] || [])) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
    if (!map.size) return 0;
    const w = container.createDiv({ cls: "lexis-related lexis-rel-reverse" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
    return map.size;
  }
  async getCuratedSourcePaths(wordFile: TFile): Promise<Set<string>> {
    try {
      const raw = await this.app.vault.cachedRead(wordFile);
      const names = [this.occurrenceHeadingText(), "例句", "出处"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return new Set();
      const set = new Set<string>();
      const re = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
      let mm;
      while ((mm = re.exec(m[1]))) {
        const base = mm[1].trim().split("/").pop().replace(/\.(?:md|pdf)$/i, "");
        set.add(base.toLowerCase());
      }
      return set;
    } catch { return new Set(); }
  }
  sourceLinkTarget(file: TFile | null | undefined): string { return file?.extension === "md" ? file.basename : file?.name || ""; }
  async addExampleToWord(wordFile: TFile, sentence: string, sourceFile?: TFile | null, page?: number): Promise<boolean> {
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
    const apply = (data: string) => this.insertOccurrence(data, occurrence);
    try {
      if (this.app.vault.process) await this.app.vault.process(wordFile, apply);
      else { const d = await this.app.vault.read(wordFile); await this.app.vault.modify(wordFile, apply(d)); }
      this.recordEncounter(wordFile, "add");
      new Notice(this.t("notice.occurrenceSaved"));
      return true;
    } catch (err) { new Notice(this.t("notice.occurrenceFailed", { error: errorMessage(err) })); return false; }
  }

  // ---------- 生命周期(归档/常驻/淘汰) ----------
  // 只叠加在算法结果之上:这里不碰 lexis-s/d/due 等 FSRS 内部字段,那些只由真实复习事件驱动(applySchedule)。
  readLifecycle(file: TFile): Lifecycle {
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
    const status = fm["lexis-status"];
    return { archived: status === "archived", retired: status === "retired", pinned: !!fm["lexis-pinned"] };
  }
  // 归档 = 退出高亮 + 暂停复习队列,悬停仍可查;取消归档("恢复")默认走这条,FSRS 进度原样保留。
  // 重置为新词是恢复时的另一个选项,见 LexisRestoreModal,不在这个函数里做。
  async setArchived(file: TFile, archived: boolean): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (archived) fm["lexis-status"] = "archived";
      else delete fm["lexis-status"];
    });
    await this.rebuildIndex(false);
  }
  async setPinned(file: TFile, pinned: boolean): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (pinned) fm["lexis-pinned"] = true;
      else delete fm["lexis-pinned"];
    });
    await this.rebuildIndex(false);
  }
  // 淘汰 = 归档而非删除:退出高亮与复习,文件保留,但比"归档"更彻底——悬停也不再触发(不像归档还留一个隐形代理 span)。
  // 只从"淘汰法庭"候选列表的操作按钮触发,没有独立的命令/右键菜单入口(候选判定本身已经是入口了)。
  async setRetired(file: TFile, retired: boolean): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (retired) fm["lexis-status"] = "retired";
      else delete fm["lexis-status"];
    });
    await this.rebuildIndex(false);
  }

  // ---------- 相遇记账(阶段 2) ----------
  // 只做"强相遇"记账:悬停查释义 / 划词加出处 / 打开词条笔记本身,都是现成代码路径上加一行记账,
  // 不额外采集停留时长/滚动/点击深度。数据存进插件自己 data 目录下的 sidecar JSON,不写 frontmatter——
  // 悬停很频繁,写 frontmatter 会不停刷新笔记 mtime 和 git 历史。
  encountersPath() { return `${this.app.vault.configDir}/plugins/${this.manifest.id}/encounters.json`; }
  async loadEncounters() {
    try {
      const parsed: unknown = JSON.parse(await this.app.vault.adapter.read(this.encountersPath()));
      this._encounters = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, Encounter> : {};
    } catch { this._encounters = {}; }
  }
  // key 用词条文件的标题(不是命中它的具体别名/拼法)——别名和标题指向同一个文件,相遇次数要合并,不能按 key 分裂计数
  // 短时间内反复触发同一类相遇(比如鼠标在同一个词上晃出晃入,连续弹好几次悬浮卡)只算一次,靠 (词+类型) 的冷却时间去重
  recordEncounter(file: TFile, type: "hover" | "add" | "passive" | "open"): void {
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
    this._encSaveTimer = window.setTimeout(() => { void this.saveEncounters(); }, 1500); // 内存攒批、防抖落盘,不是每次相遇都写一次盘
  }
  // 被动相遇(阶段 4):高亮装饰在打开的文件里实际渲染出来,就算词出现在你面前过一次——比悬停更弱的信号,
  // 只证明"出现过",不证明"注意到了"。按「词+当天」去重,不是每次重渲染(滚动/切标签页/实时预览重算)都记一次。
  // 这个检查要挂在高亮渲染的热路径上(每个匹配到的 span 都会过一遍),所以只用一次 Set.has,不做更重的事。
  passiveEncounter(file: TFile): void {
    if (!(file instanceof TFile)) return;
    const dayKey = file.path + "|" + todayStr();
    if (this._passiveSeenToday.has(dayKey)) return;
    this._passiveSeenToday.add(dayKey);
    this.recordEncounter(file, "passive");
  }
  async saveEncounters() {
    this._encSaveTimer = 0;
    try { await this.app.vault.adapter.write(this.encountersPath(), JSON.stringify(this._encounters)); } catch { /* Encounter persistence is best-effort. */ }
  }
  // 悬停 = 一次失败的提取(没想起来才要查)。这个词的到期日如果还很远,说明"排期偏晚了",拉近一点提醒尽快复习——
  // 只挪 lexis-due,绝不碰 stability/difficulty,也不伪造一次复习评分(FSRS 内部状态只能由真实复习事件驱动)。
  async hoverFeedback(file: TFile): Promise<void> {
    if (!this.settings.hoverFeedback || !(file instanceof TFile)) return;
    if (this.readLifecycle(file).archived) return; // 已归档:悬停只记账,不回流
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
    if (fm["lexis-s"] == null || !fm["lexis-due"]) return; // 还没背过/没有到期日可提前
    const today = todayStr();
    const rawDue = fm["lexis-due"];
    if (typeof rawDue !== "string" && typeof rawDue !== "number") return;
    const due = String(rawDue).slice(0, 10);
    const threshold = addDaysStr(today, this.settings.hoverFeedbackDays ?? 3);
    if (due <= threshold) return; // 本来就不算远,不用管
    await this.app.fileManager.processFrontMatter(file, (fm2: Record<string, unknown>) => { fm2["lexis-due"] = today; });
  }

  // ---------- FSRS 调度 ----------
  readCard(file: TFile): ReviewCard {
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
    return {
      s: typeof fm["lexis-s"] === "number" ? fm["lexis-s"] : null,
      d: typeof fm["lexis-d"] === "number" ? fm["lexis-d"] : null,
      due: typeof fm["lexis-due"] === "string" ? fm["lexis-due"] : null,
      last: typeof fm["lexis-last"] === "string" ? fm["lexis-last"] : null,
      reps: typeof fm["lexis-reps"] === "number" ? fm["lexis-reps"] : null,
      lapses: typeof fm["lexis-lapses"] === "number" ? fm["lexis-lapses"] : null,
      history: Array.isArray(this.settings.reviewHistory?.[file.path]) ? this.settings.reviewHistory[file.path] : [],
    };
  }
  cardRetrievability(card: ReviewCard, date = todayStr()): number {
    const s = Number(card?.s);
    if (!s || isNaN(s) || !card?.last) return 0;
    return FSRS.retrievability(Math.max(0, daysBetween(card.last, date)), s);
  }
  scheduleCard(card: ReviewCard, grade: number): Schedule {
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
  async applySchedule(file: TFile, sched: Schedule): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm["lexis-s"] = round2(sched.s);
      fm["lexis-d"] = round2(sched.d);
      fm["lexis-due"] = sched.due;
      fm["lexis-last"] = todayStr();
      fm["lexis-reps"] = sched.reps;
      fm["lexis-lapses"] = sched.lapses;
    });
  }
  async logReview(file: TFile, sched: Schedule, grade: number, retentionBefore: number): Promise<void> {
    const t = todayStr();
    this.settings.reviewLog[t] = (this.settings.reviewLog[t] || 0) + 1;
    if (file?.path) {
      const history = Array.isArray(this.settings.reviewHistory[file.path]) ? this.settings.reviewHistory[file.path] : [];
      history.push({ date: t, s: round2(sched.s), grade, retention: Math.round(Math.max(0, Math.min(1, retentionBefore)) * 100) });
      this.settings.reviewHistory[file.path] = history.slice(-64);
    }
    await this.saveSettings();
  }
  async undoReviewLog(file: TFile): Promise<void> {
    const t = todayStr();
    if (this.settings.reviewLog[t]) {
      this.settings.reviewLog[t]--;
      if (this.settings.reviewLog[t] <= 0) delete this.settings.reviewLog[t];
    }
    const history = file?.path && this.settings.reviewHistory[file.path];
    if (Array.isArray(history) && history.length) history.pop();
    await this.saveSettings();
  }
  async getFirstExample(file: TFile): Promise<string> {
    try {
      const raw = await this.app.vault.cachedRead(file);
      if (!this.occurrenceHeadingText()) return this.occurrenceSentenceFromSection(raw);
      const names = [this.occurrenceHeadingText(), "例句", "出处"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return "";
      return this.occurrenceSentenceFromSection(m[1]);
    } catch { return ""; }
  }
  buildCloze(sentence: string, word: string): string { return sentence.replace(new RegExp(boundedSource(word), "ig"), "______"); }
  humanInterval(days: number): string {
    if (days < 1) return this.t("interval.ltDay");
    if (days < 30) return this.t("interval.days", { count: days });
    if (days < 365) return this.t("interval.months", { count: Math.round(days / 30) });
    return this.t("interval.years", { count: (days / 365).toFixed(1) });
  }
  freqVal(file: TFile): number { const fm = this.app.metadataCache.getFileCache(file)?.frontmatter; const n = parseInt(String(fm && fm.frequency).replace(/[^0-9]/g, ""), 10); return isNaN(n) ? Infinity : n; }
  collectVocabTags(): string[] { const s = new Set<string>(); for (const f of this.app.vault.getMarkdownFiles()) { if (!this.inVocabFolder(f.path)) continue; for (const t of this.getTags(f)) s.add(t); } return [...s].sort(); }
  computeStats(): { due: number; fresh: number; total: number } {
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
  buildQueue(options: ReviewOptions = {}): ReviewItem[] {
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
  async buildRetireCandidates(): Promise<RetireCandidate[]> {
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
      try { occCount = (await this.findOccurrences(f.basename)).length; } catch { /* An unavailable source index counts as zero occurrences. */ }
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
  async openReview(options: ReviewOptions = {}): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_REVIEW_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf(true); await leaf.setViewState({ type: LEXIS_REVIEW_VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisReviewView) { leaf.view.options = options || {}; leaf.view.refresh(); }
  }
  saveReviewSession(leaf: obsidian.WorkspaceLeaf, state: unknown): void { if (leaf && state) this._reviewSessions.set(leaf, state); }
  takeReviewSession(leaf: obsidian.WorkspaceLeaf): unknown {
    if (!leaf) return null;
    const state = this._reviewSessions.get(leaf) || null;
    this._reviewSessions.delete(leaf);
    return state;
  }
  async openHome(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_HOME_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getRightLeaf(false); await leaf.setViewState({ type: LEXIS_HOME_VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisHomeView) leaf.view.render();
  }
  // ---------- 划词添加 ----------
  sanitizeName(name: string): string { return (name || "").replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim(); }
  async ensureFolder(folder: string): Promise<void> {
    if (!folder) return;
    if (!this.app.vault.getAbstractFileByPath(folder)) { try { await this.app.vault.createFolder(folder); } catch { /* Another write may have created the folder first. */ } }
  }
  async readTemplatePath(p: string): Promise<string | null> {
    p = (p || "").trim();
    if (!p) return null;
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f instanceof TFile) { try { return await this.app.vault.read(f); } catch { return null; } }
    return null;
  }
  createEntryFile(path: string, folder: string, fallbackContent: string, transform: (content: string) => string): Promise<TFile> {
    return this.templateProvider.create({ path, folder, fallbackContent, transform });
  }
  // 无模板可选纯空白，或只放一个内置的出处面板；用户自己的模板始终优先。
  minimalSkeleton() { return this.settings.emptyNotePreset === "occ" ? "```lexis\nocc\n```\n" : ""; }
  getSelectionSentence(editor: obsidian.Editor | null): string {
    if (!editor) return "";
    try { const from = editor.getCursor("from"); const line = editor.getLine(from.line) || ""; return this.extractSentence(line, from.ch || 0); } catch { return ""; }
  }
  getReadingSentence(): string {
    try { const sel = window.getSelection(); if (!sel || !sel.anchorNode) return ""; const text = sel.anchorNode.textContent || ""; return this.extractSentence(text, sel.anchorOffset || 0); } catch { return ""; }
  }
  // 当前选区所在 PDF 页码(pdf.js 在 .page 上挂 data-page-number);取不到返回 0
  currentPdfPage(): number {
    try {
      const sel = window.getSelection();
      const n = sel && sel.anchorNode;
      const el = n?.nodeType === Node.ELEMENT_NODE ? n as Element : n?.parentElement;
      const page = el?.closest("[data-page-number]");
      const v = page && page.getAttribute("data-page-number");
      return v ? parseInt(v, 10) || 0 : 0;
    } catch { return 0; }
  }
  addSelectedWordCommand(): void {
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    let word = "", editor = null;
    if (view && view.editor && view.getMode && view.getMode() === "source") { word = (view.editor.getSelection() || "").trim(); editor = view.editor; }
    if (!word) { const sel = window.getSelection(); word = (sel ? sel.toString() : "").trim(); }
    if (!word) { new Notice(this.t("notice.selectWord")); return; }
    void this.addWordFromSelection(word, editor, view);
  }
  async addWordFromSelection(word: string, editor: obsidian.Editor | null = null, view: obsidian.MarkdownFileInfo | obsidian.MarkdownView | null = null, targetFolder = "", { openExisting = false }: AddSelectionOptions = {}): Promise<void> {
    const clean = (word || "").trim();
    const fileName = this.sanitizeName(clean);
    if (!fileName) { new Notice(this.t("notice.invalidWord")); return; }
    const reqFolder = this.normalizeFolder(targetFolder || "");
    const folder = (reqFolder && this.dictFolders().includes(reqFolder)) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + fileName + ".md";
    const target = this.app.vault.getAbstractFileByPath(targetPath);
    let existing: TFile | null = target instanceof TFile ? target : null;
    // 路径不同名也可能已经是某词条的标题或别名(比如刚被"设为别名"并入了别的文件)——按索引兜底查,别重复建
    if (!existing) {
      const hit = this.index.get(clean.toLowerCase());
      if (hit && hit.file instanceof TFile) existing = hit.file;
    }
    const srcFile = (view && view.file) || this.app.workspace.getActiveFile();
    const sentence = editor ? this.getSelectionSentence(editor) : this.getReadingSentence();
    // 从 PDF 划词加词时,新词笔记开到新标签页,免得把正在读的 PDF 顶掉
    const fromPdf = srcFile && srcFile.extension === "pdf" && !editor;
    if (existing) {
      new Notice(this.t(openExisting ? "notice.exists" : "notice.existsNoOpen", { word: existing.basename }));
      if (openExisting) void this.app.workspace.getLeaf(fromPdf ? "tab" : false).openFile(existing);
      return;
    }
    try {
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      const content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word: clean, date: todayStr() });
      const addOccurrence = (templateContent: string) => {
        let next = templateContent;
        // 出处写进正文(而不是 frontmatter 属性),好看且笔记里直接可见
        if (!(sentence || srcFile)) return next;
        // PDF 出处带上页码,链接可直接跳到那一页
        let sub = "", disp = srcFile ? srcFile.basename : "";
        if (fromPdf) {
          const pg = this.currentPdfPage();
          if (pg) { sub = `#page=${pg}`; disp = `${srcFile.basename} p.${pg}`; }
        }
        const sourceTarget = this.sourceLinkTarget(srcFile);
        const source = srcFile ? (sub ? `[[${sourceTarget}${sub}|${disp}]]` : `[[${sourceTarget}]]`) : "";
        next = this.insertOccurrence(next, { word: clean, sentence: sentence || "", source, date: todayStr() });
        return next;
      };
      const file = await this.createEntryFile(targetPath, folder, content, addOccurrence);
      this.recordEncounter(file, "add");
      // 划词添加只写入并留在原文；"添加"不再暗含一次页面跳转。
      new Notice(this.t(fromPdf ? "notice.addedPdf" : "notice.created", { word: fileName }));
      await this.rebuildIndex(false);
    } catch (err) { new Notice(this.t("notice.createFailed", { error: errorMessage(err) })); }
  }
};

// ---------- 别名选择器:给"设为别名"选目标词条(标题或别名都可搜到) ----------
class LexisAliasPicker extends obsidian.FuzzySuggestModal<LexisEntry> {
  declare plugin: LexisPlugin;
  declare aliasText: string;
  declare onPick: (entry: LexisEntry) => void;
  constructor(app: obsidian.App, plugin: LexisPlugin, aliasText: string, onPick: (entry: LexisEntry) => void) {
    super(app);
    this.plugin = plugin;
    this.aliasText = aliasText;
    this.onPick = onPick;
    if (this.setPlaceholder) this.setPlaceholder(this.plugin.t("selection.aliasPrompt", { alias: aliasText }));
  }
  getItems() {
    const seen = new Set<string>(), out: LexisEntry[] = [];
    for (const e of this.plugin.index.values()) {
      if (!e || !e.file) continue;
      const k = e.file.path + "|" + (e.display || "");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out;
  }
  getItemText(e: LexisEntry): string { return e.isAlias ? this.plugin.t("selection.aliasItem", { alias: e.display, word: e.file.basename }) : e.display; }
  onChooseItem(e: LexisEntry): void { if (e.file) this.onPick(e); }
}

// ---------- 恢复:归档词要不要保留 FSRS 进度,二选一 ----------
class LexisRestoreModal extends Modal {
  declare plugin: LexisPlugin;
  declare file: TFile;
  constructor(app: obsidian.App, plugin: LexisPlugin, file: TFile) {
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
    keepBtn.addEventListener("click", () => { void (async () => {
      await this.plugin.setArchived(this.file, false);
      new Notice(this.plugin.t("restore.kept", { word: this.file.basename }));
      this.close();
    })(); });
    const resetBtn = row.createEl("button", { text: this.plugin.t("restore.reset") });
    resetBtn.addEventListener("click", () => { void (async () => {
      await this.app.fileManager.processFrontMatter(this.file, (fm: Record<string, unknown>) => {
        delete fm["lexis-status"];
        delete fm["lexis-s"]; delete fm["lexis-d"]; delete fm["lexis-due"];
        delete fm["lexis-last"]; delete fm["lexis-reps"]; delete fm["lexis-lapses"];
      });
      delete this.plugin.settings.reviewHistory[this.file.path];
      await this.plugin.saveSettings();
      await this.plugin.rebuildIndex(false);
      new Notice(this.plugin.t("restore.resetDone", { word: this.file.basename }));
      this.close();
    })(); });
  }
  onClose() { this.contentEl.empty(); }
}

// ---------- Lexis 主页 ----------
class LexisHomeView extends ItemView {
  declare plugin: LexisPlugin;
  declare _retireRenderTimer: number | undefined;
  constructor(leaf: obsidian.WorkspaceLeaf, plugin: LexisPlugin) { super(leaf); this.plugin = plugin; }
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
    let selFolder = "", selOrder: "due" | "frequency" | "random" = "due";
    new Setting(c).setName(this.plugin.t("home.reviewFolder")).addDropdown((dd) => { dd.addOption("", this.plugin.t("common.all")); for (const folder of folders) dd.addOption(folder, folder); dd.setValue(selFolder); dd.onChange((v) => { selFolder = v; }); });
    new Setting(c).setName(this.plugin.t("home.order")).addDropdown((dd) => { dd.addOption("due", this.plugin.t("home.dueFirst")).addOption("frequency", this.plugin.t("home.frequency")).addOption("random", this.plugin.t("home.random")).setValue(selOrder); dd.onChange((v) => { if (v === "due" || v === "frequency" || v === "random") selOrder = v; }); });
    new Setting(c).addButton((b) => b.setButtonText(`▶ ${this.plugin.t("home.start")}`).setCta().onClick(() => this.plugin.openReview({ folder: selFolder, order: selOrder })))
      .addExtraButton((b) => b.setIcon("refresh-cw").setTooltip(this.plugin.t("common.refresh")).onClick(() => this.render()));

    void this.renderRetireCandidates(c);
  }
  // 淘汰法庭:硬条件筛出来的候选,证据摆出来,判决权在用户——平时不主动打扰,只有打开主页才会看到。
  async renderRetireCandidates(c: HTMLElement): Promise<void> {
    const days = this.plugin.settings.retireCandidateDays ?? 90;
    const wrap = c.createDiv({ cls: "lexis-retire-wrap" });
    wrap.createEl("h4", { text: `🗑️ ${this.plugin.t("home.retire")}` });
    // 阈值直接在主页调,不用跑去设置页;拖动时防抖,别每挪一格就重算一遍(候选计算要挨个查出处数,不便宜)
    new Setting(wrap).setName(this.plugin.t("home.retireThreshold")).setDesc(this.plugin.t("home.retireThresholdDesc"))
      .addSlider((s) => s.setLimits(14, 365, 1).setValue(days).onChange((v) => {
        this.plugin.settings.retireCandidateDays = v;
        void this.plugin.saveSettings();
        if (this._retireRenderTimer) window.clearTimeout(this._retireRenderTimer);
        this._retireRenderTimer = window.setTimeout(() => this.render(), 400);
      }));
    const listWrap = wrap.createDiv();
    listWrap.setText(this.plugin.t("home.calculating"));
    let candidates: RetireCandidate[];
    try { candidates = await this.plugin.buildRetireCandidates(); } catch { candidates = []; }
    if (!listWrap.isConnected) return; // 算的过程中视图已经关掉/刷新了,別再画
    listWrap.empty();
    if (!candidates.length) { listWrap.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noCandidates") }); return; }
    const selected = new Set<string>();
    const rowByPath = new Map<string, HTMLElement>();
    const removeRows = (paths: string[]) => { for (const p of paths) { const row = rowByPath.get(p); if (row) row.remove(); rowByPath.delete(p); selected.delete(p); } };
    for (const cand of candidates) {
      const row = listWrap.createDiv({ cls: "lexis-retire-row" });
      rowByPath.set(cand.file.path, row);
      const cb = row.createEl("input", { type: "checkbox", cls: "lexis-retire-cb" });
      cb.addEventListener("change", () => { if (cb.checked) selected.add(cand.file.path); else selected.delete(cand.file.path); });
      const info = row.createDiv({ cls: "lexis-retire-info" });
      const nameEl = info.createEl("a", { text: cand.display, href: "#", cls: "lexis-retire-name" });
      nameEl.addEventListener("click", (e) => { e.preventDefault(); void this.plugin.app.workspace.getLeaf(false).openFile(cand.file); });
      info.createDiv({ cls: "lexis-retire-meta", text: this.plugin.t("home.candidateMeta", { created: cand.created, encounters: cand.encounterCount, hovers: cand.hoverCount, occurrences: cand.occCount, days: cand.sinceLast }) });
      const btns = row.createDiv({ cls: "lexis-retire-btns" });
      const evictBtn = btns.createEl("button", { text: `🗑️ ${this.plugin.t("home.evict")}` });
      evictBtn.addEventListener("click", () => { void this.plugin.setRetired(cand.file, true).then(() => removeRows([cand.file.path])); });
      const pinBtn = btns.createEl("button", { text: `📌 ${this.plugin.t("home.keep")}` });
      pinBtn.addEventListener("click", () => { void this.plugin.setPinned(cand.file, true).then(() => removeRows([cand.file.path])); });
      const archiveBtn = btns.createEl("button", { text: `📦 ${this.plugin.t("home.mastered")}` });
      archiveBtn.addEventListener("click", () => { void this.plugin.setArchived(cand.file, true).then(() => removeRows([cand.file.path])); });
    }
    const bulk = wrap.createDiv({ cls: "lexis-retire-bulk" });
    const bulkRun = async (fn: (file: TFile) => Promise<void>) => { const paths = [...selected]; for (const p of paths) { const f = this.plugin.app.vault.getAbstractFileByPath(p); if (f instanceof TFile) await fn(f); } removeRows(paths); };
    bulk.createEl("button", { text: this.plugin.t("home.bulkEvict") }).addEventListener("click", () => { void bulkRun((f) => this.plugin.setRetired(f, true)); });
    bulk.createEl("button", { text: this.plugin.t("home.bulkKeep") }).addEventListener("click", () => { void bulkRun((f) => this.plugin.setPinned(f, true)); });
    bulk.createEl("button", { text: this.plugin.t("home.bulkMastered") }).addEventListener("click", () => { void bulkRun((f) => this.plugin.setArchived(f, true)); });
  }
  async onClose() {}
}

Object.defineProperties(LexisPlugin.prototype, createBridgeApi({
  DEFAULT_SETTINGS,
  TFile,
  Component,
  todayStr,
  escapeRe,
  renderLexisMarkdown,
  finishRenderMath,
  escHtml,
}));
Object.defineProperties(LexisPlugin.prototype, createHighlightEngine({
  FSRS,
  Notice,
  boundedSource,
  todayStr,
}));
Object.defineProperties(LexisPlugin.prototype, createReaderUi({
  buildCurveSVG,
  FSRS,
  addDaysStr,
  daysBetween,
  fmtDate,
  todayStr,
  TFile,
  Notice,
  boundedSource,
  escapeRe,
  Component,
  renderLexisMarkdown,
  openAliasPicker: (app, plugin, text, select) => new LexisAliasPicker(app, plugin as LexisPlugin, text, (entry) => { void select(entry); }).open(),
  openRestoreModal: (app, plugin, file) => new LexisRestoreModal(app, plugin as LexisPlugin, file).open(),
}));

const LexisSettingTab = createSettingsTab({
  obsidian,
  PluginSettingTab,
  Setting,
  Notice,
  TFolder,
  DEFAULT_SETTINGS,
  cssColorToHex,
  createReorderController,
  addAppearanceButton,
  moveItem,
  LEXIS_HOME_VIEW,
  LEXIS_REVIEW_VIEW,
});

export default LexisPlugin;
