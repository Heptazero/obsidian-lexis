"use strict";

/*
 * Lexis —— 自建单词学习插件(源码按职责拆分，发布为移动端兼容的单文件 main.js)
 * Stage 0~2:文件夹→单词索引、阅读+实时预览高亮、悬浮卡(笔记结构 + 相关词 + 出现过的地方)。
 * Stage 3:FSRS 翻卡背单词,进度写进笔记 frontmatter。
 * 详细路线图见 LOG.md。
 */

import * as obsidian from "obsidian";
import { Plugin, PluginSettingTab, Setting, Notice, Platform, TFolder, TFile, Component, finishRenderMath } from "obsidian";
import { LexisAliasPicker } from "./alias-picker";
import { LEXIS_HOME_VIEW, LEXIS_REVIEW_VIEW } from "./constants";
import { DEFAULT_SETTINGS } from "./default-settings";
import { FSRS } from "./fsrs";
import { LexisHomeView, type RetireCandidate } from "./home-view";
import { createI18n } from "./i18n";
import { buildCurveSVG, recentReviewDates } from "./curve";
import { createReviewView } from "./review-view";
import { createOccurrenceSearch } from "./occurrence-search";
import { createBridgeServer } from "./bridge-server";
import { createBridgeApi } from "./bridge-api";
import { createHighlightEngine } from "./highlight-engine";
import { createDocumentHighlights } from "./document-highlights";
import { createReaderInteractions } from "./reader-interactions";
import { createReaderUi } from "./reader-ui";
import { addAppearanceButton, createReorderController, moveItem } from "./settings-controls";
import { createTemplateProvider } from "./template-provider";
import { createSettingsTab } from "./settings-tab";
import { createReviewState } from "./review-state";
import { createReviewQueue } from "./review-queue";
import { WorkspaceDocuments } from "./workspace-documents";
import { LexisRestoreModal } from "./restore-modal";
import { saveAnnotationImage, vaultImageDataUrl } from "./annotation-images";
import {
  addDaysString as addDaysStr,
  boundedSource,
  compactMixedScriptSpacing,
  cssColorToHex,
  daysBetween,
  escapeHtml as escHtml,
  escapeRe,
  formatDate as fmtDate,
  renderLexisMarkdown,
  round2,
  todayString as todayStr,
} from "./shared-utils";
import type { Occurrence, OccurrenceSearch, PdfJsRuntime } from "./occurrence-search";
import type { HighlightStyle, InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats, ReviewCardState, ReviewHistoryEvent, ReviewItem, ReviewOptions, ReviewStateSnapshot, TagRule } from "./types";

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
type Encounter = { hoverCount: number; encounterCount: number; lastEncounter: string };
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
  declare _indexKeysByCompact: Map<string, string>;
  declare _matchKeysByCompact: Map<string, string>;
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
  declare _workspaceDocuments: WorkspaceDocuments;
  declare _selPill: HTMLElement | null;
  declare highlightElement: (el: HTMLElement, ctx: obsidian.MarkdownPostProcessorContext) => void;
  declare renderLexisBlock: (el: HTMLElement, ctx: obsidian.MarkdownPostProcessorContext, src: string) => Promise<void>;
  declare renderHeatmap: (el: HTMLElement) => void;
  declare renderHomeBlock: (el: HTMLElement) => void;
  declare setupLiveExtension: () => void;
  declare setupPdfHighlight: (document?: Document) => void;
  declare setupEpubIframeHighlight: (document?: Document) => void;
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
  declare resolveIndexKey: (value: string) => string;
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
  declare readSyntaxCardState: (id: string) => ReviewCardState;
  declare snapshotReviewItem: (item: ReviewItem) => ReviewStateSnapshot;
  declare applyReviewItemSchedule: (item: ReviewItem, schedule: Schedule) => Promise<void>;
  declare restoreReviewItem: (item: ReviewItem, snapshot: ReviewStateSnapshot) => Promise<void>;
  declare logReviewItem: (item: ReviewItem, schedule: Schedule, grade: number, retentionBefore: number) => Promise<void>;
  declare undoReviewItemLog: (item: ReviewItem) => Promise<void>;
  declare collectReviewFolders: () => string[];
  declare collectReviewTags: () => string[];
  declare buildQueue: (options?: ReviewOptions) => Promise<ReviewItem[]>;
  declare migrateSyntaxCardPath: (file: TFile, oldPath: string) => Promise<void>;

  async onload() {
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
    this._indexKeysByCompact = new Map();
    this._matchKeysByCompact = new Map();
    this._rebuildTimer = null;
    this._popover = null;
    this._popoverComp = null;
    this._selPill = null;
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

    this.statusBarEl = this.addStatusBarItem();
    if (this.statusBarEl) {
      this.statusBarEl.setCssStyles({ cursor: "pointer" });
      this.statusBarEl.setAttribute("aria-label", this.t("status.rebuildAria"));
      this.registerDomEvent(this.statusBarEl, "click", () => this.rebuildIndex(true));
    }

    this.addCommand({ id: "rebuild-index", name: this.t("command.rebuild"), callback: () => this.rebuildIndex(true) });
    this.addCommand({ id: "open-review", name: this.t("command.review"), callback: () => this.openHome() });
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
    this.addRibbonIcon("brain", this.t("ribbon.review"), () => this.openHome());

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
    this._workspaceDocuments = new WorkspaceDocuments(this, {
      mouseover: (event) => this.onMouseOver(event),
      mouseout: (event) => this.onMouseOut(event),
      click: (event) => this.onClick(event),
      mouseup: (event) => this.maybeShowSelPill(event),
      escape: () => this.removeSelPill(),
      scroll: (event) => {
        const target = event.target;
        const node = target && typeof target === "object" && "nodeType" in target ? target as Node : null;
        if (this._popover && node && this._popover.contains(node)) return;
        this.removePopover();
        this.removeSelPill();
      },
      activate: (document, documentChanged) => {
        if (documentChanged) {
          this.setupPdfHighlight(document);
          this.setupEpubIframeHighlight(document);
        }
        this.applyReviewMetadataVisibility();
        this.syncActivePageHighlightState();
      },
      close: (document) => {
        if (this._popover?.ownerDocument === document) this.removePopover();
        if (this._selPill?.ownerDocument === document) this.removeSelPill();
      },
    });
    this._workspaceDocuments.start();

    this.app.workspace.onLayoutReady(() => {
      this._workspaceDocuments.activateLeaf(this.app.workspace.getMostRecentLeaf());
      void this.rebuildIndex(false);
      this.syncActivePageHighlightState();
    });
    this.registerEvent(this.app.vault.on("create", (f) => { if (f instanceof TFile) this.maybeRebuild(f); }));
    this.registerEvent(this.app.vault.on("delete", (f) => { if (f instanceof TFile) this.maybeRebuild(f); }));
    this.registerEvent(this.app.vault.on("rename", (f, old) => {
      if (f instanceof TFile) { this.maybeRebuild(f, old); void this.migrateSyntaxCardPath(f, old); }
    }));
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
    this._workspaceDocuments?.forEach((document) => document.body?.classList.remove("lexis-show-review-metadata"));
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
    if (!this.settings.syntaxCardStates || typeof this.settings.syntaxCardStates !== "object" || Array.isArray(this.settings.syntaxCardStates)) this.settings.syntaxCardStates = {};
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
    if (this._workspaceDocuments) {
      this._workspaceDocuments.forEach((document) => document.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata));
      return;
    }
    this.app.workspace.containerEl.ownerDocument.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata);
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
    const document = this._workspaceDocuments?.current() || this.app.workspace.containerEl.ownerDocument;
    try { return cssColorToHex(document.defaultView?.getComputedStyle(document.body).getPropertyValue("--text-accent") || "", document); }
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
    if (leaf.view instanceof LexisReviewView) { leaf.view.options = options || {}; await leaf.view.refresh(); }
  }
  saveReviewSession(leaf: obsidian.WorkspaceLeaf, state: unknown): void { if (leaf && state) this._reviewSessions.set(leaf, state); }
  takeReviewSession(leaf: obsidian.WorkspaceLeaf): unknown {
    if (!leaf) return null;
    const state = this._reviewSessions.get(leaf) || null;
    this._reviewSessions.delete(leaf);
    return state;
  }
  async openHome(): Promise<void> {
    const sourceFile = this.app.workspace.getActiveFile();
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_HOME_VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getRightLeaf(false); await leaf.setViewState({ type: LEXIS_HOME_VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisHomeView) {
      if (sourceFile) leaf.view.sourceFilePath = sourceFile.path;
      leaf.view.render();
    }
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
      const hit = this.index.get(this.resolveIndexKey(clean));
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

Object.defineProperties(LexisPlugin.prototype, createBridgeApi({
  DEFAULT_SETTINGS,
  TFile,
  Component,
  todayStr,
  recentReviewDates,
  escapeRe,
  renderLexisMarkdown,
  finishRenderMath,
  escHtml,
  saveAnnotationImage,
  vaultImageDataUrl,
}));
Object.defineProperties(LexisPlugin.prototype, createReviewState({ todayStr, round2 }));
Object.defineProperties(LexisPlugin.prototype, createReviewQueue({ todayStr }));
Object.defineProperties(LexisPlugin.prototype, createHighlightEngine({
  FSRS,
  Notice,
  boundedSource,
  compactMixedScriptSpacing,
  todayStr,
}));
Object.defineProperties(LexisPlugin.prototype, createDocumentHighlights());
Object.defineProperties(LexisPlugin.prototype, createReaderInteractions({
  openAliasPicker: (app, plugin, text, select) => new LexisAliasPicker(app, plugin as LexisPlugin, text, (entry) => { void select(entry); }).open(),
}));
Object.defineProperties(LexisPlugin.prototype, createReaderUi({
  buildCurveSVG,
  recentReviewDates,
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
