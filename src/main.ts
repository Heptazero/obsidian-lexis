"use strict";

/*
 * Lexis —— 自建单词学习插件(源码按职责拆分，发布为移动端兼容的单文件 main.js)
 * Stage 0~2:文件夹→单词索引、阅读+实时预览高亮、悬浮卡(笔记结构 + 相关词 + 出现过的地方)。
 * Stage 3:FSRS 翻卡背单词,进度写进笔记 frontmatter。
 * 详细路线图见 LOG.md。
 */

import * as obsidian from "obsidian";
import { PluginSettingTab, Setting, Notice, Platform, TFolder, TFile, Component, finishRenderMath } from "obsidian";
import { LEXIS_HOME_VIEW, LEXIS_REVIEW_VIEW, LEXIS_LOG_VIEW } from "./constants";
import { DEFAULT_SETTINGS } from "./default-settings";
import { FSRS } from "./fsrs";
import { LexisHomeView } from "./home-view";
import { createI18n } from "./i18n";
import { buildCurveSVG, recentReviewDates } from "./curve";
import { LexisLogView } from "./review-log-view";
import { migrateReviewEvents } from "./review-log-data";
import { createOccurrenceSearch } from "./occurrence-search";
import { EncounterStore, encounterFolder } from "./encounter-store";
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
import { relationBlockSource } from "./relation-sections";
import { repairReviewHistory } from "./review-scheduler";
import { migrateEntryColors, migrateLegacySettings, pluginFolderName, type StoredSettings } from "./settings-migration";
import { WorkspaceDocuments } from "./workspace-documents";
import { ExcalidrawHighlights } from "./excalidraw-highlights";
import { CanvasEdgeHighlights } from "./canvas-edge-highlights";
import { InlineHeadingSuggest } from "./inline-heading-suggest";
import { LexisRestoreModal } from "./restore-modal";
import { LexisPluginBase } from "./plugin-base";
import { pluginDictionaryDescriptors } from "./plugin-dictionary";
import { pluginReviewDescriptors } from "./plugin-review";
import { pluginEntryDescriptors } from "./plugin-entry";
import type { LexisPluginDictionary } from "./plugin-dictionary";
import type { LexisPluginReview } from "./plugin-review";
import type { LexisPluginEntry } from "./plugin-entry";
import { LexisReviewView } from "./plugin-views";
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
import type { PdfJsRuntime } from "./occurrence-search";
import type { LexisSettings } from "./types";

type MenuItemWithSubmenu = obsidian.MenuItem & { setSubmenu(): obsidian.Menu };

function encounterDeviceLabel(): string {
  if (Platform.isIosApp) return "ios";
  if (Platform.isAndroidApp) return "android";
  if (Platform.isWin) return "windows";
  if (Platform.isLinux) return "linux";
  if (Platform.isMacOS) return "macos";
  return Platform.isMobile ? "mobile" : "desktop";
}

const LexisBridge = createBridgeServer({ Notice, Platform });

// TypeScript declaration merging describes the methods attached below with Object.defineProperties.
// Runtime behavior remains composition: LexisPlugin only extends the Obsidian plugin base.
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging -- Standard typing pattern for runtime-composed method modules. */
interface LexisPlugin extends LexisPluginDictionary, LexisPluginReview, LexisPluginEntry {}
class LexisPlugin extends LexisPluginBase {
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
    this._mobileTapStart = null;
    this._mobileTapClick = null;
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
    this._encPending = [];
    this._encWriting = null;
    this._encRevision = 0;
    this._encRelocating = false;
    let deviceId = this.app.loadLocalStorage("lexis:encounter-device-id") as string | null;
    if (!deviceId || !/^[a-f0-9]{32}$/.test(deviceId)) {
      deviceId = crypto.randomUUID().replaceAll("-", "");
      this.app.saveLocalStorage("lexis:encounter-device-id", deviceId);
    }
    this._encounterStore = new EncounterStore(this.app.vault.adapter, encounterFolder(this.settings.encounterFolder, this.app.vault.configDir, this.manifest.id), deviceId, encounterDeviceLabel());
    this._encounterDedup = {};
    this._pageHighlightState = new WeakMap();
    this._reviewSessions = new WeakMap();
    try { await this.loadEncounters(); }
    catch (error) { console.warn("[Lexis] Cannot load encounter history", error); }
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
    this.addCommand({ id: "open-review-log", name: this.t("log.title"), callback: () => this.openReviewLog() });
    this.addCommand({ id: "add-selected-word", name: this.t("command.addSelection"), callback: () => this.addSelectedWordCommand() });
    this.addCommand({ id: "open-home", name: this.t("command.home"), callback: () => this.openHome("center") });
    this.addCommand({ id: "open-home-sidebar", name: this.t("command.homeSidebar"), callback: () => this.openHome("sidebar") });
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
    this.registerView(LEXIS_LOG_VIEW, (leaf) => new LexisLogView(leaf, this));

    this.addSettingTab(new LexisSettingTab(this.app, this as unknown as ConstructorParameters<typeof LexisSettingTab>[1]));
    this.registerEditorSuggest(new InlineHeadingSuggest(this.app, this));

    this.registerMarkdownPostProcessor((el, ctx) => this.highlightElement(el, ctx));
    this.registerMarkdownCodeBlockProcessor("lexis", (src, el, ctx) => this.renderLexisBlock(el, ctx, src));
    this.registerMarkdownCodeBlockProcessor("rel", (src, el, ctx) => this.renderLexisBlock(el, ctx, relationBlockSource(src, ctx.getSectionInfo(el)?.text)));
    this.registerMarkdownCodeBlockProcessor("lexis-heatmap", (src, el) => this.renderHeatmap(el));
    this.registerMarkdownCodeBlockProcessor("lexis-home", (src, el) => this.renderHomeBlock(el));
    this.setupLiveExtension();
    this._workspaceDocuments = new WorkspaceDocuments(this, {
      mousemove: (event) => this.onMouseMove(event),
      mouseover: (event) => this.onMouseOver(event),
      mouseout: (event) => this.onMouseOut(event),
      click: (event) => this.onClick(event),
      pointerdown: (event) => this.onPointerDown(event),
      pointermove: (event) => this.onPointerMove(event),
      pointerup: (event) => this.onPointerUp(event),
      pointercancel: () => this.onPointerCancel(),
      mouseup: (event) => this.maybeShowSelPill(event),
      escape: () => this.removeSelPill(),
      scroll: (event) => {
        this._mobileTapStart = null;
        const target = event.target;
        const node = target && typeof target === "object" && "nodeType" in target ? target as Node : null;
        if (this._popover && node && this._popover.contains(node)) return;
        this.removePopover();
        this.removeSelPill();
      },
      activate: (document, documentChanged) => {
        this._canvasEdgeHighlights.activate(document);
        if (documentChanged) {
          this.setupPdfHighlight(document);
          this.setupEpubIframeHighlight(document);
        }
        this.applyReviewMetadataVisibility();
        this.syncActivePageHighlightState();
      },
      close: (document) => {
        this._canvasEdgeHighlights.close(document);
        if (this._popover?.ownerDocument === document) this.removePopover();
        if (this._selPill?.ownerDocument === document) this.removeSelPill();
      },
    });
    this._canvasEdgeHighlights = new CanvasEdgeHighlights(this);
    this._workspaceDocuments.start();
    this._excalidrawHighlights = new ExcalidrawHighlights(this);
    this._excalidrawHighlights.start();

    this.app.workspace.onLayoutReady(() => {
      this._workspaceDocuments.activateLeaf(this.app.workspace.getMostRecentLeaf());
      void this.rebuildIndex(false);
      this.syncActivePageHighlightState();
    });
    this.registerEvent(this.app.vault.on("create", (f) => { if (f instanceof TFile) this.maybeRebuild(f); }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      if (!(f instanceof TFile)) return;
      this.deleteEncounterPath(f.path);
      this.maybeRebuild(f);
    }));
    this.registerEvent(this.app.vault.on("rename", (f, old) => {
      if (f instanceof TFile) {
        this.renameEncounterPath(old, f.path);
        this.maybeRebuild(f, old);
        void this.migrateSyntaxCardPath(f, old);
      }
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
    if (this._encSaveTimer || this._encPending.length) { window.clearTimeout(this._encSaveTimer); void this.saveEncounters(); }
    this.removePopover();
    this.removeSelPill();
    this.teardownPdfHighlight();
    this.teardownEpubIframeHighlight();
    this._excalidrawHighlights?.destroy();
    this._canvasEdgeHighlights?.destroy();
    this.bridge?.stop();
    this._workspaceDocuments?.forEach((document) => document.body?.classList.remove("lexis-show-review-metadata"));
  }

  async loadStoredSettings(): Promise<StoredSettings> {
    const current = ((await this.loadData()) || {}) as StoredSettings;
    if (pluginFolderName(this.manifest.dir, this.manifest.id) !== this.manifest.id || current.legacySettingsImported) return current;
    const legacyPath = `${this.app.vault.configDir}/plugins/lexis-local/data.json`;
    if (!(await this.app.vault.adapter.exists(legacyPath))) return current;
    try {
      const legacy = JSON.parse(await this.app.vault.adapter.read(legacyPath)) as StoredSettings;
      const result = migrateLegacySettings(current, legacy);
      if (result.migrated) await this.saveData(result.settings);
      return result.settings;
    } catch {
      return current;
    }
  }

  async loadSettings() {
    const entryColorMigration = migrateEntryColors(await this.loadStoredSettings());
    const stored = entryColorMigration.settings;
    if (entryColorMigration.migrated) await this.saveData(stored);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored) as LexisSettings;
    if ((!this.settings.tagRules || !this.settings.tagRules.length) && this.settings.tagRulesText) {
      this.settings.tagRules = this.parseTagRulesText(this.settings.tagRulesText);
      delete this.settings.tagRulesText;
      await this.saveData(this.settings);
    }
    if (!Array.isArray(this.settings.tagRules)) this.settings.tagRules = [];
    if (!Array.isArray(this.settings.entryColors)) this.settings.entryColors = [];
    if (!this.settings.inlineCategoryColors || typeof this.settings.inlineCategoryColors !== "object" || Array.isArray(this.settings.inlineCategoryColors)) this.settings.inlineCategoryColors = {};
    if (!this.settings.inlineCategoryOpacity || typeof this.settings.inlineCategoryOpacity !== "object" || Array.isArray(this.settings.inlineCategoryOpacity)) this.settings.inlineCategoryOpacity = {};
    if (!this.settings.inlineCategoryHighlight || typeof this.settings.inlineCategoryHighlight !== "object" || Array.isArray(this.settings.inlineCategoryHighlight)) this.settings.inlineCategoryHighlight = {};
    if (!["heading", "file"].includes(this.settings.inlineClassificationMode)) this.settings.inlineClassificationMode = "heading";
    if (!Number.isInteger(this.settings.inlineHeadingLevel) || this.settings.inlineHeadingLevel < 0 || this.settings.inlineHeadingLevel > 6) this.settings.inlineHeadingLevel = 2;
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
    const historyRepaired = repairReviewHistory(this.settings.reviewHistory);
    const eventsMigrated = !Array.isArray(stored.reviewEvents);
    this.settings.reviewEvents = eventsMigrated ? migrateReviewEvents(this.settings.reviewHistory) : stored.reviewEvents;
    if (!this.settings.reviewAddedAt || typeof this.settings.reviewAddedAt !== "object" || Array.isArray(this.settings.reviewAddedAt)) this.settings.reviewAddedAt = {};
    if (historyRepaired || eventsMigrated) await this.saveData(this.settings);
    if (!this.settings.syntaxCardStates || typeof this.settings.syntaxCardStates !== "object" || Array.isArray(this.settings.syntaxCardStates)) this.settings.syntaxCardStates = {};
    // 单值 → 多值迁移(收录文件夹 / 网页排除标签)。旧键不在 DEFAULT_SETTINGS,故能区分"未迁移"。
    if (this.settings.vocabFolders == null) this.settings.vocabFolders = this.settings.vocabFolder != null ? this.settings.vocabFolder : "01-word";
    if (this.settings.excludeTags == null) this.settings.excludeTags = this.settings.excludeTag || "";
    if (this.settings.vocabTags == null) this.settings.vocabTags = "";
    // 词典表:文件夹来源升级成 [{folder, template}]。从旧 vocabFolders 迁移(模板留空=用全局默认)。
    if (!Array.isArray(this.settings.dicts)) {
      this.settings.dicts = this.parseFolders(this.settings.vocabFolders).map((f) => ({ folder: f, template: "" }));
    }
    const legacyTags = this.parseTags(this.settings.vocabTags);
    const configuredTags = new Set(this.settings.dicts.map((item) => this.parseTags(item.tag || "")).flat());
    let migratedTags = false;
    for (const tag of legacyTags) {
      if (configuredTags.has(tag)) continue;
      this.settings.dicts.push({ folder: "", template: "", tag });
      configuredTags.add(tag);
      migratedTags = true;
    }
    if (legacyTags.length) {
      this.settings.vocabTags = "";
      migratedTags = true;
    }
    if (migratedTags) await this.saveData(this.settings);
  }


};
/* eslint-enable @typescript-eslint/no-unsafe-declaration-merging -- End runtime-composed plugin declaration. */

Object.defineProperties(LexisPlugin.prototype, pluginDictionaryDescriptors());
Object.defineProperties(LexisPlugin.prototype, pluginReviewDescriptors());
Object.defineProperties(LexisPlugin.prototype, pluginEntryDescriptors());
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
Object.defineProperties(LexisPlugin.prototype, createReaderInteractions());
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
