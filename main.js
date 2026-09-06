/* Generated from TypeScript source. Edit src/, not main.js. */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var obsidian4 = __toESM(require("obsidian"));
var import_obsidian7 = require("obsidian");

// src/alias-picker.ts
var import_obsidian = require("obsidian");
var LexisAliasPicker = class extends import_obsidian.FuzzySuggestModal {
  constructor(app, plugin, aliasText, onPick) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
    this.setPlaceholder(this.plugin.t("selection.aliasPrompt", { alias: aliasText }));
  }
  getItems() {
    const seen = /* @__PURE__ */ new Set();
    const entries = [];
    for (const entry of this.plugin.index.values()) {
      if (!entry?.file) continue;
      const key = `${entry.file.path}|${entry.display || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
    return entries;
  }
  getItemText(entry) {
    return entry.isAlias ? this.plugin.t("selection.aliasItem", { alias: entry.display, word: entry.file.basename }) : entry.display;
  }
  onChooseItem(entry) {
    if (entry.file) this.onPick(entry);
  }
};

// src/constants.ts
var LEXIS_REVIEW_VIEW = "lexis-review-view";
var LEXIS_HOME_VIEW = "lexis-home-view";
var LEXIS_BRIDGE_DEFAULT_PORT = 12345;

// src/default-settings.ts
var DEFAULT_SETTINGS = {
  language: "zh",
  vocabTags: "",
  includeAliases: true,
  aliasSources: "",
  inlineEntriesEnabled: true,
  inlineEntryDelimiter: "::",
  inlineClassificationMode: "heading",
  inlineCategoryColors: {},
  inlineCategoryOpacity: {},
  inlineCategoryHighlight: {},
  inlineFileColors: {},
  inlineFileOpacity: {},
  inlineFileHighlight: {},
  inlineSourceHighlight: {},
  inlineCollapsedGroups: {},
  inlineCategoryOrder: [],
  inlineFileOrder: [],
  inlineCategoryOrderByParent: {},
  enableHighlight: true,
  enableLivePreview: true,
  highlightStyle: "wavy",
  highlightColor: "",
  highlightOpacity: 1,
  popoverWidth: 460,
  popoverMaxHeight: 420,
  popoverFontSize: 14,
  hoverDelayMs: 250,
  fadeByMemory: true,
  fadeFloor: 0.25,
  hoverFeedback: true,
  hoverFeedbackDays: 3,
  retireCandidateDays: 90,
  tagRules: [],
  showRelated: true,
  showOccurrences: true,
  includePdfOccurrences: true,
  occurrenceLimit: 6,
  occurrenceFolders: "",
  requestRetention: 0.9,
  newPerDay: 20,
  maxReviewsPerSession: 200,
  reviewLog: {},
  reviewHistory: {},
  syntaxCardStates: {},
  showReviewMetadata: false,
  flashcardInlineTemplate: "{{question}}::{{answer}}",
  flashcardBidirectionalTemplate: "{{sideA}}:::{{sideB}}",
  flashcardBlockTemplate: "{{question}}??\n{{answer}}",
  flashcardClozeTemplate: "=={{answer}}==",
  newWordTemplate: "template/\u5355\u8BCD\u6A21\u677F.md",
  emptyNotePreset: "blank",
  occurrenceTemplate: "#### \u51FA\u5904\n> {{sentence}}{{sourceSuffix}}",
  annotationHeading: "",
  annotationImageLocation: "obsidian",
  annotationImageFolder: "",
  cardFront: "note",
  reviewBottomSpace: 70,
  bridgeEnabled: false,
  bridgePort: LEXIS_BRIDGE_DEFAULT_PORT,
  bridgeToken: "",
  selectionPill: true,
  lastSelectionFolder: "",
  enablePdfHighlight: true
};

// src/fsrs.ts
var WEIGHTS = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 46e-4, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
var DECAY = -0.5;
var FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
var MAX_INTERVAL = 36500;
var FSRS = {
  clampD: (difficulty) => Math.min(10, Math.max(1, difficulty)),
  initStability: (grade) => Math.max(0.1, WEIGHTS[grade - 1]),
  initDifficulty(grade) {
    return FSRS.clampD(WEIGHTS[4] - Math.exp(WEIGHTS[5] * (grade - 1)) + 1);
  },
  linearDamping: (delta, difficulty) => delta * (10 - difficulty) / 9,
  meanReversion: (initial, current) => WEIGHTS[7] * initial + (1 - WEIGHTS[7]) * current,
  nextDifficulty(difficulty, grade) {
    const delta = -WEIGHTS[6] * (grade - 3);
    const next = difficulty + FSRS.linearDamping(delta, difficulty);
    return FSRS.clampD(FSRS.meanReversion(FSRS.initDifficulty(4), next));
  },
  retrievability(elapsedDays, stability) {
    return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
  },
  nextRecallStability(difficulty, stability, retrievability, grade) {
    const hardPenalty = grade === 2 ? WEIGHTS[15] : 1;
    const easyBonus = grade === 4 ? WEIGHTS[16] : 1;
    return stability * (1 + Math.exp(WEIGHTS[8]) * (11 - difficulty) * Math.pow(stability, -WEIGHTS[9]) * (Math.exp((1 - retrievability) * WEIGHTS[10]) - 1) * hardPenalty * easyBonus);
  },
  nextForgetStability(difficulty, stability, retrievability) {
    return WEIGHTS[11] * Math.pow(difficulty, -WEIGHTS[12]) * (Math.pow(stability + 1, WEIGHTS[13]) - 1) * Math.exp((1 - retrievability) * WEIGHTS[14]);
  },
  nextInterval(stability, retention) {
    const interval = stability / FACTOR * (Math.pow(retention, 1 / DECAY) - 1);
    return Math.min(MAX_INTERVAL, Math.max(1, Math.round(interval)));
  }
};

// src/home-view.ts
var import_obsidian2 = require("obsidian");
var LexisHomeView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.sourceFilePath = "";
  }
  getViewType() {
    return LEXIS_HOME_VIEW;
  }
  getDisplayText() {
    return "Lexis";
  }
  getIcon() {
    return "graduation-cap";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const container = this.contentEl;
    container.empty();
    container.addClass("lexis-home");
    container.createEl("h3", { text: "\u{1F4D5} Lexis" });
    const current = this.plugin.computeStats();
    const stats = container.createDiv({ cls: "lexis-home-stats" });
    stats.createDiv({ cls: "lexis-stat", text: `\u23F0 ${this.plugin.t("home.due", { count: current.due })}` });
    stats.createDiv({ cls: "lexis-stat", text: `\u2728 ${this.plugin.t("home.new", { count: current.fresh })}` });
    stats.createDiv({ cls: "lexis-stat", text: `\u{1F4DA} ${this.plugin.t("home.total", { count: current.total })}` });
    this.plugin.renderHeatmap(container.createDiv({ cls: "lexis-hm-wrap" }));
    container.createEl("h4", { text: this.plugin.t("home.start") });
    const folders = this.plugin.collectReviewFolders();
    const tags = this.plugin.collectReviewTags();
    const activeFile = this.app.workspace.getActiveFile();
    const rememberedFile = this.sourceFilePath ? this.app.vault.getAbstractFileByPath(this.sourceFilePath) : null;
    const currentFile = activeFile || (rememberedFile instanceof import_obsidian2.TFile ? rememberedFile : null);
    let selectedScope = "vocab";
    let selectedFolder = "";
    let selectedTag = "";
    let selectedContent = "notes";
    let selectedClozeMode = "separate";
    let selectedSort = "due";
    let selectedDirection = "asc";
    const controls = container.createDiv({ cls: "lexis-review-controls" });
    let renderControls;
    const rerenderControls = () => {
      const scrollTop = container.scrollTop;
      renderControls();
      container.scrollTop = scrollTop;
      container.ownerDocument.defaultView?.requestAnimationFrame(() => {
        container.scrollTop = scrollTop;
      });
    };
    const addSegments = (setting, options, value, select) => {
      const group = setting.controlEl.createDiv({ cls: "lexis-segments" });
      for (const [key, label] of options) {
        const button = group.createEl("button", { cls: `lexis-segment${key === value ? " is-active" : ""}`, text: label, attr: { type: "button" } });
        button.addEventListener("click", () => select(key));
      }
    };
    renderControls = () => {
      controls.empty();
      new import_obsidian2.Setting(controls).setName(this.plugin.t("home.reviewScope")).addDropdown((dropdown) => dropdown.addOption("vocab", this.plugin.t("home.scopeVocab")).addOption("folder", this.plugin.t("home.scopeFolder")).addOption("tag", this.plugin.t("home.scopeTag")).addOption("current", this.plugin.t("home.scopeCurrent")).setValue(selectedScope).onChange((value) => {
        if (["vocab", "folder", "tag", "current"].includes(value)) selectedScope = value;
        rerenderControls();
      }));
      if (selectedScope === "folder") {
        new import_obsidian2.Setting(controls).setName(this.plugin.t("home.reviewFolder")).addDropdown((dropdown) => {
          dropdown.addOption("", this.plugin.t("home.scopeAllFiles"));
          for (const folder of folders) dropdown.addOption(folder, folder);
          dropdown.setValue(selectedFolder).onChange((value) => {
            selectedFolder = value;
          });
        });
      }
      if (selectedScope === "tag") {
        new import_obsidian2.Setting(controls).setName(this.plugin.t("home.reviewTag")).addDropdown((dropdown) => {
          dropdown.addOption("", this.plugin.t("home.chooseTag"));
          for (const tag of tags) dropdown.addOption(tag, `#${tag}`);
          dropdown.setValue(selectedTag).onChange((value) => {
            selectedTag = value;
          });
        });
      }
      if (selectedScope === "current") {
        new import_obsidian2.Setting(controls).setName(this.plugin.t("home.currentNote")).setDesc(currentFile?.path || this.plugin.t("home.noCurrentNote"));
      }
      const contentSetting = new import_obsidian2.Setting(controls).setName(this.plugin.t("home.reviewContent"));
      addSegments(contentSetting, [
        ["notes", this.plugin.t("home.contentNotes")],
        ["syntax", this.plugin.t("home.contentSyntax")],
        ["both", this.plugin.t("home.contentBoth")]
      ], selectedContent, (value) => {
        selectedContent = value;
        rerenderControls();
      });
      if (selectedContent !== "notes") {
        const clozeSetting = new import_obsidian2.Setting(controls).setName(this.plugin.t("home.clozeMode"));
        addSegments(clozeSetting, [
          ["separate", this.plugin.t("home.clozeSeparate")],
          ["combined", this.plugin.t("home.clozeCombined")]
        ], selectedClozeMode, (value) => {
          selectedClozeMode = value;
          rerenderControls();
        });
      }
      new import_obsidian2.Setting(controls).setName(this.plugin.t("home.sortBy")).addDropdown((dropdown) => {
        dropdown.addOption("due", this.plugin.t("home.sortDue")).addOption("wordCount", this.plugin.t("home.sortWordCount")).addOption("modified", this.plugin.t("home.sortModified")).addOption("created", this.plugin.t("home.sortCreated")).addOption("frequency", this.plugin.t("home.frequency")).addOption("random", this.plugin.t("home.random")).setValue(selectedSort);
        dropdown.onChange((value) => {
          if (["due", "wordCount", "modified", "created", "frequency", "random"].includes(value)) selectedSort = value;
          rerenderControls();
        });
      });
      if (selectedSort !== "random") {
        const directionSetting = new import_obsidian2.Setting(controls).setName(this.plugin.t("home.sortDirection"));
        addSegments(directionSetting, [
          ["asc", this.plugin.t("home.ascending")],
          ["desc", this.plugin.t("home.descending")]
        ], selectedDirection, (value) => {
          selectedDirection = value;
          rerenderControls();
        });
      }
      new import_obsidian2.Setting(controls).addButton((button) => button.setButtonText(this.plugin.t("home.start")).setCta().setDisabled(selectedScope === "current" && !currentFile || selectedScope === "tag" && !selectedTag).onClick(() => this.plugin.openReview({
        scope: selectedScope,
        folder: selectedFolder,
        tag: selectedTag,
        file: currentFile?.path,
        content: selectedContent,
        clozeMode: selectedClozeMode,
        sortBy: selectedSort,
        sortDirection: selectedDirection
      }))).addExtraButton((button) => button.setIcon("refresh-cw").setTooltip(this.plugin.t("common.refresh")).onClick(() => this.render()));
    };
    renderControls();
    void this.renderRetireCandidates(container);
  }
  async renderRetireCandidates(container) {
    const days = this.plugin.settings.retireCandidateDays ?? 90;
    const wrapper = container.createDiv({ cls: "lexis-retire-wrap" });
    wrapper.createEl("h4", { text: `\u{1F5D1}\uFE0F ${this.plugin.t("home.retire")}` });
    new import_obsidian2.Setting(wrapper).setName(this.plugin.t("home.retireThreshold")).setDesc(this.plugin.t("home.retireThresholdDesc")).addSlider((slider) => slider.setLimits(14, 365, 1).setValue(days).onChange((value) => {
      this.plugin.settings.retireCandidateDays = value;
      void this.plugin.saveSettings();
      if (this.retireRenderTimer) window.clearTimeout(this.retireRenderTimer);
      this.retireRenderTimer = window.setTimeout(() => this.render(), 400);
    }));
    const list = wrapper.createDiv();
    list.setText(this.plugin.t("home.calculating"));
    let candidates;
    try {
      candidates = await this.plugin.buildRetireCandidates();
    } catch {
      candidates = [];
    }
    if (!list.isConnected) return;
    list.empty();
    if (!candidates.length) {
      list.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noCandidates") });
      return;
    }
    const selected = /* @__PURE__ */ new Set();
    const rows = /* @__PURE__ */ new Map();
    const removeRows = (paths) => {
      for (const path of paths) {
        rows.get(path)?.remove();
        rows.delete(path);
        selected.delete(path);
      }
    };
    for (const candidate of candidates) {
      const row = list.createDiv({ cls: "lexis-retire-row" });
      rows.set(candidate.file.path, row);
      const checkbox = row.createEl("input", { type: "checkbox", cls: "lexis-retire-cb" });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selected.add(candidate.file.path);
        else selected.delete(candidate.file.path);
      });
      const info = row.createDiv({ cls: "lexis-retire-info" });
      const name = info.createEl("a", { text: candidate.display, href: "#", cls: "lexis-retire-name" });
      name.addEventListener("click", (event) => {
        event.preventDefault();
        void this.plugin.app.workspace.getLeaf(false).openFile(candidate.file);
      });
      info.createDiv({
        cls: "lexis-retire-meta",
        text: this.plugin.t("home.candidateMeta", {
          created: candidate.created,
          encounters: candidate.encounterCount,
          hovers: candidate.hoverCount,
          occurrences: candidate.occCount,
          days: candidate.sinceLast
        })
      });
      const buttons = row.createDiv({ cls: "lexis-retire-btns" });
      buttons.createEl("button", { text: `\u{1F5D1}\uFE0F ${this.plugin.t("home.evict")}` }).addEventListener("click", () => {
        void this.plugin.setRetired(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
      buttons.createEl("button", { text: `\u{1F4CC} ${this.plugin.t("home.keep")}` }).addEventListener("click", () => {
        void this.plugin.setPinned(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
      buttons.createEl("button", { text: `\u{1F4E6} ${this.plugin.t("home.mastered")}` }).addEventListener("click", () => {
        void this.plugin.setArchived(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
    }
    const bulk = wrapper.createDiv({ cls: "lexis-retire-bulk" });
    const runBulk = async (operation) => {
      const paths = [...selected];
      for (const path of paths) {
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian2.TFile) await operation(file);
      }
      removeRows(paths);
    };
    bulk.createEl("button", { text: this.plugin.t("home.bulkEvict") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setRetired(file, true));
    });
    bulk.createEl("button", { text: this.plugin.t("home.bulkKeep") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setPinned(file, true));
    });
    bulk.createEl("button", { text: this.plugin.t("home.bulkMastered") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setArchived(file, true));
    });
  }
  async onClose() {
  }
};

// src/i18n.ts
var MESSAGES = {
  "language.name": { zh: "\u754C\u9762\u8BED\u8A00", en: "Interface language" },
  "language.zh": { zh: "\u4E2D\u6587", en: "\u4E2D\u6587" },
  "language.en": { zh: "English", en: "English" },
  "language.reload": { zh: "Lexis\uFF1A\u547D\u4EE4\u540D\u79F0\u5C06\u5728\u91CD\u8F7D\u63D2\u4EF6\u540E\u66F4\u65B0", en: "Lexis: command names update after reloading the plugin" },
  "common.all": { zh: "\u5168\u90E8", en: "All" },
  "common.default": { zh: "\u9ED8\u8BA4", en: "Default" },
  "common.delete": { zh: "\u5220\u9664", en: "Delete" },
  "common.refresh": { zh: "\u5237\u65B0", en: "Refresh" },
  "common.root": { zh: "\u6839\u76EE\u5F55", en: "Vault root" },
  "common.loading": { zh: "\u52A0\u8F7D\u4E2D\u2026", en: "Loading\u2026" },
  "common.searching": { zh: "\u641C\u7D22\u4E2D\u2026", en: "Searching\u2026" },
  "common.empty": { zh: "\u7A7A", en: "Empty" },
  "common.failed": { zh: "\u5931\u8D25", en: "Failed" },
  "common.cancel": { zh: "\u53D6\u6D88", en: "Cancel" },
  "common.done": { zh: "\u5B8C\u6210", en: "Done" },
  "command.rebuild": { zh: "\u91CD\u5EFA\u8BCD\u6761\u7D22\u5F15", en: "Rebuild entry index" },
  "command.review": { zh: "\u5F00\u59CB\u590D\u4E60", en: "Start review" },
  "command.addSelection": { zh: "\u628A\u9009\u4E2D\u5185\u5BB9\u52A0\u5165 Lexis", en: "Add selection to Lexis" },
  "command.home": { zh: "\u6253\u5F00 Lexis \u4E3B\u9875", en: "Open Lexis home" },
  "command.toggleHighlights": { zh: "\u5207\u6362\u5F53\u524D\u9875\u9762\u7684\u6240\u6709\u9AD8\u4EAE", en: "Toggle all highlights on current page" },
  "command.archive": { zh: "\u6807\u4E3A\u5DF2\u638C\u63E1\uFF08\u5F52\u6863\uFF09", en: "Mark as mastered (archive)" },
  "command.restore": { zh: "\u6062\u590D\uFF08\u53D6\u6D88\u5F52\u6863\uFF09", en: "Restore from archive" },
  "command.pin": { zh: "\u5207\u6362\u5E38\u9A7B\u72B6\u6001", en: "Toggle resident status" },
  "command.migrate": { zh: "\u8FC1\u79FB\uFF1A\u628A #\u719F\u6089 \u6279\u91CF\u6807\u4E3A\u5F52\u6863", en: "Migrate: archive entries tagged #\u719F\u6089" },
  "ribbon.home": { zh: "Lexis \u4E3B\u9875", en: "Lexis home" },
  "ribbon.review": { zh: "Lexis \u590D\u4E60", en: "Lexis review" },
  "status.rebuildAria": { zh: "\u70B9\u51FB\u91CD\u5EFA\u7D22\u5F15\uFF1B\u53F3\u952E\u5F00\u59CB\u590D\u4E60", en: "Click to rebuild index; right-click to review" },
  "status.summary": { zh: "\u{1F4D5} {words} \u8BCD{aliases}{inline}{due}{bridge}", en: "\u{1F4D5} {words} entries{aliases}{inline}{due}{bridge}" },
  "status.aliases": { zh: " +{count} \u522B\u540D", en: " +{count} aliases" },
  "status.inline": { zh: " +{count} \u5185\u8054", en: " +{count} inline" },
  "notice.desktopBridge": { zh: "Lexis\uFF1A\u672C\u673A\u6865\u63A5\u4EC5\u652F\u6301\u684C\u9762\u7AEF", en: "Lexis: the local bridge is desktop-only" },
  "notice.bridgeFailed": { zh: "Lexis \u6865\u63A5\u542F\u52A8\u5931\u8D25\uFF1A{reason}", en: "Lexis bridge failed to start: {reason}" },
  "notice.portBusy": { zh: "\u7AEF\u53E3 {port} \u88AB\u5360\u7528", en: "Port {port} is already in use" },
  "notice.loadFailed": { zh: "Lexis \u52A0\u8F7D\u5931\u8D25\uFF1A{error}", en: "Lexis failed to load: {error}" },
  "notice.archived": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u5F52\u6863", en: "Lexis: archived \u201C{word}\u201D" },
  "notice.pinned": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u8BBE\u4E3A\u5E38\u9A7B", en: "Lexis: marked \u201C{word}\u201D as resident" },
  "notice.unpinned": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u53D6\u6D88\u5E38\u9A7B", en: "Lexis: removed resident status from \u201C{word}\u201D" },
  "notice.noFamiliar": { zh: "Lexis\uFF1A\u6CA1\u6709\u53EF\u8FC1\u79FB\u7684 #\u719F\u6089 \u8BCD\u6761", en: "Lexis: no entries tagged #\u719F\u6089 are eligible for migration" },
  "notice.migrated": { zh: "Lexis\uFF1A\u5DF2\u5F52\u6863 {count} \u4E2A #\u719F\u6089 \u8BCD\u6761", en: "Lexis: archived {count} entries tagged #\u719F\u6089" },
  "notice.indexBuilt": { zh: "Lexis\uFF1A\u5DF2\u4ECE {scope} \u8BC6\u522B {words} \u4E2A\u8BCD\u6761{aliases}{inline}", en: "Lexis: indexed {words} entries{aliases}{inline} from {scope}" },
  "notice.aliasCount": { zh: "\uFF08\u542B {count} \u4E2A\u522B\u540D\uFF09", en: " ({count} aliases)" },
  "notice.inlineCount": { zh: "\uFF0C\u53E6\u6709 {count} \u6761\u5185\u8054\u6761\u76EE", en: " and {count} inline entries" },
  "notice.scopeFolders": { zh: "{count} \u4E2A\u6587\u4EF6\u5939", en: "{count} folders" },
  "notice.scopeTags": { zh: "{count} \u4E2A\u6807\u7B7E", en: "{count} tags" },
  "notice.scopeEmpty": { zh: "\u7A7A\u8303\u56F4", en: "an empty scope" },
  "notice.selectWord": { zh: "Lexis\uFF1A\u8BF7\u5148\u9009\u4E2D\u5185\u5BB9", en: "Lexis: select some text first" },
  "notice.invalidWord": { zh: "Lexis\uFF1A\u65E0\u6548\u8BCD\u6761", en: "Lexis: invalid entry" },
  "notice.exists": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u5B58\u5728\uFF0C\u6B63\u5728\u6253\u5F00", en: "Lexis: \u201C{word}\u201D already exists; opening it" },
  "notice.existsNoOpen": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u5B58\u5728", en: "Lexis: \u201C{word}\u201D already exists" },
  "notice.addedPdf": { zh: "Lexis\uFF1A\u5DF2\u52A0\u5165\u300C{word}\u300D\u5E76\u9AD8\u4EAE", en: "Lexis: added and highlighted \u201C{word}\u201D" },
  "notice.created": { zh: "Lexis\uFF1A\u5DF2\u521B\u5EFA\u300C{word}\u300D", en: "Lexis: created \u201C{word}\u201D" },
  "notice.createFailed": { zh: "Lexis \u521B\u5EFA\u5931\u8D25\uFF1A{error}", en: "Lexis failed to create the entry: {error}" },
  "notice.aliasSelf": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5C31\u662F\u8BE5\u8BCD\u6761\u672C\u8EAB", en: "Lexis: \u201C{word}\u201D is already this entry" },
  "notice.aliasAdded": { zh: "Lexis\uFF1A\u5DF2\u628A\u300C{alias}\u300D\u8BBE\u4E3A\u300C{word}\u300D\u7684\u522B\u540D", en: "Lexis: added \u201C{alias}\u201D as an alias of \u201C{word}\u201D" },
  "notice.aliasFailed": { zh: "Lexis \u6DFB\u52A0\u522B\u540D\u5931\u8D25\uFF1A{error}", en: "Lexis failed to add the alias: {error}" },
  "notice.bridgeRestarted": { zh: "Lexis\uFF1A\u6865\u63A5\u5DF2\u91CD\u542F", en: "Lexis: bridge restarted" },
  "notice.tokenCopied": { zh: "Lexis\uFF1A\u4EE4\u724C\u5DF2\u590D\u5236", en: "Lexis: token copied" },
  "notice.highlightsHidden": { zh: "Lexis\uFF1A\u5F53\u524D\u9875\u9762\u9AD8\u4EAE\u5DF2\u9690\u85CF", en: "Lexis: highlights hidden on this page" },
  "notice.highlightsShown": { zh: "Lexis\uFF1A\u5F53\u524D\u9875\u9762\u9AD8\u4EAE\u5DF2\u663E\u793A", en: "Lexis: highlights shown on this page" },
  "notice.moved": { zh: "Lexis\uFF1A\u5DF2\u79FB\u5230 {folder}", en: "Lexis: moved to {folder}" },
  "notice.moveFailed": { zh: "Lexis \u79FB\u52A8\u5931\u8D25\uFF1A{error}", en: "Lexis failed to move the entry: {error}" },
  "notice.noteAdded": { zh: "Lexis\uFF1A\u5DF2\u7ED9\u300C{word}\u300D\u6DFB\u52A0\u6279\u6CE8", en: "Lexis: added a note to \u201C{word}\u201D" },
  "notice.noteFailed": { zh: "Lexis \u6DFB\u52A0\u6279\u6CE8\u5931\u8D25\uFF1A{error}", en: "Lexis failed to add the note: {error}" },
  "notice.deleted": { zh: "Lexis\uFF1A\u5DF2\u5220\u9664\u300C{word}\u300D", en: "Lexis: deleted \u201C{word}\u201D" },
  "notice.deleteFailed": { zh: "Lexis \u5220\u9664\u5931\u8D25\uFF1A{error}", en: "Lexis failed to delete the entry: {error}" },
  "notice.occurrenceExists": { zh: "Lexis\uFF1A\u8FD9\u6761\u5DF2\u7ECF\u6536\u85CF", en: "Lexis: this occurrence is already saved" },
  "notice.occurrenceSaved": { zh: "Lexis\uFF1A\u5DF2\u6536\u85CF\u5230\u51FA\u5904", en: "Lexis: saved as an occurrence" },
  "notice.occurrenceFailed": { zh: "Lexis \u6536\u85CF\u5931\u8D25\uFF1A{error}", en: "Lexis failed to save the occurrence: {error}" },
  "menu.restore": { zh: "Lexis\uFF1A\u6062\u590D", en: "Lexis: Restore" },
  "menu.archive": { zh: "Lexis\uFF1A\u6807\u4E3A\u5DF2\u638C\u63E1\uFF08\u5F52\u6863\uFF09", en: "Lexis: Mark as mastered (archive)" },
  "menu.pin": { zh: "Lexis\uFF1A\u5E38\u9A7B", en: "Lexis: Mark as resident" },
  "menu.unpin": { zh: "Lexis\uFF1A\u53D6\u6D88\u5E38\u9A7B", en: "Lexis: Remove resident status" },
  "menu.addTo": { zh: "Lexis\uFF1A\u6DFB\u52A0\u201C{word}\u201D\u5230 {folder}", en: "Lexis: Add \u201C{word}\u201D to {folder}" },
  "menu.add": { zh: "Lexis\uFF1A\u6DFB\u52A0\u201C{word}\u201D", en: "Lexis: Add \u201C{word}\u201D" },
  "review.title": { zh: "Lexis \u590D\u4E60", en: "Lexis review" },
  "review.progress": { zh: "\u5DF2\u80CC {done} \xB7 \u5269 {left}", en: "Reviewed {done} \xB7 {left} left" },
  "review.undo": { zh: "\u64A4\u9500 (Z)", en: "Undo (Z)" },
  "review.skip": { zh: "\u8DF3\u8FC7 (S)", en: "Skip (S)" },
  "review.openSource": { zh: "\u5728\u5F53\u524D\u6807\u7B7E\u9875\u6253\u5F00\u539F\u6587", en: "Open source in current tab" },
  "review.onlyTag": { zh: "\u53EA\u80CC #{tag}", en: "Review only #{tag}" },
  "review.show": { zh: "\u663E\u793A\u7B54\u6848 (\u7A7A\u683C)", en: "Show answer (Space)" },
  "review.again": { zh: "\u91CD\u6765", en: "Again" },
  "review.hard": { zh: "\u8F83\u96BE", en: "Hard" },
  "review.good": { zh: "\u8BB0\u5F97", en: "Good" },
  "review.easy": { zh: "\u7B80\u5355", en: "Easy" },
  "review.renderFailed": { zh: "\u5185\u5BB9\u6E32\u67D3\u5931\u8D25\uFF1A{error}", en: "Failed to render content: {error}" },
  "review.revealFirst": { zh: "Lexis\uFF1A\u8BF7\u5148\u663E\u793A\u7B54\u6848", en: "Lexis: reveal the answer first" },
  "review.gradeFailed": { zh: "Lexis \u8BC4\u5206\u5931\u8D25\uFF1A{error}", en: "Lexis failed to save the rating: {error}" },
  "review.nothingUndo": { zh: "Lexis\uFF1A\u6CA1\u6709\u53EF\u64A4\u9500\u7684\u64CD\u4F5C", en: "Lexis: nothing to undo" },
  "review.undoFailed": { zh: "Lexis \u64A4\u9500\u5931\u8D25\uFF1A{error}", en: "Lexis failed to undo: {error}" },
  "review.closeImage": { zh: "\u5173\u95ED\u5927\u56FE", en: "Close image" },
  "review.done": { zh: "\u672C\u8F6E\u5DF2\u590D\u4E60 {count} \u4E2A", en: "Reviewed {count} this session" },
  "review.noneDue": { zh: "\u6682\u65E0\u5230\u671F\u8BCD\u6761", en: "No entries are due" },
  "review.checkAgain": { zh: "\u91CD\u65B0\u68C0\u67E5", en: "Check again" },
  "interval.ltDay": { zh: "<1\u5929", en: "<1d" },
  "interval.days": { zh: "{count}\u5929", en: "{count}d" },
  "interval.months": { zh: "{count}\u4E2A\u6708", en: "{count}mo" },
  "interval.years": { zh: "{count}\u5E74", en: "{count}y" },
  "home.due": { zh: "\u5F85\u590D\u4E60 {count}", en: "Due {count}" },
  "home.new": { zh: "\u65B0\u8BCD {count}", en: "New {count}" },
  "home.total": { zh: "\u603B\u8BA1 {count}", en: "Total {count}" },
  "home.start": { zh: "\u5F00\u59CB\u590D\u4E60", en: "Start review" },
  "home.collection": { zh: "\u96C6\u5408", en: "Collection" },
  "home.reviewScope": { zh: "\u8303\u56F4", en: "Scope" },
  "home.scopeVocab": { zh: "Lexis \u8BCD\u5178", en: "Lexis dictionaries" },
  "home.scopeFolder": { zh: "\u6587\u4EF6\u5939", en: "Folder" },
  "home.scopeTag": { zh: "\u6807\u7B7E", en: "Tag" },
  "home.scopeCurrent": { zh: "\u5F53\u524D\u7B14\u8BB0", en: "Current note" },
  "home.scopeAllFiles": { zh: "\u6574\u4E2A\u4ED3\u5E93", en: "Whole vault" },
  "home.reviewFolder": { zh: "\u590D\u4E60\u6587\u4EF6\u5939", en: "Review folder" },
  "home.reviewTag": { zh: "\u590D\u4E60\u6807\u7B7E", en: "Review tag" },
  "home.chooseTag": { zh: "\u9009\u62E9\u6807\u7B7E", en: "Choose a tag" },
  "home.currentNote": { zh: "\u5F53\u524D\u7B14\u8BB0", en: "Current note" },
  "home.noCurrentNote": { zh: "\u6CA1\u6709\u6253\u5F00 Markdown \u7B14\u8BB0", en: "No Markdown note is open" },
  "home.reviewContent": { zh: "\u5185\u5BB9", en: "Content" },
  "home.contentNotes": { zh: "\u7B14\u8BB0", en: "Notes" },
  "home.contentSyntax": { zh: "\u8BED\u6CD5\u5361", en: "Syntax cards" },
  "home.contentBoth": { zh: "\u4E24\u8005", en: "Both" },
  "home.clozeMode": { zh: "\u591A\u4E2A\u6316\u7A7A", en: "Multiple clozes" },
  "home.clozeSeparate": { zh: "\u9010\u4E2A", en: "Separate" },
  "home.clozeCombined": { zh: "\u5408\u5E76", en: "Combined" },
  "home.sortBy": { zh: "\u6392\u5E8F\u4F9D\u636E", en: "Sort by" },
  "home.sortDirection": { zh: "\u6392\u5E8F\u65B9\u5411", en: "Direction" },
  "home.sortDue": { zh: "\u5230\u671F\u65E5", en: "Due date" },
  "home.sortWordCount": { zh: "\u5B57\u6570", en: "Word count" },
  "home.sortModified": { zh: "\u4FEE\u6539\u65F6\u95F4", en: "Modified time" },
  "home.sortCreated": { zh: "\u521B\u5EFA\u65F6\u95F4", en: "Created time" },
  "home.ascending": { zh: "\u5347\u5E8F", en: "Ascending" },
  "home.descending": { zh: "\u964D\u5E8F", en: "Descending" },
  "home.frequency": { zh: "\u8BCD\u9891", en: "Frequency" },
  "home.random": { zh: "\u968F\u673A", en: "Random" },
  "home.open": { zh: "\u6253\u5F00\u4E3B\u9875", en: "Open home" },
  "home.openTitle": { zh: "\u70B9\u51FB\u6253\u5F00 Lexis \u4E3B\u9875", en: "Open Lexis home" },
  "home.retire": { zh: "\u6DD8\u6C70\u5019\u9009", en: "Retirement candidates" },
  "home.retireThreshold": { zh: "\u5165\u5E93/\u672A\u76F8\u9047\u5929\u6570\u9608\u503C", en: "Added / unseen threshold" },
  "home.retireThresholdDesc": { zh: "\u4E24\u9879\u5747\u8FBE\u5230\u6B64\u5929\u6570\u624D\u5165\u5217\u3002", en: "Both ages must reach this value." },
  "home.calculating": { zh: "\u8BA1\u7B97\u4E2D\u2026", en: "Calculating\u2026" },
  "home.noCandidates": { zh: "\u6682\u65E0\u5019\u9009", en: "No candidates" },
  "home.candidateMeta": { zh: "\u5165\u5E93 {created} \xB7 \u76F8\u9047 {encounters} \u6B21\uFF08\u60AC\u505C {hovers}\uFF09\xB7 \u51FA\u5904 {occurrences} \u6761 \xB7 \u672A\u76F8\u9047 {days} \u5929", en: "Added {created} \xB7 {encounters} encounters ({hovers} hovers) \xB7 {occurrences} occurrences \xB7 unseen for {days} days" },
  "home.evict": { zh: "\u6DD8\u6C70", en: "Retire" },
  "home.keep": { zh: "\u7559\u4E0B", en: "Keep" },
  "home.mastered": { zh: "\u5DF2\u638C\u63E1", en: "Mastered" },
  "home.bulkEvict": { zh: "\u6279\u91CF\u6DD8\u6C70", en: "Retire selected" },
  "home.bulkKeep": { zh: "\u6279\u91CF\u7559\u4E0B", en: "Keep selected" },
  "home.bulkMastered": { zh: "\u6279\u91CF\u5DF2\u638C\u63E1", en: "Master selected" },
  "home.heatmapCaption": { zh: "\u8FD1 {weeks} \u5468 \xB7 \u5171 {count} \u6B21\u590D\u4E60", en: "Last {weeks} weeks \xB7 {count} reviews" },
  "home.heatmapDay": { zh: "{date}\uFF1A{count} \u6B21", en: "{date}: {count} reviews" },
  "popover.addOccurrence": { zh: "\u6536\u85CF\u5230\u51FA\u5904", en: "Save as occurrence" },
  "popover.addCurrentOccurrence": { zh: "+ \u51FA\u5904", en: "+ Source" },
  "popover.addCurrentOccurrenceTitle": { zh: "\u628A\u5F53\u524D\u53E5\u5B50\u6536\u85CF\u5230\u51FA\u5904", en: "Save the current sentence as a source" },
  "popover.occurrences": { zh: "\u51FA\u73B0\u8FC7\u7684\u5730\u65B9 ({count})", en: "Occurrences ({count})" },
  "popover.noOccurrences": { zh: "\u6CA1\u6709\u672A\u6536\u85CF\u7684\u65B0\u51FA\u5904", en: "No new unsaved occurrences" },
  "popover.addNote": { zh: "\u6DFB\u52A0\u6279\u6CE8", en: "Add note" },
  "popover.addImage": { zh: "\u6DFB\u52A0\u56FE\u7247", en: "Add image" },
  "popover.notePlaceholder": { zh: "\u5199\u6279\u6CE8\uFF0C\u56DE\u8F66\u4FDD\u5B58\uFF0CEsc \u53D6\u6D88", en: "Write a note; Enter to save, Esc to cancel" },
  "popover.deleteEntry": { zh: "\u4ECE\u8BCD\u5E93\u4E2D\u5220\u9664", en: "Delete from dictionary" },
  "popover.deleteConfirm": { zh: "\u5220\u9664\u300C{word}\u300D\uFF1F", en: "Delete \u201C{word}\u201D?" },
  "popover.deleteTag": { zh: "\u5220\u9664\u6807\u7B7E", en: "Remove tag" },
  "popover.addTag": { zh: "+ \u6807\u7B7E", en: "+ Tag" },
  "popover.archive": { zh: "\u5F52\u6863", en: "Archive" },
  "popover.restore": { zh: "\u6062\u590D", en: "Restore" },
  "popover.archiveTitle": { zh: "\u9000\u51FA\u9AD8\u4EAE\u548C\u590D\u4E60\uFF1B\u4ECD\u53EF\u60AC\u505C\u67E5\u770B", en: "Stop highlighting and review; hover remains available" },
  "popover.restoreTitle": { zh: "\u91CD\u65B0\u52A0\u5165\u9AD8\u4EAE\u548C\u590D\u4E60", en: "Return to highlighting and review" },
  "popover.moveDictionary": { zh: "\u70B9\u51FB\u79FB\u5230\u5176\u4ED6\u8BCD\u5178", en: "Move to another dictionary" },
  "popover.readFailed": { zh: "\u8BFB\u53D6\u5931\u8D25\uFF1A{error}", en: "Failed to read: {error}" },
  "popover.resize": { zh: "\u62D6\u52A8\u8C03\u6574\u5361\u7247\u5927\u5C0F", en: "Drag to resize card" },
  "selection.openExisting": { zh: "\u5DF2\u6709\uFF0C\u6253\u5F00", en: "Open existing" },
  "selection.add": { zh: "\u52A0\u5165\u8BCD\u5E93", en: "Add to dictionary" },
  "selection.chooseDictionary": { zh: "\u9009\u62E9\u8BCD\u5178", en: "Choose dictionary" },
  "selection.alias": { zh: "\u8BBE\u4E3A\u522B\u540D", en: "Add as alias" },
  "selection.aliasPrompt": { zh: "\u628A\u300C{alias}\u300D\u8BBE\u4E3A\u8C01\u7684\u522B\u540D", en: "Choose the entry for alias \u201C{alias}\u201D" },
  "selection.aliasItem": { zh: "{alias} \u2014\u300C{word}\u300D\u7684\u522B\u540D", en: "{alias} \u2014 alias of \u201C{word}\u201D" },
  "restore.title": { zh: "\u6062\u590D\u300C{word}\u300D", en: "Restore \u201C{word}\u201D" },
  "restore.question": { zh: "\u4FDD\u7559\u539F\u6709\u590D\u4E60\u8FDB\u5EA6\uFF0C\u8FD8\u662F\u91CD\u7F6E\u4E3A\u65B0\u8BCD\uFF1F", en: "Keep its review history or reset it as new?" },
  "restore.keep": { zh: "\u4FDD\u7559\u8FDB\u5EA6", en: "Keep progress" },
  "restore.reset": { zh: "\u91CD\u7F6E\u4E3A\u65B0\u8BCD", en: "Reset as new" },
  "restore.kept": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u6062\u590D\u5E76\u4FDD\u7559\u8FDB\u5EA6", en: "Lexis: restored \u201C{word}\u201D with its progress" },
  "restore.resetDone": { zh: "Lexis\uFF1A\u300C{word}\u300D\u5DF2\u6062\u590D\u4E3A\u65B0\u8BCD", en: "Lexis: restored \u201C{word}\u201D as new" },
  "settings.title": { zh: "Lexis \u8BBE\u7F6E", en: "Lexis settings" },
  "settings.dictionary": { zh: "\u8BCD\u5178\u4E0E\u8BCD\u5E93\u6765\u6E90", en: "Dictionaries and sources" },
  "settings.dictionaryDesc": { zh: "\u6BCF\u884C\u4E00\u4E2A\u8BCD\u5178\uFF1B\u65B0\u8BCD\u9ED8\u8BA4\u8FDB\u5165\u7B2C\u4E00\u884C\u3002", en: "One dictionary per row; new entries go to the first." },
  "settings.folderPlaceholder": { zh: "\u6587\u4EF6\u5939\uFF0C\u5982 01-word", en: "Folder, e.g. 01-word" },
  "settings.templatePlaceholder": { zh: "\u6A21\u677F\u8DEF\u5F84\uFF1B\u7559\u7A7A\u4E3A\u767D\u7EB8", en: "Template path; blank for an empty note" },
  "settings.templaterTemplate": { zh: "\u7531 Templater \u6587\u4EF6\u5939\u6A21\u677F\u63A5\u7BA1\uFF1A{path}", en: "Managed by the Templater folder template: {path}" },
  "settings.followGlobal": { zh: "\u8DDF\u968F\u5168\u5C40\u989C\u8272", en: "Use global color" },
  "settings.dictionaryColor": { zh: "\u8BCD\u5178\u989C\u8272", en: "Dictionary color" },
  "settings.dictionaryAppearance": { zh: "\u8BCD\u5178\u9AD8\u4EAE\u5916\u89C2", en: "Dictionary highlight appearance" },
  "settings.showDictionaryHighlight": { zh: "\u663E\u793A\u8FD9\u4E2A\u8BCD\u5178\u7684\u9AD8\u4EAE", en: "Show highlights for this dictionary" },
  "settings.resetGlobal": { zh: "\u6062\u590D\u5168\u5C40\u989C\u8272", en: "Reset to global color" },
  "settings.deleteDictionary": { zh: "\u5220\u9664\u8FD9\u4E2A\u8BCD\u5178", en: "Delete this dictionary" },
  "settings.addDictionary": { zh: "+ \u6DFB\u52A0\u8BCD\u5178", en: "+ Add dictionary" },
  "settings.reorder": { zh: "\u957F\u6309\u5E76\u62D6\u52A8\u6392\u5E8F", en: "Press and drag to reorder" },
  "settings.tagsAsEntries": { zh: "\u6309\u6807\u7B7E\u6536\u5F55", en: "Include by tag" },
  "settings.tagsAsEntriesDesc": { zh: "\u4E0E\u8BCD\u5178\u6587\u4EF6\u5939\u53D6\u5E76\u96C6\u3002", en: "Combined with dictionary folders." },
  "settings.includeAliases": { zh: "\u522B\u540D\u4E5F\u7B97\u8BCD\u6761", en: "Include aliases" },
  "settings.aliasProperties": { zh: "\u522B\u540D\u5C5E\u6027\u540D", en: "Alias properties" },
  "settings.aliasPropertiesDesc": { zh: "\u9664 aliases/alias \u5916\u7684\u5C5E\u6027\uFF0C\u9017\u53F7\u5206\u9694\u3002", en: "Additional properties beyond aliases/alias, comma-separated." },
  "settings.inline": { zh: "\u5185\u8054\u6761\u76EE\u5E93", en: "Inline entries" },
  "settings.inlineDesc": { zh: "\u8F7B\u91CF\u8BCD\u6761\uFF0C\u4E0D\u53C2\u4E0E\u590D\u4E60", en: "Lightweight entries, excluded from review" },
  "settings.enableInline": { zh: "\u542F\u7528\u5185\u8054\u6761\u76EE", en: "Enable inline entries" },
  "settings.enableInlineDesc": { zh: "\u7B14\u8BB0\u9700\u8BBE\u7F6E lexis-inline: true \u6216 #lexis-inline\u3002", en: "Notes require lexis-inline: true or #lexis-inline." },
  "settings.inlineDelimiter": { zh: "\u5185\u8054\u6761\u76EE\u5206\u9694\u7B26", en: "Inline delimiter" },
  "settings.inlineDelimiterDesc": { zh: "\u683C\u5F0F\uFF1A\u8BCD\u6761::\u6279\u6CE8\u3002", en: "Format: entry:: annotation." },
  "settings.noInlineCategories": { zh: "\u6682\u65E0\u5185\u8054\u5206\u7C7B\u3002", en: "No inline categories." },
  "settings.entryCount": { zh: "{count} \u6761", en: "{count} entries" },
  "settings.showHighlight": { zh: "\u663E\u793A\u9AD8\u4EAE\uFF1B\u5173\u95ED\u540E\u4ECD\u53EF\u60AC\u505C", en: "Show highlight; hover remains available when off" },
  "settings.showGroupHighlight": { zh: "\u542F\u7528\u8FD9\u4E00\u7EC4\uFF1B\u5173\u95ED\u540E\u5B50\u9879\u4E0D\u751F\u6548", en: "Enable this group; child rules are inactive when off" },
  "settings.showSubsetHighlight": { zh: "\u542F\u7528\u8FD9\u4E2A\u5B50\u96C6", en: "Enable this subset" },
  "settings.resetInlineStyle": { zh: "\u6062\u590D\u5168\u5C40\u989C\u8272\u548C\u900F\u660E\u5EA6", en: "Reset global color and opacity" },
  "settings.categoryAppearance": { zh: "\u201C{name}\u201D\u7684\u9AD8\u4EAE\u5916\u89C2", en: "Highlight appearance for \u201C{name}\u201D" },
  "settings.inlineClassification": { zh: "\u5206\u7C7B\u65B9\u5F0F", en: "Group by" },
  "settings.inlineClassificationDesc": { zh: "\u6700\u8FD1\u6807\u9898\u5171\u4EAB\u6807\u9898\u989C\u8272\uFF1B\u6309\u6587\u4EF6\u5219\u6574\u4EFD\u6587\u4EF6\u5171\u4EAB\u989C\u8272\u3002", en: "Matching nearest headings share a color, or use one color per source file." },
  "settings.classifyByHeading": { zh: "\u6700\u8FD1\u6807\u9898", en: "Nearest heading" },
  "settings.classifyByFile": { zh: "\u6587\u4EF6", en: "File" },
  "settings.colorByHeading": { zh: "\u6309\u6807\u9898\u5206\u7C7B\u7740\u8272", en: "Color by heading" },
  "settings.colorByHeadingDesc": { zh: "\u5D4C\u5957\u6807\u9898\u7EE7\u627F\u4E0A\u7EA7\u3002", en: "Nested headings inherit from parents." },
  "settings.refreshCategories": { zh: "\u5237\u65B0\u5206\u7C7B", en: "Refresh categories" },
  "settings.highlight": { zh: "\u9AD8\u4EAE\u5916\u89C2", en: "Highlights" },
  "settings.enableHighlight": { zh: "\u542F\u7528\u9AD8\u4EAE", en: "Enable highlights" },
  "settings.livePreview": { zh: "\u5B9E\u65F6\u9884\u89C8\u4E5F\u9AD8\u4EAE", en: "Highlight in Live Preview" },
  "settings.unsupported": { zh: "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u3002", en: "Not supported in this environment." },
  "settings.selectionPill": { zh: "\u5212\u8BCD\u663E\u793A\u300C\u52A0\u5165\u8BCD\u5E93\u300D", en: "Show Add to Lexis on selection" },
  "settings.pdfHighlight": { zh: "PDF \u91CC\u4E5F\u9AD8\u4EAE", en: "Highlight in PDFs" },
  "settings.pdfHighlightDesc": { zh: "\u626B\u63CF\u7248 PDF \u4E0D\u652F\u6301\u3002", en: "Scanned PDFs are not supported." },
  "settings.highlightStyle": { zh: "\u9ED8\u8BA4\u9AD8\u4EAE\u7EBF\u578B", en: "Default highlight style" },
  "settings.wavy": { zh: "\u6CE2\u6D6A\u4E0B\u5212\u7EBF", en: "Wavy underline" },
  "settings.underline": { zh: "\u5B9E\u7EBF\u4E0B\u5212\u7EBF", en: "Underline" },
  "settings.background": { zh: "\u80CC\u666F\u8272", en: "Background" },
  "settings.highlightColor": { zh: "\u9ED8\u8BA4\u9AD8\u4EAE\u989C\u8272", en: "Default highlight color" },
  "settings.resetTheme": { zh: "\u6062\u590D\u4E3B\u9898\u8272", en: "Reset to theme color" },
  "settings.opacity": { zh: "\u900F\u660E\u5EA6", en: "Opacity" },
  "settings.fade": { zh: "\u6309\u8BB0\u5FC6\u5F3A\u5EA6\u6E10\u9690", en: "Fade with memory strength" },
  "settings.fadeDesc": { zh: "\u6700\u7EC8\u900F\u660E\u5EA6 = \u57FA\u7840\u900F\u660E\u5EA6 \xD7 [1 - S/(S+20) \xD7 (1-\u6E10\u9690\u4E0B\u9650)]\u3002S \u4E3A FSRS \u7A33\u5B9A\u5EA6\uFF1B\u65B0\u8BCD\u4FDD\u6301\u57FA\u7840\u900F\u660E\u5EA6\u3002", en: "Final opacity = base opacity \xD7 [1 - S/(S+20) \xD7 (1-fade floor)]. S is FSRS stability; new entries keep the base opacity." },
  "settings.fadeFloor": { zh: "\u6700\u4F4E\u900F\u660E\u5EA6", en: "Minimum opacity" },
  "settings.tagColors": { zh: "\u6309\u6807\u7B7E\u7740\u8272", en: "Color by tag" },
  "settings.tagPlaceholder": { zh: "\u6807\u7B7E", en: "Tag" },
  "settings.addTagRule": { zh: "+ \u6DFB\u52A0\u6807\u7B7E\u89C4\u5219", en: "+ Add tag rule" },
  "settings.tagAppearance": { zh: "\u6807\u7B7E\u89C4\u5219\u5916\u89C2", en: "Tag rule appearance" },
  "settings.resetAppearance": { zh: "\u8DDF\u968F\u5168\u5C40", en: "Use global appearance" },
  "settings.popover": { zh: "\u60AC\u6D6E\u5361", en: "Hover card" },
  "settings.popoverPreview": { zh: "\u60AC\u6D6E\u5361\u9884\u89C8", en: "Hover card preview" },
  "settings.popoverFont": { zh: "\u5361\u7247\u5B57\u53F7", en: "Card font size" },
  "settings.hoverDelay": { zh: "\u60AC\u6D6E\u5EF6\u8FDF", en: "Hover delay" },
  "settings.hoverDelayDesc": { zh: "0 \u4E3A\u7ACB\u5373\u663E\u793A\u3002", en: "0 shows the card immediately." },
  "settings.showRelated": { zh: "\u663E\u793A\u76F8\u5173\u8BCD", en: "Show related entries" },
  "settings.showOccurrences": { zh: "\u663E\u793A\u300C\u51FA\u73B0\u8FC7\u7684\u5730\u65B9\u300D", en: "Show occurrences" },
  "settings.showOccurrencesDesc": { zh: "\u5168\u6587\u641C\u7D22\uFF0C\u65E0\u9700\u53CC\u94FE\u3002", en: "Full-text search; links are not required." },
  "settings.pdfOccurrences": { zh: "PDF \u4E5F\u4F5C\u4E3A\u51FA\u5904", en: "Include PDFs as occurrences" },
  "settings.pdfOccurrencesDesc": { zh: "\u4EC5\u652F\u6301\u80FD\u590D\u5236\u6587\u5B57\u7684 PDF\u3002", en: "Only PDFs with selectable text are supported." },
  "settings.occurrenceLimit": { zh: "\u51FA\u5904\u6570\u91CF\u4E0A\u9650", en: "Occurrence limit" },
  "settings.occurrenceScope": { zh: "\u51FA\u5904\u641C\u7D22\u8303\u56F4", en: "Occurrence search scope" },
  "settings.occurrenceScopeDesc": { zh: "\u9017\u53F7\u5206\u9694\uFF1B\u7559\u7A7A\u4E3A\u5168\u5E93\u3002", en: "Comma-separated; blank searches the whole vault." },
  "settings.wholeVault": { zh: "\u7559\u7A7A=\u5168\u5E93", en: "Blank = whole vault" },
  "settings.selectionAdd": { zh: "\u5212\u8BCD\u6DFB\u52A0", en: "Add from selection" },
  "settings.emptyNotePreset": { zh: "\u65E0\u6A21\u677F\u65F6", en: "When no template is selected" },
  "settings.emptyNotePresetDesc": { zh: "\u4EC5\u7528\u4E8E\u6CA1\u6709\u9009\u62E9\u6A21\u677F\u6587\u4EF6\u7684\u8BCD\u5178\u3002", en: "Used only for dictionaries without a template file." },
  "settings.emptyNoteBlank": { zh: "\u7EAF\u7A7A\u767D", en: "Blank note" },
  "settings.emptyNoteOccurrences": { zh: "\u672B\u5C3E\u663E\u793A\u51FA\u5904\u9762\u677F", en: "Show occurrences panel at the end" },
  "settings.defaultTemplate": { zh: "\u9ED8\u8BA4\u6A21\u677F", en: "Default template" },
  "settings.defaultTemplateDesc": { zh: "\u4EC5\u7528\u4E8E\u672A\u5339\u914D\u8BCD\u5178\u65F6\uFF1B\u652F\u6301 {{word}}\u3001{{date}}\u3002", en: "Used only when no dictionary matches; supports {{word}} and {{date}}." },
  "settings.occurrenceTemplate": { zh: "\u81EA\u52A8\u51FA\u5904\u683C\u5F0F", en: "Automatic source format" },
  "settings.occurrenceTemplateDesc": { zh: "\u9996\u884C\u53EF\u5199 Markdown \u6807\u9898\uFF0C\u5176\u4F59\u5185\u5BB9\u6309\u6BCF\u6761\u51FA\u5904\u91CD\u590D\u3002\u652F\u6301 {{word}}\u3001{{sentence}}\u3001{{source}}\u3001{{sourceSuffix}}\u3001{{date}}\uFF1B\u7559\u7A7A\u4E0D\u5199\u51FA\u5904\u3002", en: "The first line may be a Markdown heading; the remaining lines repeat for each source. Supports {{word}}, {{sentence}}, {{source}}, {{sourceSuffix}}, and {{date}}. Leave blank to omit sources." },
  "settings.review": { zh: "\u590D\u4E60 (FSRS)", en: "Review (FSRS)" },
  "settings.flashcardInline": { zh: "\u884C\u5185\u95EE\u7B54\u8BED\u6CD5", en: "Inline Q&A syntax" },
  "settings.flashcardBidirectional": { zh: "\u53CC\u5411\u95EE\u7B54\u8BED\u6CD5", en: "Bidirectional Q&A syntax" },
  "settings.flashcardBlock": { zh: "\u5757\u7EA7\u95EE\u7B54\u8BED\u6CD5", en: "Block Q&A syntax" },
  "settings.flashcardCloze": { zh: "\u884C\u5185\u6316\u7A7A\u8BED\u6CD5", en: "Inline cloze syntax" },
  "settings.flashcardTemplateDesc": { zh: "\u4FDD\u7559\u53D8\u91CF\uFF1B\u7559\u7A7A\u5173\u95ED\u3002", en: "Keep the variables; leave blank to disable." },
  "settings.resetTemplate": { zh: "\u6062\u590D\u9ED8\u8BA4\u8BED\u6CD5", en: "Reset syntax" },
  "settings.retention": { zh: "\u76EE\u6807\u8BB0\u5FC6\u4FDD\u7559\u7387", en: "Desired retention" },
  "settings.retentionDesc": { zh: "\u8D8A\u9AD8\uFF0C\u590D\u4E60\u8D8A\u9891\u7E41\u3002", en: "Higher values schedule more reviews." },
  "settings.newLimit": { zh: "\u6BCF\u5929\u65B0\u8BCD\u4E0A\u9650", en: "New entries per day" },
  "settings.sessionLimit": { zh: "\u6BCF\u8F6E\u6700\u591A\u590D\u4E60", en: "Reviews per session" },
  "settings.cardFront": { zh: "\u5361\u7247\u6B63\u9762", en: "Card front" },
  "settings.cardFrontDesc": { zh: "\u586B\u7A7A\u9700\u6709\u51FA\u5904\uFF0C\u5426\u5219\u663E\u793A\u5355\u8BCD\u3002", en: "Cloze requires an occurrence; otherwise the entry is shown." },
  "settings.noteCard": { zh: "\u8BCD\u6761 \u2192 \u6574\u7BC7", en: "Entry \u2192 note" },
  "settings.clozeCard": { zh: "\u51FA\u5904\u586B\u7A7A", en: "Occurrence cloze" },
  "settings.showReviewMetadata": { zh: "\u663E\u793A\u590D\u4E60\u5185\u90E8\u72B6\u6001", en: "Show internal review state" },
  "settings.showReviewMetadataDesc": { zh: "\u9ED8\u8BA4\u5728\u5C5E\u6027\u9762\u677F\u9690\u85CF\uFF0C\u6570\u636E\u4ECD\u4FDD\u5B58\u5728\u7B14\u8BB0\u4E2D\u3002", en: "Hidden from Properties by default; the data remains in the note." },
  "settings.ratingOffset": { zh: "\u79FB\u52A8\u7AEF\u8BC4\u5206\u680F\u5E95\u90E8\u4F4D\u7F6E", en: "Mobile rating bar position" },
  "settings.ratingOffsetDesc": { zh: "\u81EA\u52A8\u907F\u5F00\u5E95\u90E8\u5DE5\u5177\u680F\uFF1B\u4ECD\u88AB\u6321\u4F4F\u65F6\u8C03\u5927\u3002", en: "Avoids the bottom toolbar automatically. Increase it if the bar is still covered." },
  "settings.openReview": { zh: "\u6253\u5F00\u590D\u4E60", en: "Open review" },
  "settings.hoverFeedback": { zh: "\u60AC\u505C\u56DE\u6D41", en: "Hover feedback" },
  "settings.hoverFeedbackDesc": { zh: "\u628A\u8F83\u8FDC\u7684\u5230\u671F\u65E5\u63D0\u524D\u5230\u4ECA\u5929\uFF0C\u4E0D\u8BA1\u4F5C\u590D\u4E60\u3002", en: "Pulls distant due dates to today without recording a review." },
  "settings.feedbackDays": { zh: "\u56DE\u6D41\u9608\u503C\uFF08\u5929\uFF09", en: "Feedback threshold (days)" },
  "settings.feedbackDaysDesc": { zh: "\u5230\u671F\u65E5\u8D85\u8FC7\u6B64\u5929\u6570\u624D\u63D0\u524D\u3002", en: "Only later due dates are pulled forward." },
  "settings.retireDays": { zh: "\u6DD8\u6C70\u5019\u9009\u9608\u503C\uFF08\u5929\uFF09", en: "Retirement threshold (days)" },
  "settings.retireDaysDesc": { zh: "\u5165\u5E93\u4E0E\u672A\u76F8\u9047\u5747\u8FBE\u5230\u6B64\u5929\u6570\u3002", en: "Both added and unseen ages must reach this value." },
  "settings.bridge": { zh: "\u672C\u673A\u6865\u63A5", en: "Local bridge" },
  "settings.bridgeDesc": { zh: "\u4F9B\u6D4F\u89C8\u5668\u4E0E Zotero \u8FDE\u63A5", en: "Connects the browser and Zotero companions" },
  "settings.excludeTags": { zh: "\u4E0D\u9AD8\u4EAE\u7684\u6807\u7B7E", en: "Tags hidden from highlights" },
  "settings.excludeTagsDesc": { zh: "\u4ECD\u53C2\u4E0E\u590D\u4E60\uFF0C\u53EA\u5173\u95ED Obsidian\u3001\u6D4F\u89C8\u5668\u548C Zotero \u9AD8\u4EAE\u3002", en: "Entries remain in review; only Obsidian, browser, and Zotero highlights are hidden." },
  "settings.addExcludedTag": { zh: "\u8F93\u5165\u6807\u7B7E\u540E\u56DE\u8F66", en: "Type a tag and press Enter" },
  "settings.removeExcludedTag": { zh: "\u79FB\u9664 #{tag}", en: "Remove #{tag}" },
  "settings.annotationHeading": { zh: "\u6279\u6CE8\u5C0F\u8282\u6807\u9898", en: "Annotation heading" },
  "settings.annotationHeadingDesc": { zh: "\u652F\u6301\u201C\u6279\u6CE8\u201D\u6216\u201C## \u5F15\u7528\u201D\uFF1B\u7559\u7A7A\u4E3A\u201C#### \u6279\u6CE8\u201D\u3002", en: "Use plain text or a Markdown heading; blank uses \u201C#### \u6279\u6CE8\u201D." },
  "settings.annotationImageLocation": { zh: "\u6279\u6CE8\u56FE\u7247\u4F4D\u7F6E", en: "Annotation image location" },
  "settings.annotationImageLocationDesc": { zh: "\u8DDF\u968F Obsidian\uFF0C\u6216\u5355\u72EC\u6307\u5B9A\u6587\u4EF6\u5939\u3002", en: "Follow Obsidian or use a dedicated folder." },
  "settings.annotationImageObsidian": { zh: "\u8DDF\u968F Obsidian", en: "Follow Obsidian" },
  "settings.annotationImageCustom": { zh: "\u81EA\u5B9A\u4E49\u6587\u4EF6\u5939", en: "Custom folder" },
  "settings.annotationImageFolder": { zh: "\u6279\u6CE8\u56FE\u7247\u6587\u4EF6\u5939", en: "Annotation image folder" },
  "settings.annotationImageFolderDesc": { zh: "\u4EC5\u5728\u9009\u62E9\u81EA\u5B9A\u4E49\u4F4D\u7F6E\u65F6\u4F7F\u7528\u3002", en: "Used only for the custom location." },
  "settings.enableBridge": { zh: "\u542F\u7528\u672C\u673A\u6865\u63A5", en: "Enable local bridge" },
  "settings.port": { zh: "\u7AEF\u53E3", en: "Port" },
  "settings.portDesc": { zh: "\u4FEE\u6539\u540E\u70B9\u53F3\u4FA7\u91CD\u542F\u3002", en: "Restart the bridge after changing it." },
  "settings.restartBridge": { zh: "\u91CD\u542F\u6865\u63A5", en: "Restart bridge" },
  "settings.token": { zh: "\u8BBF\u95EE\u4EE4\u724C", en: "Access token" },
  "settings.tokenDesc": { zh: "\u6D4F\u89C8\u5668\u4E0E Zotero \u4F7F\u7528\u3002", en: "Used by the browser and Zotero companions." },
  "settings.tokenPending": { zh: "\uFF08\u542F\u7528\u540E\u751F\u6210\uFF09", en: "(generated when enabled)" },
  "settings.copyToken": { zh: "\u590D\u5236\u4EE4\u724C", en: "Copy token" },
  "settings.regenerateToken": { zh: "\u91CD\u65B0\u751F\u6210\uFF08\u4F34\u4FA3\u7AEF\u9700\u91CD\u586B\uFF09", en: "Regenerate (update companion apps)" },
  "settings.rebuild": { zh: "\u91CD\u5EFA\u7D22\u5F15", en: "Rebuild index" },
  "settings.rebuildNow": { zh: "\u7ACB\u5373\u91CD\u5EFA", en: "Rebuild now" },
  "settings.stats": { zh: "\u7D22\u5F15\uFF1A{words} \u8BCD\u6761 \xB7 {aliases} \u522B\u540D \xB7 {inline} \u5185\u8054 \xB7 {due} \u5F85\u590D\u4E60", en: "Index: {words} entries \xB7 {aliases} aliases \xB7 {inline} inline \xB7 {due} due" }
};
function createI18n(getLanguage) {
  const language = () => getLanguage() === "en" ? "en" : "zh";
  const t = (key, vars = {}) => {
    const pair = MESSAGES[key];
    let text = pair ? pair[language()] || pair.zh || key : key;
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  };
  return { t, language };
}

// src/curve.ts
function buildCurveSVG(card, { requestRetention, nextInterval, retrievability, addDaysStr, daysBetween: daysBetween2, todayStr }) {
  const currentS = Number(card.s);
  if (!currentS || isNaN(currentS)) return null;
  const eventsByDate = /* @__PURE__ */ new Map();
  for (const raw of Array.isArray(card.history) ? card.history : []) {
    const date = String(raw?.date || "").slice(0, 10);
    const s = Number(raw?.s);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !s || isNaN(s)) continue;
    eventsByDate.set(date, { date, s, retention: Number(raw.retention) });
  }
  const lastDate = String(card.last || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) {
    const saved = eventsByDate.get(lastDate);
    eventsByDate.set(lastDate, { date: lastDate, s: currentS, retention: saved?.retention });
  }
  const events = [...eventsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!events.length) return null;
  const targetRetention = requestRetention || 0.9;
  const startDate = events[0].date;
  const fallbackDue = addDaysStr(events[events.length - 1].date, nextInterval(events[events.length - 1].s, targetRetention));
  const endDate = [String(card.due || "").slice(0, 10), todayStr(), fallbackDue, events[events.length - 1].date].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().pop();
  const totalDays = Math.max(1, daysBetween2(startDate, endDate));
  const H = 122, left = 34, right = 12, top = 8, bottom = 26;
  const W = Math.max(300, Math.min(1800, Math.max(totalDays * 12 + left + right, events.length * 64 + left + right)));
  const plotW = W - left - right, plotH = H - top - bottom;
  const xDay = (day) => left + plotW * Math.max(0, Math.min(totalDays, day)) / totalDays;
  const xDate = (date) => xDay(daysBetween2(startDate, date));
  const y = (retention) => top + plotH * (1 - Math.max(0, Math.min(1, retention)));
  let path = "";
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventX = xDate(event.date);
    const before = Number.isFinite(event.retention) ? event.retention / 100 : 1;
    if (!path) path = `M${eventX.toFixed(1)} ${y(before).toFixed(1)} L${eventX.toFixed(1)} ${y(1).toFixed(1)}`;
    else path += ` L${eventX.toFixed(1)} ${y(1).toFixed(1)}`;
    const segmentEnd = i + 1 < events.length ? events[i + 1].date : endDate;
    const segmentDays = Math.max(0, daysBetween2(event.date, segmentEnd));
    const samples = Math.max(2, Math.min(48, segmentDays * 2));
    for (let sample = 1; sample <= samples; sample++) {
      const elapsed = segmentDays * sample / samples;
      const xx = xDay(daysBetween2(startDate, event.date) + elapsed);
      const retention = retrievability(elapsed, event.s);
      path += ` L${xx.toFixed(1)} ${y(retention).toFixed(1)}`;
    }
  }
  const grid = [1, 0.5, 0].map((retention) => {
    const yy = y(retention).toFixed(1);
    return `<line x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}" stroke="var(--background-modifier-border)" stroke-width="1"/><text x="${left - 5}" y="${(+yy + 3.5).toFixed(1)}" text-anchor="end" fill="var(--text-muted)" font-size="9">${Math.round(retention * 100)}%</text>`;
  }).join("");
  const targetY = y(targetRetention).toFixed(1);
  let lastLabelX = -Infinity;
  const reviewMarks = events.map((event) => {
    const xx = xDate(event.date);
    const before = Number.isFinite(event.retention) ? event.retention / 100 : null;
    const point = before == null ? "" : `<circle cx="${xx.toFixed(1)}" cy="${y(before).toFixed(1)}" r="2.5" fill="var(--text-accent)"/>`;
    const label = xx - lastLabelX < 42 ? "" : `<text x="${xx.toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--text-muted)" font-size="9">${event.date.slice(5)}</text>`;
    if (label) lastLabelX = xx;
    return `<line x1="${xx.toFixed(1)}" y1="${top}" x2="${xx.toFixed(1)}" y2="${H - bottom}" stroke="var(--text-faint)" stroke-width="1" stroke-dasharray="2 3"/>${point}${label}`;
  }).join("");
  const today = todayStr();
  const latest = [...events].reverse().find((event) => event.date <= today) || events[0];
  const todayRetention = retrievability(Math.max(0, daysBetween2(latest.date, today)), latest.s);
  const todayX = xDate(today);
  const todayPoint = today >= startDate && today <= endDate ? `<circle cx="${todayX.toFixed(1)}" cy="${y(todayRetention).toFixed(1)}" r="3" fill="var(--interactive-accent)"/>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` + grid + `<line x1="${left}" y1="${targetY}" x2="${W - right}" y2="${targetY}" stroke="var(--text-faint)" stroke-dasharray="3 3" stroke-width="1"/><path d="${path}" fill="none" stroke="var(--interactive-accent)" stroke-width="2"/>` + reviewMarks + todayPoint + `</svg>`;
}

// src/review-view.ts
var import_obsidian3 = require("obsidian");
var errorMessage = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
var createReviewView = ({ reviewViewType, todayStr, renderLexisMarkdown: renderLexisMarkdown2 }) => class LexisReviewView extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.currentItem = null;
    this.backEl = null;
    this.showBtn = null;
    this.rateBar = null;
    this._comp = null;
    this._frontComp = null;
    this._imagePreview = null;
    this.plugin = plugin;
    this.queue = [];
    this.pos = 0;
    this.reviewed = 0;
    this.revealed = false;
    this.undoStack = [];
    this.options = {};
  }
  getViewType() {
    return reviewViewType;
  }
  getDisplayText() {
    return this.plugin.t("review.title");
  }
  getIcon() {
    return "brain";
  }
  async onOpen() {
    this.registerDomEvent(window, "keydown", (event) => this.onKey(event));
    this.registerDomEvent(window, "resize", () => this.updateMobileRateBarOffset());
    const saved = this.plugin.takeReviewSession(this.leaf);
    if (!saved) {
      await this.refresh();
      return;
    }
    this.queue = saved.queue;
    this.pos = saved.pos;
    this.reviewed = saved.reviewed;
    this.undoStack = saved.undoStack;
    this.options = saved.options;
    this.render();
    if (saved.revealed) await this.reveal();
  }
  async onClose() {
    if (this._comp) this._comp.unload();
    if (this._frontComp) this._frontComp.unload();
    this.closeImagePreview();
  }
  async refresh() {
    this.contentEl.empty();
    this.contentEl.createDiv({ cls: "lexis-rv-loading", text: this.plugin.t("common.loading") });
    this.queue = await this.plugin.buildQueue(this.options);
    this.pos = 0;
    this.reviewed = 0;
    this.revealed = false;
    this.undoStack = [];
    this.render();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    c.addClass("lexis-review");
    if (this.pos >= this.queue.length) {
      this.renderDone(c);
      return;
    }
    if (this._frontComp) {
      this._frontComp.unload();
      this._frontComp = null;
    }
    this.revealed = false;
    const item = this.currentItem = this.queue[this.pos];
    const topbar = c.createDiv({ cls: "lexis-rv-topbar" });
    topbar.createDiv({ cls: "lexis-rv-progress", text: this.plugin.t("review.progress", { done: this.reviewed, left: this.queue.length - this.pos }) });
    const topbtns = topbar.createDiv({ cls: "lexis-rv-topbtns" });
    if (this.undoStack.length) {
      const ub = topbtns.createEl("button", { cls: "lexis-rv-undo", text: `\u21A9 ${this.plugin.t("review.undo")}` });
      ub.addEventListener("click", () => {
        void this.undo();
      });
    }
    const sb = topbtns.createEl("button", { cls: "lexis-rv-undo", text: this.plugin.t("review.skip") });
    sb.addEventListener("click", () => this.skip());
    const card = c.createDiv({ cls: "lexis-rv-card" });
    let wordEl;
    if (item.type === "syntax" && item.syntax) {
      const source = card.createEl("button", { cls: "lexis-rv-source", text: `${item.file.basename} \xB7 L${item.syntax.line + 1}`, attr: { type: "button" } });
      source.setAttribute("title", this.plugin.t("review.openSource"));
      source.addEventListener("click", () => {
        void this.openSource(item);
      });
      wordEl = card.createDiv({ cls: "lexis-rv-word is-syntax" });
      void this.renderSyntaxFront(wordEl, item);
    } else {
      wordEl = card.createDiv({ cls: "lexis-rv-word" });
      wordEl.setText(item.file.basename);
      wordEl.setAttribute("title", this.plugin.t("review.openSource"));
      wordEl.addEventListener("click", () => {
        void this.openSource(item);
      });
      if (this.plugin.settings.cardFront === "cloze") void this.applyClozeFront(wordEl, item);
    }
    const tagsSet = this.plugin.getTags(item.file);
    if (tagsSet.size) {
      const tw = card.createDiv({ cls: "lexis-rv-tags" });
      for (const t of tagsSet) {
        const pill = tw.createSpan({ cls: "lexis-tag", text: "#" + t });
        pill.setAttribute("title", this.plugin.t("review.onlyTag", { tag: t }));
        pill.addEventListener("click", () => {
          void this.plugin.openReview({ ...this.options, scope: "tag", tag: t });
        });
      }
    }
    this.backEl = card.createDiv({ cls: "lexis-rv-back" });
    this.backEl.setCssStyles({ display: "none" });
    this.showBtn = c.createEl("button", { cls: "mod-cta lexis-rv-show", text: this.plugin.t("review.show") });
    this.showBtn.addEventListener("click", () => {
      void this.reveal();
    });
    this.rateBar = c.createDiv({ cls: "lexis-rv-rate" });
    this.rateBar.setCssStyles({ display: "none" });
    const bs = this.plugin.settings.reviewBottomSpace ?? 70;
    this.containerEl.setCssProps({ "--lexis-review-bottom-space": `${bs}px` });
    const isPhone = this.containerEl.doc.body.classList.contains("is-phone");
    this.rateBar.setCssStyles({ marginBottom: isPhone ? "" : bs + "px" });
    if (isPhone) this.updateMobileRateBarOffset();
    const grades = [[1, "review.again"], [2, "review.hard"], [3, "review.good"], [4, "review.easy"]];
    for (const [g, key] of grades) {
      const ivl = this.plugin.scheduleCard(item.card, g).interval;
      const b = this.rateBar.createEl("button", { cls: "lexis-rv-btn lexis-rv-g" + g });
      b.createSpan({ cls: "lexis-rv-label", text: `${this.plugin.t(key)} (${g})` });
      b.createSpan({ cls: "lexis-rv-ivl", text: this.plugin.humanInterval(ivl) });
      b.addEventListener("click", () => {
        void this.grade(g);
      });
    }
  }
  async reveal() {
    if (this.revealed) return;
    this.revealed = true;
    this.showBtn.setCssStyles({ display: "none" });
    this.backEl.setCssStyles({ display: "" });
    this.rateBar.setCssStyles({ display: "" });
    try {
      if (this._comp) this._comp.unload();
      this._comp = new import_obsidian3.Component();
      this._comp.load();
      const item = this.currentItem;
      if (item.type === "syntax" && item.syntax) {
        this.backEl.empty();
        await renderLexisMarkdown2(this.app, item.syntax.back, this.backEl, item.file.path, this._comp);
      } else {
        await this.plugin.renderNoteInto(this.backEl, item.file, this._comp, true);
        const openOcc = () => this.backEl.querySelectorAll("details.lexis-occ-details").forEach((details) => {
          details.open = true;
        });
        openOcc();
        window.setTimeout(openOcc, 60);
      }
      this.installAnswerInteractions();
    } catch (err) {
      this.backEl.setText(this.plugin.t("review.renderFailed", { error: errorMessage(err) }));
      console.error("[Lexis] reveal error", err);
    }
  }
  updateMobileRateBarOffset() {
    if (!this.rateBar || !this.containerEl.doc.body.classList.contains("is-phone")) return;
    const navbarHeight = Math.ceil(this.containerEl.doc.querySelector(".mobile-navbar")?.getBoundingClientRect().height || 58);
    this.containerEl.setCssProps({ "--lexis-mobile-navbar-height": `${navbarHeight}px` });
  }
  async grade(g) {
    if (!this.revealed) {
      new import_obsidian3.Notice(this.plugin.t("review.revealFirst"));
      return;
    }
    const item = this.currentItem;
    try {
      const snapshot = this.plugin.snapshotReviewItem(item);
      const previousCard = { ...item.card };
      const retentionBefore = this.plugin.cardRetrievability(item.card);
      const sched = this.plugin.scheduleCard(item.card, g);
      await this.plugin.applyReviewItemSchedule(item, sched);
      await this.plugin.logReviewItem(item, sched, g, retentionBefore);
      this.undoStack.push({ item, snapshot, previousCard, pos: this.pos, requeued: g === 1 });
      this.reviewed++;
      const updated = { s: sched.s, d: sched.d, due: sched.due, last: todayStr(), reps: sched.reps, lapses: sched.lapses };
      item.card = updated;
      if (g === 1) this.queue.push({ ...item, card: { ...updated } });
      this.pos++;
      this.render();
    } catch (err) {
      new import_obsidian3.Notice(this.plugin.t("review.gradeFailed", { error: errorMessage(err) }));
      console.error("[Lexis] grade error", err);
    }
  }
  async undo() {
    const u = this.undoStack.pop();
    if (!u) {
      new import_obsidian3.Notice(this.plugin.t("review.nothingUndo"));
      return;
    }
    try {
      await this.plugin.restoreReviewItem(u.item, u.snapshot);
      await this.plugin.undoReviewItemLog(u.item);
      u.item.card = { ...u.previousCard };
      if (u.requeued && this.queue.length) this.queue.pop();
      this.pos = u.pos;
      this.reviewed = Math.max(0, this.reviewed - 1);
      this.render();
    } catch (err) {
      new import_obsidian3.Notice(this.plugin.t("review.undoFailed", { error: errorMessage(err) }));
    }
  }
  async openSource(item) {
    this.plugin.saveReviewSession(this.leaf, {
      queue: this.queue,
      pos: this.pos,
      reviewed: this.reviewed,
      revealed: this.revealed,
      undoStack: this.undoStack,
      options: this.options
    });
    await this.leaf.openFile(item.file, { active: true });
    await this.app.workspace.revealLeaf(this.leaf);
    if (item.syntax && this.leaf.view instanceof import_obsidian3.MarkdownView) {
      const position = { line: item.syntax.line, ch: 0 };
      this.leaf.view.editor.setCursor(position);
      this.leaf.view.editor.scrollIntoView({ from: position, to: position }, true);
    }
  }
  onKey(e) {
    if (this.app.workspace.getMostRecentLeaf() !== this.leaf) return;
    if (e.key === "Escape" && this._imagePreview) {
      e.preventDefault();
      this.closeImagePreview();
      return;
    }
    const target = e.targetNode;
    const element = target?.instanceOf(HTMLElement) ? target : null;
    const tag = element?.tagName || "";
    if (/INPUT|TEXTAREA/.test(tag) || element?.isContentEditable) return;
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault();
      void this.undo();
      return;
    }
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      this.skip();
      return;
    }
    if (this.pos >= this.queue.length) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (!this.revealed) void this.reveal();
      return;
    }
    if (this.revealed && ["1", "2", "3", "4"].includes(e.key)) {
      e.preventDefault();
      void this.grade(Number(e.key));
    }
  }
  async applyClozeFront(wordEl, item) {
    const ex = await this.plugin.getFirstExample(item.file);
    if (!ex || this.currentItem !== item) return;
    wordEl.addClass("lexis-rv-cloze");
    wordEl.empty();
    if (this._frontComp) this._frontComp.unload();
    this._frontComp = new import_obsidian3.Component();
    this._frontComp.load();
    const cloze = this.plugin.buildCloze(ex, item.file.basename);
    await renderLexisMarkdown2(this.app, cloze, wordEl, item.file.path, this._frontComp);
  }
  async renderSyntaxFront(wordEl, item) {
    if (!item.syntax || this.currentItem !== item) return;
    this._frontComp = new import_obsidian3.Component();
    this._frontComp.load();
    await renderLexisMarkdown2(this.app, item.syntax.front, wordEl, item.file.path, this._frontComp);
  }
  installAnswerInteractions() {
    this.backEl.querySelectorAll("img").forEach((img) => {
      img.classList.add("lexis-rv-zoomable");
      img.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openImagePreview(img);
      });
    });
  }
  openImagePreview(source) {
    this.closeImagePreview();
    const overlay = this.containerEl.doc.body.createDiv({ cls: "lexis-rv-image-preview" });
    const image = overlay.createEl("img");
    image.src = source.currentSrc || source.src;
    image.alt = source.alt || "";
    image.className = "is-fit";
    image.addEventListener("click", (e) => {
      e.stopPropagation();
      const fit = image.classList.toggle("is-fit");
      overlay.classList.toggle("is-actual", !fit);
    });
    const close = overlay.createEl("button", { cls: "lexis-rv-image-close" });
    close.type = "button";
    close.textContent = "\xD7";
    close.setAttribute("aria-label", this.plugin.t("review.closeImage"));
    close.addEventListener("click", () => this.closeImagePreview());
    overlay.addEventListener("click", () => this.closeImagePreview());
    this._imagePreview = overlay;
  }
  closeImagePreview() {
    if (this._imagePreview) this._imagePreview.remove();
    this._imagePreview = null;
  }
  skip() {
    if (this.pos >= this.queue.length) return;
    this.queue.push(this.queue[this.pos]);
    this.pos++;
    this.render();
  }
  renderDone(c) {
    const d = c.createDiv({ cls: "lexis-rv-done" });
    d.createDiv({ cls: "lexis-rv-done-emoji", text: "\u{1F389}" });
    d.createDiv({ text: this.reviewed ? this.plugin.t("review.done", { count: this.reviewed }) : this.plugin.t("review.noneDue") });
    const b = d.createEl("button", { cls: "mod-cta", text: this.plugin.t("review.checkAgain") });
    b.onclick = () => {
      void this.plugin.rebuildIndex(false);
      void this.refresh();
    };
    this.plugin.renderHeatmap(d.createDiv({ cls: "lexis-hm-wrap" }));
    c.setCssStyles({ paddingBottom: (this.plugin.settings.reviewBottomSpace ?? 70) + "px" });
  }
};

// src/occurrence-search.ts
function pdfItemsToText(items) {
  let out = "";
  let prev = null;
  for (const item of items || []) {
    const text = String(item && item.str || "");
    if (!text) {
      if (item && item.hasEOL) out += "\n";
      continue;
    }
    let separator = "";
    if (prev) {
      if (prev.hasEOL) separator = "\n";
      else if (!/\s$/.test(out) && !/^\s/.test(text)) {
        const pt = prev.transform || [], ct = item.transform || [];
        const sameLine = Number.isFinite(pt[5]) && Number.isFinite(ct[5]) ? Math.abs(pt[5] - ct[5]) <= Math.max(1, Math.abs(pt[3] || ct[3] || 0) * 0.45) : true;
        if (!sameLine) separator = "\n";
        else if (Number.isFinite(pt[4]) && Number.isFinite(ct[4]) && Number.isFinite(prev.width)) {
          const chars = Math.max(1, String(prev.str || "").trim().length);
          const charWidth = Math.abs(Number(prev.width) || 0) / chars;
          const gap = ct[4] - (pt[4] + Number(prev.width || 0));
          if (gap > Math.max(0.5, charWidth * 0.18) || gap < -Math.max(2, charWidth * 2)) separator = " ";
        } else separator = " ";
      }
    }
    out += separator + text;
    prev = item;
  }
  return out;
}
function normalizePdfText(text) {
  return String(text || "").replace(/([\p{L}\p{N}])-\s*\n\s*([\p{L}\p{N}])/gu, "$1$2").replace(/\s+/g, " ").trim();
}
function mergeOccurrences(markdown, pdf, limit) {
  const out = [], max = Math.max(1, Number(limit) || 1);
  for (let i = 0; out.length < max && (i < markdown.length || i < pdf.length); i++) {
    if (i < markdown.length) out.push(markdown[i]);
    if (out.length < max && i < pdf.length) out.push(pdf[i]);
  }
  return out;
}
function createOccurrenceSearch(options) {
  const { app, loadPdfJs: loadPdfJs2, boundedSource: boundedSource2, extractSentence, markdownAllowed, inScope } = options;
  const pdfCache = /* @__PURE__ */ new Map();
  const readPdfPages = async (file) => {
    const signature = `${file.stat && file.stat.mtime || 0}:${file.stat && file.stat.size || 0}`;
    const cached = pdfCache.get(file.path);
    if (cached && cached.signature === signature) return cached.promise;
    const promise = (async () => {
      let doc = null;
      try {
        const pdfjs = await loadPdfJs2();
        const buffer = await app.vault.readBinary(file);
        const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        doc = await task.promise;
        const pages = [];
        for (let page = 1; page <= doc.numPages; page++) {
          const pdfPage = await doc.getPage(page);
          const content = await pdfPage.getTextContent();
          const text = normalizePdfText(pdfItemsToText(content.items));
          if (text) pages.push({ page, text });
          if (pdfPage.cleanup) pdfPage.cleanup();
        }
        return pages;
      } catch (error) {
        console.warn(`[Lexis] PDF \u51FA\u5904\u626B\u63CF\u5931\u8D25: ${file.path}`, error);
        return [];
      } finally {
        if (doc?.destroy) {
          try {
            await doc.destroy();
          } catch {
          }
        }
      }
    })();
    pdfCache.set(file.path, { signature, promise });
    return promise;
  };
  const searchMarkdown = async (word, limit, scope) => {
    const re = new RegExp(boundedSource2(word), "i"), results = [];
    const files = app.vault.getMarkdownFiles().filter((file) => markdownAllowed(file) && inScope(file.path, scope));
    for (const file of files) {
      if (results.length >= limit) break;
      let content;
      try {
        content = await app.vault.cachedRead(file);
      } catch {
        continue;
      }
      const index = content.search(re);
      if (index >= 0) results.push({ file, sentence: extractSentence(content, index) });
    }
    return results;
  };
  const searchPdf = async (word, limit, scope) => {
    const re = new RegExp(boundedSource2(word), "i"), results = [];
    const files = app.vault.getFiles().filter((file) => file.extension === "pdf" && inScope(file.path, scope));
    for (const file of files) {
      if (results.length >= limit) break;
      const pages = await readPdfPages(file);
      for (const page of pages) {
        const index = page.text.search(re);
        if (index < 0) continue;
        results.push({ file, page: page.page, sentence: extractSentence(page.text, index) });
        break;
      }
    }
    return results;
  };
  return {
    clearResults() {
      return;
    },
    invalidatePdf(path) {
      if (path) pdfCache.delete(path);
      else pdfCache.clear();
    },
    async find(word, { limit = 6, scope = [], includePdf = true } = {}) {
      const markdownPromise = searchMarkdown(word, limit, scope);
      const pdfPromise = includePdf ? searchPdf(word, limit, scope) : Promise.resolve([]);
      const [markdown, pdf] = await Promise.all([markdownPromise, pdfPromise]);
      return mergeOccurrences(markdown, pdf, limit);
    }
  };
}

// src/bridge-server.ts
function createBridgeServer({ Notice: Notice4, Platform: Platform2 }) {
  class LexisBridge2 {
    constructor(plugin) {
      this.plugin = plugin;
      this.server = null;
    }
    get running() {
      return !!this.server;
    }
    generateToken() {
      const bytes = new Uint8Array(16);
      (window.crypto || crypto).getRandomValues(bytes);
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    start() {
      if (this.server) return;
      if (!Platform2.isDesktopApp) {
        new Notice4(this.plugin.t("notice.desktopBridge"));
        return;
      }
      let http = null;
      try {
        http = window.require?.("http") ?? null;
      } catch {
      }
      if (!http) {
        new Notice4(this.plugin.t("notice.desktopBridge"));
        return;
      }
      const port = Number(this.plugin.settings.bridgePort) || LEXIS_BRIDGE_DEFAULT_PORT;
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          try {
            res.writeHead(500);
            res.end(err instanceof Error ? err.message : "Internal error");
          } catch {
          }
        });
      });
      server.on("error", (err) => {
        this.server = null;
        const reason = err.code === "EADDRINUSE" ? this.plugin.t("notice.portBusy", { port }) : err.code || err.message;
        new Notice4(this.plugin.t("notice.bridgeFailed", { reason }));
      });
      server.listen(port, "127.0.0.1", () => this.plugin.updateStatusBar());
      this.server = server;
    }
    stop() {
      if (!this.server) return;
      this.server.close();
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
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
      };
    }
    async handle(req, res) {
      const plugin = this.plugin;
      const cors = this.cors();
      const send = (code, obj) => {
        res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors));
        res.end(JSON.stringify(obj));
      };
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        res.end();
        return;
      }
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (path === "/ping" || path === "/") return send(200, { ok: true, app: "lexis", version: plugin.manifest.version, vault: plugin.app.vault.getName() });
      const tokenHeader = req.headers["x-lexis-token"];
      const token = (Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader) || url.searchParams.get("token") || "";
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
        req.on("data", (chunk) => {
          data += typeof chunk === "string" ? chunk : chunk instanceof Uint8Array ? new TextDecoder().decode(chunk) : "";
          if (data.length > 1e6) req.destroy();
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            resolve(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
          } catch {
            resolve({});
          }
        });
        req.on("error", () => resolve({}));
      });
    }
  }
  return LexisBridge2;
}

// src/bridge-api.ts
function errorMessage2(error) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown error";
}
function textValue(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}
function createBridgeApi({ DEFAULT_SETTINGS: DEFAULT_SETTINGS2, TFile: TFile4, Component: Component4, todayStr, escapeRe: escapeRe2, renderLexisMarkdown: renderLexisMarkdown2, finishRenderMath: finishRenderMath2, escHtml, saveAnnotationImage: saveAnnotationImage2, vaultImageDataUrl: vaultImageDataUrl2 }) {
  class BridgeApi {
    // ---------- 词典桥接动作（由 Obsidian 卡片与外部阅读端共同调用） ----------
    // 网页划词/加出处:词不在库→新建,在库→加出处。来源是网址链接 [标题](url),不是 [[内链]]
    async bridgeAddWord(payload) {
      const word = textValue(payload.word).trim();
      if (!word) return { ok: false, error: "empty-word" };
      const name = this.sanitizeName(word);
      if (!name) return { ok: false, error: "bad-name" };
      const alias = textValue(payload.alias).trim();
      const sentence = textValue(payload.sentence).trim();
      const url = textValue(payload.url).trim();
      const title = (textValue(payload.title) || url).trim().replaceAll("[", "").replaceAll("]", "");
      const source = url ? `[${title || url}](${url})` : "";
      const occurrence = sentence || source ? { word, sentence, source, date: todayStr() } : null;
      const dupKey = sentence || url;
      const reqFolder = this.normalizeFolder(textValue(payload.folder));
      const folder = reqFolder && this.dictFolders().includes(reqFolder) ? reqFolder : this.primaryVocabFolder();
      const targetPath = (folder ? folder + "/" : "") + name + ".md";
      let existing = this.app.vault.getAbstractFileByPath(targetPath);
      if (!(existing instanceof TFile4)) {
        const hit = this.index.get(this.resolveIndexKey(word));
        if (hit && hit.file instanceof TFile4) existing = hit.file;
      }
      const injectAlias = (data) => {
        const re = /^---\r?\n([\s\S]*?)\r?\n---/;
        const fm = re.exec(data);
        const line = `  - ${alias}
`;
        if (!fm) return `---
aliases:
${line}---
` + data;
        const body = fm[1];
        if (body.includes(alias)) return data;
        if (/^aliases:/m.test(body)) {
          return data.slice(0, fm.index) + `---
` + body.replace(/^(aliases:.*)$/m, `$1
${line}`) + `
---` + data.slice(fm.index + fm[0].length);
        }
        return data.slice(0, fm.index) + `---
${body}
aliases:
${line}---` + data.slice(fm.index + fm[0].length);
      };
      try {
        if (existing instanceof TFile4) {
          if (alias) {
            if (this.app.vault.process) await this.app.vault.process(existing, injectAlias);
            else await this.app.vault.modify(existing, injectAlias(await this.app.vault.cachedRead(existing)));
            await this.rebuildIndex(false);
            if (alias) {
              const ak = alias.toLowerCase();
              if (!this.index.has(ak)) this.index.set(ak, { display: alias, file: existing, isAlias: true, tags: this.getTags(existing) });
            }
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
          return { ok: true, created: false, word: existing.basename, alias: alias || void 0, file: existing.path };
        }
        await this.ensureFolder(folder);
        const tpl = await this.templateForFolder(folder);
        const content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word, date: todayStr() });
        const file = await this.createEntryFile(targetPath, folder, content, (templateContent) => {
          let next = templateContent;
          if (occurrence) next = this.insertOccurrence(next, occurrence);
          if (alias) next = injectAlias(next);
          return next;
        });
        this.recordEncounter(file, "add");
        await this.rebuildIndex(false);
        if (alias) {
          const ak = alias.toLowerCase();
          if (!this.index.has(ak)) this.index.set(ak, { display: alias, file, isAlias: true, tags: /* @__PURE__ */ new Set() });
        }
        return { ok: true, created: true, word, alias: alias || void 0, file: file.path };
      } catch (err) {
        return { ok: false, error: errorMessage2(err) };
      }
    }
    async bridgeDeleteWord(key) {
      const k = this.resolveIndexKey(textValue(key));
      const e = this.index.get(k);
      if (!e || !e.file) return { ok: false, error: "not-found" };
      if (e.inline) return { ok: false, error: "inline-readonly" };
      try {
        await this.app.fileManager.trashFile(e.file);
        await this.rebuildIndex(false);
        return { ok: true, deleted: e.display, file: e.file.path };
      } catch (err) {
        return { ok: false, error: errorMessage2(err) };
      }
    }
    async bridgeTagWord(payload) {
      const key = this.resolveIndexKey(textValue(payload.key));
      const tag = textValue(payload.tag).toLowerCase().replace(/^#/, "");
      const action = textValue(payload.action) || "add";
      if (!tag) return { ok: false, error: "empty-tag" };
      const e = this.index.get(key);
      if (!e || !e.file) return { ok: false, error: "not-found" };
      if (e.inline) return { ok: false, error: "inline-readonly" };
      try {
        let resultTags = [];
        await this.app.fileManager.processFrontMatter(e.file, (fm) => {
          const rawTags = fm.tags ?? fm.tag ?? [];
          const values = typeof rawTags === "string" ? rawTags.split(/[,，;；\s]+/) : Array.isArray(rawTags) ? rawTags : [rawTags];
          let tags = values.map((value) => textValue(value).trim().replace(/^#/, "").toLowerCase()).filter((value) => value && value !== "null");
          if (action === "remove") tags = tags.filter((value) => value !== tag);
          else if (!tags.includes(tag)) tags.push(tag);
          tags = [...new Set(tags)];
          if (tags.length) fm.tags = tags;
          else delete fm.tags;
          if (fm.tag != null) delete fm.tag;
          resultTags = tags;
        });
        await this.rebuildIndex(false);
        const tagSet = new Set(resultTags);
        for (const entry of this.index.values()) {
          if (entry.file === e.file) entry.tags = tagSet;
        }
        return { ok: true, key, tag, action: action === "remove" ? "removed" : "added", tags: resultTags };
      } catch (err) {
        return { ok: false, error: errorMessage2(err) };
      }
    }
    // 把 line 追加到指定标题小节末尾(在子标题/代码块之前);没这个标题就在文末新建。
    // headingLine:完整标题行(级别 + 文字,比如 "#### 出处",可以是用户在设置里自定义的任意级别/文字);
    // legacyNames:识别时额外认的旧标题文字(不认级别,只认文字,比如"例句"改名"出处"前的老笔记),但新建小节永远用 headingLine。
    insertUnderHeading(data, headingLine, line, legacyNames = []) {
      const headingText = headingLine.replace(/^#{1,6}[ \t]*/, "").trim() || headingLine;
      const names = [headingText, ...legacyNames || []].map(escapeRe2).join("|");
      const re = new RegExp("(^|\\n)#{1,6}[ \\t]*(?:" + names + ")[^\\n]*\\n");
      const m = re.exec(data);
      if (!m) return this.appendBeforeLexisBlock(data, `${headingLine}
${line}`);
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
        const before2 = content.slice(0, at).replace(/\s*$/, "");
        const after = content.slice(at).replace(/^\n+/, "");
        return before2 + (before2 ? "\n\n" : "") + blockText.trim() + "\n\n" + after;
      }
      const before = content.replace(/\s*$/, "");
      return before + (before ? "\n\n" : "") + blockText.trim() + "\n";
    }
    renderTemplate(template, vars) {
      let out = String(template || "");
      for (const [key, value] of Object.entries(vars || {})) {
        out = out.replace(new RegExp(`\\{\\{${escapeRe2(key)}\\}\\}`, "g"), textValue(value));
      }
      return out;
    }
    occurrenceTemplateDefinition() {
      const raw = String(this.settings.occurrenceTemplate ?? DEFAULT_SETTINGS2.occurrenceTemplate).trim();
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
      const templateLine = item.split("\n").find((line2) => line2.includes("{{sentence}}"));
      if (templateLine) {
        const tokenRe = /\{\{(word|sentence|source|sourceSuffix|date)\}\}/g;
        const source = "(?:\\[\\[[^\\]]+\\]\\]|\\[[^\\]]+\\]\\([^\\n]+\\)|[^\\n]*?)";
        const sourceSuffix = `(?:\\s*\u2014\u2014\\s*${source})?`;
        let pattern = "^\\s*", last = 0;
        const literal = (text) => escapeRe2(text).replace(/\s+/g, "\\s+");
        let match = tokenRe.exec(templateLine);
        while (match) {
          pattern += literal(templateLine.slice(last, match.index));
          if (match[1] === "sentence") pattern += "(.+?)";
          else if (match[1] === "source") pattern += source;
          else if (match[1] === "sourceSuffix") pattern += sourceSuffix;
          else pattern += "[^\\n]*?";
          last = match.index + match[0].length;
          match = tokenRe.exec(templateLine);
        }
        pattern += literal(templateLine.slice(last)) + "\\s*$";
        const re = new RegExp(pattern);
        for (const line2 of String(section || "").split("\n")) {
          const found = re.exec(line2);
          if (found?.[1]) return found[1].trim();
        }
      }
      const line = String(section || "").split("\n").map((s) => s.trim()).find((s) => s.startsWith(">"));
      if (!line) return "";
      return line.replace(/^>\s*/, "").replace(/\s*——\s*(?:\[\[[^\]]*\]\]|\[[^\]]*\]\([^\n]+\))\s*$/, "").trim();
    }
    insertOccurrence(data, vars) {
      const definition = this.occurrenceTemplateDefinition();
      if (!definition) return data;
      const source = textValue(vars.source);
      const values = { ...vars, source, sourceSuffix: source ? ` \u2014\u2014 ${source}` : "" };
      const item = this.renderTemplate(definition.item, values).trim();
      if (!item) return data;
      if (definition.heading) {
        const heading = this.renderTemplate(definition.heading, values).trim();
        return this.insertUnderHeading(data, heading, item, ["\u4F8B\u53E5", "\u51FA\u5904"]);
      }
      return this.appendBeforeLexisBlock(data, item);
    }
    // 批注小节标题行:设置里可以填完整一行(级别+文字,比如 "## 引用"),也可以只填文字(默认按 #### 级别);留空用默认 "#### 批注"
    annotationHeadingLine() {
      const v = (this.settings.annotationHeading || "").trim();
      if (!v) return "#### \u6279\u6CE8";
      return /^#{1,6}[ \t]/.test(v) ? v : `#### ${v}`;
    }
    annotationHeadingText() {
      return this.annotationHeadingLine().replace(/^#{1,6}[ \t]*/, "").trim() || "\u6279\u6CE8";
    }
    // 批注写进词条笔记；Obsidian 卡片还可同时把图片保存为仓库附件并插入引用。
    async bridgeAnnotate(payload) {
      const text = textValue(payload.note ?? payload.text).trim().replace(/\r?\n+/g, " ");
      const image = typeof File !== "undefined" && payload.image instanceof File && payload.image.type.startsWith("image/") ? payload.image : null;
      if (!text && !image) return { ok: false, error: "empty-note" };
      const key = this.resolveIndexKey(textValue(payload.key ?? payload.word).trim());
      const e = this.index.get(key);
      if (!e || !e.file) return { ok: false, error: "not-found" };
      if (e.inline) return { ok: false, error: "inline-readonly" };
      try {
        const imageFile = image ? await saveAnnotationImage2(this.app, this.settings, e.file, image) : null;
        const content = [text ? `> ${text}` : "", imageFile ? `![[${imageFile.path}]]` : ""].filter(Boolean).join("\n\n");
        const apply = (data) => this.insertUnderHeading(data, this.annotationHeadingLine(), content, ["\u6279\u6CE8"]);
        if (this.app.vault.process) await this.app.vault.process(e.file, apply);
        else await this.app.vault.modify(e.file, apply(await this.app.vault.cachedRead(e.file)));
        this._occCache.clear();
        return { ok: true, key, file: e.file.path };
      } catch (err) {
        return { ok: false, error: errorMessage2(err) };
      }
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
      s = s.replace(/```[\s\S]*?```/g, "");
      const annotNames = [this.annotationHeadingText(), "\u6279\u6CE8"].map(escapeRe2).join("|");
      s = s.replace(new RegExp("(^|\\n)#{1,6}[ \\t][^\\n]*(?:" + annotNames + ")[\\s\\S]*?(?=\\n#{1,6}[ \\t]|$)", "g"), "\n");
      s = s.replace(/^#{1,6}[ \t].*$/gm, "");
      return !/[A-Za-z0-9一-鿿]/.test(s);
    }
    // 把已有词移动到另一个词典文件夹。默认只移动文件(正文/批注/出处全保留);
    // 但若该词笔记是空骨架且目标词典有自己的模板,则顺手重套模板——并把批注小节内容迁移过去。
    async bridgeMoveWord(payload) {
      const key = this.resolveIndexKey(textValue(payload.key ?? payload.word).trim());
      const folder = this.normalizeFolder(textValue(payload.folder));
      const e = this.index.get(key);
      if (!e || !e.file) return { ok: false, error: "not-found" };
      if (e.inline) return { ok: false, error: "inline-readonly" };
      if (folder && !this.dictFolders().includes(folder)) return { ok: false, error: "bad-folder" };
      const target = (folder ? folder + "/" : "") + e.file.name;
      if (target === e.file.path) return { ok: true, key, file: e.file.path, moved: false };
      if (this.app.vault.getAbstractFileByPath(target)) return { ok: false, error: "exists" };
      try {
        let oldContent = "";
        try {
          oldContent = await this.app.vault.cachedRead(e.file);
        } catch {
        }
        const tplRaw = await this.templateForFolder(folder);
        const retemplate = tplRaw != null && tplRaw.trim() !== "" && this.isScaffoldOnly(oldContent);
        await this.ensureFolder(folder);
        await this.app.fileManager.renameFile(e.file, target);
        let reTemplated = false;
        if (retemplate) {
          const annot = this.extractSection(oldContent, [this.annotationHeadingText(), "\u6279\u6CE8"]).replace(/```[\s\S]*?```/g, "").trim();
          const oldFm = this.splitFrontmatter(oldContent).fm;
          const filled = tplRaw.replace(/\{\{word\}\}/g, e.display).replace(/\{\{date\}\}/g, todayStr());
          const tplBody = this.splitFrontmatter(filled).body.replace(/^\s+/, "");
          let nc = (oldFm ? oldFm.replace(/\s*$/, "\n") : "") + (oldFm ? "\n" : "") + tplBody;
          if (annot) nc = this.insertUnderHeading(nc, this.annotationHeadingLine(), annot, ["\u6279\u6CE8"]);
          const fileNow = this.app.vault.getAbstractFileByPath(target);
          if (fileNow instanceof TFile4) {
            if (this.app.vault.process) await this.app.vault.process(fileNow, () => nc);
            else await this.app.vault.modify(fileNow, nc);
            reTemplated = true;
          }
        }
        await this.rebuildIndex(false);
        return { ok: true, key, file: target, folder, moved: true, reTemplated };
      } catch (err) {
        return { ok: false, error: errorMessage2(err) };
      }
    }
    // 网页被动相遇:扩展按「词+当天」去重后批量报过来的 key 列表,这边再按同样的 (文件+当天) 去重记一次
    // (两边都去重不是多余——扩展端只挡"同一页反复扫描",挡不住"今天换个 tab 又开了同一个页面")。
    async bridgeEncounter(payload) {
      const keys = Array.isArray(payload.keys) ? payload.keys : [];
      let recorded = 0;
      for (const k of keys) {
        const e = this.index.get(this.resolveIndexKey(textValue(k)));
        if (e && !e.inline && e.file instanceof TFile4) {
          this.passiveEncounter(e.file);
          recorded++;
        }
      }
      return { ok: true, recorded };
    }
    bridgeWordList() {
      const words = [];
      for (const [key, e] of this.index) {
        if (e.archived || e.retired) continue;
        words.push({ key, word: e.display, alias: !!e.isAlias, inline: !!e.inline, tags: [...e.tags || []], file: e.file && e.file.path, color: this.colorForEntry(e), opacity: this.highlightAlphaForEntry(e), visible: this.highlightVisibleForEntry(e, false), wstyle: this.styleKindForEntry(e) });
      }
      return {
        ok: true,
        version: this.manifest.version,
        count: words.length,
        words,
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
          hoverDelayMs: this.settings.hoverDelayMs
        }
      };
    }
    // name 可以是单个标题文字,也可以是一个数组(比如当前自定义名字 + 旧的默认名字,任一命中都算)
    extractSection(md, name) {
      const names = (Array.isArray(name) ? name : [name]).map(escapeRe2).join("|");
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
      const style = this.app.workspace.containerEl.ownerDocument.getElementById("MJX-CHTML-styles");
      return style?.sheet ? Array.from(style.sheet.cssRules, (rule) => rule.cssText).join("\n") : "";
    }
    async bridgeWordDetail(key) {
      const k = this.resolveIndexKey(textValue(key));
      const e = this.index.get(k);
      if (!e) return { ok: false, error: "not-found" };
      if (e.inline) {
        const heading2 = this.cardHeading(e);
        return {
          ok: true,
          word: e.display,
          base: e.display,
          file: e.file.path,
          vault: this.app.vault.getName(),
          inline: true,
          category: e.category,
          markdown: e.annotation || "*(\u65E0\u6279\u6CE8)*",
          title: heading2.title,
          subtitle: heading2.subtitle,
          html: await this.renderInlineEntryHtml(e)
        };
      }
      this.recordEncounter(e.file, "hover");
      void this.hoverFeedback(e.file);
      let body = "";
      try {
        const raw = await this.app.vault.cachedRead(e.file);
        body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```lexis[\s\S]*?```/g, "");
        body = this.compactSections(body.trim());
      } catch {
      }
      const html = await this.bridgeFullHtml(e.file, e.display);
      const heading = this.cardHeading(e);
      return {
        ok: true,
        word: e.display,
        base: e.file && e.file.basename,
        file: e.file && e.file.path,
        vault: this.app.vault.getName(),
        title: heading.title,
        subtitle: heading.subtitle,
        alias: !!e.isAlias,
        tags: [...e.tags || []],
        meaning: this.extractSection(body, ["\u610F\u601D", "\u610F\u4E49"]),
        markdown: body,
        html,
        mathCss: html.includes("<mjx-container") ? this.bridgeMathCss() : ""
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
      const div = createDiv();
      const comp = new Component4();
      comp.load();
      try {
        await this.renderInlineEntryInto(div, entry, comp);
        await this.bridgePostProcess(div, entry.file.path);
        return div.innerHTML;
      } finally {
        comp.unload();
      }
    }
    async bridgePostProcess(div, sourcePath) {
      const vault = encodeURIComponent(this.app.vault.getName());
      div.querySelectorAll("a.internal-link").forEach((a) => {
        const lp = a.getAttribute("data-href") || a.getAttribute("href") || a.textContent || "";
        a.setAttribute("href", `obsidian://open?vault=${vault}&file=${encodeURIComponent(lp)}`);
        a.removeAttribute("data-href");
        a.classList.add("lexis-web-ilink");
      });
      for (const img of div.querySelectorAll("img")) {
        const src = img.getAttribute("src") || "";
        if (/^(?:https?:|data:)/i.test(src)) continue;
        const embed = img.closest(".internal-embed");
        const linkPath = embed?.getAttribute("src") || embed?.getAttribute("data-href") || img.getAttribute("alt") || "";
        try {
          const dataUrl = await vaultImageDataUrl2(this.app, linkPath, sourcePath);
          if (dataUrl) img.setAttribute("src", dataUrl);
          else img.remove();
        } catch {
          img.remove();
        }
      }
      div.querySelectorAll(".internal-embed").forEach((embed) => {
        if (embed.querySelector("img")) embed.replaceWith(...Array.from(embed.childNodes));
        else embed.remove();
      });
      div.querySelectorAll("iframe").forEach((frame) => frame.remove());
    }
    // 整篇笔记渲成 HTML,且 ```lexis 块在原位渲染(保持文档顺序),供浏览器扩展悬浮卡用
    async bridgeFullHtml(file, display) {
      let raw = "";
      try {
        raw = await this.app.vault.cachedRead(file);
      } catch {
        return "";
      }
      raw = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
      const blocks = [];
      raw = raw.replace(/```lexis\s*([\s\S]*?)```/g, (_whole, inner) => {
        const i = blocks.length;
        blocks.push((inner || "").trim());
        return `

@@LEXIS${i}@@

`;
      });
      const div = createDiv();
      const comp = new Component4();
      comp.load();
      try {
        await renderLexisMarkdown2(this.app, raw, div, file.path || "", comp);
      } catch {
      }
      for (let i = 0; i < blocks.length; i++) {
        const marker = `@@LEXIS${i}@@`;
        const host = Array.from(div.querySelectorAll("p, div, li")).find((element) => element.textContent.trim() === marker);
        const html = await this.lexisBlockHtml(file, display, blocks[i]);
        if (!host) continue;
        if (!html || !html.trim()) {
          const prev = host.previousElementSibling;
          host.remove();
          if (prev && /^H[1-6]$/.test(prev.tagName)) {
            const nx = prev.nextElementSibling;
            if (!nx || /^H[1-6]$/.test(nx.tagName)) prev.remove();
          }
        } else {
          const parsed = new DOMParser().parseFromString(html, "text/html");
          const nodes = Array.from(parsed.body.childNodes, (node) => div.ownerDocument.importNode(node, true));
          host.replaceWith(...nodes);
        }
      }
      (function compact(container) {
        const hs = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
        const rm = [];
        for (let i = 0; i < hs.length; i++) {
          const h = hs[i], next = hs[i + 1] || null;
          let sib = h.nextElementSibling, ok = false;
          while (sib && sib !== next) {
            const nextSib = sib.nextElementSibling;
            if ((sib.textContent || "").trim()) {
              ok = true;
              break;
            }
            if (sib.querySelector(".lexis-web-sec,.lexis-web-rel,.lexis-web-occ,.lexis-web-curve,.lexis-web-dim")) {
              ok = true;
              break;
            }
            sib = nextSib;
          }
          if (!ok) rm.push(h);
        }
        for (const h of rm) h.remove();
      })(div);
      try {
        await finishRenderMath2();
      } catch {
      }
      await this.bridgePostProcess(div, file.path);
      const out = div.innerHTML;
      comp.unload();
      return out;
    }
    // 单个 ```lexis 块 → HTML(对应 renderLexisBlock 的各模式,带 obsidian:// 链接)
    async lexisBlockHtml(file, display, src) {
      const parts = (src || "").trim().split(/\s+/).filter(Boolean);
      const m = (parts[0] || "").toLowerCase();
      const typeArg = parts.slice(1).join(" ");
      const olink = (path, basename) => this.bridgeOlink(path, basename);
      const relMap = (bags, types) => {
        const map = /* @__PURE__ */ new Map();
        for (const type of types) for (const relation of bags[type] || []) map.set(relation.path, relation.basename);
        return map;
      };
      if (m === "derived" || m === "\u6D3E\u751F") {
        const resolved = this.app.metadataCache.resolvedLinks || {};
        const map = /* @__PURE__ */ new Map();
        for (const s in resolved) if (this.inVocabFolder(s) && resolved[s] && resolved[s][file.path]) {
          const sf = this.app.vault.getAbstractFileByPath(s);
          if (sf instanceof TFile4) map.set(s, sf.basename);
        }
        let h = `<div class="lexis-web-sec">\u{1F331} \u6D3E\u751F\u8BCD (${map.size})</div>`;
        if (!map.size) return h + `<div class="lexis-web-occ lexis-web-dim">(\u8FD8\u6CA1\u6709\u5355\u8BCD\u94FE\u5230\u8FD9\u4E2A\u8BCD\u6839)</div>`;
        return h + `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
      }
      const showCurve = m === "" || m === "curve" || m === "all";
      const showRelated = m === "" || m === "refs" || m === "ref" || m === "rel" || m === "related" || m === "all";
      const showOcc = (m === "" || m === "refs" || m === "ref" || m === "occ" || m === "all") && this.settings.showOccurrences;
      let html = "";
      if (showCurve) {
        const card = this.readCard(file);
        const svg = this.buildCurveSVG(card);
        if (svg) {
          const due = card.due ? ` \xB7 \u4E0B\u6B21\u590D\u4E60 ${String(card.due).slice(0, 10)}` : "";
          html += `<div class="lexis-web-sec">\u{1F9E0} \u8BB0\u5FC6\u66F2\u7EBF\uFF08\u590D\u4E60\u65E5\u671F \xD7 \u4FDD\u7559\u7387${due}\uFF09</div><div class="lexis-web-curve">${svg}</div>`;
        }
      }
      if (showRelated && this.settings.showRelated) {
        try {
          const { out, inc } = await this.findTypedRelations(file);
          if ((m === "rel" || m === "related") && typeArg) {
            const types = typeArg === "\u8FA8\u6790" ? ["\u8FA8\u6790", "\u76F8\u5173"] : [typeArg];
            const outPaths = /* @__PURE__ */ new Set();
            for (const t of types) for (const r of out[t] || []) outPaths.add(r.path);
            const map = /* @__PURE__ */ new Map();
            for (const t of types) for (const r of inc[t] || []) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
            if (map.size) html += `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
          } else {
            for (const t of ["\u8FD1\u4E49\u8BCD", "\u540C\u6839\u8BCD", "\u5F62\u8FD1\u8BCD", "\u8FA8\u6790", "\u76F8\u5173"]) {
              const map = relMap(out, [t]);
              for (const [p, b] of relMap(inc, [t])) map.set(p, b);
              if (!map.size) continue;
              html += `<div class="lexis-web-sec">\u{1F517} ${escHtml(t)}</div><div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
            }
          }
        } catch {
        }
      }
      if (showOcc) {
        try {
          const list = await this.findOccurrences(display);
          const curated = await this.getCuratedSourcePaths(file);
          const fresh = list.filter((o) => !curated.has(o.file.basename.toLowerCase()));
          html += `<div class="lexis-web-sec">\u{1F4CD} \u51FA\u73B0\u8FC7\u7684\u5730\u65B9 (${fresh.length})</div>`;
          if (!fresh.length) html += `<div class="lexis-web-occ lexis-web-dim">(\u6CA1\u6709\u672A\u6536\u85CF\u7684\u65B0\u51FA\u5904)</div>`;
          else {
            const comp = new Component4();
            comp.load();
            const rendered = [];
            for (const o of fresh) {
              const d = createDiv();
              await renderLexisMarkdown2(this.app, o.sentence, d, file.path, comp);
              rendered.push({ d, o });
            }
            try {
              await finishRenderMath2();
            } catch {
            }
            for (const { d, o } of rendered) {
              this.boldMatchesInPlace(d, display);
              html += `<div class="lexis-web-occ">${d.innerHTML} <span class="lexis-web-occ-src">\u2014 ${olink(this.occurrenceLinkPath(o), this.occurrenceLabel(o))}</span></div>`;
            }
            comp.unload();
          }
        } catch {
        }
      }
      return html;
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(BridgeApi.prototype);
  return descriptors;
}

// src/highlight-engine.ts
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");
var obsidian = __toESM(require("obsidian"));
function createHighlightEngine({ Notice: Notice4, boundedSource: boundedSource2, compactMixedScriptSpacing: compactMixedScriptSpacing2, todayStr }) {
  class HighlightEngine {
    // ---------- 索引 ----------
    normalizeFolder(p) {
      return (p || "").trim().replace(/^\/+|\/+$/g, "");
    }
    // 单一真相:rebuildIndex 算出的命中路径集合。支持"文件夹∪标签"两种收录,且 14 处调用点签名不变。
    inVocabFolder(path) {
      return this.vocabPaths ? this.vocabPaths.has(path) : false;
    }
    // 词条自身的标题/别名 key 集合:该词条笔记内文出现自己的标题时不高亮自己,但别的词库词照常高亮。
    selfKeysFor(path) {
      return this._selfKeysByPath && this._selfKeysByPath.get(path) || null;
    }
    maybeRebuild(file, oldPath) {
      const p = file && file.path || "";
      this._occCache.clear();
      if (file?.extension === "pdf") this.occurrenceSearch?.invalidatePdf(file.path);
      if (oldPath && /\.pdf$/i.test(oldPath)) this.occurrenceSearch?.invalidatePdf(oldPath);
      if (oldPath && p && this.settings.reviewHistory?.[oldPath]) {
        this.settings.reviewHistory[p] = this.settings.reviewHistory[oldPath];
        delete this.settings.reviewHistory[oldPath];
        void this.saveSettings();
      }
      if (this.isVocabFile(file) || this.vocabPaths.has(p) || this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(p) || oldPath && (this.inFolderScope(oldPath) || this.vocabPaths.has(oldPath) || this.inlineSourcePaths?.has(oldPath))) this.scheduleRebuild();
    }
    scheduleRebuild() {
      window.clearTimeout(this._rebuildTimer);
      this._rebuildTimer = window.setTimeout(() => {
        void this.rebuildIndex(false);
      }, 800);
    }
    inlineDelimiter() {
      return String(this.settings.inlineEntryDelimiter || "::").trim() || "::";
    }
    isInlineSourceFile(file) {
      if (!this.settings.inlineEntriesEnabled || !file?.path) return false;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
      const marker = fm["lexis-inline"];
      if (marker === true || marker === 1 || typeof marker === "string" && /^(true|yes|1)$/i.test(marker)) return true;
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
        if (/^\s*```/.test(line)) {
          inFence = !inFence;
          continue;
        }
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
        if (left.toLowerCase() === "color") continue;
        const headingPath = headingStack.filter(Boolean).map((item) => ({ ...item }));
        const categories = headingPath.map((item) => item.name).reverse();
        const category = categories[0] || "";
        out.push({ display: left, file, isAlias: false, tags: /* @__PURE__ */ new Set(), inline: true, annotation: right, category, categories, headingPath, line: lineNo });
      }
      return out;
    }
    extractAliases(file) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!fm) return [];
      const extra = (this.settings.aliasSources || "").split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
      const sources = [.../* @__PURE__ */ new Set(["aliases", "alias", ...extra])];
      const seen = /* @__PURE__ */ new Set();
      const results = [];
      for (const src of sources) {
        const raw = fm[src];
        if (raw == null || raw === "") continue;
        const values = typeof raw === "string" ? raw.split(/[,，;；]/) : Array.isArray(raw) ? raw : [raw];
        for (const x of values) {
          const s = typeof x === "string" || typeof x === "number" ? String(x).trim() : "";
          if (!s || s.toLowerCase() === "null") continue;
          if (!seen.has(s)) {
            seen.add(s);
            results.push(s);
          }
        }
      }
      return results;
    }
    getTags(file) {
      const cache = this.app.metadataCache.getFileCache(file);
      const set = /* @__PURE__ */ new Set();
      const fm = cache?.frontmatter;
      if (fm) {
        const rawTags = fm.tags ?? fm.tag ?? [];
        const tags = typeof rawTags === "string" ? rawTags.split(/[,，;；\s]+/) : Array.isArray(rawTags) ? rawTags : [rawTags];
        for (const value of tags) {
          const s = typeof value === "string" || typeof value === "number" ? String(value).trim().replace(/^#/, "") : "";
          if (s && s.toLowerCase() !== "null") set.add(s.toLowerCase());
        }
      }
      if (cache?.tags) for (const tg of cache.tags) {
        const s = (tg.tag || "").replace(/^#/, "");
        if (s) set.add(s.toLowerCase());
      }
      return set;
    }
    async rebuildIndex(notify) {
      const buildId = (this._indexBuildId || 0) + 1;
      this._indexBuildId = buildId;
      const index = /* @__PURE__ */ new Map();
      const selfKeysByPath = /* @__PURE__ */ new Map();
      const today = todayStr();
      let words = 0, aliases = 0, inlineEntries = 0, due = 0;
      const inlineCategoryOccurrences = /* @__PURE__ */ new Map();
      const files = this.app.vault.getMarkdownFiles().filter((f) => this.isVocabFile(f));
      const vocabPaths = new Set(files.map((f) => f.path));
      for (const file of files) {
        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter || {};
        const tags = this.getTags(file);
        const display = file.basename;
        const key = display.toLowerCase();
        const own = /* @__PURE__ */ new Set([key]);
        const archived = fm["lexis-status"] === "archived";
        const retired = fm["lexis-status"] === "retired";
        const pinned = !!fm["lexis-pinned"];
        const sRaw = Number(fm["lexis-s"]);
        const cardS = fm["lexis-s"] == null || isNaN(sRaw) ? null : sRaw;
        if (!index.has(key)) {
          index.set(key, { display, file, isAlias: false, tags, archived, retired, pinned, cardS });
          words++;
        }
        if (this.settings.includeAliases) {
          for (const a of this.extractAliases(file)) {
            const ak = a.toLowerCase();
            own.add(ak);
            if (!index.has(ak)) {
              index.set(ak, { display: a, file, isAlias: true, tags, archived, retired, pinned, cardS });
              aliases++;
            }
          }
        }
        selfKeysByPath.set(file.path, own);
        if (!archived && !retired && (fm["lexis-s"] == null || !fm["lexis-due"] || String(fm["lexis-due"]).slice(0, 10) <= today)) due++;
      }
      const inlineFiles = this.app.vault.getMarkdownFiles().filter((f) => this.isInlineSourceFile(f));
      const inlineSourcePaths = new Set(inlineFiles.map((f) => f.path));
      const parsed = await Promise.all(inlineFiles.map(async (file) => {
        try {
          return this.parseInlineEntries(await this.app.vault.cachedRead(file), file);
        } catch {
          return [];
        }
      }));
      if (buildId !== this._indexBuildId) return this.stats;
      for (const entries of parsed) {
        const own = /* @__PURE__ */ new Set();
        for (const entry of entries) {
          const key = entry.display.toLowerCase();
          own.add(key);
          const headingPath = entry.headingPath || [];
          const heading = headingPath[headingPath.length - 1];
          if (heading) {
            const id = `${entry.file.path}::${heading.name}`;
            let node = inlineCategoryOccurrences.get(id);
            if (!node) {
              node = { id, name: heading.name, level: heading.level, line: heading.line, file: entry.file, count: 0 };
              inlineCategoryOccurrences.set(id, node);
            }
            node.count++;
          }
          if (!index.has(key)) {
            index.set(key, entry);
            inlineEntries++;
          }
        }
        if (entries.length) selfKeysByPath.set(entries[0].file.path, own);
      }
      this.vocabPaths = vocabPaths;
      this.inlineSourcePaths = inlineSourcePaths;
      const legacyRank = new Map((this.settings.inlineCategoryOrder || []).map((name, index2) => [name, index2]));
      this.inlineCategoryOccurrences = [...inlineCategoryOccurrences.values()].sort((a, b) => {
        const ar = legacyRank.has(a.name) ? legacyRank.get(a.name) : Number.MAX_SAFE_INTEGER;
        const br = legacyRank.has(b.name) ? legacyRank.get(b.name) : Number.MAX_SAFE_INTEGER;
        return ar - br || a.name.localeCompare(b.name) || a.file.path.localeCompare(b.file.path) || a.line - b.line;
      });
      const categories = /* @__PURE__ */ new Map();
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
        new Notice4(this.t("notice.indexBuilt", { scope, words, aliases: aliasPart, inline: inlinePart }));
      }
      return this.stats;
    }
    buildMatcher() {
      let keys = [...this.index.keys()].filter((key) => key.length >= 2 || [...key].some((character) => (character.codePointAt(0) || 0) > 127));
      const exc = this.excludeTagSet();
      if (exc.size) keys = keys.filter((k) => {
        const e = this.index.get(k);
        return !(e && e.tags && [...e.tags].some((t) => exc.has(t)));
      });
      keys = keys.filter((k) => {
        const e = this.index.get(k);
        return !(e && e.retired);
      });
      keys.sort((a, b) => b.length - a.length);
      this._indexKeysByCompact = /* @__PURE__ */ new Map();
      for (const key of this.index.keys()) {
        this._indexKeysByCompact.set(key, key);
        const compact = compactMixedScriptSpacing2(key);
        if (!this._indexKeysByCompact.has(compact)) this._indexKeysByCompact.set(compact, key);
      }
      this._matchKeysByCompact = /* @__PURE__ */ new Map();
      for (const key of keys) {
        this._matchKeysByCompact.set(key, key);
        const compact = compactMixedScriptSpacing2(key);
        if (!this._matchKeysByCompact.has(compact)) this._matchKeysByCompact.set(compact, key);
      }
      if (!keys.length) {
        this._pattern = null;
        return;
      }
      this._pattern = keys.map(boundedSource2).join("|");
    }
    resolveIndexKey(value) {
      const key = String(value || "").toLowerCase();
      return this._indexKeysByCompact.get(key) || this._indexKeysByCompact.get(compactMixedScriptSpacing2(key)) || key;
    }
    resolveMatchKey(value) {
      const key = String(value || "").toLowerCase();
      return this._matchKeysByCompact.get(key) || this._matchKeysByCompact.get(compactMixedScriptSpacing2(key)) || key;
    }
    updateStatusBar() {
      if (!this.statusBarEl) return;
      const aliasPart = this.settings.includeAliases && this.stats.aliases ? this.t("status.aliases", { count: this.stats.aliases }) : "";
      const inlinePart = this.stats.inlineEntries ? this.t("status.inline", { count: this.stats.inlineEntries }) : "";
      const duePart = this.stats.due ? ` \xB7 \u23F0${this.stats.due}` : "";
      const bridgePart = this.bridge?.running ? " \xB7 \u{1F310}" : "";
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
    inlineClassificationMode() {
      return this.settings.inlineClassificationMode === "file" ? "file" : "heading";
    }
    inlineSourceKey(entry) {
      return entry.file.path && entry.category ? `${entry.file.path}::${entry.category}` : "";
    }
    // 最近标题模式让所有同名标题共享外观；文件模式让同一来源文件共享外观。Markdown 祖先标题不参与。
    inlineCategoryColor(entry) {
      if (!entry?.inline) return "";
      const fileMode = this.inlineClassificationMode() === "file";
      const colors = fileMode ? this.settings.inlineFileColors || {} : this.settings.inlineCategoryColors || {};
      const key = fileMode ? entry.file?.path : entry.category;
      return String(colors[key || ""] || "").trim();
    }
    // 分类透明度使用和颜色相同的分类键；没有单独配置时沿用全局透明度。
    inlineCategoryOpacity(entry) {
      if (!entry?.inline) return null;
      const fileMode = this.inlineClassificationMode() === "file";
      const opacities = fileMode ? this.settings.inlineFileOpacity || {} : this.settings.inlineCategoryOpacity || {};
      const key = fileMode ? entry.file?.path : entry.category;
      if (!key || !Object.prototype.hasOwnProperty.call(opacities, key)) return null;
      const opacity = Number(opacities[key]);
      return isNaN(opacity) ? null : Math.max(0.1, Math.min(1, opacity));
    }
    highlightVisibleForEntry(entry, includeDictionary = true) {
      if (includeDictionary && this.dictSettingForFile(entry?.file)?.highlight === false) return false;
      if (!entry?.inline) return true;
      const fileMode = this.inlineClassificationMode() === "file";
      const parents = fileMode ? this.settings.inlineFileHighlight || {} : this.settings.inlineCategoryHighlight || {};
      const parentKey = fileMode ? entry.file?.path : entry.category;
      if (parentKey && parents[parentKey] === false) return false;
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
        if (folder && (wf === folder || wf.startsWith(folder + "/")) && folder.length > bestLen) {
          best = row;
          bestLen = folder.length;
        }
      }
      return best;
    }
    inlineStyleForEntry(entry, opts = {}) {
      let color = opts?.external ? this.effectiveHighlightColor() : this.settings.highlightColor || "var(--text-accent)";
      let styleKind = this.settings.highlightStyle || "wavy";
      const dc = this.dictColorForFile(entry && entry.file);
      if (dc) color = dc;
      if (entry?.tags && this.settings.tagRules?.length) {
        const rule = this.settings.tagRules.find((r) => r.tag && entry.tags.has(r.tag.toLowerCase()));
        if (rule) {
          if (rule.color) color = rule.color;
          if (rule.style) styleKind = rule.style;
        }
      }
      const inlineColor = this.inlineCategoryColor(entry);
      if (inlineColor) color = inlineColor;
      if (opts && opts.pdf) return "--lexis-hl-underline:none;--lexis-hl-background:transparent;";
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
    currentHighlightPage(leaf = this.app.workspace.getMostRecentLeaf()) {
      if (!leaf) return null;
      const view = leaf.view;
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
    syncActivePageHighlightState(leaf = this.app.workspace.getMostRecentLeaf()) {
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
      new Notice4(this.t(state.hidden ? "notice.highlightsHidden" : "notice.highlightsShown"));
    }
    refreshAllViews() {
      this.app.workspace.iterateAllLeaves((leaf) => {
        const view = leaf.view;
        const pm = view.previewMode;
        if (pm && typeof pm.rerender === "function") pm.rerender(true);
        const cm = view.editor?.cm;
        if (this._liveRefreshEffect && cm?.dispatch) {
          try {
            cm.dispatch({ effects: this._liveRefreshEffect.of(void 0) });
          } catch {
          }
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
      this.wrapMatchesInElement(el, "code,pre,a,.lexis-hl,.lexis-popover,.math,.tag", {}, selfKeys);
    }
    // 把 el 内文本节点里命中词库的片段包成 <span class="lexis-hl">(供阅读模式 + PDF 复用)。
    // rejectSelector:父元素命中则跳过该文本节点(避免重复包/包进代码块等)。
    // excludeKeys:命中这些 key 时只留纯文本不高亮(词条笔记里不高亮自己的标题/别名,但别的词照常高亮)。
    wrapMatchesInElement(el, rejectSelector, styleOpts = {}, excludeKeys = null) {
      if (!this._pattern || !this.index.size) return;
      const doc = el.ownerDocument || document;
      const regex = new RegExp(this._pattern, "gi");
      const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p || rejectSelector && p.closest(rejectSelector)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const targets = [];
      let n;
      while (n = walker.nextNode()) if (n.nodeType === Node.TEXT_NODE) targets.push(n);
      for (const node of targets) {
        const text = node.nodeValue || "";
        regex.lastIndex = 0;
        if (!regex.test(text)) continue;
        regex.lastIndex = 0;
        const frag = createFragment();
        let last = 0;
        let m;
        while (m = regex.exec(text)) {
          if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
          const key = this.resolveMatchKey(m[0]);
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
        const editorInfoField2 = obsidian.editorInfoField;
        const refreshEffect = import_state.StateEffect.define();
        this._liveRefreshEffect = refreshEffect;
        const buildDecorations = (view) => {
          const builder = new import_state.RangeSetBuilder();
          if (!this.settings.enableHighlight || !this.settings.enableLivePreview || !this._pattern) return builder.finish();
          let selfKeys = null;
          if (editorInfoField2) {
            try {
              const info = view.state.field(editorInfoField2, false);
              if (info?.file?.path) selfKeys = this.selfKeysFor(info.file.path);
            } catch {
            }
          }
          const regex = new RegExp(this._pattern, "gi");
          for (const { from, to } of view.visibleRanges) {
            const text = view.state.doc.sliceString(from, to);
            regex.lastIndex = 0;
            let match;
            while (match = regex.exec(text)) {
              const key = this.resolveMatchKey(match[0]);
              if (selfKeys?.has(key)) {
                if (match[0].length === 0) regex.lastIndex++;
                continue;
              }
              const start = from + match.index;
              const end = start + match[0].length;
              const entry = this.index.get(key);
              if (entry && !entry.inline) this.passiveEncounter(entry.file);
              builder.add(start, end, import_view.Decoration.mark({ class: "lexis-hl", attributes: { "data-lexis-key": key, style: this.inlineStyleForEntry(entry) } }));
              if (match[0].length === 0) regex.lastIndex++;
            }
          }
          return builder.finish();
        };
        const ext = import_view.ViewPlugin.fromClass(
          class {
            constructor(view) {
              this.decorations = buildDecorations(view);
            }
            update(update) {
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
        console.warn("[Lexis] \u5B9E\u65F6\u9884\u89C8\u9AD8\u4EAE\u4E0D\u53EF\u7528:", err);
      }
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(HighlightEngine.prototype);
  return descriptors;
}

// src/document-highlights.ts
function createDocumentHighlights() {
  class DocumentHighlights {
    // ---------- PDF 高亮(钩 pdf.js 文字层) ----------
    // pdf.js 会把同一行甚至同一个词拆成多个 span。普通 TreeWalker 只能逐文本节点匹配，
    // 所以 PDF 先按几何位置还原短的视觉行，再把跨片段命中映射回原文本节点。
    pdfTextRuns(layer) {
      const doc = layer.ownerDocument || document;
      const walker = doc.createTreeWalker(layer, NodeFilter.SHOW_TEXT, {
        acceptNode: (node2) => {
          if (!node2.nodeValue || !node2.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node2.parentElement;
          if (!parent || parent.closest(".lexis-hl,.lexis-popover")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const parts = [];
      let node;
      while (node = walker.nextNode()) {
        try {
          const range = doc.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          parts.push({ node, text: node.nodeValue || "", rect });
        } catch {
        }
      }
      const runs = [];
      for (const part of parts) {
        const last = runs[runs.length - 1];
        const center = part.rect.top + part.rect.height / 2;
        const sameLine = last && Math.abs(center - last.center) <= Math.max(2, Math.min(last.height, part.rect.height) * 0.45);
        const gap = last ? part.rect.left - last.right : 0;
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
        text.push(" ");
        map.push(source || null);
      };
      const appendPart = (part) => {
        for (let i = 0; i < part.text.length; i++) {
          const ch = part.text[i];
          if (/\s/.test(ch)) appendSpace({ node: part.node, offset: i });
          else {
            text.push(ch);
            map.push({ node: part.node, offset: i });
          }
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
      while (text[0] === " ") {
        text.shift();
        map.shift();
      }
      while (text[text.length - 1] === " ") {
        text.pop();
        map.pop();
      }
      return { text: text.join(""), map };
    }
    wrapPdfFragmentMatches(layer) {
      if (!this._pattern || !this.index.size) return;
      const runs = this.pdfTextRuns(layer);
      if (!runs.length) return;
      const streams = runs.map((run) => this.pdfRunStream(run));
      const candidates = [];
      const nodeOrder = /* @__PURE__ */ new WeakMap();
      const regex = new RegExp(this._pattern, "gi");
      let order = 0;
      for (const run of runs) for (const part of run.parts) if (!nodeOrder.has(part.node)) nodeOrder.set(part.node, order++);
      const collect = (stream, accepts, droppedHyphen) => {
        regex.lastIndex = 0;
        let match;
        while (match = regex.exec(stream.text)) {
          const refs = stream.map.slice(match.index, match.index + match[0].length).filter((ref) => ref !== null);
          if (!refs.length || !accepts(refs)) {
            if (!match[0].length) regex.lastIndex++;
            continue;
          }
          const key = this.resolveMatchKey(match[0]);
          const entry = this.index.get(key);
          if (!entry) continue;
          const byNode = /* @__PURE__ */ new Map();
          for (const ref of refs) {
            const current = byNode.get(ref.node);
            if (current) {
              current.start = Math.min(current.start, ref.offset);
              current.end = Math.max(current.end, ref.offset + 1);
            } else byNode.set(ref.node, { node: ref.node, start: ref.offset, end: ref.offset + 1 });
          }
          if (droppedHyphen && byNode.has(droppedHyphen.node)) {
            const segment = byNode.get(droppedHyphen.node);
            segment.end = Math.max(segment.end, droppedHyphen.offset + 1);
          }
          const segments = [...byNode.values()].sort((a, b) => (nodeOrder.get(a.node) || 0) - (nodeOrder.get(b.node) || 0));
          candidates.push({ key, entry, segments, length: match[0].length });
          if (!match[0].length) regex.lastIndex++;
        }
      };
      for (let i = 0; i < runs.length; i++) {
        collect(streams[i], (refs) => new Set(refs.map((ref) => ref.node)).size > 1, null);
      }
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
          if (score < bestScore) {
            bestScore = score;
            nextIndex = j;
          }
        }
        if (nextIndex < 0) continue;
        const left = streams[i], right = streams[nextIndex];
        if (!left.text || !right.text) continue;
        const leftNodes = new Set(runs[i].parts.map((part) => part.node));
        const rightNodes = new Set(runs[nextIndex].parts.map((part) => part.node));
        const crossesLines = (refs) => refs.some((ref) => leftNodes.has(ref.node)) && refs.some((ref) => rightNodes.has(ref.node));
        const combine = (leftText, leftMap, separator) => ({
          text: leftText + separator + right.text,
          map: leftMap.concat(separator ? [null] : [], right.map)
        });
        const hyphen = /[-\u00ad\u2010\u2011]$/.test(left.text);
        if (hyphen) {
          const dropped = left.map[left.map.length - 1];
          collect(combine(left.text.slice(0, -1), left.map.slice(0, -1), ""), crossesLines, dropped);
          collect(combine(left.text, left.map, ""), crossesLines, null);
        } else {
          collect(combine(left.text, left.map, ""), crossesLines, null);
          collect(combine(left.text, left.map, " "), crossesLines, null);
        }
      }
      candidates.sort((a, b) => b.length - a.length || a.segments[0].start - b.segments[0].start);
      const used = /* @__PURE__ */ new WeakMap();
      const accepted = [];
      const signatures = /* @__PURE__ */ new Set();
      for (const candidate of candidates) {
        const signature = candidate.key + "|" + candidate.segments.map((s) => `${nodeOrder.get(s.node)}:${s.start}-${s.end}`).join(",");
        if (signatures.has(signature)) continue;
        signatures.add(signature);
        const overlaps = candidate.segments.some((segment) => (used.get(segment.node) || []).some((range) => segment.start < range.end && segment.end > range.start));
        if (overlaps) continue;
        for (const segment of candidate.segments) {
          const ranges = used.get(segment.node) || [];
          ranges.push(segment);
          used.set(segment.node, ranges);
        }
        accepted.push(candidate);
      }
      const rangesByNode = /* @__PURE__ */ new Map();
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
          const span = doc.body.createSpan();
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
    setupPdfHighlight(document2 = this._pdfDocument || this.app.workspace.containerEl.ownerDocument) {
      this.teardownPdfHighlight();
      this._pdfDocument = document2;
      this._pdfWindow = document2.defaultView || window;
      const observerWindow = this._pdfWindow;
      this._pdfObservedLayers = /* @__PURE__ */ new WeakSet();
      this._pdfObservedSizes = /* @__PURE__ */ new WeakMap();
      const MutationObserverConstructor = observerWindow.MutationObserver;
      if (!this.settings.enablePdfHighlight || !MutationObserverConstructor) return;
      this._pdfPending = /* @__PURE__ */ new Set();
      const flush = () => {
        this._pdfRaf = 0;
        const next = this._pdfPending.values().next();
        if (!next.done) {
          this._pdfPending.delete(next.value);
          if (next.value.isConnected) {
            this.scanPdfLayer(next.value);
            next.value.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.remove("is-geometry-changing");
          }
        }
        if (this._pdfPending.size) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
        else document2.querySelectorAll(".lexis-pdf-hl-layer.is-geometry-changing").forEach((element) => element.classList.remove("is-geometry-changing"));
      };
      const scheduleFlush = (delay = 0) => {
        if (delay) {
          if (this._pdfResizeTimer || this._pdfRaf) return;
          this._pdfResizeTimer = this._pdfWindow?.setTimeout(() => {
            this._pdfResizeTimer = 0;
            if (!this._pdfRaf) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
          }, delay) || 0;
        } else if (this._pdfPending.size && !this._pdfRaf) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
      };
      this._pdfScheduleFlush = scheduleFlush;
      const ResizeObserverConstructor = observerWindow.ResizeObserver;
      if (ResizeObserverConstructor) {
        this._pdfResizeObserver = new ResizeObserverConstructor((entries) => {
          for (const entry of entries) {
            const target = entry.target;
            const size = `${entry.contentRect.width}:${entry.contentRect.height}`;
            const previousSize = this._pdfObservedSizes?.get(target);
            this._pdfObservedSizes?.set(target, size);
            if (previousSize == null || previousSize === size) continue;
            const layer = target.classList.contains("textLayer") ? target : target.querySelector(".textLayer");
            if (layer) this.markPdfGeometryChanging(layer);
          }
          if (this._pdfPending.size) scheduleFlush(220);
        });
      }
      this._pdfObserver = new MutationObserverConstructor((muts) => {
        let geometryChanged = false;
        for (const mu of muts) {
          const targetElement = mu.target.nodeType === 1 ? mu.target : mu.target.parentElement;
          if (targetElement && !targetElement.closest(".lexis-hl,.lexis-pdf-hl-layer")) {
            const containingLayer = targetElement.classList.contains("textLayer") ? targetElement : targetElement.closest(".textLayer");
            if (containingLayer) {
              this.markPdfGeometryChanging(containingLayer);
              geometryChanged = true;
            } else if (targetElement.matches(".page, .canvasWrapper, canvas")) {
              const page = targetElement.classList.contains("page") ? targetElement : targetElement.closest(".page");
              const layer = page?.querySelector(":scope > .textLayer");
              if (layer) {
                this.markPdfGeometryChanging(layer);
                geometryChanged = true;
              }
            }
          }
          if (mu.type === "attributes") continue;
          for (const node of mu.addedNodes) {
            if (node.nodeType !== 1) continue;
            const element = node;
            if (element.classList.contains("lexis-hl") || element.closest(".lexis-hl")) continue;
            if (element.classList.contains("textLayer")) {
              this.markPdfGeometryChanging(element);
              geometryChanged = true;
            } else element.querySelectorAll(".textLayer").forEach((layer) => {
              this.markPdfGeometryChanging(layer);
              geometryChanged = true;
            });
          }
        }
        if (geometryChanged) scheduleFlush(220);
      });
      this._pdfObserver.observe(document2.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
      document2.querySelectorAll(".textLayer").forEach((layer) => this.markPdfGeometryChanging(layer));
      scheduleFlush();
    }
    observePdfLayer(layer) {
      if (!this._pdfResizeObserver || !layer || this._pdfObservedLayers?.has(layer)) return;
      try {
        this._pdfObservedLayers.add(layer);
        this._pdfResizeObserver.observe(layer);
        if (layer.parentElement) this._pdfResizeObserver.observe(layer.parentElement);
      } catch {
      }
    }
    markPdfGeometryChanging(layer) {
      if (!layer?.isConnected) return;
      this._pdfPending?.add(layer);
      layer.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.add("is-geometry-changing");
    }
    scanPdfLayer(layer) {
      if (!this.settings.enablePdfHighlight || !this.settings.enableHighlight) return;
      this.observePdfLayer(layer);
      this.wrapPdfFragmentMatches(layer);
      this.wrapMatchesInElement(layer, ".lexis-hl,.lexis-popover", { pdf: true });
      const page = layer.parentElement;
      if (!page) return;
      if (getComputedStyle(page).position === "static") page.setCssStyles({ position: "relative" });
      let hl = page.querySelector(":scope > .lexis-pdf-hl-layer");
      if (!hl) {
        hl = page.createDiv({ cls: "lexis-pdf-hl-layer" });
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
        pointerEvents: "none"
      });
      hl.empty();
      const spans = layer.querySelectorAll(".lexis-hl");
      for (const s of spans) {
        const key = s.dataset.lexisKey;
        if (!key) continue;
        const entry = this.index.get(key);
        if (!entry) continue;
        if (entry.archived || !this.highlightVisibleForEntry(entry)) continue;
        try {
          const color = this.colorForEntry(entry);
          const alpha = Math.max(0.04, Math.min(0.75, this.highlightAlphaForEntry(entry) * 0.65));
          const rects = Array.from(s.getClientRects()).filter((rect) => rect.width && rect.height);
          for (const rect of rects.length ? rects : [s.getBoundingClientRect()]) {
            const d = hl.createDiv({ cls: "lexis-pdf-hl" });
            d.dataset.lexisKey = key;
            d.setCssStyles({
              position: "absolute",
              left: `${(rect.left - hlBB.left) / scaleX}px`,
              top: `${(rect.top - hlBB.top) / scaleY}px`,
              width: `${rect.width / scaleX}px`,
              height: `${rect.height / scaleY}px`,
              background: this.applyAlpha(color, alpha),
              borderRadius: "2px",
              pointerEvents: "auto"
            });
            hl.appendChild(d);
          }
        } catch {
        }
      }
    }
    teardownPdfHighlight() {
      const document2 = this._pdfDocument;
      const hostWindow = this._pdfWindow || window;
      if (this._pdfObserver) {
        this._pdfObserver.disconnect();
        this._pdfObserver = null;
      }
      if (this._pdfRaf) {
        hostWindow.cancelAnimationFrame(this._pdfRaf);
        this._pdfRaf = 0;
      }
      if (this._pdfResizeObserver) {
        this._pdfResizeObserver.disconnect();
        this._pdfResizeObserver = null;
      }
      if (this._pdfResizeTimer) {
        hostWindow.clearTimeout(this._pdfResizeTimer);
        this._pdfResizeTimer = 0;
      }
      this._pdfScheduleFlush = null;
      this._pdfObservedLayers = null;
      this._pdfObservedSizes = null;
      if (document2) {
        document2.querySelectorAll(".lexis-pdf-hl-layer").forEach((layer) => layer.remove());
        document2.querySelectorAll(".textLayer .lexis-hl").forEach((span) => {
          const text = document2.createTextNode(span.textContent || "");
          span.parentNode?.replaceChild(text, span);
        });
      }
      this._pdfDocument = null;
      this._pdfWindow = null;
    }
    // 词库/配色变化后,清掉 PDF 里旧高亮再重扫(.lexis-hl 拆回纯文本)
    rescanPdfLayers() {
      const document2 = this._pdfDocument || this.app.workspace.containerEl.ownerDocument;
      document2.querySelectorAll(".textLayer .lexis-hl").forEach((span) => {
        const text = document2.createTextNode(span.textContent || "");
        span.parentNode?.replaceChild(text, span);
      });
      document2.querySelectorAll(".lexis-pdf-hl-layer").forEach((layer) => layer.remove());
      document2.querySelectorAll(".textLayer").forEach((layer) => {
        layer.normalize();
        this.markPdfGeometryChanging(layer);
      });
      this._pdfScheduleFlush?.();
    }
    // ---------- 第三方 EPUB 阅读器高亮 ----------
    // EPUB Marginalia 与 ePub Reader 都用 epub.js,章节放在同源 iframe 中。
    // 主文档的事件/TreeWalker 无法穿透 iframe,所以只对 epub.js 的 iframe 单独注入。
    isEpubIframe(frame) {
      return frame.tagName === "IFRAME" && (frame.hasAttribute("enable-annotation") || frame.matches?.(".epub-reader-area iframe, .epub-container iframe, .epub-view iframe") || frame.closest(".epub-reader-area, .epub-container, .epub-view")) != null;
    }
    setupEpubIframeHighlight(document2 = this._epubHostDocument || this.app.workspace.containerEl.ownerDocument) {
      this.teardownEpubIframeHighlight();
      this._epubHostDocument = document2;
      this._epubIframeFrames = /* @__PURE__ */ new WeakSet();
      this._epubIframeDocs = /* @__PURE__ */ new Map();
      const MutationObserverConstructor = document2.defaultView?.MutationObserver || MutationObserver;
      this._epubIframeObserver = new MutationObserverConstructor((muts) => {
        for (const mu of muts) for (const node of mu.addedNodes) {
          if (node.nodeType !== 1) continue;
          const element = node;
          if (this.isEpubIframe(element)) this.observeEpubIframe(element);
          element.querySelectorAll("iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe").forEach((frame) => this.observeEpubIframe(frame));
        }
      });
      this._epubIframeObserver.observe(document2.body, { childList: true, subtree: true });
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
      try {
        doc = frame.contentDocument;
      } catch {
        return;
      }
      if (!doc?.body) return;
      doc.querySelectorAll(".lexis-hl").forEach((span) => {
        const textNode = doc.createTextNode(span.textContent || "");
        span.parentNode?.replaceChild(textNode, span);
      });
      doc.body.normalize();
      this.wrapMatchesInElement(doc.body, "script,style,code,pre,.lexis-hl,.lexis-popover", { external: true });
      if (this._epubIframeDocs.has(doc)) return;
      const over = (event) => this.onMouseOver(event);
      const out = (event) => this.onMouseOut(event);
      const click = (event) => this.onClick(event);
      const mouseup = (event) => this.maybeShowSelPill(event, true);
      doc.addEventListener("mouseover", over);
      doc.addEventListener("mouseout", out);
      doc.addEventListener("click", click);
      doc.addEventListener("mouseup", mouseup);
      this._epubIframeDocs.set(doc, { over, out, click, mouseup });
    }
    rescanEpubIframes() {
      const document2 = this._epubHostDocument || this.app.workspace.containerEl.ownerDocument;
      document2.querySelectorAll("iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe").forEach((frame) => this.observeEpubIframe(frame));
    }
    teardownEpubIframeHighlight() {
      if (this._epubIframeObserver) {
        this._epubIframeObserver.disconnect();
        this._epubIframeObserver = null;
      }
      if (this._epubIframeDocs) {
        for (const [doc, hooks] of this._epubIframeDocs) {
          doc.removeEventListener("mouseover", hooks.over);
          doc.removeEventListener("mouseout", hooks.out);
          doc.removeEventListener("click", hooks.click);
          doc.removeEventListener("mouseup", hooks.mouseup);
        }
      }
      this._epubIframeDocs = null;
      this._epubIframeFrames = null;
      this._epubHostDocument = null;
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(DocumentHighlights.prototype);
  return descriptors;
}

// src/reader-interactions.ts
var obsidian2 = __toESM(require("obsidian"));
function eventElement(target) {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return null;
  const node = target;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return element && "dataset" in element ? element : null;
}
function closestHighlight(target) {
  return eventElement(target)?.closest(".lexis-hl,.lexis-pdf-hl") || null;
}
function overlayDocumentFor(element) {
  const sourceDocument = element.ownerDocument;
  return sourceDocument.defaultView?.frameElement?.ownerDocument || sourceDocument;
}
function createReaderInteractions({ openAliasPicker }) {
  class ReaderInteractions {
    // ---------- 悬浮卡 ----------
    highlightTarget(event) {
      for (const target of event.composedPath()) {
        const highlight = closestHighlight(target);
        if (highlight) return highlight;
      }
      return closestHighlight(event.target);
    }
    onMouseOver(e) {
      const t = this.highlightTarget(e);
      if (!t) return;
      window.clearTimeout(this._hideTimer);
      if (this._popover?.dataset.lexisKey === t.dataset.lexisKey) return;
      if (this._showTarget === t) return;
      window.clearTimeout(this._showTimer);
      this._showTarget = t;
      const open = () => {
        this._showTimer = null;
        if (this._showTarget === t && t.isConnected) void this.showPopover(t);
      };
      const delay = Math.max(0, Number(this.settings.hoverDelayMs) || 0);
      if (delay) this._showTimer = window.setTimeout(open, delay);
      else open();
    }
    onMouseOut(e) {
      const t = this.highlightTarget(e);
      if (!t) return;
      if (this._showTarget === t) {
        window.clearTimeout(this._showTimer);
        this._showTimer = null;
        this._showTarget = null;
      }
      if (this._popover?.dataset.lexisKey === t.dataset.lexisKey) this.scheduleHide();
    }
    onClick(e) {
      const t = this.highlightTarget(e);
      if (t) {
        const entry = this.index.get(t.dataset.lexisKey);
        if (entry) {
          e.preventDefault();
          if (entry.inline) void this.openInlineEntry(entry, e.ctrlKey || e.metaKey);
          else {
            void this.app.workspace.getLeaf(e.ctrlKey || e.metaKey ? "tab" : false).openFile(entry.file);
            this.removePopover();
          }
        }
      } else if (this._popover && !this._popover.contains(eventElement(e.target))) this.removePopover();
    }
    scheduleHide() {
      window.clearTimeout(this._hideTimer);
      this._hideTimer = window.setTimeout(() => {
        if (this._popover?.dataset.lexisResizing !== "1") this.removePopover();
      }, 220);
    }
    removePopover() {
      window.clearTimeout(this._showTimer);
      this._showTimer = null;
      this._showTarget = null;
      if (this._popoverComp) {
        this._popoverComp.unload();
        this._popoverComp = null;
      }
      if (this._popover) {
        this._popover.remove();
        this._popover = null;
      }
    }
    attachPopoverResize(popover, target) {
      const hostWindow = popover.ownerDocument.defaultView || window;
      if (hostWindow.matchMedia?.("(pointer: coarse)").matches) return;
      const handle = popover.createDiv({ cls: "lexis-popover-resize-handle" });
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-label", this.t("popover.resize"));
      handle.setAttribute("title", this.t("popover.resize"));
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        window.clearTimeout(this._hideTimer);
        const start = popover.getBoundingClientRect();
        const startX = event.clientX;
        const startY = event.clientY;
        popover.dataset.lexisResizing = "1";
        try {
          handle.setPointerCapture(event.pointerId);
        } catch {
        }
        const resize = (move) => {
          const maxWidth = Math.max(260, hostWindow.innerWidth - start.left - 10);
          const maxHeight = Math.max(160, hostWindow.innerHeight - start.top - 10);
          const width = Math.max(260, Math.min(maxWidth, start.width + move.clientX - startX));
          const height = Math.max(160, Math.min(maxHeight, start.height + move.clientY - startY));
          popover.setCssStyles({ width: `${width}px`, height: `${height}px`, maxHeight: `${height}px` });
        };
        const finish = (cancelled) => {
          handle.removeEventListener("pointermove", resize);
          handle.removeEventListener("pointerup", onPointerUp);
          handle.removeEventListener("pointercancel", onPointerCancel);
          delete popover.dataset.lexisResizing;
          if (cancelled) {
            popover.setCssStyles({ width: `${start.width}px`, height: `${start.height}px`, maxHeight: `${start.height}px` });
          } else {
            const result = popover.getBoundingClientRect();
            this.settings.popoverWidth = Math.round(result.width);
            this.settings.popoverMaxHeight = Math.round(result.height);
            void this.saveSettings();
          }
          this.positionPopover(popover, target);
        };
        const onPointerUp = () => finish(false);
        const onPointerCancel = () => finish(true);
        handle.addEventListener("pointermove", resize);
        handle.addEventListener("pointerup", onPointerUp);
        handle.addEventListener("pointercancel", onPointerCancel);
      });
    }
    // ---------- 划词添加药丸(普通笔记,阅读/编辑两种模式) ----------
    removeSelPill() {
      if (this._selPill) {
        this._selPill.remove();
        this._selPill = null;
      }
    }
    maybeShowSelPill(e, fromEpubIframe = false) {
      if (!this.settings.selectionPill) return;
      const tgt = eventElement(e.target);
      if (tgt?.closest(".lexis-sel-pill, .lexis-popover, .menu")) return;
      const sourceDoc = tgt?.ownerDocument || document;
      const sourceWin = sourceDoc.defaultView || window;
      const overlayDoc = tgt ? overlayDocumentFor(tgt) : sourceDoc;
      const overlayWin = overlayDoc.defaultView || window;
      let sel, text;
      try {
        sel = sourceWin.getSelection();
        text = sel ? sel.toString().trim() : "";
      } catch {
        return;
      }
      if (!text || text.length > 60 || /[\n\r]/.test(text)) {
        this.removeSelPill();
        return;
      }
      const node = sel.anchorNode;
      const host = node ? node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement : null;
      if (!host || !fromEpubIframe && !host.closest(".markdown-source-view, .markdown-reading-view, .markdown-preview-view, .pdf-viewer, .pdf-container, .pdf-embed, .textLayer")) {
        this.removeSelPill();
        return;
      }
      let rect;
      try {
        rect = sel.getRangeAt(0).getBoundingClientRect();
      } catch {
        return;
      }
      if (!rect || !rect.width && !rect.height) {
        this.removeSelPill();
        return;
      }
      if (sourceWin.frameElement && sourceWin.frameElement.ownerDocument === overlayDoc) {
        const frameRect = sourceWin.frameElement.getBoundingClientRect();
        rect = { left: rect.left + frameRect.left, right: rect.right + frameRect.left, top: rect.top + frameRect.top, bottom: rect.bottom + frameRect.top, width: rect.width, height: rect.height };
      }
      this.removeSelPill();
      const known = this.index.has(this.resolveIndexKey(text));
      const pill = overlayDoc.body.createDiv({ cls: "lexis-sel-pill" });
      pill.addEventListener("mousedown", (ev) => ev.preventDefault());
      if (known) {
        const b = pill.createSpan({ cls: "lexis-sel-pill-btn", text: `\u{1F4D6} ${this.t("selection.openExisting")}` });
        b.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          void this.addFromPill(text, void 0, { openExisting: true });
        });
      } else {
        const dicts = this.dictFolders();
        let selectedFolder = this.preferredSelectionFolder();
        const folderLabel = (f) => String(f || this.t("common.root")).split("/").pop() || "";
        const addB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "\uFF0B" });
        addB.setAttribute("title", this.t("selection.add"));
        addB.setAttribute("aria-label", this.t("selection.add"));
        addB.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          void this.addFromPill(text, selectedFolder);
        });
        if (dicts.length > 1) {
          const folderB = pill.createSpan({ cls: "lexis-sel-pill-btn lexis-sel-pill-folder", text: `\u{1F4C1} ${folderLabel(selectedFolder)}` });
          folderB.setAttribute("title", this.t("selection.chooseDictionary"));
          folderB.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const menu = new obsidian2.Menu();
            for (const f of dicts) menu.addItem((it) => it.setTitle(f || this.t("common.root")).setIcon(f === selectedFolder ? "check" : "folder").onClick(() => {
              selectedFolder = f;
              folderB.setText(`\u{1F4C1} ${folderLabel(f)}`);
              void this.rememberSelectionFolder(f);
            }));
            menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
          });
        }
        const aliasB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "\u{1F517}" });
        aliasB.setAttribute("title", this.t("selection.alias"));
        aliasB.setAttribute("aria-label", this.t("selection.alias"));
        aliasB.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.removeSelPill();
          openAliasPicker(this.app, this, text, (entry) => this.attachAlias(text, entry.file));
        });
      }
      const top = Math.min(rect.bottom + 6, overlayWin.innerHeight - 36);
      const left = Math.max(6, Math.min(rect.left, overlayWin.innerWidth - pill.offsetWidth - 6));
      pill.setCssStyles({ top: top + "px", left: left + "px" });
      this._selPill = pill;
    }
    preferredSelectionFolder() {
      const dicts = this.dictFolders();
      const saved = this.normalizeFolder(this.settings.lastSelectionFolder || "");
      return dicts.includes(saved) ? saved : dicts[0] || "";
    }
    async rememberSelectionFolder(folder) {
      const value = this.normalizeFolder(folder || "");
      if (!this.dictFolders().includes(value) || this.settings.lastSelectionFolder === value) return;
      this.settings.lastSelectionFolder = value;
      await this.saveSettings();
    }
    async addFromPill(text, folder, options = {}) {
      const view = this.app.workspace.getActiveViewOfType(obsidian2.MarkdownView);
      const editor = view && view.getMode && view.getMode() === "source" && view.editor ? view.editor : null;
      this.removeSelPill();
      if (folder) await this.rememberSelectionFolder(folder);
      await this.addWordFromSelection(text, editor, view, folder, options);
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderInteractions.prototype);
  return descriptors;
}

// src/reader-ui.ts
var obsidian3 = __toESM(require("obsidian"));
function errorMessage3(error) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
}
function confirmAction(app, title, message) {
  return new Promise((resolve) => {
    let settled = false;
    class ConfirmModal extends obsidian3.Modal {
      onOpen() {
        this.setTitle(title);
        this.contentEl.createEl("p", { text: message });
        const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
        actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
        actions.createEl("button", { cls: "mod-warning", text: "\u5220\u9664" }).addEventListener("click", () => {
          settled = true;
          resolve(true);
          this.close();
        });
      }
      onClose() {
        this.contentEl.empty();
        if (!settled) resolve(false);
      }
    }
    new ConfirmModal(app).open();
  });
}
function createReaderUi({ buildCurveSVG: buildCurveSVG2, FSRS: FSRS2, addDaysStr, daysBetween: daysBetween2, todayStr, fmtDate, TFile: TFile4, Notice: Notice4, boundedSource: boundedSource2, escapeRe: escapeRe2, Component: Component4, renderLexisMarkdown: renderLexisMarkdown2, openRestoreModal }) {
  class ReaderUi {
    // 遗忘曲线 SVG(FSRS 衰减)
    buildCurveSVG(card) {
      return buildCurveSVG2(card, {
        requestRetention: this.settings.requestRetention,
        nextInterval: (stability, retention) => FSRS2.nextInterval(stability, retention),
        retrievability: (elapsedDays, stability) => FSRS2.retrievability(elapsedDays, stability),
        addDaysStr,
        daysBetween: daysBetween2,
        todayStr
      });
    }
    // 笔记内 ```lexis 代码块:曲线 + 相关词 + 出现过的地方
    async renderLexisBlock(el, ctx, src) {
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      if (!(file instanceof TFile4)) {
        el.setText("Lexis:\u65E0\u6CD5\u8BC6\u522B\u5F53\u524D\u7B14\u8BB0");
        return;
      }
      const word = file.basename;
      el.addClass("lexis-block");
      const parts = (src || "").trim().split(/\s+/).filter(Boolean);
      const m = (parts[0] || "").toLowerCase();
      const typeArg = parts.slice(1).join(" ");
      const countBefore = el.children.length;
      if (m === "derived" || m === "\u6D3E\u751F") {
        await this.renderDerivedWords(el, file);
        if (el.children.length === countBefore) el.remove();
        return;
      }
      const showCurve = m === "" || m === "curve" || m === "all";
      const showRelated = m === "" || m === "refs" || m === "ref" || m === "rel" || m === "related" || m === "all";
      const showOcc = (m === "" || m === "refs" || m === "ref" || m === "occ" || m === "all") && this.settings.showOccurrences;
      if (showCurve) {
        const card = this.readCard(file);
        const svg = this.buildCurveSVG(card);
        if (svg) {
          const due = card.due ? ` \xB7 \u4E0B\u6B21\u590D\u4E60 ${String(card.due).slice(0, 10)}` : "";
          el.createDiv({ cls: "lexis-section-title", text: `\u{1F9E0} \u8BB0\u5FC6\u66F2\u7EBF\uFF08\u590D\u4E60\u65E5\u671F \xD7 \u4FDD\u7559\u7387${due}\uFF09` });
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
        det.createEl("summary", { text: `\u{1F4CD} \u51FA\u73B0\u8FC7\u7684\u5730\u65B9 (${list.length})` });
        const occWrap = det.createDiv();
        const comp = new Component4();
        comp.load();
        for (const o of list) {
          const dd = occWrap.createDiv({ cls: "lexis-occ" });
          await this.renderSentence(dd, o.sentence, word, comp);
          const add = dd.createSpan({ cls: "lexis-occ-add", text: " \u2795" });
          add.setAttribute("title", "\u6536\u85CF\u5230\u51FA\u5904");
          add.addEventListener("click", () => {
            void (async () => {
              if (add.dataset.done) return;
              add.dataset.done = "1";
              if (await this.addExampleToWord(file, o.sentence, o.file, o.page)) {
                add.setText(" \u2713");
                add.setCssStyles({ cursor: "default" });
                add.removeAttribute("title");
              } else delete add.dataset.done;
            })();
          });
          const s2 = dd.createSpan({ cls: "lexis-occ-src", text: " \u2197 " + this.occurrenceLabel(o) });
          s2.addEventListener("click", () => {
            void this.openOccurrence(o.file, word, o.page);
          });
        }
      }
      if (el.children.length === countBefore) el.remove();
    }
    // 把 alias 写进某词条文件的 frontmatter aliases(已存在则跳过,幂等)
    async addAliasToFile(file, alias) {
      if (!(file instanceof TFile4) || !alias) return;
      const inject = (data) => {
        const re = /^---\r?\n([\s\S]*?)\r?\n---/;
        const fm = re.exec(data);
        const line = `  - ${alias}
`;
        if (!fm) return `---
aliases:
${line}---
` + data;
        const body = fm[1];
        if (new RegExp(`(^|\\n)\\s*-\\s*["']?${escapeRe2(alias)}["']?\\s*($|\\n)`).test(body)) return data;
        if (/^aliases:/m.test(body)) return data.slice(0, fm.index) + `---
` + body.replace(/^(aliases:.*)$/m, `$1
${line}`) + `
---` + data.slice(fm.index + fm[0].length);
        return data.slice(0, fm.index) + `---
${body}
aliases:
${line}---` + data.slice(fm.index + fm[0].length);
      };
      if (this.app.vault.process) await this.app.vault.process(file, inject);
      else await this.app.vault.modify(file, inject(await this.app.vault.cachedRead(file)));
    }
    // 把当前选中的词并入目标词条(标题或别名解析到的同一个文件)的 aliases
    async attachAlias(aliasText, file) {
      aliasText = (aliasText || "").trim();
      if (!aliasText || !(file instanceof TFile4)) return;
      if (aliasText.toLowerCase() === file.basename.toLowerCase()) {
        new Notice4(this.t("notice.aliasSelf", { word: aliasText }));
        return;
      }
      try {
        await this.addAliasToFile(file, aliasText);
        await this.rebuildIndex(false);
        const ak = aliasText.toLowerCase();
        if (!this.index.has(ak)) this.index.set(ak, { display: aliasText, file, isAlias: true, tags: this.getTags(file) });
        new Notice4(this.t("notice.aliasAdded", { alias: aliasText, word: file.basename }));
      } catch (err) {
        new Notice4(this.t("notice.aliasFailed", { error: errorMessage3(err) }));
      }
    }
    openAndClose(file) {
      void this.app.workspace.getLeaf(false).openFile(file);
      this.removePopover();
    }
    async openInlineEntry(entry, newTab) {
      const leaf = this.app.workspace.getLeaf(newTab ? "tab" : false);
      await leaf.openFile(entry.file);
      try {
        const editor = leaf.view.editor;
        if (editor) {
          const offset = String(editor.getValue() || "").split(/\r?\n/).slice(0, entry.line || 0).reduce((n, line) => n + line.length + 1, 0);
          const pos = editor.offsetToPos(offset);
          editor.setCursor(pos);
          editor.scrollIntoView({ from: pos, to: pos }, true);
        }
      } catch {
      }
      this.removePopover();
    }
    async openOccurrence(file, word, page) {
      let leaf = this._occLeaf;
      if (!leaf || !leaf.parent) {
        leaf = this.app.workspace.getLeaf("tab");
        this._occLeaf = leaf;
      }
      await leaf.openFile(file, page ? { eState: { subpath: `#page=${page}` } } : void 0);
      await this.app.workspace.revealLeaf(leaf);
      try {
        const ed = leaf.view.editor;
        if (ed && word) {
          const m = new RegExp(boundedSource2(word), "i").exec(ed.getValue());
          if (m) {
            const pos = ed.offsetToPos(m.index);
            ed.setCursor(pos);
            ed.scrollIntoView({ from: pos, to: ed.offsetToPos(m.index + word.length) }, true);
          }
        }
      } catch {
      }
      this.removePopover();
    }
    renderHeatmap(el) {
      const log = this.settings.reviewLog || {};
      const weeks = 18;
      const today = /* @__PURE__ */ new Date();
      const max = Math.max(1, ...Object.values(log).map(Number));
      const grid = el.createDiv({ cls: "lexis-hm-grid" });
      const cur = new Date(today);
      cur.setDate(cur.getDate() - (weeks * 7 - 1));
      cur.setDate(cur.getDate() - cur.getDay());
      let total = 0;
      for (let w = 0; w <= weeks; w++) {
        const col = grid.createDiv({ cls: "lexis-hm-col" });
        for (let dch = 0; dch < 7; dch++) {
          const ds = fmtDate(cur);
          const cell = col.createDiv({ cls: "lexis-hm-cell" });
          if (cur > today) cell.addClass("lexis-hm-future");
          else {
            const c = Number(log[ds]) || 0;
            total += c;
            if (c > 0) cell.addClass("lexis-hm-l" + Math.min(4, Math.ceil(c / max * 4)));
            cell.setAttribute("title", this.t("home.heatmapDay", { date: ds, count: c }));
          }
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
      stats.createDiv({ cls: "lexis-stat", text: `\u23F0 ${this.t("home.due", { count: st.due })}` });
      stats.createDiv({ cls: "lexis-stat", text: `\u2728 ${this.t("home.new", { count: st.fresh })}` });
      stats.createDiv({ cls: "lexis-stat", text: `\u{1F4DA} ${this.t("home.total", { count: st.total })}` });
      const hmWrap = el.createDiv({ cls: "lexis-hm-wrap lexis-home-block-hm" });
      hmWrap.setAttribute("title", this.t("home.openTitle"));
      this.renderHeatmap(hmWrap);
      hmWrap.addEventListener("click", () => this.openHome());
      const btnRow = el.createDiv({ cls: "lexis-home-block-btns" });
      const reviewBtn = btnRow.createEl("button", { cls: "mod-cta", text: `\u25B6 ${this.t("home.start")}` });
      reviewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openReview();
      });
      const homeBtn = btnRow.createEl("button", { text: `\u{1F4D5} ${this.t("home.open")}` });
      homeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openHome();
      });
    }
    // 把 el 内命中 word 的文本包一层 <b>(渲染完的 DOM 上原地操作,供出处预览统一复用)
    boldMatchesInPlace(el, word) {
      const re = new RegExp(boundedSource2(word), "ig");
      const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const targets = [];
      let n;
      while (n = walker.nextNode()) if (n.nodeType === Node.TEXT_NODE) targets.push(n);
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
    async renderSentence(el, sentence, word, comp) {
      el.empty();
      const useComp = comp || new Component4();
      if (!comp) useComp.load();
      await renderLexisMarkdown2(this.app, sentence, el, "", useComp);
      this.boldMatchesInPlace(el, word);
    }
    compactSections(md) {
      return md.replace(/^#{2,6}[ \t].*\n(?:[ \t]*\n)*(?=#{1,6}[ \t]|$)/gm, "").trim();
    }
    stripForPreview(content) {
      return content.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```lexis[\s\S]*?```/g, "").trim();
    }
    async renderNoteInto(el, file, comp, keepLexis = false) {
      const raw = await this.app.vault.cachedRead(file);
      let stripped = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
      if (!keepLexis) stripped = stripped.replace(/```lexis[\s\S]*?```/g, "");
      const md = this.compactSections(stripped.trim()) || "*(\u7A7A)*";
      el.empty();
      await renderLexisMarkdown2(this.app, md, el, file.path, comp);
      (function compact(container) {
        const hs = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
        const rm = [];
        for (let i = 0; i < hs.length; i++) {
          const h = hs[i], next = hs[i + 1] || null;
          let sib = h.nextElementSibling, ok = false;
          while (sib && sib !== next) {
            const ns = sib.nextElementSibling;
            if ((sib.textContent || "").trim()) {
              ok = true;
              break;
            }
            if (sib.querySelector(".lexis-section-title,.lexis-curve,.lexis-related,.lexis-occ,.lexis-occ-details,img,svg,video,iframe")) {
              ok = true;
              break;
            }
            sib = ns;
          }
          if (!ok) rm.push(h);
        }
        for (const h of rm) h.remove();
      })(el);
    }
    async renderInlineEntryInto(el, entry, comp) {
      el.empty();
      const md = entry.annotation || "*(\u65E0\u6279\u6CE8)*";
      const content = el.createDiv({ cls: "lexis-inline-annotation" });
      await renderLexisMarkdown2(this.app, md, content, entry.file.path, comp);
    }
    highlightSource(span) {
      const sourceDocument = span.ownerDocument;
      const frame = sourceDocument.defaultView?.frameElement;
      const locatedNode = frame || span;
      let file = null;
      this.app.workspace.iterateAllLeaves((leaf) => {
        const view = leaf.view;
        if (!file && view.containerEl?.contains(locatedNode)) file = view.file || null;
      });
      if (!file) file = this.app.workspace.getActiveFile();
      const pageElement = span.closest("[data-page-number]");
      const pageValue = pageElement?.getAttribute("data-page-number") || "";
      const page = Number.parseInt(pageValue, 10) || void 0;
      const textContainer = span.closest("p,li,blockquote,td,th,figcaption,h1,h2,h3,h4,h5,h6,.cm-line,.textLayer") || span.parentElement;
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
    renderPopoverControls(meta, corner, body, entry, sourceSpan) {
      if (entry.inline) return;
      const baseKey = entry.file?.basename || entry.display;
      const path = entry.file?.path || "";
      const slash = path.lastIndexOf("/");
      const folder = slash > 0 ? path.slice(0, slash) : "";
      const shortFolder = (f) => String(f || this.t("common.root")).split("/").pop() || "";
      const folderChip = meta.createSpan({ cls: "lexis-popover-chip", text: shortFolder(folder) });
      folderChip.setAttribute("title", folder || this.t("common.root"));
      const dicts = this.dictFolders();
      if (dicts.length > 1) {
        folderChip.addClass("is-clickable");
        folderChip.setAttribute("title", `${folder || this.t("common.root")} \u2014 ${this.t("popover.moveDictionary")}`);
        folderChip.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const menu = new obsidian3.Menu();
          for (const target of dicts) menu.addItem((it) => it.setTitle(shortFolder(target)).setIcon(target === folder ? "check" : "folder").onClick(async () => {
            if (target === folder) return;
            const result = await this.bridgeMoveWord({ key: baseKey, folder: target });
            new Notice4(result.ok ? this.t("notice.moved", { folder: shortFolder(target) }) : this.t("notice.moveFailed", { error: result.error || this.t("common.failed") }));
            if (result.ok) this.removePopover();
          }));
          menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
        });
      }
      const occurrenceBtn = meta.createEl("button", { cls: "lexis-popover-action", text: this.t("popover.addCurrentOccurrence") });
      occurrenceBtn.setAttribute("title", this.t("popover.addCurrentOccurrenceTitle"));
      occurrenceBtn.addEventListener("click", (ev) => {
        void (async () => {
          ev.preventDefault();
          ev.stopPropagation();
          const source = this.highlightSource(sourceSpan);
          occurrenceBtn.disabled = true;
          if (await this.addExampleToWord(entry.file, source.sentence, source.file, source.page)) {
            occurrenceBtn.setText("\u2713");
            occurrenceBtn.removeAttribute("title");
          } else occurrenceBtn.disabled = false;
        })();
      });
      const noteBtn = corner.createEl("button", { cls: "lexis-popover-action", text: "\u270E" });
      noteBtn.setAttribute("title", this.t("popover.addNote"));
      noteBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const existing = body.querySelector(".lexis-popover-note-row");
        if (existing) {
          existing.querySelector("input")?.focus();
          return;
        }
        const row = body.createDiv({ cls: "lexis-popover-note-row" });
        const input = row.createEl("input", { attr: { type: "text", placeholder: this.t("popover.notePlaceholder") } });
        const imageInput = row.createEl("input", { cls: "lexis-popover-note-file", attr: { type: "file", accept: "image/*" } });
        const imageBtn = row.createEl("button", { cls: "lexis-popover-note-image", attr: { type: "button", title: this.t("popover.addImage") } });
        obsidian3.setIcon(imageBtn, "image-plus");
        input.addEventListener("click", (e) => e.stopPropagation());
        imageBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          imageInput.click();
        });
        imageInput.addEventListener("click", (e) => e.stopPropagation());
        imageInput.addEventListener("change", () => {
          void (async () => {
            const image = imageInput.files?.[0];
            if (!image) return;
            input.disabled = true;
            imageBtn.disabled = true;
            const result = await this.bridgeAnnotate({ key: baseKey, note: input.value.trim(), image });
            new Notice4(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
            if (result.ok) this.removePopover();
            else {
              input.disabled = false;
              imageBtn.disabled = false;
              imageInput.value = "";
            }
          })();
        });
        input.addEventListener("keydown", (e) => {
          void (async () => {
            if (e.key === "Escape") {
              row.remove();
              return;
            }
            if (e.key !== "Enter") return;
            e.preventDefault();
            const note = input.value.trim();
            if (!note) {
              row.remove();
              return;
            }
            input.disabled = true;
            const result = await this.bridgeAnnotate({ key: baseKey, note });
            new Notice4(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
            this.removePopover();
          })();
        });
        body.prepend(row);
        input.focus();
      });
      const delBtn = corner.createEl("button", { cls: "lexis-popover-action is-danger", text: "\u{1F5D1}" });
      delBtn.setAttribute("title", this.t("popover.deleteEntry"));
      delBtn.addEventListener("click", (ev) => {
        void (async () => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!await confirmAction(this.app, this.t("popover.deleteEntry"), this.t("popover.deleteConfirm", { word: entry.display }))) return;
          const result = await this.bridgeDeleteWord(baseKey);
          new Notice4(result.ok ? this.t("notice.deleted", { word: entry.display }) : this.t("notice.deleteFailed", { error: result.error || this.t("common.failed") }));
          this.removePopover();
        })();
      });
      const tagWrap = body.createDiv({ cls: "lexis-popover-tags" });
      const tags = new Set(entry.tags || []);
      const renderTags = () => {
        tagWrap.empty();
        for (const tag of [...tags].sort()) {
          const pill = tagWrap.createSpan({ cls: "lexis-popover-tag", text: `#${tag}` });
          const remove = pill.createSpan({ cls: "lexis-popover-tag-remove", text: " \xD7" });
          remove.setAttribute("title", this.t("popover.deleteTag"));
          remove.addEventListener("click", (ev) => {
            void (async () => {
              ev.preventDefault();
              ev.stopPropagation();
              const result = await this.bridgeTagWord({ key: baseKey, tag, action: "remove" });
              if (result.ok) {
                tags.delete(tag);
                entry.tags = new Set(result.tags || []);
                renderTags();
              }
            })();
          });
        }
        const add = tagWrap.createSpan({ cls: "lexis-popover-tag is-add", text: tags.size ? "+" : this.t("popover.addTag") });
        add.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const menu = new obsidian3.Menu();
          for (const tag of this.collectVocabTags().filter((t) => !tags.has(t))) menu.addItem((it) => it.setTitle(`#${tag}`).setIcon("tag").onClick(async () => {
            const result = await this.bridgeTagWord({ key: baseKey, tag, action: "add" });
            if (result.ok) {
              tags.add(tag);
              entry.tags = new Set(result.tags || []);
              renderTags();
            }
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
      if (this._popover && this._popover.dataset.lexisKey === key) {
        window.clearTimeout(this._hideTimer);
        return;
      }
      if (!entry.inline) {
        this.recordEncounter(entry.file, "hover");
        void this.hoverFeedback(entry.file);
      }
      this.removePopover();
      const pop = overlayDocumentFor(spanEl).body.createDiv({ cls: "lexis-popover" });
      pop.dataset.lexisKey = key;
      this.applyPopoverAppearance(pop);
      const scroll = pop.createDiv({ cls: "lexis-popover-scroll" });
      const title = scroll.createDiv({ cls: "lexis-popover-title" });
      const heading = this.cardHeading(entry);
      title.createSpan({ cls: "lexis-popover-title-main", text: heading.title });
      if (heading.subtitle) title.createSpan({ cls: "lexis-popover-alias", text: heading.subtitle });
      title.addEventListener("click", () => {
        if (entry.inline) void this.openInlineEntry(entry, false);
        else this.openAndClose(entry.file);
      });
      const corner = scroll.createDiv({ cls: "lexis-popover-corner" });
      const meta = scroll.createDiv({ cls: "lexis-popover-meta" });
      if (!entry.inline) {
        pop.addClass("has-corner-actions");
        const archiveBtn = meta.createSpan({ cls: "lexis-popover-archive", text: entry.archived ? `\u21A9 ${this.t("popover.restore")}` : `\u{1F4E6} ${this.t("popover.archive")}` });
        archiveBtn.setAttribute("title", this.t(entry.archived ? "popover.restoreTitle" : "popover.archiveTitle"));
        archiveBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (entry.archived) openRestoreModal(this.app, this, entry.file);
          else void this.setArchived(entry.file, true).then(() => new Notice4(this.t("notice.archived", { word: entry.file.basename })));
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
        const comp = new Component4();
        comp.load();
        this._popoverComp = comp;
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
          const occTitle = body.createDiv({ cls: "lexis-section-title", text: `\u{1F4CD} ${this.t("popover.occurrences", { count: "\u2026" })}` });
          const occWrap = body.createDiv();
          occWrap.setText(this.t("common.searching"));
          const rawList = await this.findOccurrences(entry.display);
          if (this._popover === pop) {
            const curated = await this.getCuratedSourcePaths(entry.file);
            const list = rawList.filter((occurrence) => !curated.has(occurrence.file.basename.toLowerCase()));
            occTitle.setText(`\u{1F4CD} ${this.t("popover.occurrences", { count: list.length })}`);
            occWrap.empty();
            if (!list.length) occWrap.createDiv({ cls: "lexis-occ", text: this.t("popover.noOccurrences") });
            else for (const o of list) {
              const d = occWrap.createDiv({ cls: "lexis-occ" });
              await this.renderSentence(d, o.sentence, entry.display, comp);
              const add = d.createSpan({ cls: "lexis-occ-add", text: " \u2795" });
              add.setAttribute("title", this.t("popover.addOccurrence"));
              add.addEventListener("click", () => {
                void (async () => {
                  if (add.dataset.done) return;
                  add.dataset.done = "1";
                  if (await this.addExampleToWord(entry.file, o.sentence, o.file, o.page)) {
                    add.setText(" \u2713");
                    add.setCssStyles({ cursor: "default" });
                    add.removeAttribute("title");
                  } else delete add.dataset.done;
                })();
              });
              const src = d.createSpan({ cls: "lexis-occ-src", text: " \u2197 " + this.occurrenceLabel(o) });
              src.addEventListener("click", () => {
                void this.openOccurrence(o.file, entry.display, o.page);
              });
            }
            this.positionPopover(pop, spanEl);
          }
        }
        this.positionPopover(pop, spanEl);
      } catch (err) {
        body.setText(this.t("popover.readFailed", { error: errorMessage3(err) }));
      }
    }
    positionPopover(pop, spanEl) {
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
    applyPopoverAppearance(pop) {
      const width = Math.max(260, Number(this.settings.popoverWidth) || 460);
      const height = Math.max(160, Number(this.settings.popoverMaxHeight) || 420);
      const fontSize = Math.max(11, Number(this.settings.popoverFontSize) || 14);
      pop.setCssProps({
        "--lexis-popover-width": `${width}px`,
        "--lexis-popover-height": `${height}px`,
        "--lexis-popover-font-size": `${fontSize}px`
      });
      const isPreview = pop.classList.contains("lexis-popover-preview");
      const coarsePointer = pop.ownerDocument.defaultView?.matchMedia?.("(pointer: coarse)").matches;
      pop.setCssStyles({
        width: `${width}px`,
        height: !isPreview && !coarsePointer ? `${height}px` : "",
        maxHeight: `${height}px`,
        fontSize: `${fontSize}px`
      });
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderUi.prototype);
  return descriptors;
}

// src/settings-controls.ts
function moveItem(items, from, to) {
  const next = Array.from(items || []);
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
function createReorderController({ container, onMove, setIcon: setIcon2, label = "Reorder", longPressMs = 260 }) {
  let from = -1;
  let active = false;
  let timer = 0;
  let pointerId = null;
  let activeHandle = null;
  let draggedRow = null;
  let placeholder = null;
  let savedStyle = null;
  let offsetX = 0;
  let offsetY = 0;
  let pointerX = 0;
  let pointerY = 0;
  const rows = () => Array.from(container.children).filter((el) => el.instanceOf(HTMLElement) && el.classList.contains("lexis-sortable-item"));
  const candidates = () => rows().filter((row) => row !== draggedRow);
  const restoreRow = () => {
    if (!draggedRow) return;
    draggedRow.classList.remove("is-dragging", "is-floating");
    if (savedStyle == null) draggedRow.removeAttribute("style");
    else draggedRow.setAttribute("style", savedStyle);
  };
  const floatingPosition = (x, y) => {
    if (!draggedRow) return;
    draggedRow.setCssStyles({ left: `${Math.round(x - offsetX)}px`, top: `${Math.round(y - offsetY)}px` });
  };
  const targetAt = (x, y) => {
    const doc = container.ownerDocument || document;
    const direct = doc.elementFromPoint?.(x, y)?.closest?.(".lexis-sortable-item");
    if (direct?.instanceOf(HTMLElement) && direct.parentElement === container && direct !== draggedRow) return direct;
    let nearest = null;
    let distance = Infinity;
    for (const row of candidates()) {
      const rect = row.getBoundingClientRect();
      const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      const score = dx * dx + dy * dy;
      if (score < distance) {
        nearest = row;
        distance = score;
      }
    }
    return nearest;
  };
  const movePlaceholder = (target, x, y) => {
    if (!placeholder || !target) return;
    const rect = target.getBoundingClientRect();
    const view = container.ownerDocument?.defaultView || window;
    const isGrid = view.getComputedStyle?.(container).display === "grid";
    const sameBand = y >= rect.top && y <= rect.bottom;
    const after = isGrid && sameBand ? x > rect.left + rect.width / 2 : y > rect.top + rect.height / 2;
    const reference = after ? target.nextSibling : target;
    if (reference !== placeholder) container.insertBefore(placeholder, reference);
  };
  const begin = (row, handle, index, event) => {
    const rect = row.getBoundingClientRect();
    from = index;
    active = true;
    activeHandle = handle;
    draggedRow = row;
    savedStyle = row.getAttribute("style");
    offsetX = pointerX - rect.left;
    offsetY = pointerY - rect.top;
    placeholder = container.createDiv({ cls: "lexis-sortable-placeholder" });
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.setCssStyles({ height: `${Math.ceil(rect.height)}px` });
    container.insertBefore(placeholder, row);
    row.classList.add("is-dragging", "is-floating");
    row.setCssStyles({
      position: "fixed",
      width: `${Math.ceil(rect.width)}px`,
      left: `${Math.round(rect.left)}px`,
      top: `${Math.round(rect.top)}px`,
      margin: "0",
      zIndex: "1000",
      pointerEvents: "none"
    });
    floatingPosition(pointerX, pointerY);
    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {
    }
  };
  const finish = () => {
    window.clearTimeout(timer);
    timer = 0;
    const start = from;
    let target = start;
    if (active && placeholder && draggedRow) {
      const order = Array.from(container.children).filter((el) => el === placeholder || el.instanceOf(HTMLElement) && el.classList.contains("lexis-sortable-item") && el !== draggedRow);
      target = order.indexOf(placeholder);
      container.insertBefore(draggedRow, placeholder);
      placeholder.remove();
    }
    restoreRow();
    from = -1;
    active = false;
    if (activeHandle && pointerId != null) {
      try {
        activeHandle.releasePointerCapture?.(pointerId);
      } catch {
      }
    }
    activeHandle = null;
    pointerId = null;
    draggedRow = null;
    placeholder = null;
    savedStyle = null;
    if (start >= 0 && target >= 0 && start !== target) void onMove(start, target);
  };
  return {
    attach(item, index, { handleParent = item } = {}) {
      item.classList.add("lexis-sortable-item");
      handleParent.classList.add("lexis-sortable-row");
      item.dataset.lexisOrder = String(index);
      const handle = handleParent.createEl("button", {
        cls: "lexis-drag-handle clickable-icon",
        attr: { type: "button", "aria-label": label, title: label }
      });
      if (setIcon2) setIcon2(handle, "grip-vertical");
      else handle.setText("\u22EE\u22EE");
      handle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      handle.addEventListener("pointerdown", (event) => {
        if (event.button != null && event.button !== 0) return;
        window.clearTimeout(timer);
        from = index;
        pointerId = event.pointerId;
        pointerX = event.clientX;
        pointerY = event.clientY;
        try {
          handle.setPointerCapture?.(event.pointerId);
        } catch {
        }
        if (event.pointerType === "touch") timer = window.setTimeout(() => begin(item, handle, index, event), longPressMs);
        else {
          event.preventDefault();
          begin(item, handle, index, event);
        }
      });
      handle.addEventListener("pointermove", (event) => {
        if (event.pointerId !== pointerId) return;
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!active) return;
        event.preventDefault();
        floatingPosition(pointerX, pointerY);
        const target = targetAt(event.clientX, event.clientY);
        movePlaceholder(target, event.clientX, event.clientY);
      }, { passive: false });
      handle.addEventListener("pointerup", (event) => {
        if (event.pointerId === pointerId) finish();
      });
      handle.addEventListener("pointercancel", (event) => {
        if (event.pointerId === pointerId) finish();
      });
      handle.addEventListener("contextmenu", (event) => {
        if (active) event.preventDefault();
      });
    }
  };
}
function addAppearanceButton({ app, obsidian: obsidian5, parent, title, state, onChange, onReset, labels, allowStyle = false }) {
  const button = new obsidian5.ExtraButtonComponent(parent).setIcon("palette").setTooltip(title);
  const refreshButton = () => {
    const color = state().color;
    button.extraSettingsEl.setCssStyles({ color: color || "var(--text-accent)" });
  };
  button.onClick(() => {
    const modal = new obsidian5.Modal(app);
    modal.onOpen = () => {
      modal.contentEl.empty();
      modal.contentEl.createEl("h3", { text: title });
      new obsidian5.Setting(modal.contentEl).setName(labels.color).addColorPicker((picker) => picker.setValue(state().color).onChange((color) => {
        void Promise.resolve(onChange({ color })).then(refreshButton);
      }));
      new obsidian5.Setting(modal.contentEl).setName(labels.opacity).addSlider((slider) => slider.setLimits(0.1, 1, 0.05).setValue(state().opacity).onChange((opacity) => {
        void onChange({ opacity });
      }));
      if (allowStyle) {
        new obsidian5.Setting(modal.contentEl).setName(labels.style).addDropdown((dropdown) => dropdown.addOption("", labels.defaultStyle).addOption("wavy", labels.wavy).addOption("underline", labels.underline).addOption("background", labels.background).setValue(state().style || "").onChange((style) => {
          void onChange({ style });
        }));
      }
      new obsidian5.Setting(modal.contentEl).addButton((reset) => reset.setButtonText(labels.reset).onClick(() => {
        void Promise.resolve(onReset()).then(() => {
          refreshButton();
          modal.close();
        });
      })).addButton((done) => done.setButtonText(labels.done).setCta().onClick(() => modal.close()));
    };
    modal.open();
  });
  refreshButton();
  return button;
}

// src/template-provider.ts
function createTemplateProvider({ app, TFile: TFile4, getSettings, normalizeFolder, readTemplatePath }) {
  const lexisPathFor = (folder) => {
    const settings = getSettings();
    const normalized = normalizeFolder(folder);
    const row = (settings.dicts || []).find((item) => item && normalizeFolder(item.folder) === normalized);
    return (row ? row.template || "" : settings.newWordTemplate || "").trim();
  };
  const templaterPlugin = () => app.plugins?.getPlugin("templater-obsidian") ?? null;
  const templaterTemplateFor = (folder) => {
    const plugin = templaterPlugin();
    if (!plugin?.templater?.write_template_to_file || plugin.settings?.trigger_on_file_creation_mode !== "folder") return null;
    const rules = Array.isArray(plugin.settings.folder_templates) ? plugin.settings.folder_templates : [];
    let current = normalizeFolder(folder);
    while (current) {
      const rule = rules.find((item) => normalizeFolder(item?.folder) === current && item?.template);
      if (rule) return { plugin, path: rule.template, folder: current };
      const slash = current.lastIndexOf("/");
      current = slash < 0 ? "" : current.slice(0, slash);
    }
    return null;
  };
  const readLexis = (folder) => readTemplatePath(lexisPathFor(folder));
  const create = async ({ path, folder, fallbackContent, transform = (content) => content }) => {
    const match = templaterTemplateFor(folder);
    if (!match) return app.vault.create(path, transform(fallbackContent));
    const templateFile = app.vault.getAbstractFileByPath(match.path);
    if (!(templateFile instanceof TFile4)) return app.vault.create(path, transform(fallbackContent));
    const file = await app.vault.create(path, "");
    await match.plugin.templater.write_template_to_file(templateFile, file);
    if (app.vault.process) await app.vault.process(file, transform);
    else await app.vault.modify(file, transform(await app.vault.cachedRead(file)));
    return file;
  };
  return { create, lexisPathFor, readLexis, templaterTemplateFor };
}

// src/settings-tab.ts
var createSettingsTab = ({ obsidian: obsidian5, PluginSettingTab: PluginSettingTab2, Setting: Setting3, Notice: Notice4, TFolder: TFolder2, DEFAULT_SETTINGS: DEFAULT_SETTINGS2, cssColorToHex: cssColorToHex2, addAppearanceButton: addAppearanceButton2, createReorderController: createReorderController2, moveItem: moveItem2, LEXIS_HOME_VIEW: LEXIS_HOME_VIEW2, LEXIS_REVIEW_VIEW: LEXIS_REVIEW_VIEW2 }) => {
  class PathSuggest extends obsidian5.AbstractInputSuggest {
    constructor(app, inputEl, getItems, onPick, opts = {}) {
      super(app, inputEl);
      this.inputEl = inputEl;
      this.getItems = getItems;
      this.onPick = onPick;
      this.multi = !!(opts && opts.multi);
      this.sep = opts && opts.sep || " ";
    }
    _split() {
      const v = this.inputEl && this.inputEl.value || "";
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
        const chosen = new Set((this.inputEl && this.inputEl.value || "").toLowerCase().split(/[\s,，;；]+/).filter(Boolean));
        items = items.filter((p) => p.toLowerCase() === token.toLowerCase() || !chosen.has(p.toLowerCase()));
      } else {
        q = (query || "").toLowerCase();
      }
      return items.filter((p) => p.toLowerCase().includes(q)).slice(0, 50);
    }
    renderSuggestion(value, el) {
      el.setText(value);
    }
    selectSuggestion(value) {
      if (this.multi) {
        const { before } = this._split();
        const out = before + value + this.sep;
        if (this.inputEl) this.inputEl.value = out;
        if (this.onPick) this.onPick(out);
        if (typeof this.setValue === "function") this.setValue(out);
        if (this.inputEl) this.inputEl.focus();
        return;
      }
      if (typeof this.setValue === "function") this.setValue(value);
      if (this.inputEl) this.inputEl.value = value;
      if (typeof this.close === "function") this.close();
      if (this.onPick) this.onPick(value);
    }
  }
  return class LexisSettingTab extends PluginSettingTab2 {
    constructor(app, plugin) {
      super(app, plugin);
      this.statsEl = null;
      this._colorComp = null;
      this.plugin = plugin;
    }
    section(containerEl, title, { open = false, desc = "" } = {}) {
      const details = containerEl.createEl("details", { cls: "lexis-settings-section" });
      details.open = open;
      const summary = details.createEl("summary");
      summary.createSpan({ text: title });
      if (desc) summary.createSpan({ cls: "lexis-settings-section-hint", text: desc });
      return details.createDiv({ cls: "lexis-settings-section-body" });
    }
    getSettingDefinitions() {
      return [{
        name: "Lexis",
        aliases: ["dictionary", "highlight", "review", "browser", "PDF", "\u8BCD\u5178", "\u9AD8\u4EAE", "\u590D\u4E60"],
        render: (setting) => {
          setting.settingEl.empty();
          setting.settingEl.addClass("lexis-settings-root");
          this.renderSettings(setting.settingEl);
        }
      }];
    }
    renderSettings(containerEl) {
      containerEl.empty();
      const t = (key, vars) => this.plugin.t(key, vars);
      const document2 = containerEl.ownerDocument;
      const accentHex = cssColorToHex2(document2.defaultView?.getComputedStyle(document2.body).getPropertyValue("--text-accent") || "", document2);
      const save = () => this.plugin.saveSettings();
      const refresh = () => this.plugin.refreshAllViews();
      const appearanceLabels = {
        color: t("settings.highlightColor"),
        opacity: t("settings.opacity"),
        style: t("settings.highlightStyle"),
        defaultStyle: t("common.default"),
        wavy: t("settings.wavy"),
        underline: t("settings.underline"),
        background: t("settings.background"),
        reset: t("settings.resetAppearance"),
        done: t("common.done")
      };
      new Setting3(containerEl).setName(t("settings.title")).setHeading();
      new Setting3(containerEl).setName(t("language.name")).addDropdown((dd) => dd.addOption("zh", t("language.zh")).addOption("en", t("language.en")).setValue(this.plugin.settings.language || "zh").onChange(async (value) => {
        this.plugin.settings.language = value === "en" ? "en" : "zh";
        await save();
        this.plugin.refreshAllViews();
        this.app.workspace.iterateAllLeaves((leaf) => {
          const type = leaf?.view?.getViewType?.();
          if (type === LEXIS_HOME_VIEW2 || type === LEXIS_REVIEW_VIEW2) leaf.view.render?.();
        });
        new Notice4(t("language.reload"));
        this.update();
      }));
      const folders = this.app.vault.getAllLoadedFiles().filter((f) => f instanceof TFolder2).map((f) => f.path).filter((p) => p && p !== "/").sort();
      const mdFiles = this.app.vault.getMarkdownFiles().map((f) => f.path).sort();
      const hasSuggest = !!obsidian5.AbstractInputSuggest;
      const allTags = (() => {
        const s = new Set(this.plugin.collectVocabTags());
        try {
          const tg = this.app.metadataCache.getTags?.() || {};
          for (const k in tg) s.add(k.replace(/^#/, "").toLowerCase());
        } catch {
        }
        return [...s].filter(Boolean).sort();
      })();
      const allProps = (() => {
        try {
          const infos = this.app.metadataCache.getAllPropertyInfos?.();
          if (infos) return Object.values(infos).map((info) => info.name).filter((name) => !!name).sort();
        } catch {
        }
        return [];
      })();
      const tagSuggest = (comp, apply) => {
        if (hasSuggest) new PathSuggest(this.app, comp.inputEl, () => allTags, (value) => {
          comp.setValue(value);
          void apply(value);
        }, { multi: true });
      };
      const dictSection = this.section(containerEl, t("settings.dictionary"), { open: true });
      new Setting3(dictSection).setDesc(t("settings.dictionaryDesc")).setHeading();
      const dictsWrap = dictSection.createDiv();
      const renderDicts = () => {
        dictsWrap.empty();
        const reorder = createReorderController2({
          container: dictsWrap,
          setIcon: obsidian5.setIcon,
          label: t("settings.reorder"),
          onMove: async (from, to) => {
            this.plugin.settings.dicts = moveItem2(this.plugin.settings.dicts, from, to);
            await save();
            await this.plugin.rebuildIndex(false);
            renderDicts();
          }
        });
        (this.plugin.settings.dicts || []).forEach((d, i) => {
          const row = dictsWrap.createDiv({ cls: "lexis-setting-row lexis-dictionary-row" });
          const fIn = new obsidian5.TextComponent(row);
          fIn.setPlaceholder(t("settings.folderPlaceholder")).setValue(d.folder || "");
          fIn.inputEl.setCssStyles({ flex: "1" });
          const tIn = new obsidian5.TextComponent(row);
          tIn.setPlaceholder(t("settings.templatePlaceholder")).setValue(d.template || "");
          tIn.inputEl.setCssStyles({ flex: "1.4" });
          const updateTemplateSource = () => {
            const match = this.plugin.templateProvider.templaterTemplateFor(d.folder);
            tIn.setDisabled(!!match);
            tIn.setValue(match ? match.path : d.template || "");
            tIn.inputEl.title = match ? t("settings.templaterTemplate", { path: match.path }) : "";
          };
          const onFolder = async (v) => {
            d.folder = (v || "").trim();
            updateTemplateSource();
            await save();
            void this.plugin.rebuildIndex(false);
            this.renderStats();
          };
          fIn.onChange(onFolder);
          const onTpl = async (v) => {
            d.template = (v || "").trim();
            await save();
          };
          tIn.onChange(onTpl);
          updateTemplateSource();
          if (hasSuggest) {
            new PathSuggest(this.app, fIn.inputEl, () => folders, (v) => {
              fIn.setValue(v);
              void onFolder(v);
            });
            new PathSuggest(this.app, tIn.inputEl, () => mdFiles, (v) => {
              tIn.setValue(v);
              void onTpl(v);
            });
          }
          new obsidian5.ToggleComponent(row).setTooltip(t("settings.showDictionaryHighlight")).setValue(d.highlight !== false).onChange(async (value) => {
            d.highlight = value;
            refresh();
            await save();
          });
          const globalColor = this.plugin.settings.highlightColor || accentHex;
          addAppearanceButton2({
            app: this.app,
            obsidian: obsidian5,
            parent: row,
            title: t("settings.dictionaryAppearance"),
            labels: appearanceLabels,
            state: () => ({ color: d.color || globalColor, opacity: Number(d.opacity ?? this.plugin.settings.highlightOpacity) }),
            onChange: async (patch) => {
              Object.assign(d, patch);
              await save();
              refresh();
            },
            onReset: async () => {
              delete d.color;
              delete d.opacity;
              await save();
              refresh();
            }
          });
          new obsidian5.ExtraButtonComponent(row).setIcon("trash").setTooltip(t("settings.deleteDictionary")).onClick(async () => {
            this.plugin.settings.dicts.splice(i, 1);
            await save();
            await this.plugin.rebuildIndex(false);
            renderDicts();
            this.renderStats();
          });
          reorder.attach(row, i);
        });
        const addDict = dictsWrap.createEl("button", { text: t("settings.addDictionary") });
        addDict.setCssStyles({ marginTop: "2px" });
        addDict.addEventListener("click", () => {
          void (async () => {
            this.plugin.settings.dicts.push({ folder: "", template: "", highlight: true });
            await save();
            renderDicts();
          })();
        });
      };
      renderDicts();
      new Setting3(dictSection).setName(t("settings.tagsAsEntries")).setDesc(t("settings.tagsAsEntriesDesc")).addText((t2) => {
        t2.setPlaceholder("\u8BCD\u6C47 \u672F\u8BED").setValue(this.plugin.settings.vocabTags);
        const apply = async (v) => {
          this.plugin.settings.vocabTags = v;
          await save();
          void this.plugin.rebuildIndex(true);
          this.renderStats();
        };
        t2.onChange(apply);
        tagSuggest(t2, apply);
      });
      new Setting3(dictSection).setName(t("settings.includeAliases")).addToggle((t2) => t2.setValue(this.plugin.settings.includeAliases).onChange(async (v) => {
        this.plugin.settings.includeAliases = v;
        await save();
        await this.plugin.rebuildIndex(false);
        this.renderStats();
      }));
      new Setting3(dictSection).setName(t("settings.aliasProperties")).setDesc(t("settings.aliasPropertiesDesc")).addText((t2) => {
        t2.setPlaceholder("Past, forms, variants").setValue(this.plugin.settings.aliasSources);
        const apply = async (v) => {
          this.plugin.settings.aliasSources = (v || "").trim();
          await save();
          if (this.plugin.settings.includeAliases) {
            void this.plugin.rebuildIndex(false);
            this.renderStats();
          }
        };
        t2.onChange(apply);
        if (hasSuggest) new PathSuggest(this.app, t2.inputEl, () => allProps, (v) => {
          t2.setValue(v);
          void apply(v);
        }, { multi: true, sep: "," });
      });
      const inlineSection = this.section(containerEl, t("settings.inline"), { desc: t("settings.inlineDesc") });
      new Setting3(inlineSection).setName(t("settings.enableInline")).setDesc(t("settings.enableInlineDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.inlineEntriesEnabled).onChange(async (v) => {
        this.plugin.settings.inlineEntriesEnabled = v;
        await save();
        await this.plugin.rebuildIndex(false);
        this.renderStats();
      }));
      new Setting3(inlineSection).setName(t("settings.inlineDelimiter")).setDesc(t("settings.inlineDelimiterDesc")).addText((t2) => t2.setPlaceholder("::").setValue(this.plugin.inlineDelimiter()).onChange(async (v) => {
        this.plugin.settings.inlineEntryDelimiter = (v || "").trim() || "::";
        await save();
        await this.plugin.rebuildIndex(false);
        this.renderStats();
      }));
      new Setting3(inlineSection).setName(t("settings.inlineClassification")).setDesc(t("settings.inlineClassificationDesc")).addDropdown((dropdown) => dropdown.addOption("heading", t("settings.classifyByHeading")).addOption("file", t("settings.classifyByFile")).setValue(this.plugin.settings.inlineClassificationMode).onChange(async (mode) => {
        this.plugin.settings.inlineClassificationMode = mode === "file" ? "file" : "heading";
        await save();
        renderCategoryColors();
        refresh();
      })).addExtraButton((button) => button.setIcon("refresh-cw").setTooltip(t("settings.refreshCategories")).onClick(async () => {
        await this.plugin.rebuildIndex(false);
        renderCategoryColors();
        this.renderStats();
      }));
      const categoryColorsWrap = inlineSection.createDiv({ cls: "lexis-inline-tree" });
      const openInlineHeading = async (node) => {
        this.app.setting?.close();
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(node.file, { active: true });
        await this.app.workspace.revealLeaf(leaf);
        const reveal = () => {
          const editor = leaf.view instanceof obsidian5.MarkdownView ? leaf.view.editor : null;
          if (!editor) return;
          const position = { line: node.line, ch: 0 };
          editor.setCursor(position);
          editor.scrollIntoView({ from: position, to: position }, true);
        };
        reveal();
        window.setTimeout(reveal, 60);
      };
      const renderCategoryColors = () => {
        categoryColorsWrap.empty();
        const occurrences = this.plugin.inlineCategoryOccurrences || [];
        if (!occurrences.length) {
          categoryColorsWrap.createEl("p", { cls: "setting-item-description", text: t("settings.noInlineCategories") });
          return;
        }
        const mode = this.plugin.settings.inlineClassificationMode === "file" ? "file" : "heading";
        const groupMap = /* @__PURE__ */ new Map();
        for (const node of occurrences) {
          const key = mode === "file" ? node.file.path : node.name;
          let group = groupMap.get(key);
          if (!group) {
            group = {
              id: `${mode}:${key}`,
              key,
              name: mode === "file" ? node.file.basename : node.name,
              count: 0,
              children: []
            };
            groupMap.set(key, group);
          }
          group.count += node.count;
          group.children.push(node);
        }
        const parentOrder = mode === "file" ? this.plugin.settings.inlineFileOrder : this.plugin.settings.inlineCategoryOrder;
        const parentRank = new Map(parentOrder.map((key, index) => [key, index]));
        let groups = [...groupMap.values()].sort((a, b) => {
          const ar = parentRank.has(a.key) ? parentRank.get(a.key) : Number.MAX_SAFE_INTEGER;
          const br = parentRank.has(b.key) ? parentRank.get(b.key) : Number.MAX_SAFE_INTEGER;
          return ar - br || a.name.localeCompare(b.name);
        });
        for (const group of groups) {
          const childRank = new Map((this.plugin.settings.inlineCategoryOrderByParent[group.id] || []).map((id, index) => [id, index]));
          group.children.sort((a, b) => {
            const ar = childRank.has(a.id) ? childRank.get(a.id) : Number.MAX_SAFE_INTEGER;
            const br = childRank.has(b.id) ? childRank.get(b.id) : Number.MAX_SAFE_INTEGER;
            const aLabel = mode === "file" ? a.name : a.file.path;
            const bLabel = mode === "file" ? b.name : b.file.path;
            return ar - br || aLabel.localeCompare(bLabel) || a.line - b.line;
          });
        }
        const colors = mode === "file" ? this.plugin.settings.inlineFileColors : this.plugin.settings.inlineCategoryColors;
        const opacities = mode === "file" ? this.plugin.settings.inlineFileOpacity : this.plugin.settings.inlineCategoryOpacity;
        const visibility = mode === "file" ? this.plugin.settings.inlineFileHighlight : this.plugin.settings.inlineCategoryHighlight;
        const sourceVisibility = this.plugin.settings.inlineSourceHighlight;
        const collapsed = this.plugin.settings.inlineCollapsedGroups;
        const rootReorder = createReorderController2({
          container: categoryColorsWrap,
          setIcon: obsidian5.setIcon,
          label: t("settings.reorder"),
          onMove: async (from, to) => {
            groups = moveItem2(groups, from, to);
            if (mode === "file") this.plugin.settings.inlineFileOrder = groups.map(({ key }) => key);
            else this.plugin.settings.inlineCategoryOrder = groups.map(({ key }) => key);
            await save();
            renderCategoryColors();
          }
        });
        groups.forEach((group, groupIndex) => {
          const enabled = visibility[group.key] !== false;
          const details = categoryColorsWrap.createEl("details", { cls: "lexis-inline-group" });
          details.open = collapsed[group.id] !== true;
          details.addEventListener("toggle", () => {
            void (async () => {
              collapsed[group.id] = !details.open;
              await save();
            })();
          });
          const summary = details.createEl("summary", { cls: "lexis-setting-row lexis-inline-group-row" });
          const chevron = summary.createSpan({ cls: "lexis-inline-chevron" });
          obsidian5.setIcon(chevron, "chevron-right");
          summary.createSpan({ cls: "lexis-inline-group-name", text: group.name, attr: { title: group.key } });
          const parentControls = summary.createDiv({ cls: "lexis-inline-category-controls" });
          parentControls.addEventListener("click", (event) => event.stopPropagation());
          const countLabel = t("settings.entryCount", { count: group.count });
          parentControls.createSpan({ cls: "lexis-inline-count", text: countLabel, attr: { title: countLabel } });
          new obsidian5.ToggleComponent(parentControls).setTooltip(t("settings.showGroupHighlight")).setValue(enabled).onChange(async (value) => {
            visibility[group.key] = value;
            await save();
            refresh();
            renderCategoryColors();
          });
          addAppearanceButton2({
            app: this.app,
            obsidian: obsidian5,
            parent: parentControls,
            title: t("settings.categoryAppearance", { name: group.name }),
            labels: appearanceLabels,
            state: () => ({
              color: colors[group.key] || accentHex,
              opacity: Number(Object.prototype.hasOwnProperty.call(opacities, group.key) ? opacities[group.key] : this.plugin.settings.highlightOpacity)
            }),
            onChange: async (patch) => {
              if (patch.color != null) colors[group.key] = patch.color;
              if (patch.opacity != null) opacities[group.key] = patch.opacity;
              await save();
              refresh();
            },
            onReset: async () => {
              delete colors[group.key];
              delete opacities[group.key];
              await save();
              refresh();
            }
          });
          rootReorder.attach(details, groupIndex, { handleParent: summary });
          const childrenEl = details.createDiv({ cls: "lexis-inline-siblings lexis-inline-group-children" });
          const childReorder = createReorderController2({
            container: childrenEl,
            setIcon: obsidian5.setIcon,
            label: t("settings.reorder"),
            onMove: async (from, to) => {
              group.children = moveItem2(group.children, from, to);
              this.plugin.settings.inlineCategoryOrderByParent[group.id] = group.children.map(({ id }) => id);
              await save();
              renderCategoryColors();
            }
          });
          group.children.forEach((node, childIndex) => {
            const row = childrenEl.createDiv({ cls: `lexis-setting-row lexis-inline-category-row${enabled ? "" : " is-disabled"}` });
            const label = mode === "file" ? node.name : node.file.basename;
            const link = row.createEl("button", {
              cls: "lexis-inline-category-link",
              text: label,
              attr: { type: "button", title: `${node.file.path}:${node.line + 1}` }
            });
            link.addEventListener("click", () => {
              void openInlineHeading(node);
            });
            const childControls = row.createDiv({ cls: "lexis-inline-category-controls" });
            const childCount = t("settings.entryCount", { count: node.count });
            childControls.createSpan({ cls: "lexis-inline-count", text: childCount, attr: { title: childCount } });
            new obsidian5.ToggleComponent(childControls).setTooltip(t("settings.showSubsetHighlight")).setValue(sourceVisibility[node.id] !== false).setDisabled(!enabled).onChange(async (value) => {
              sourceVisibility[node.id] = value;
              await save();
              refresh();
            });
            childReorder.attach(row, childIndex);
          });
        });
      };
      renderCategoryColors();
      const hlSection = this.section(containerEl, t("settings.highlight"));
      new Setting3(hlSection).setName(t("settings.enableHighlight")).addToggle((toggle) => toggle.setValue(this.plugin.settings.enableHighlight).onChange(async (v) => {
        this.plugin.settings.enableHighlight = v;
        await save();
        refresh();
      }));
      new Setting3(hlSection).setName(t("settings.livePreview")).setDesc(this.plugin.liveAvailable ? "" : t("settings.unsupported")).addToggle((t2) => t2.setValue(this.plugin.settings.enableLivePreview).setDisabled(!this.plugin.liveAvailable).onChange(async (v) => {
        this.plugin.settings.enableLivePreview = v;
        await save();
        refresh();
      }));
      new Setting3(hlSection).setName(t("settings.selectionPill")).addToggle((t2) => t2.setValue(this.plugin.settings.selectionPill).onChange(async (v) => {
        this.plugin.settings.selectionPill = v;
        await save();
        if (!v) this.plugin.removeSelPill();
      }));
      new Setting3(hlSection).setName(t("settings.pdfHighlight")).setDesc(t("settings.pdfHighlightDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.enablePdfHighlight).onChange(async (v) => {
        this.plugin.settings.enablePdfHighlight = v;
        await save();
        if (v) this.plugin.setupPdfHighlight();
        else {
          this.plugin.teardownPdfHighlight();
          this.plugin.rescanPdfLayers();
        }
      }));
      new Setting3(hlSection).setName(t("settings.highlightStyle")).addDropdown((dd) => dd.addOption("wavy", t("settings.wavy")).addOption("underline", t("settings.underline")).addOption("background", t("settings.background")).setValue(this.plugin.settings.highlightStyle).onChange(async (v) => {
        this.plugin.settings.highlightStyle = ["wavy", "underline", "background"].includes(v) ? v : "wavy";
        await save();
        refresh();
      }));
      new Setting3(hlSection).setName(t("settings.highlightColor")).addColorPicker((cp) => {
        this._colorComp = cp;
        cp.setValue(this.plugin.settings.highlightColor || accentHex).onChange(async (v) => {
          this.plugin.settings.highlightColor = v;
          await save();
          refresh();
        });
      }).addExtraButton((b) => b.setIcon("reset").setTooltip(t("settings.resetTheme")).onClick(async () => {
        this.plugin.settings.highlightColor = "";
        this._colorComp?.setValue(accentHex);
        await save();
        refresh();
      }));
      new Setting3(hlSection).setName(t("settings.opacity")).addSlider((s) => s.setLimits(0.1, 1, 0.05).setValue(this.plugin.settings.highlightOpacity).onChange(async (v) => {
        this.plugin.settings.highlightOpacity = v;
        await save();
        refresh();
      }));
      new Setting3(hlSection).setName(t("settings.fade")).setDesc(t("settings.fadeDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.fadeByMemory).onChange(async (v) => {
        this.plugin.settings.fadeByMemory = v;
        await save();
        refresh();
      }));
      new Setting3(hlSection).setName(t("settings.fadeFloor")).addSlider((s) => s.setLimits(0, 0.9, 0.05).setValue(this.plugin.settings.fadeFloor).onChange(async (v) => {
        this.plugin.settings.fadeFloor = v;
        await save();
        refresh();
      }));
      const excludeSetting = new Setting3(hlSection).setName(t("settings.excludeTags")).setDesc(t("settings.excludeTagsDesc"));
      excludeSetting.settingEl.addClass("lexis-tags-setting");
      const excludeEditor = excludeSetting.controlEl.createDiv({ cls: "lexis-tag-editor" });
      const excludeChips = excludeEditor.createDiv({ cls: "lexis-tag-editor-chips" });
      const excludeAdd = excludeEditor.createDiv({ cls: "lexis-tag-editor-add" });
      const excludeInput = new obsidian5.TextComponent(excludeAdd).setPlaceholder(t("settings.addExcludedTag"));
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
          chip.createSpan({ cls: "lexis-tag-editor-remove", text: "\xD7" });
          chip.addEventListener("click", () => {
            void (async () => {
              await saveExcludedTags(excludedTags().filter((value) => value !== tag));
              renderExcludedTags();
            })();
          });
        }
      };
      const addExcludedTags = async (raw) => {
        const incoming = this.plugin.parseTags(raw);
        if (!incoming.length) return;
        await saveExcludedTags([.../* @__PURE__ */ new Set([...excludedTags(), ...incoming])]);
        excludeInput.setValue("");
        renderExcludedTags();
        excludeInput.inputEl.focus();
      };
      excludeInput.inputEl.addEventListener("keydown", (event) => {
        if (["Enter", ",", "\uFF0C", ";", "\uFF1B"].includes(event.key)) {
          event.preventDefault();
          void addExcludedTags(excludeInput.inputEl.value);
        } else if (event.key === "Backspace" && !excludeInput.inputEl.value) {
          const tags = excludedTags();
          if (tags.length) {
            tags.pop();
            void saveExcludedTags(tags).then(renderExcludedTags);
          }
        }
      });
      new obsidian5.ExtraButtonComponent(excludeAdd).setIcon("plus").setTooltip(t("settings.addExcludedTag")).onClick(() => {
        void addExcludedTags(excludeInput.inputEl.value);
      });
      if (hasSuggest) new PathSuggest(this.app, excludeInput.inputEl, () => allTags.filter((tag) => !excludedTags().includes(tag)), (value) => {
        void addExcludedTags(value);
      });
      renderExcludedTags();
      const tagColorSection = this.section(containerEl, t("settings.tagColors"));
      const rulesWrap = tagColorSection.createDiv();
      const renderRules = () => {
        rulesWrap.empty();
        const grid = rulesWrap.createDiv({ cls: "lexis-rule-grid" });
        const reorder = createReorderController2({
          container: grid,
          setIcon: obsidian5.setIcon,
          label: t("settings.reorder"),
          onMove: async (from, to) => {
            this.plugin.settings.tagRules = moveItem2(this.plugin.settings.tagRules, from, to);
            await save();
            refresh();
            renderRules();
          }
        });
        this.plugin.settings.tagRules.forEach((rule, i) => {
          const cell = grid.createDiv({ cls: "lexis-setting-row lexis-rule" });
          const tagIn = new obsidian5.TextComponent(cell).setPlaceholder(t("settings.tagPlaceholder")).setValue(rule.tag);
          const applyTag = async (v) => {
            rule.tag = (v || "").trim();
            await save();
            refresh();
          };
          tagIn.onChange(applyTag);
          if (hasSuggest) new PathSuggest(this.app, tagIn.inputEl, () => allTags, (v) => {
            tagIn.setValue(v);
            void applyTag(v);
          });
          addAppearanceButton2({
            app: this.app,
            obsidian: obsidian5,
            parent: cell,
            title: t("settings.tagAppearance"),
            labels: appearanceLabels,
            allowStyle: true,
            state: () => ({ color: rule.color || accentHex, opacity: Number(rule.opacity ?? this.plugin.settings.highlightOpacity), style: rule.style || "" }),
            onChange: async (patch) => {
              Object.assign(rule, patch);
              await save();
              refresh();
            },
            onReset: async () => {
              delete rule.color;
              delete rule.opacity;
              delete rule.style;
              await save();
              refresh();
            }
          });
          new obsidian5.ExtraButtonComponent(cell).setIcon("trash").setTooltip(t("common.delete")).onClick(async () => {
            this.plugin.settings.tagRules.splice(i, 1);
            await save();
            refresh();
            renderRules();
          });
          reorder.attach(cell, i);
        });
        const addRule = rulesWrap.createEl("button", { text: t("settings.addTagRule") });
        addRule.setCssStyles({ marginTop: "2px" });
        addRule.addEventListener("click", () => {
          void (async () => {
            this.plugin.settings.tagRules.push({ tag: "", color: accentHex, style: "" });
            await save();
            renderRules();
          })();
        });
      };
      renderRules();
      const cardSection = this.section(containerEl, t("settings.popover"));
      const preview = cardSection.createDiv({ cls: "lexis-popover lexis-popover-preview" });
      const previewScroll = preview.createDiv({ cls: "lexis-popover-scroll" });
      previewScroll.createDiv({ cls: "lexis-popover-title", text: "Yalda \xB7 \u4EBA\u7269" });
      previewScroll.createDiv({ cls: "lexis-popover-body", text: t("settings.popoverPreview") });
      const updateCards = () => {
        this.plugin.applyPopoverAppearance(preview);
        const doc = preview.ownerDocument || document2;
        doc.querySelectorAll(".lexis-popover:not(.lexis-popover-preview)").forEach((el) => this.plugin.applyPopoverAppearance(el));
      };
      updateCards();
      new Setting3(cardSection).setName(t("settings.popoverFont")).addSlider((s) => s.setLimits(11, 24, 1).setValue(this.plugin.settings.popoverFontSize).onChange(async (v) => {
        this.plugin.settings.popoverFontSize = v;
        updateCards();
        await save();
      }));
      new Setting3(cardSection).setName(t("settings.hoverDelay")).setDesc(t("settings.hoverDelayDesc")).addSlider((s) => s.setLimits(0, 3, 0.1).setValue((this.plugin.settings.hoverDelayMs || 0) / 1e3).onChange(async (v) => {
        this.plugin.settings.hoverDelayMs = Math.round(v * 1e3);
        await save();
      }));
      new Setting3(cardSection).setName(t("settings.showRelated")).addToggle((toggle) => toggle.setValue(this.plugin.settings.showRelated).onChange(async (v) => {
        this.plugin.settings.showRelated = v;
        await save();
      }));
      new Setting3(cardSection).setName(t("settings.showOccurrences")).setDesc(t("settings.showOccurrencesDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.showOccurrences).onChange(async (v) => {
        this.plugin.settings.showOccurrences = v;
        await save();
      }));
      new Setting3(cardSection).setName(t("settings.pdfOccurrences")).setDesc(t("settings.pdfOccurrencesDesc")).addToggle((toggle) => toggle.setValue(this.plugin.settings.includePdfOccurrences !== false).onChange(async (v) => {
        this.plugin.settings.includePdfOccurrences = v;
        this.plugin._occCache.clear();
        await save();
      }));
      new Setting3(cardSection).setName(t("settings.occurrenceLimit")).addSlider((s) => s.setLimits(1, 15, 1).setValue(this.plugin.settings.occurrenceLimit).onChange(async (v) => {
        this.plugin.settings.occurrenceLimit = v;
        await save();
        this.plugin._occCache.clear();
      }));
      new Setting3(cardSection).setName(t("settings.occurrenceScope")).setDesc(t("settings.occurrenceScopeDesc")).addText((input) => input.setPlaceholder(t("settings.wholeVault")).setValue(this.plugin.settings.occurrenceFolders).onChange(async (v) => {
        this.plugin.settings.occurrenceFolders = v.trim();
        await save();
        this.plugin._occCache.clear();
      }));
      const addSection = this.section(containerEl, t("settings.selectionAdd"));
      new Setting3(addSection).setName(t("settings.emptyNotePreset")).setDesc(t("settings.emptyNotePresetDesc")).addDropdown((dropdown) => dropdown.addOption("blank", t("settings.emptyNoteBlank")).addOption("occ", t("settings.emptyNoteOccurrences")).setValue(this.plugin.settings.emptyNotePreset || "blank").onChange(async (value) => {
        this.plugin.settings.emptyNotePreset = value === "occ" ? "occ" : "blank";
        await save();
      }));
      new Setting3(addSection).setName(t("settings.defaultTemplate")).setDesc(t("settings.defaultTemplateDesc")).addText((input) => {
        input.setPlaceholder("template/word.md").setValue(this.plugin.settings.newWordTemplate);
        const onTpl = async (v) => {
          this.plugin.settings.newWordTemplate = (v || "").trim();
          await save();
        };
        input.onChange(onTpl);
        if (hasSuggest) new PathSuggest(this.app, input.inputEl, () => mdFiles, (v) => {
          input.setValue(v);
          void onTpl(v);
        });
      });
      const occurrenceSetting = new Setting3(addSection).setName(t("settings.occurrenceTemplate")).setDesc(t("settings.occurrenceTemplateDesc")).addTextArea((input) => input.setPlaceholder(DEFAULT_SETTINGS2.occurrenceTemplate).setValue(this.plugin.settings.occurrenceTemplate ?? DEFAULT_SETTINGS2.occurrenceTemplate).onChange(async (v) => {
        this.plugin.settings.occurrenceTemplate = v;
        await save();
      }));
      occurrenceSetting.settingEl.addClass("lexis-template-setting");
      const occurrenceTextarea = occurrenceSetting.controlEl.querySelector("textarea");
      if (occurrenceTextarea) occurrenceTextarea.rows = 4;
      new Setting3(addSection).setName(t("settings.annotationHeading")).setDesc(t("settings.annotationHeadingDesc")).addText((input) => input.setPlaceholder("#### \u6279\u6CE8").setValue(this.plugin.settings.annotationHeading).onChange(async (value) => {
        this.plugin.settings.annotationHeading = value;
        await save();
      }));
      new Setting3(addSection).setName(t("settings.annotationImageLocation")).setDesc(t("settings.annotationImageLocationDesc")).addDropdown((dropdown) => dropdown.addOption("obsidian", t("settings.annotationImageObsidian")).addOption("custom", t("settings.annotationImageCustom")).setValue(this.plugin.settings.annotationImageLocation || "obsidian").onChange(async (value) => {
        this.plugin.settings.annotationImageLocation = value === "custom" ? "custom" : "obsidian";
        await save();
        this.update();
      }));
      if (this.plugin.settings.annotationImageLocation === "custom") {
        new Setting3(addSection).setName(t("settings.annotationImageFolder")).setDesc(t("settings.annotationImageFolderDesc")).addText((input) => {
          const apply = async (value) => {
            this.plugin.settings.annotationImageFolder = value.trim();
            await save();
          };
          input.setPlaceholder("Attachments/lexis").setValue(this.plugin.settings.annotationImageFolder || "").onChange(apply);
          if (hasSuggest) new PathSuggest(this.app, input.inputEl, () => folders, (value) => {
            input.setValue(value);
            void apply(value);
          });
        });
      }
      const fsrsSection = this.section(containerEl, t("settings.review"));
      const syntaxTemplates2 = [
        ["flashcardInlineTemplate", "settings.flashcardInline", "{{question}}::{{answer}}"],
        ["flashcardBidirectionalTemplate", "settings.flashcardBidirectional", "{{sideA}}:::{{sideB}}"],
        ["flashcardBlockTemplate", "settings.flashcardBlock", "{{question}}??\n{{answer}}"],
        ["flashcardClozeTemplate", "settings.flashcardCloze", "=={{answer}}=="]
      ];
      for (const [field, label, placeholder] of syntaxTemplates2) {
        const setting = new Setting3(fsrsSection).setName(t(label)).setDesc(t("settings.flashcardTemplateDesc"));
        const saveTemplate = async (value) => {
          this.plugin.settings[field] = value;
          await save();
        };
        if (field === "flashcardBlockTemplate") {
          setting.addTextArea((input) => input.setPlaceholder(placeholder).setValue(this.plugin.settings[field]).onChange(saveTemplate));
          const textarea = setting.controlEl.querySelector("textarea");
          if (textarea) textarea.rows = 2;
        } else setting.addText((input) => input.setPlaceholder(placeholder).setValue(this.plugin.settings[field]).onChange(saveTemplate));
        setting.addExtraButton((button) => button.setIcon("reset").setTooltip(t("settings.resetTemplate")).onClick(async () => {
          const value = DEFAULT_SETTINGS2[field];
          this.plugin.settings[field] = value;
          await save();
          this.update();
        }));
      }
      new Setting3(fsrsSection).setName(t("settings.retention")).setDesc(t("settings.retentionDesc")).addSlider((s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).onChange(async (v) => {
        this.plugin.settings.requestRetention = v;
        await save();
      }));
      new Setting3(fsrsSection).setName(t("settings.newLimit")).addSlider((s) => s.setLimits(0, 100, 5).setValue(this.plugin.settings.newPerDay).onChange(async (v) => {
        this.plugin.settings.newPerDay = v;
        await save();
      }));
      new Setting3(fsrsSection).setName(t("settings.sessionLimit")).addSlider((s) => s.setLimits(10, 500, 10).setValue(this.plugin.settings.maxReviewsPerSession).onChange(async (v) => {
        this.plugin.settings.maxReviewsPerSession = v;
        await save();
      }));
      new Setting3(fsrsSection).setName(t("settings.cardFront")).setDesc(t("settings.cardFrontDesc")).addDropdown((dd) => dd.addOption("note", t("settings.noteCard")).addOption("cloze", t("settings.clozeCard")).setValue(this.plugin.settings.cardFront).onChange(async (v) => {
        this.plugin.settings.cardFront = v === "cloze" ? "cloze" : "note";
        await save();
      }));
      new Setting3(fsrsSection).setName(t("settings.showReviewMetadata")).setDesc(t("settings.showReviewMetadataDesc")).addToggle((toggle) => toggle.setValue(!!this.plugin.settings.showReviewMetadata).onChange(async (value) => {
        this.plugin.settings.showReviewMetadata = value;
        this.plugin.applyReviewMetadataVisibility();
        await save();
      }));
      new Setting3(fsrsSection).setName(t("settings.ratingOffset")).setDesc(t("settings.ratingOffsetDesc")).addSlider((s) => s.setLimits(0, 200, 5).setValue(this.plugin.settings.reviewBottomSpace).setInstant(true).setDisplayFormat((value) => `${value}px`).onChange(async (value) => {
        this.plugin.settings.reviewBottomSpace = value;
        this.app.workspace.containerEl.ownerDocument.querySelectorAll('.workspace-leaf-content[data-type="lexis-review-view"]').forEach((view) => view.setCssProps({ "--lexis-review-bottom-space": `${value}px` }));
        await save();
      }));
      new Setting3(fsrsSection).setName(t("home.start")).addButton((b) => b.setButtonText(t("settings.openReview")).setCta().onClick(() => this.plugin.openHome()));
      new Setting3(fsrsSection).setName(t("settings.hoverFeedback")).setDesc(t("settings.hoverFeedbackDesc")).addToggle((t2) => t2.setValue(this.plugin.settings.hoverFeedback).onChange(async (v) => {
        this.plugin.settings.hoverFeedback = v;
        await save();
      }));
      new Setting3(fsrsSection).setName(t("settings.feedbackDays")).setDesc(t("settings.feedbackDaysDesc")).addSlider((s) => s.setLimits(1, 30, 1).setValue(this.plugin.settings.hoverFeedbackDays).onChange(async (v) => {
        this.plugin.settings.hoverFeedbackDays = v;
        await save();
      }));
      new Setting3(fsrsSection).setName(t("settings.retireDays")).setDesc(t("settings.retireDaysDesc")).addSlider((s) => s.setLimits(14, 365, 1).setValue(this.plugin.settings.retireCandidateDays).onChange(async (v) => {
        this.plugin.settings.retireCandidateDays = v;
        await save();
      }));
      const bridgeSection = this.section(containerEl, t("settings.bridge"), { desc: t("settings.bridgeDesc") });
      new Setting3(bridgeSection).setName(t("settings.enableBridge")).addToggle((t2) => t2.setValue(this.plugin.settings.bridgeEnabled).onChange(async (v) => {
        this.plugin.settings.bridgeEnabled = v;
        if (v && !this.plugin.settings.bridgeToken) this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken();
        await save();
        this.plugin.bridge.restart();
        this.update();
      }));
      new Setting3(bridgeSection).setName(t("settings.port")).setDesc(t("settings.portDesc")).addText((t2) => t2.setValue(String(this.plugin.settings.bridgePort)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (n >= 1024 && n <= 65535) {
          this.plugin.settings.bridgePort = n;
          await save();
        }
      })).addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip(t("settings.restartBridge")).onClick(() => {
        this.plugin.bridge.restart();
        new Notice4(t("notice.bridgeRestarted"));
      }));
      new Setting3(bridgeSection).setName(t("settings.token")).setDesc(t("settings.tokenDesc")).addText((input) => {
        input.setValue(this.plugin.settings.bridgeToken || t("settings.tokenPending")).setDisabled(true);
        input.inputEl.setCssStyles({ width: "260px" });
      }).addExtraButton((b) => b.setIcon("copy").setTooltip(t("settings.copyToken")).onClick(async () => {
        if (this.plugin.settings.bridgeToken) {
          await navigator.clipboard.writeText(this.plugin.settings.bridgeToken);
          new Notice4(t("notice.tokenCopied"));
        }
      })).addExtraButton((b) => b.setIcon("refresh-cw").setTooltip(t("settings.regenerateToken")).onClick(async () => {
        this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken();
        await save();
        this.plugin.bridge.restart();
        this.update();
      }));
      new Setting3(containerEl).setName(t("settings.rebuild")).addButton((b) => b.setButtonText(t("settings.rebuildNow")).onClick(() => {
        void this.plugin.rebuildIndex(true);
        this.renderStats();
      }));
      this.statsEl = containerEl.createEl("p", { cls: "lexis-stats" });
      this.renderStats();
    }
    renderStats() {
      if (!this.statsEl) return;
      const s = this.plugin.stats;
      this.statsEl.setText(this.plugin.t("settings.stats", { words: s.words, aliases: s.aliases, inline: s.inlineEntries || 0, due: s.due || 0 }));
    }
  };
};

// src/review-state.ts
var cloneState = (state) => state ? { ...state } : null;
function createReviewState({ todayStr, round2: round22 }) {
  class ReviewState {
    readSyntaxCardState(id) {
      const state = this.settings.syntaxCardStates?.[id] || {};
      return {
        ...state,
        history: Array.isArray(this.settings.reviewHistory?.[`syntax:${id}`]) ? this.settings.reviewHistory[`syntax:${id}`] : []
      };
    }
    snapshotReviewItem(item) {
      if (item.type === "note") return { note: cloneState(item.card) };
      const syntax = {};
      for (const id of item.syntax?.memberIds || []) syntax[id] = cloneState(this.settings.syntaxCardStates?.[id]);
      return { syntax };
    }
    async applyReviewItemSchedule(item, schedule) {
      const state = {
        s: round22(schedule.s),
        d: round22(schedule.d),
        due: schedule.due,
        last: todayStr(),
        reps: schedule.reps,
        lapses: schedule.lapses
      };
      if (item.type === "note") {
        await this.app.fileManager.processFrontMatter(item.file, (frontmatter) => {
          frontmatter["lexis-s"] = state.s;
          frontmatter["lexis-d"] = state.d;
          frontmatter["lexis-due"] = state.due;
          frontmatter["lexis-last"] = state.last;
          frontmatter["lexis-reps"] = state.reps;
          frontmatter["lexis-lapses"] = state.lapses;
        });
        return;
      }
      for (const id of item.syntax?.memberIds || []) this.settings.syntaxCardStates[id] = { ...state };
      await this.saveSettings();
    }
    async restoreReviewItem(item, snapshot) {
      if (item.type === "note") {
        const previous = snapshot.note;
        await this.app.fileManager.processFrontMatter(item.file, (frontmatter) => {
          if (previous?.s == null || Number.isNaN(Number(previous.s))) {
            delete frontmatter["lexis-s"];
            delete frontmatter["lexis-d"];
            delete frontmatter["lexis-due"];
            delete frontmatter["lexis-last"];
            delete frontmatter["lexis-reps"];
            delete frontmatter["lexis-lapses"];
            return;
          }
          frontmatter["lexis-s"] = previous.s;
          frontmatter["lexis-d"] = previous.d;
          frontmatter["lexis-due"] = previous.due;
          frontmatter["lexis-last"] = previous.last;
          frontmatter["lexis-reps"] = previous.reps;
          frontmatter["lexis-lapses"] = previous.lapses;
        });
        return;
      }
      for (const [id, state] of Object.entries(snapshot.syntax || {})) {
        if (state) this.settings.syntaxCardStates[id] = { ...state };
        else delete this.settings.syntaxCardStates[id];
      }
      await this.saveSettings();
    }
    async logReviewItem(item, schedule, grade, retentionBefore) {
      const today = todayStr();
      this.settings.reviewLog[today] = (this.settings.reviewLog[today] || 0) + 1;
      const keys = item.type === "note" ? [item.file.path] : (item.syntax?.memberIds || []).map((id) => `syntax:${id}`);
      for (const key of keys) {
        const history = Array.isArray(this.settings.reviewHistory[key]) ? this.settings.reviewHistory[key] : [];
        history.push({ date: today, s: round22(schedule.s), grade, retention: Math.round(Math.max(0, Math.min(1, retentionBefore)) * 100) });
        this.settings.reviewHistory[key] = history.slice(-64);
      }
      await this.saveSettings();
    }
    async undoReviewItemLog(item) {
      const today = todayStr();
      if (this.settings.reviewLog[today]) {
        this.settings.reviewLog[today]--;
        if (this.settings.reviewLog[today] <= 0) delete this.settings.reviewLog[today];
      }
      const keys = item.type === "note" ? [item.file.path] : (item.syntax?.memberIds || []).map((id) => `syntax:${id}`);
      for (const key of keys) {
        const history = this.settings.reviewHistory[key];
        if (Array.isArray(history) && history.length) history.pop();
      }
      await this.saveSettings();
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(ReviewState.prototype);
  delete descriptors.constructor;
  return descriptors;
}

// src/flashcard-syntax.ts
var PLACEHOLDERS = {
  question: "{{question}}",
  answer: "{{answer}}",
  sideA: "{{sideA}}",
  sideB: "{{sideB}}"
};
var hashText = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};
var stableId = (filePath, kind, front, back, occurrence = 0) => `syntax-${hashText([filePath, kind, front.trim(), back.trim(), occurrence].join(""))}`;
var betweenVariables = (template, left, right) => {
  const leftIndex = template.indexOf(left);
  const rightIndex = template.indexOf(right, leftIndex + left.length);
  if (leftIndex < 0 || rightIndex < 0 || rightIndex < leftIndex) return "";
  return template.slice(leftIndex + left.length, rightIndex);
};
var maskExcludedLines = (markdown) => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let fence = "";
  let frontmatter = lines[0]?.trim() === "---";
  let comment = false;
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (frontmatter) {
      if (index > 0 && trimmed === "---") frontmatter = false;
      return "";
    }
    if (fence) {
      if (trimmed.startsWith(fence)) fence = "";
      return "";
    }
    const fenceMatch = /^(```+|~~~+)/.exec(trimmed);
    if (fenceMatch) {
      fence = fenceMatch[1][0].repeat(fenceMatch[1].length);
      return "";
    }
    if (comment) {
      if (line.includes("-->")) comment = false;
      return "";
    }
    const commentStart = line.indexOf("<!--");
    if (commentStart >= 0) {
      if (!line.slice(commentStart + 4).includes("-->")) comment = true;
      return line.slice(0, commentStart);
    }
    return line;
  });
};
var addCard = (cards, counts, filePath, kind, front, back, line, groupSource = "", combinedFront) => {
  const base = [kind, front.trim(), back.trim()].join("");
  const occurrence = counts.get(base) || 0;
  counts.set(base, occurrence + 1);
  const id = stableId(filePath, kind, front, back, occurrence);
  cards.push({
    id,
    groupId: `group-${hashText([filePath, kind, groupSource || base, line].join(""))}`,
    kind,
    front: front.trim(),
    back: back.trim(),
    combinedFront: combinedFront?.trim(),
    line
  });
};
function parseSyntaxCards(markdown, filePath, templates) {
  const rawLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const lines = maskExcludedLines(markdown);
  const cards = [];
  const counts = /* @__PURE__ */ new Map();
  const consumed = /* @__PURE__ */ new Set();
  const blockBetween = betweenVariables(templates.block || "", PLACEHOLDERS.question, PLACEHOLDERS.answer);
  const blockMarker = blockBetween.trim();
  const markerOnOwnLine = /^\s*\n[\s\S]*\n\s*$/.test(blockBetween);
  if (blockMarker) {
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      let question = "";
      let answerStart = index + 1;
      let questionStart = index;
      if (markerOnOwnLine && line.trim() === blockMarker) {
        let start = index - 1;
        while (start >= 0 && lines[start].trim()) start--;
        questionStart = start + 1;
        question = rawLines.slice(questionStart, index).join("\n").trim();
      } else if (!markerOnOwnLine && line.trimEnd().endsWith(blockMarker)) {
        question = line.trimEnd().slice(0, -blockMarker.length).trim();
      } else continue;
      let answerEnd = answerStart;
      while (answerEnd < rawLines.length && rawLines[answerEnd].trim()) answerEnd++;
      const answer = rawLines.slice(answerStart, answerEnd).join("\n").trim();
      if (!question || !answer) continue;
      for (let used = questionStart; used < answerEnd; used++) consumed.add(used);
      addCard(cards, counts, filePath, "block", question, answer, questionStart, `${question}
${answer}`);
      index = Math.max(index, answerEnd - 1);
    }
  }
  const bidirectionalDelimiter = betweenVariables(templates.bidirectional || "", PLACEHOLDERS.sideA, PLACEHOLDERS.sideB).trim();
  const inlineDelimiter = betweenVariables(templates.inline || "", PLACEHOLDERS.question, PLACEHOLDERS.answer).trim();
  for (let index = 0; index < lines.length; index++) {
    if (consumed.has(index) || !lines[index].trim()) continue;
    const line = lines[index];
    if (bidirectionalDelimiter && line.includes(bidirectionalDelimiter)) {
      const at = line.indexOf(bidirectionalDelimiter);
      const sideA = line.slice(0, at).trim();
      const sideB = line.slice(at + bidirectionalDelimiter.length).trim();
      if (sideA && sideB) {
        const group = `${sideA}${bidirectionalDelimiter}${sideB}`;
        addCard(cards, counts, filePath, "bidirectional", sideA, sideB, index, group);
        addCard(cards, counts, filePath, "bidirectional", sideB, sideA, index, group);
        consumed.add(index);
      }
      continue;
    }
    if (inlineDelimiter && line.includes(inlineDelimiter)) {
      const at = line.indexOf(inlineDelimiter);
      const question = line.slice(0, at).trim();
      const answer = line.slice(at + inlineDelimiter.length).trim();
      if (question && answer) {
        addCard(cards, counts, filePath, "inline", question, answer, index);
        consumed.add(index);
      }
    }
  }
  const clozeTemplate = templates.cloze || "";
  const answerAt = clozeTemplate.indexOf(PLACEHOLDERS.answer);
  const clozeOpen = answerAt >= 0 ? clozeTemplate.slice(0, answerAt) : "";
  const clozeClose = answerAt >= 0 ? clozeTemplate.slice(answerAt + PLACEHOLDERS.answer.length) : "";
  if (clozeOpen && clozeClose) {
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].trim()) continue;
      const source = lines[index];
      const ranges = [];
      let cursor = 0;
      while (cursor < source.length) {
        const start = source.indexOf(clozeOpen, cursor);
        if (start < 0) break;
        const contentStart = start + clozeOpen.length;
        const close = source.indexOf(clozeClose, contentStart);
        if (close < 0) break;
        const answer = source.slice(contentStart, close).trim();
        if (answer) ranges.push({ start, end: close + clozeClose.length, answer });
        cursor = close + clozeClose.length;
      }
      if (!ranges.length) continue;
      const combinedFront = ranges.reduceRight((value, range) => value.slice(0, range.start) + "[\u2026]" + value.slice(range.end), source);
      ranges.forEach((range) => {
        const front = source.slice(0, range.start) + "[\u2026]" + source.slice(range.end);
        addCard(cards, counts, filePath, "cloze", front, source, index, source, combinedFront);
      });
    }
  }
  return cards;
}

// src/review-queue.ts
var isFresh = (card) => card.s == null || Number.isNaN(Number(card.s));
var syntaxTemplates = (settings) => ({
  inline: settings.flashcardInlineTemplate,
  bidirectional: settings.flashcardBidirectionalTemplate,
  block: settings.flashcardBlockTemplate,
  cloze: settings.flashcardClozeTemplate
});
var representativeState = (states) => {
  if (!states.length || states.some(isFresh)) return {};
  return [...states].sort((left, right) => String(left.due || "").localeCompare(String(right.due || "")))[0];
};
var stripFrontmatter = (markdown) => markdown.replace(/^---\s*\n[\s\S]*?\n---(?:\n|$)/, "");
var countNoteWords = (markdown) => {
  const content = stripFrontmatter(markdown);
  const cjkPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const cjkCount = content.match(cjkPattern)?.length || 0;
  const otherWords = content.replace(cjkPattern, " ").match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)?.length || 0;
  return cjkCount + otherWords;
};
function createReviewQueue({ todayStr }) {
  class ReviewQueue {
    collectReviewFolders() {
      const folders = /* @__PURE__ */ new Set();
      for (const file of this.app.vault.getMarkdownFiles()) {
        let path = file.path;
        for (let slash = path.lastIndexOf("/"); slash > 0; slash = path.lastIndexOf("/")) {
          path = path.slice(0, slash);
          folders.add(path);
        }
      }
      return [...folders].sort((left, right) => left.localeCompare(right));
    }
    collectReviewTags() {
      const tags = /* @__PURE__ */ new Set();
      for (const file of this.app.vault.getMarkdownFiles()) for (const tag of this.getTags(file)) tags.add(tag);
      return [...tags].sort((left, right) => left.localeCompare(right));
    }
    reviewScopeFiles(options) {
      const scope = options.scope || "vocab";
      let files = this.app.vault.getMarkdownFiles();
      if (scope === "vocab") files = files.filter((file) => this.inVocabFolder(file.path));
      if (scope === "folder") {
        const folder = this.normalizeFolder(options.folder || "");
        if (folder) files = files.filter((file) => this.inScope(file.path, [folder]));
      }
      if (scope === "tag") {
        const tag = String(options.tag || "").toLowerCase().replace(/^#/, "");
        files = tag ? files.filter((file) => this.getTags(file).has(tag)) : [];
      }
      if (scope === "current") files = files.filter((file) => file.path === options.file);
      return files.filter((file) => {
        const lifecycle = this.readLifecycle(file);
        return !lifecycle.archived && !lifecycle.retired;
      });
    }
    syntaxItems(file, cards, clozeMode) {
      const result = [];
      const combinedGroups = /* @__PURE__ */ new Map();
      for (const syntax of cards) {
        if (syntax.kind === "cloze" && clozeMode === "combined") {
          const group = combinedGroups.get(syntax.groupId) || [];
          group.push(syntax);
          combinedGroups.set(syntax.groupId, group);
          continue;
        }
        result.push({
          type: "syntax",
          file,
          card: this.readSyntaxCardState(syntax.id),
          syntax: { id: syntax.id, memberIds: [syntax.id], kind: syntax.kind, front: syntax.front, back: syntax.back, line: syntax.line }
        });
      }
      for (const group of combinedGroups.values()) {
        const first = group[0];
        const memberIds = group.map((card) => card.id);
        result.push({
          type: "syntax",
          file,
          card: representativeState(memberIds.map((id) => this.readSyntaxCardState(id))),
          syntax: { id: first.groupId, memberIds, kind: "cloze", front: first.combinedFront || first.front, back: first.back, line: first.line }
        });
      }
      return result;
    }
    async migrateSyntaxCardPath(file, oldPath) {
      if (file.extension !== "md" || !oldPath.toLowerCase().endsWith(".md")) return;
      let markdown = "";
      try {
        markdown = await this.app.vault.cachedRead(file);
      } catch {
        return;
      }
      const templates = syntaxTemplates(this.settings);
      const previous = parseSyntaxCards(markdown, oldPath, templates);
      const current = parseSyntaxCards(markdown, file.path, templates);
      let changed = false;
      for (let index = 0; index < Math.min(previous.length, current.length); index++) {
        const before = previous[index], after = current[index];
        if (before.kind !== after.kind || before.front !== after.front || before.back !== after.back) continue;
        const state = this.settings.syntaxCardStates[before.id];
        if (state && !this.settings.syntaxCardStates[after.id]) {
          this.settings.syntaxCardStates[after.id] = state;
          delete this.settings.syntaxCardStates[before.id];
          changed = true;
        }
        const history = this.settings.reviewHistory[`syntax:${before.id}`];
        if (history && !this.settings.reviewHistory[`syntax:${after.id}`]) {
          this.settings.reviewHistory[`syntax:${after.id}`] = history;
          delete this.settings.reviewHistory[`syntax:${before.id}`];
          changed = true;
        }
      }
      if (changed) await this.saveSettings();
    }
    async buildQueue(options = {}) {
      const resolved = options || {};
      const content = resolved.content || "notes";
      const sortBy = resolved.sortBy || "due";
      const direction = resolved.sortDirection === "desc" ? -1 : 1;
      const files = this.reviewScopeFiles(resolved);
      const markdownByPath = /* @__PURE__ */ new Map();
      if (content !== "notes" || sortBy === "wordCount") {
        await Promise.all(files.map(async (file) => {
          try {
            markdownByPath.set(file.path, await this.app.vault.cachedRead(file));
          } catch {
            markdownByPath.set(file.path, "");
          }
        }));
      }
      const candidates = [];
      if (content === "notes" || content === "both") {
        for (const file of files) candidates.push({ type: "note", file, card: this.readCard(file) });
      }
      if (content === "syntax" || content === "both") {
        const templates = syntaxTemplates(this.settings);
        const parsed = files.map((file) => this.syntaxItems(file, parseSyntaxCards(markdownByPath.get(file.path) || "", file.path, templates), resolved.clozeMode || "separate"));
        for (const items of parsed) candidates.push(...items);
      }
      const today = todayStr();
      const due = candidates.filter((item) => !isFresh(item.card) && (!item.card.due || String(item.card.due).slice(0, 10) <= today));
      const fresh = candidates.filter((item) => isFresh(item.card));
      let queue = due.concat(fresh);
      if (sortBy === "random") {
        for (let index = queue.length - 1; index > 0; index--) {
          const target = Math.floor(Math.random() * (index + 1));
          [queue[index], queue[target]] = [queue[target], queue[index]];
        }
      } else {
        const metric = (item, key2) => {
          if (key2 === "due") return item.card.due ? String(item.card.due).slice(0, 10) : null;
          if (key2 === "wordCount") return countNoteWords(markdownByPath.get(item.file.path) || "");
          if (key2 === "modified") return item.file.stat.mtime;
          if (key2 === "created") return item.file.stat.ctime;
          const frequency = this.freqVal(item.file);
          return Number.isFinite(frequency) ? frequency : null;
        };
        const key = sortBy;
        queue.sort((left, right) => {
          const leftValue = metric(left, key), rightValue = metric(right, key);
          if (leftValue == null && rightValue == null) return left.file.path.localeCompare(right.file.path);
          if (leftValue == null) return 1;
          if (rightValue == null) return -1;
          const compared = typeof leftValue === "number" && typeof rightValue === "number" ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue));
          return compared ? compared * direction : left.file.path.localeCompare(right.file.path);
        });
      }
      const newLimit = Math.max(0, this.settings.newPerDay ?? 20);
      let admittedFresh = 0;
      queue = queue.filter((item) => !isFresh(item.card) || admittedFresh++ < newLimit);
      return queue.slice(0, this.settings.maxReviewsPerSession || 200);
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(ReviewQueue.prototype);
  delete descriptors.constructor;
  return descriptors;
}

// src/workspace-documents.ts
var WorkspaceDocuments = class {
  constructor(plugin, callbacks) {
    this.plugin = plugin;
    this.callbacks = callbacks;
    this.documents = /* @__PURE__ */ new Set();
    this.active = plugin.app.workspace.containerEl.ownerDocument;
  }
  start() {
    this.activateLeaf(this.plugin.app.workspace.getMostRecentLeaf());
    this.plugin.registerEvent(this.plugin.app.workspace.on("active-leaf-change", (leaf) => this.activateLeaf(leaf)));
    this.plugin.registerEvent(this.plugin.app.workspace.on("window-open", (_workspaceWindow, window2) => this.activate(window2.document)));
    this.plugin.registerEvent(this.plugin.app.workspace.on("window-close", (_workspaceWindow, window2) => this.remove(window2.document)));
  }
  current() {
    return this.active;
  }
  forEach(callback) {
    for (const document2 of this.documents) callback(document2);
  }
  activateLeaf(leaf) {
    this.activate(leaf?.view?.containerEl?.ownerDocument || this.plugin.app.workspace.containerEl.ownerDocument);
  }
  activate(document2) {
    const documentChanged = this.active !== document2 || !this.documents.has(document2);
    this.bind(document2);
    this.active = document2;
    this.callbacks.activate(document2, documentChanged);
  }
  bind(document2) {
    if (this.documents.has(document2)) return;
    this.documents.add(document2);
    this.plugin.registerDomEvent(document2, "mouseover", (event) => this.callbacks.mouseover(event));
    this.plugin.registerDomEvent(document2, "mouseout", (event) => this.callbacks.mouseout(event));
    this.plugin.registerDomEvent(document2, "click", (event) => this.callbacks.click(event));
    this.plugin.registerDomEvent(document2, "mouseup", (event) => this.callbacks.mouseup(event));
    this.plugin.registerDomEvent(document2, "keydown", (event) => {
      if (event.key === "Escape") this.callbacks.escape();
    });
    const window2 = document2.defaultView;
    if (window2) this.plugin.registerDomEvent(window2, "scroll", (event) => this.callbacks.scroll(event), { capture: true });
  }
  remove(document2) {
    if (!this.documents.delete(document2)) return;
    this.callbacks.close(document2);
    if (this.active === document2) {
      this.active = this.plugin.app.workspace.containerEl.ownerDocument;
      this.activate(this.active);
    }
  }
};

// src/restore-modal.ts
var import_obsidian4 = require("obsidian");
var LexisRestoreModal = class extends import_obsidian4.Modal {
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
    const keepButton = row.createEl("button", { cls: "mod-cta", text: this.plugin.t("restore.keep") });
    keepButton.addEventListener("click", () => {
      void (async () => {
        await this.plugin.setArchived(this.file, false);
        new import_obsidian4.Notice(this.plugin.t("restore.kept", { word: this.file.basename }));
        this.close();
      })();
    });
    const resetButton = row.createEl("button", { text: this.plugin.t("restore.reset") });
    resetButton.addEventListener("click", () => {
      void (async () => {
        await this.app.fileManager.processFrontMatter(this.file, (frontmatter) => {
          delete frontmatter["lexis-status"];
          delete frontmatter["lexis-s"];
          delete frontmatter["lexis-d"];
          delete frontmatter["lexis-due"];
          delete frontmatter["lexis-last"];
          delete frontmatter["lexis-reps"];
          delete frontmatter["lexis-lapses"];
        });
        delete this.plugin.settings.reviewHistory[this.file.path];
        await this.plugin.saveSettings();
        await this.plugin.rebuildIndex(false);
        new import_obsidian4.Notice(this.plugin.t("restore.resetDone", { word: this.file.basename }));
        this.close();
      })();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/annotation-images.ts
var import_obsidian5 = require("obsidian");
var IMAGE_MIME = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp"
};
function attachmentName(file) {
  const clean = file.name.replace(/[\\/:*?"<>|#[\]]/g, "-").trim();
  if (/\.[a-z0-9]+$/i.test(clean)) return clean;
  const extension = Object.entries(IMAGE_MIME).find(([, mime]) => mime === file.type)?.[0] || "png";
  return `${clean || "image"}.${extension}`;
}
async function ensureFolder(app, folder) {
  let current = "";
  for (const part of (0, import_obsidian5.normalizePath)(folder).split("/").filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}
function uniquePath(app, folder, filename) {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : "";
  let path = (0, import_obsidian5.normalizePath)(`${folder}/${filename}`);
  for (let index = 2; app.vault.getAbstractFileByPath(path); index++) {
    path = (0, import_obsidian5.normalizePath)(`${folder}/${stem} ${index}${extension}`);
  }
  return path;
}
async function saveAnnotationImage(app, settings, wordFile, image) {
  const filename = attachmentName(image);
  let path;
  if (settings.annotationImageLocation === "custom") {
    const folder = (0, import_obsidian5.normalizePath)(settings.annotationImageFolder || "");
    if (!folder) throw new Error("Custom annotation image folder is empty");
    await ensureFolder(app, folder);
    path = uniquePath(app, folder, filename);
  } else {
    path = await app.fileManager.getAvailablePathForAttachment(filename, wordFile.path);
  }
  return app.vault.createBinary(path, await image.arrayBuffer());
}
async function vaultImageDataUrl(app, linkPath, sourcePath) {
  const target = String(linkPath || "").split("|")[0].trim();
  if (!target) return null;
  const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
  if (!(file instanceof import_obsidian5.TFile)) return null;
  const mime = IMAGE_MIME[file.extension.toLowerCase()];
  if (!mime) return null;
  const bytes = await app.vault.readBinary(file);
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let offset = 0; offset < view.length; offset += 32768) {
    binary += String.fromCharCode(...view.subarray(offset, offset + 32768));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

// src/shared-utils.ts
var import_obsidian6 = require("obsidian");

// src/match-text.ts
var ASCII_WORD = /[A-Za-z0-9_]/;
var EAST_ASIAN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
var HORIZONTAL_SPACE = /[ \t\u00a0\u3000]/;
var OPTIONAL_MIXED_SPACE = "[ \\t\\u00a0\\u3000]*";
var escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var isMixedScriptBoundary = (left, right) => ASCII_WORD.test(left) && EAST_ASIAN.test(right) || EAST_ASIAN.test(left) && ASCII_WORD.test(right);
function compactMixedScriptSpacing(value) {
  const characters = [...String(value || "")];
  let result = "";
  let previous = "";
  for (let index = 0; index < characters.length; ) {
    const character = characters[index];
    if (!HORIZONTAL_SPACE.test(character)) {
      result += character;
      previous = character;
      index++;
      continue;
    }
    let end = index + 1;
    while (end < characters.length && HORIZONTAL_SPACE.test(characters[end])) end++;
    const next = characters[end] || "";
    if (!isMixedScriptBoundary(previous, next)) result += characters.slice(index, end).join("");
    index = end;
  }
  return result;
}
function flexibleMixedScriptSource(value) {
  const characters = [...String(value || "")];
  let source = "";
  let previous = "";
  let boundaryAlreadyAdded = false;
  for (let index = 0; index < characters.length; ) {
    const character = characters[index];
    if (HORIZONTAL_SPACE.test(character)) {
      let end = index + 1;
      while (end < characters.length && HORIZONTAL_SPACE.test(characters[end])) end++;
      const next = characters[end] || "";
      boundaryAlreadyAdded = isMixedScriptBoundary(previous, next);
      source += boundaryAlreadyAdded ? OPTIONAL_MIXED_SPACE : escapeRe(characters.slice(index, end).join(""));
      index = end;
      continue;
    }
    if (!boundaryAlreadyAdded && previous && isMixedScriptBoundary(previous, character)) source += OPTIONAL_MIXED_SPACE;
    source += escapeRe(character);
    previous = character;
    boundaryAlreadyAdded = false;
    index++;
  }
  return source;
}
var boundedSource = (word) => {
  const leftBoundary = /^[A-Za-z0-9_]/.test(word) ? "\\b" : "";
  const rightBoundary = /[A-Za-z0-9_]$/.test(word) ? "\\b" : "";
  return leftBoundary + flexibleMixedScriptSource(word) + rightBoundary;
};

// src/shared-utils.ts
var escapeHtml = (value) => String(value == null ? "" : value).replace(
  /[&<>"]/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] || character
);
var renderLexisMarkdown = (app, markdown, element, sourcePath, component) => import_obsidian6.MarkdownRenderer.render(app, String(markdown == null ? "" : markdown).replace(/\u00a0/g, " "), element, sourcePath, component);
var round2 = (value) => Math.round(value * 100) / 100;
function cssColorToHex(color, document2) {
  if (!color) return "#888888";
  if (/^#[0-9a-fA-F]{6}$/.test(color.trim())) return color.trim();
  const temporary = document2.body.createDiv();
  temporary.setCssStyles({ color });
  const rgb = temporary.win.getComputedStyle(temporary).color;
  temporary.remove();
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!match) return "#888888";
  return `#${[match[1], match[2], match[3]].map((value) => (+value).toString(16).padStart(2, "0")).join("")}`;
}
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function todayString() {
  return formatDate(/* @__PURE__ */ new Date());
}
function parseDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}
function addDaysString(base, days) {
  const date = base ? parseDate(base) : /* @__PURE__ */ new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}
function daysBetween(from, to) {
  return Math.max(0, Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 864e5));
}

// src/main.ts
var LexisReviewView = createReviewView({
  reviewViewType: LEXIS_REVIEW_VIEW,
  todayStr: todayString,
  renderLexisMarkdown
});
var LexisBridge = createBridgeServer({ Notice: import_obsidian7.Notice, Platform: import_obsidian7.Platform });
var errorMessage4 = (error) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
var LexisPlugin = class extends import_obsidian7.Plugin {
  async onload() {
    await this.loadSettings();
    this.i18n = createI18n(() => this.settings.language);
    this.templateProvider = createTemplateProvider({
      app: this.app,
      TFile: import_obsidian7.TFile,
      getSettings: () => this.settings,
      normalizeFolder: (folder) => this.normalizeFolder(folder),
      readTemplatePath: (path) => this.readTemplatePath(path)
    });
    this.applyReviewMetadataVisibility();
    this.index = /* @__PURE__ */ new Map();
    this.vocabPaths = /* @__PURE__ */ new Set();
    this.stats = { words: 0, aliases: 0, inlineEntries: 0, due: 0 };
    this._pattern = null;
    this._indexKeysByCompact = /* @__PURE__ */ new Map();
    this._matchKeysByCompact = /* @__PURE__ */ new Map();
    this._rebuildTimer = null;
    this._popover = null;
    this._popoverComp = null;
    this._selPill = null;
    this._hideTimer = null;
    this._showTimer = null;
    this._showTarget = null;
    this._occCache = /* @__PURE__ */ new Map();
    this.occurrenceSearch = createOccurrenceSearch({
      app: this.app,
      loadPdfJs: () => obsidian4.loadPdfJs(),
      boundedSource,
      extractSentence: (content, index) => this.extractSentence(content, index),
      markdownAllowed: (file) => !this.inVocabFolder(file.path) && !this.inlineSourcePaths?.has(file.path),
      inScope: (path, scope) => this.inScope(path, scope)
    });
    this.liveAvailable = false;
    this._encounters = {};
    this._encSaveTimer = 0;
    this._encounterDedup = {};
    this._passiveSeenToday = /* @__PURE__ */ new Set();
    this._pageHighlightState = /* @__PURE__ */ new WeakMap();
    this._reviewSessions = /* @__PURE__ */ new WeakMap();
    await this.loadEncounters();
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (file instanceof import_obsidian7.TFile && this.inVocabFolder(file.path)) this.recordEncounter(file, "open");
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
      }
    });
    this.addRibbonIcon("graduation-cap", this.t("ribbon.home"), () => this.openHome());
    this.addRibbonIcon("brain", this.t("ribbon.review"), () => this.openHome());
    this.addCommand({
      id: "archive-word",
      name: this.t("command.archive"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.inVocabFolder(file.path) || this.readLifecycle(file).archived) return false;
        if (checking) return true;
        void this.setArchived(file, true).then(() => new import_obsidian7.Notice(this.t("notice.archived", { word: file.basename })));
        return true;
      }
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
      }
    });
    this.addCommand({
      id: "toggle-pin-word",
      name: this.t("command.pin"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.inVocabFolder(file.path)) return false;
        if (checking) return true;
        const pinned = this.readLifecycle(file).pinned;
        void this.setPinned(file, !pinned).then(() => new import_obsidian7.Notice(this.t(!pinned ? "notice.pinned" : "notice.unpinned", { word: file.basename })));
        return true;
      }
    });
    this.addCommand({
      id: "migrate-familiar-tag-to-archived",
      name: this.t("command.migrate"),
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path) && this.getTags(f).has("\u719F\u6089") && !this.readLifecycle(f).archived && !this.readLifecycle(f).retired);
        if (!files.length) {
          new import_obsidian7.Notice(this.t("notice.noFamiliar"));
          return;
        }
        for (const f of files) await this.app.fileManager.processFrontMatter(f, (fm) => {
          fm["lexis-status"] = "archived";
        });
        await this.rebuildIndex(false);
        new import_obsidian7.Notice(this.t("notice.migrated", { count: files.length }));
      }
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (!(file instanceof import_obsidian7.TFile) || !this.inVocabFolder(file.path)) return;
      const { archived, pinned } = this.readLifecycle(file);
      menu.addItem((it) => it.setTitle(this.t(archived ? "menu.restore" : "menu.archive")).setIcon(archived ? "archive-restore" : "archive").onClick(() => {
        if (archived) new LexisRestoreModal(this.app, this, file).open();
        else void this.setArchived(file, true).then(() => new import_obsidian7.Notice(this.t("notice.archived", { word: file.basename })));
      }));
      menu.addItem((it) => it.setTitle(this.t(pinned ? "menu.unpin" : "menu.pin")).setIcon(pinned ? "pin-off" : "pin").onClick(() => {
        void this.setPinned(file, !pinned).then(() => new import_obsidian7.Notice(this.t(!pinned ? "notice.pinned" : "notice.unpinned", { word: file.basename })));
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
    this._workspaceDocuments = new WorkspaceDocuments(this, {
      mouseover: (event) => this.onMouseOver(event),
      mouseout: (event) => this.onMouseOut(event),
      click: (event) => this.onClick(event),
      mouseup: (event) => this.maybeShowSelPill(event),
      escape: () => this.removeSelPill(),
      scroll: (event) => {
        const target = event.target;
        const node = target && typeof target === "object" && "nodeType" in target ? target : null;
        if (this._popover && node && this._popover.contains(node)) return;
        this.removePopover();
        this.removeSelPill();
      },
      activate: (document2, documentChanged) => {
        if (documentChanged) {
          this.setupPdfHighlight(document2);
          this.setupEpubIframeHighlight(document2);
        }
        this.applyReviewMetadataVisibility();
        this.syncActivePageHighlightState();
      },
      close: (document2) => {
        if (this._popover?.ownerDocument === document2) this.removePopover();
        if (this._selPill?.ownerDocument === document2) this.removeSelPill();
      }
    });
    this._workspaceDocuments.start();
    this.app.workspace.onLayoutReady(() => {
      this._workspaceDocuments.activateLeaf(this.app.workspace.getMostRecentLeaf());
      void this.rebuildIndex(false);
      this.syncActivePageHighlightState();
    });
    this.registerEvent(this.app.vault.on("create", (f) => {
      if (f instanceof import_obsidian7.TFile) this.maybeRebuild(f);
    }));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      if (f instanceof import_obsidian7.TFile) this.maybeRebuild(f);
    }));
    this.registerEvent(this.app.vault.on("rename", (f, old) => {
      if (f instanceof import_obsidian7.TFile) {
        this.maybeRebuild(f, old);
        void this.migrateSyntaxCardPath(f, old);
      }
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      this._occCache.clear();
      if (file instanceof import_obsidian7.TFile && file.extension === "pdf") this.occurrenceSearch.invalidatePdf(file.path);
      if (file instanceof import_obsidian7.TFile && this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(file.path)) this.scheduleRebuild();
    }));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      if (this.vocabPaths.has(file.path) || this.isVocabFile(file) || this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(file?.path)) this.scheduleRebuild();
    }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
      const sel = (editor.getSelection() || "").trim();
      if (!sel || sel.length > 60) return;
      const label = sel.length > 16 ? sel.slice(0, 16) + "\u2026" : sel;
      const dicts = this.dictFolders();
      if (dicts.length > 1) {
        menu.addItem((item) => {
          item.setTitle(this.t("menu.add", { word: label })).setIcon("book-plus");
          const submenu = item.setSubmenu();
          for (const folder of dicts) {
            submenu.addItem((choice) => choice.setTitle(folder).setIcon("folder").onClick(() => this.addWordFromSelection(sel, editor, view, folder)));
          }
        });
      } else {
        menu.addItem((item) => item.setTitle(this.t("menu.add", { word: label })).setIcon("book-plus").onClick(() => this.addWordFromSelection(sel, editor, view)));
      }
    }));
    this.bridge = new LexisBridge(this);
    if (this.settings.bridgeEnabled) {
      if (!this.settings.bridgeToken) {
        this.settings.bridgeToken = this.bridge.generateToken();
        await this.saveSettings();
      }
      this.bridge.start();
    }
  }
  onunload() {
    window.clearTimeout(this._rebuildTimer);
    window.clearTimeout(this._hideTimer);
    window.clearTimeout(this._showTimer);
    if (this._encSaveTimer) {
      window.clearTimeout(this._encSaveTimer);
      void this.saveEncounters();
    }
    this.removePopover();
    this.removeSelPill();
    this.teardownPdfHighlight();
    this.teardownEpubIframeHighlight();
    this.bridge?.stop();
    this._workspaceDocuments?.forEach((document2) => document2.body?.classList.remove("lexis-show-review-metadata"));
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
    if (this.settings.vocabFolders == null) this.settings.vocabFolders = this.settings.vocabFolder != null ? this.settings.vocabFolder : "01-word";
    if (this.settings.excludeTags == null) this.settings.excludeTags = this.settings.excludeTag || "";
    if (this.settings.vocabTags == null) this.settings.vocabTags = "";
    if (!Array.isArray(this.settings.dicts)) {
      this.settings.dicts = this.parseFolders(this.settings.vocabFolders).map((f) => ({ folder: f, template: "" }));
    }
  }
  t(key, vars) {
    return this.i18n ? this.i18n.t(key, vars) : key;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  applyReviewMetadataVisibility() {
    if (this._workspaceDocuments) {
      this._workspaceDocuments.forEach((document2) => document2.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata));
      return;
    }
    this.app.workspace.containerEl.ownerDocument.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata);
  }
  parseTagRulesText(text) {
    const rules = [];
    for (const line of (text || "").split("\n")) {
      const m = /^\s*#?([^:：]+)[:：]\s*(\S+)(?:\s+(wavy|underline|background))?\s*$/.exec(line);
      if (m) rules.push({ tag: m[1].trim(), color: m[2].trim(), style: m[3] || "" });
    }
    return rules;
  }
  // ---------- 出处 & 相关词 ----------
  parseFolders(text) {
    return (text || "").split(/[,，\n]/).map((s) => this.normalizeFolder(s)).filter(Boolean);
  }
  parseTags(text) {
    return (text || "").split(/[,，;；\s]+/).map((s) => s.trim().replace(/^#/, "").toLowerCase()).filter(Boolean);
  }
  vocabTagSet() {
    return new Set(this.parseTags(this.settings.vocabTags));
  }
  excludeTagSet() {
    return new Set(this.parseTags(this.settings.excludeTags));
  }
  // 词典表的文件夹列表 = 文件夹来源的单一真相
  dictFolders() {
    return (this.settings.dicts || []).map((d) => this.normalizeFolder(d && d.folder)).filter(Boolean);
  }
  // 一条词的最终高亮色(优先级:标签规则 > 词典色 > 全局兜底),返回解析后的真实 hex —— 网页和 ob 同一套优先级
  colorForEntry(e) {
    let color = this.effectiveHighlightColor();
    const dc = this.dictColorForFile(e && e.file);
    if (dc) color = dc;
    if (e && e.tags && this.settings.tagRules && this.settings.tagRules.length) {
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
    const document2 = this._workspaceDocuments?.current() || this.app.workspace.containerEl.ownerDocument;
    try {
      return cssColorToHex(document2.defaultView?.getComputedStyle(document2.body).getPropertyValue("--text-accent") || "", document2);
    } catch {
      return "#7c5cff";
    }
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
  primaryVocabFolder() {
    return this.dictFolders()[0] || "";
  }
  // 新建单词时落地的文件夹(取第一个)
  inFolderScope(path) {
    const fs = this.dictFolders();
    return fs.length ? this.inScope(path, fs) : false;
  }
  // 某文件夹对应的模板:命中某词典行 → 完全按它的 template(留空=空白笔记,不再回退全局);
  // 没有对应词典行(极少见)→ 才用全局默认 newWordTemplate。这样"没给这个词典选模板"= 空白,符合直觉。
  templateForFolder(folder) {
    return this.templateProvider.readLexis(folder);
  }
  isVocabFile(file) {
    if (!file || !file.path) return false;
    if (this.inFolderScope(file.path)) return true;
    const ts = this.vocabTagSet();
    if (ts.size) {
      for (const t of this.getTags(file)) if (ts.has(t)) return true;
    }
    return false;
  }
  inScope(path, scope) {
    if (!scope.length) return true;
    return scope.some((f) => path === f || path.startsWith(f + "/"));
  }
  extractSentence(content, idx) {
    const bound = /[.!?。！？\n]/;
    let s = idx;
    while (s > 0 && !bound.test(content[s - 1])) s--;
    let e = idx;
    while (e < content.length && !bound.test(content[e])) e++;
    let sent = content.slice(s, e + 1).replace(/\s+/g, " ").trim();
    if (sent.length > 220) sent = sent.slice(0, 220) + "\u2026";
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
    const set = /* @__PURE__ */ new Set();
    for (const src in resolved) {
      if (resolved[src][file.path] && this.inVocabFolder(src) && src !== file.path) set.add(src);
    }
    const out = resolved[file.path] || {};
    for (const dest in out) {
      if (this.inVocabFolder(dest) && dest !== file.path) set.add(dest);
    }
    return [...set].map((p) => this.app.vault.getAbstractFileByPath(p)).filter((file2) => file2 instanceof import_obsidian7.TFile);
  }
  parseSectionLinks(raw, known) {
    const clean = raw.replace(/```[\s\S]*?```/g, "").replace(/^---\n[\s\S]*?\n---/, "");
    const out = [];
    let cur = "\u76F8\u5173";
    const linkRe = /\[\[([^\]|#\n]+)(?:\|[^\]\n]*)?\]\]/g;
    for (const line of clean.split("\n")) {
      const h = /^#{1,6}\s*(.+?)\s*$/.exec(line);
      if (h) {
        cur = known.find((t) => h[1].includes(t)) || "\u76F8\u5173";
        continue;
      }
      let m;
      linkRe.lastIndex = 0;
      while (m = linkRe.exec(line)) out.push({ type: cur, target: m[1].trim() });
    }
    return out;
  }
  async findTypedRelations(file) {
    const KNOWN = ["\u8FD1\u4E49\u8BCD", "\u540C\u6839\u8BCD", "\u5F62\u8FD1\u8BCD", "\u8FA8\u6790"];
    const out = {}, inc = {};
    const put = (bag, type, tf) => {
      if (!tf || tf.path === file.path) return;
      (bag[type] = bag[type] || /* @__PURE__ */ new Map()).set(tf.path, tf.basename);
    };
    try {
      const raw = await this.app.vault.cachedRead(file);
      for (const { type, target } of this.parseSectionLinks(raw, KNOWN)) {
        const tf = this.app.metadataCache.getFirstLinkpathDest(target, file.path);
        if (tf && this.inVocabFolder(tf.path)) put(out, type, tf);
      }
    } catch {
    }
    const resolved = this.app.metadataCache.resolvedLinks || {};
    for (const src in resolved) {
      if (!this.inVocabFolder(src) || src === file.path || !resolved[src][file.path]) continue;
      const srcFile = this.app.vault.getAbstractFileByPath(src);
      if (!(srcFile instanceof import_obsidian7.TFile)) continue;
      try {
        const raw = await this.app.vault.cachedRead(srcFile);
        let matched = false;
        for (const { type, target } of this.parseSectionLinks(raw, KNOWN)) {
          const tf = this.app.metadataCache.getFirstLinkpathDest(target, src);
          if (tf && tf.path === file.path) {
            put(inc, type, srcFile);
            matched = true;
          }
        }
        if (!matched) put(inc, "\u76F8\u5173", srcFile);
      } catch {
      }
    }
    const toArr = (bag) => {
      const result = {};
      for (const type in bag) result[type] = [...bag[type].entries()].map(([path, basename]) => ({ path, basename }));
      return result;
    };
    return { out: toArr(out), inc: toArr(inc) };
  }
  async renderDerivedWords(container, file) {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const map = /* @__PURE__ */ new Map();
    for (const src in resolved) {
      if (this.inVocabFolder(src) && resolved[src] && resolved[src][file.path]) {
        const sf = this.app.vault.getAbstractFileByPath(src);
        if (sf instanceof import_obsidian7.TFile) map.set(src, sf.basename);
      }
    }
    if (!map.size) return;
    container.createDiv({ cls: "lexis-section-title", text: `\u{1F331} \u6D3E\u751F\u8BCD (${map.size})` });
    const w = container.createDiv({ cls: "lexis-related" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
  }
  relLink(w, path, basename) {
    const a = w.createEl("a", { text: basename, href: "#" });
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof import_obsidian7.TFile) {
        void this.app.workspace.getLeaf(false).openFile(f);
        this.removePopover();
      }
    });
  }
  async renderTypedRelations(container, file) {
    const { out, inc } = await this.findTypedRelations(file);
    const order = ["\u8FD1\u4E49\u8BCD", "\u540C\u6839\u8BCD", "\u5F62\u8FD1\u8BCD", "\u8FA8\u6790", "\u76F8\u5173"];
    let n = 0;
    for (const t of order) {
      const map = /* @__PURE__ */ new Map();
      for (const r of out[t] || []) map.set(r.path, r.basename);
      for (const r of inc[t] || []) map.set(r.path, r.basename);
      if (!map.size) continue;
      container.createDiv({ cls: "lexis-section-title", text: "\u{1F517} " + t });
      const w = container.createDiv({ cls: "lexis-related" });
      for (const [path, basename] of map) {
        this.relLink(w, path, basename);
        n++;
      }
    }
    return n;
  }
  async renderReverseRelations(container, file, type) {
    const { out, inc } = await this.findTypedRelations(file);
    const types = type === "\u8FA8\u6790" ? ["\u8FA8\u6790", "\u76F8\u5173"] : [type];
    const outPaths = /* @__PURE__ */ new Set();
    for (const t of types) for (const r of out[t] || []) outPaths.add(r.path);
    const map = /* @__PURE__ */ new Map();
    for (const t of types) for (const r of inc[t] || []) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
    if (!map.size) return 0;
    const w = container.createDiv({ cls: "lexis-related lexis-rel-reverse" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
    return map.size;
  }
  async getCuratedSourcePaths(wordFile) {
    try {
      const raw = await this.app.vault.cachedRead(wordFile);
      const names = [this.occurrenceHeadingText(), "\u4F8B\u53E5", "\u51FA\u5904"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return /* @__PURE__ */ new Set();
      const set = /* @__PURE__ */ new Set();
      const re = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
      let mm;
      while (mm = re.exec(m[1])) {
        const base = mm[1].trim().split("/").pop().replace(/\.(?:md|pdf)$/i, "");
        set.add(base.toLowerCase());
      }
      return set;
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  sourceLinkTarget(file) {
    return file?.extension === "md" ? file.basename : file?.name || "";
  }
  async addExampleToWord(wordFile, sentence, sourceFile, page) {
    if (sourceFile) {
      const curated = await this.getCuratedSourcePaths(wordFile);
      if (curated.has(sourceFile.basename.toLowerCase())) {
        new import_obsidian7.Notice(this.t("notice.occurrenceExists"));
        return true;
      }
    }
    const occurrence = {
      word: wordFile.basename,
      sentence: (sentence || "").trim(),
      source: sourceFile ? page ? `[[${this.sourceLinkTarget(sourceFile)}#page=${page}|${sourceFile.basename} p.${page}]]` : `[[${this.sourceLinkTarget(sourceFile)}]]` : "",
      date: todayString()
    };
    const apply = (data) => this.insertOccurrence(data, occurrence);
    try {
      if (this.app.vault.process) await this.app.vault.process(wordFile, apply);
      else {
        const d = await this.app.vault.read(wordFile);
        await this.app.vault.modify(wordFile, apply(d));
      }
      this.recordEncounter(wordFile, "add");
      new import_obsidian7.Notice(this.t("notice.occurrenceSaved"));
      return true;
    } catch (err) {
      new import_obsidian7.Notice(this.t("notice.occurrenceFailed", { error: errorMessage4(err) }));
      return false;
    }
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
    await this.rebuildIndex(false);
  }
  async setPinned(file, pinned) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (pinned) fm["lexis-pinned"] = true;
      else delete fm["lexis-pinned"];
    });
    await this.rebuildIndex(false);
  }
  // 淘汰 = 归档而非删除:退出高亮与复习,文件保留,但比"归档"更彻底——悬停也不再触发(不像归档还留一个隐形代理 span)。
  // 只从"淘汰法庭"候选列表的操作按钮触发,没有独立的命令/右键菜单入口(候选判定本身已经是入口了)。
  async setRetired(file, retired) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (retired) fm["lexis-status"] = "retired";
      else delete fm["lexis-status"];
    });
    await this.rebuildIndex(false);
  }
  // ---------- 相遇记账(阶段 2) ----------
  // 只做"强相遇"记账:悬停查释义 / 划词加出处 / 打开词条笔记本身,都是现成代码路径上加一行记账,
  // 不额外采集停留时长/滚动/点击深度。数据存进插件自己 data 目录下的 sidecar JSON,不写 frontmatter——
  // 悬停很频繁,写 frontmatter 会不停刷新笔记 mtime 和 git 历史。
  encountersPath() {
    return `${this.app.vault.configDir}/plugins/${this.manifest.id}/encounters.json`;
  }
  async loadEncounters() {
    try {
      const parsed = JSON.parse(await this.app.vault.adapter.read(this.encountersPath()));
      this._encounters = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      this._encounters = {};
    }
  }
  // key 用词条文件的标题(不是命中它的具体别名/拼法)——别名和标题指向同一个文件,相遇次数要合并,不能按 key 分裂计数
  // 短时间内反复触发同一类相遇(比如鼠标在同一个词上晃出晃入,连续弹好几次悬浮卡)只算一次,靠 (词+类型) 的冷却时间去重
  recordEncounter(file, type) {
    if (!(file instanceof import_obsidian7.TFile)) return;
    const k = file.basename.toLowerCase();
    const now = Date.now();
    const dedupKey = k + ":" + type;
    if (!this._encounterDedup) this._encounterDedup = {};
    const last = this._encounterDedup[dedupKey];
    if (last && now - last < 6e4) return;
    this._encounterDedup[dedupKey] = now;
    const e = this._encounters[k] || (this._encounters[k] = { hoverCount: 0, encounterCount: 0, lastEncounter: "" });
    e.encounterCount = (e.encounterCount || 0) + 1;
    if (type === "hover") e.hoverCount = (e.hoverCount || 0) + 1;
    e.lastEncounter = todayString();
    if (this._encSaveTimer) window.clearTimeout(this._encSaveTimer);
    this._encSaveTimer = window.setTimeout(() => {
      void this.saveEncounters();
    }, 1500);
  }
  // 被动相遇(阶段 4):高亮装饰在打开的文件里实际渲染出来,就算词出现在你面前过一次——比悬停更弱的信号,
  // 只证明"出现过",不证明"注意到了"。按「词+当天」去重,不是每次重渲染(滚动/切标签页/实时预览重算)都记一次。
  // 这个检查要挂在高亮渲染的热路径上(每个匹配到的 span 都会过一遍),所以只用一次 Set.has,不做更重的事。
  passiveEncounter(file) {
    if (!(file instanceof import_obsidian7.TFile)) return;
    const dayKey = file.path + "|" + todayString();
    if (this._passiveSeenToday.has(dayKey)) return;
    this._passiveSeenToday.add(dayKey);
    this.recordEncounter(file, "passive");
  }
  async saveEncounters() {
    this._encSaveTimer = 0;
    try {
      await this.app.vault.adapter.write(this.encountersPath(), JSON.stringify(this._encounters));
    } catch {
    }
  }
  // 悬停 = 一次失败的提取(没想起来才要查)。这个词的到期日如果还很远,说明"排期偏晚了",拉近一点提醒尽快复习——
  // 只挪 lexis-due,绝不碰 stability/difficulty,也不伪造一次复习评分(FSRS 内部状态只能由真实复习事件驱动)。
  async hoverFeedback(file) {
    if (!this.settings.hoverFeedback || !(file instanceof import_obsidian7.TFile)) return;
    if (this.readLifecycle(file).archived) return;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    if (fm["lexis-s"] == null || !fm["lexis-due"]) return;
    const today = todayString();
    const rawDue = fm["lexis-due"];
    if (typeof rawDue !== "string" && typeof rawDue !== "number") return;
    const due = String(rawDue).slice(0, 10);
    const threshold = addDaysString(today, this.settings.hoverFeedbackDays ?? 3);
    if (due <= threshold) return;
    await this.app.fileManager.processFrontMatter(file, (fm2) => {
      fm2["lexis-due"] = today;
    });
  }
  // ---------- FSRS 调度 ----------
  readCard(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    return {
      s: typeof fm["lexis-s"] === "number" ? fm["lexis-s"] : null,
      d: typeof fm["lexis-d"] === "number" ? fm["lexis-d"] : null,
      due: typeof fm["lexis-due"] === "string" ? fm["lexis-due"] : null,
      last: typeof fm["lexis-last"] === "string" ? fm["lexis-last"] : null,
      reps: typeof fm["lexis-reps"] === "number" ? fm["lexis-reps"] : null,
      lapses: typeof fm["lexis-lapses"] === "number" ? fm["lexis-lapses"] : null,
      history: Array.isArray(this.settings.reviewHistory?.[file.path]) ? this.settings.reviewHistory[file.path] : []
    };
  }
  cardRetrievability(card, date = todayString()) {
    const s = Number(card?.s);
    if (!s || isNaN(s) || !card?.last) return 0;
    return FSRS.retrievability(Math.max(0, daysBetween(card.last, date)), s);
  }
  scheduleCard(card, grade) {
    const R = this.settings.requestRetention || 0.9;
    let reps = (Number(card.reps) || 0) + 1, lapses = Number(card.lapses) || 0, S, D;
    const today = todayString();
    if (card.s == null || isNaN(Number(card.s))) {
      S = FSRS.initStability(grade);
      D = FSRS.initDifficulty(grade);
    } else {
      const t = card.last ? daysBetween(card.last, today) : 0;
      const r = FSRS.retrievability(t, Number(card.s));
      D = FSRS.nextDifficulty(Number(card.d), grade);
      if (grade === 1) {
        S = FSRS.nextForgetStability(Number(card.d), Number(card.s), r);
        lapses++;
      } else {
        S = FSRS.nextRecallStability(Number(card.d), Number(card.s), r, grade);
      }
    }
    S = Math.max(0.01, S);
    const interval = FSRS.nextInterval(S, R);
    return { s: S, d: D, reps, lapses, interval, due: addDaysString(today, interval) };
  }
  async getFirstExample(file) {
    try {
      const raw = await this.app.vault.cachedRead(file);
      if (!this.occurrenceHeadingText()) return this.occurrenceSentenceFromSection(raw);
      const names = [this.occurrenceHeadingText(), "\u4F8B\u53E5", "\u51FA\u5904"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return "";
      return this.occurrenceSentenceFromSection(m[1]);
    } catch {
      return "";
    }
  }
  buildCloze(sentence, word) {
    return sentence.replace(new RegExp(boundedSource(word), "ig"), "______");
  }
  humanInterval(days) {
    if (days < 1) return this.t("interval.ltDay");
    if (days < 30) return this.t("interval.days", { count: days });
    if (days < 365) return this.t("interval.months", { count: Math.round(days / 30) });
    return this.t("interval.years", { count: (days / 365).toFixed(1) });
  }
  freqVal(file) {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const n = parseInt(String(fm && fm.frequency).replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? Infinity : n;
  }
  collectVocabTags() {
    const s = /* @__PURE__ */ new Set();
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!this.inVocabFolder(f.path)) continue;
      for (const t of this.getTags(f)) s.add(t);
    }
    return [...s].sort();
  }
  computeStats() {
    const today = todayString();
    let total = 0, due = 0, fresh = 0;
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!this.inVocabFolder(f.path)) continue;
      total++;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
      if (fm["lexis-status"] === "archived" || fm["lexis-status"] === "retired") continue;
      if (fm["lexis-s"] == null) {
        fresh++;
        due++;
      } else if (!fm["lexis-due"] || String(fm["lexis-due"]).slice(0, 10) <= today) due++;
    }
    return { total, due, fresh };
  }
  // ---------- 淘汰法庭(阶段 3) ----------
  // 硬条件筛子,不做加权评分:全部满足才入列,判决权在用户(淘汰/留下/已掌握三个按钮,见 LexisHomeView)。
  async buildRetireCandidates() {
    const days = this.settings.retireCandidateDays ?? 90;
    const today = todayString();
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.inVocabFolder(f.path));
    const out = [];
    for (const f of files) {
      const lc = this.readLifecycle(f);
      if (lc.pinned || lc.archived || lc.retired) continue;
      const created = formatDate(new Date(f.stat.ctime));
      if (daysBetween(created, today) < days) continue;
      const enc = this._encounters[f.basename.toLowerCase()];
      const lastEncounter = enc && enc.lastEncounter || created;
      const sinceLast = daysBetween(lastEncounter, today);
      if (sinceLast < days) continue;
      let occCount = 0;
      try {
        occCount = (await this.findOccurrences(f.basename)).length;
      } catch {
      }
      out.push({
        file: f,
        display: f.basename,
        created,
        lastEncounter,
        sinceLast,
        encounterCount: enc && enc.encounterCount || 0,
        hoverCount: enc && enc.hoverCount || 0,
        occCount
      });
    }
    out.sort((a, b) => b.sinceLast - a.sinceLast);
    return out;
  }
  async openReview(options = {}) {
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_REVIEW_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: LEXIS_REVIEW_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisReviewView) {
      leaf.view.options = options || {};
      await leaf.view.refresh();
    }
  }
  saveReviewSession(leaf, state) {
    if (leaf && state) this._reviewSessions.set(leaf, state);
  }
  takeReviewSession(leaf) {
    if (!leaf) return null;
    const state = this._reviewSessions.get(leaf) || null;
    this._reviewSessions.delete(leaf);
    return state;
  }
  async openHome() {
    const sourceFile = this.app.workspace.getActiveFile();
    let leaf = this.app.workspace.getLeavesOfType(LEXIS_HOME_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: LEXIS_HOME_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof LexisHomeView) {
      if (sourceFile) leaf.view.sourceFilePath = sourceFile.path;
      leaf.view.render();
    }
  }
  // ---------- 划词添加 ----------
  sanitizeName(name) {
    return (name || "").replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
  }
  async ensureFolder(folder) {
    if (!folder) return;
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch {
      }
    }
  }
  async readTemplatePath(p) {
    p = (p || "").trim();
    if (!p) return null;
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f instanceof import_obsidian7.TFile) {
      try {
        return await this.app.vault.read(f);
      } catch {
        return null;
      }
    }
    return null;
  }
  createEntryFile(path, folder, fallbackContent, transform) {
    return this.templateProvider.create({ path, folder, fallbackContent, transform });
  }
  // 无模板可选纯空白，或只放一个内置的出处面板；用户自己的模板始终优先。
  minimalSkeleton() {
    return this.settings.emptyNotePreset === "occ" ? "```lexis\nocc\n```\n" : "";
  }
  getSelectionSentence(editor) {
    if (!editor) return "";
    try {
      const from = editor.getCursor("from");
      const line = editor.getLine(from.line) || "";
      return this.extractSentence(line, from.ch || 0);
    } catch {
      return "";
    }
  }
  getReadingSentence() {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return "";
      const text = sel.anchorNode.textContent || "";
      return this.extractSentence(text, sel.anchorOffset || 0);
    } catch {
      return "";
    }
  }
  // 当前选区所在 PDF 页码(pdf.js 在 .page 上挂 data-page-number);取不到返回 0
  currentPdfPage() {
    try {
      const sel = window.getSelection();
      const n = sel && sel.anchorNode;
      const el = n?.nodeType === Node.ELEMENT_NODE ? n : n?.parentElement;
      const page = el?.closest("[data-page-number]");
      const v = page && page.getAttribute("data-page-number");
      return v ? parseInt(v, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }
  addSelectedWordCommand() {
    const view = this.app.workspace.getActiveViewOfType(obsidian4.MarkdownView);
    let word = "", editor = null;
    if (view && view.editor && view.getMode && view.getMode() === "source") {
      word = (view.editor.getSelection() || "").trim();
      editor = view.editor;
    }
    if (!word) {
      const sel = window.getSelection();
      word = (sel ? sel.toString() : "").trim();
    }
    if (!word) {
      new import_obsidian7.Notice(this.t("notice.selectWord"));
      return;
    }
    void this.addWordFromSelection(word, editor, view);
  }
  async addWordFromSelection(word, editor = null, view = null, targetFolder = "", { openExisting = false } = {}) {
    const clean = (word || "").trim();
    const fileName = this.sanitizeName(clean);
    if (!fileName) {
      new import_obsidian7.Notice(this.t("notice.invalidWord"));
      return;
    }
    const reqFolder = this.normalizeFolder(targetFolder || "");
    const folder = reqFolder && this.dictFolders().includes(reqFolder) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + fileName + ".md";
    const target = this.app.vault.getAbstractFileByPath(targetPath);
    let existing = target instanceof import_obsidian7.TFile ? target : null;
    if (!existing) {
      const hit = this.index.get(this.resolveIndexKey(clean));
      if (hit && hit.file instanceof import_obsidian7.TFile) existing = hit.file;
    }
    const srcFile = view && view.file || this.app.workspace.getActiveFile();
    const sentence = editor ? this.getSelectionSentence(editor) : this.getReadingSentence();
    const fromPdf = srcFile && srcFile.extension === "pdf" && !editor;
    if (existing) {
      new import_obsidian7.Notice(this.t(openExisting ? "notice.exists" : "notice.existsNoOpen", { word: existing.basename }));
      if (openExisting) void this.app.workspace.getLeaf(fromPdf ? "tab" : false).openFile(existing);
      return;
    }
    try {
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      const content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word: clean, date: todayString() });
      const addOccurrence = (templateContent) => {
        let next = templateContent;
        if (!(sentence || srcFile)) return next;
        let sub = "", disp = srcFile ? srcFile.basename : "";
        if (fromPdf) {
          const pg = this.currentPdfPage();
          if (pg) {
            sub = `#page=${pg}`;
            disp = `${srcFile.basename} p.${pg}`;
          }
        }
        const sourceTarget = this.sourceLinkTarget(srcFile);
        const source = srcFile ? sub ? `[[${sourceTarget}${sub}|${disp}]]` : `[[${sourceTarget}]]` : "";
        next = this.insertOccurrence(next, { word: clean, sentence: sentence || "", source, date: todayString() });
        return next;
      };
      const file = await this.createEntryFile(targetPath, folder, content, addOccurrence);
      this.recordEncounter(file, "add");
      new import_obsidian7.Notice(this.t(fromPdf ? "notice.addedPdf" : "notice.created", { word: fileName }));
      await this.rebuildIndex(false);
    } catch (err) {
      new import_obsidian7.Notice(this.t("notice.createFailed", { error: errorMessage4(err) }));
    }
  }
};
Object.defineProperties(LexisPlugin.prototype, createBridgeApi({
  DEFAULT_SETTINGS,
  TFile: import_obsidian7.TFile,
  Component: import_obsidian7.Component,
  todayStr: todayString,
  escapeRe,
  renderLexisMarkdown,
  finishRenderMath: import_obsidian7.finishRenderMath,
  escHtml: escapeHtml,
  saveAnnotationImage,
  vaultImageDataUrl
}));
Object.defineProperties(LexisPlugin.prototype, createReviewState({ todayStr: todayString, round2 }));
Object.defineProperties(LexisPlugin.prototype, createReviewQueue({ todayStr: todayString }));
Object.defineProperties(LexisPlugin.prototype, createHighlightEngine({
  FSRS,
  Notice: import_obsidian7.Notice,
  boundedSource,
  compactMixedScriptSpacing,
  todayStr: todayString
}));
Object.defineProperties(LexisPlugin.prototype, createDocumentHighlights());
Object.defineProperties(LexisPlugin.prototype, createReaderInteractions({
  openAliasPicker: (app, plugin, text, select) => new LexisAliasPicker(app, plugin, text, (entry) => {
    void select(entry);
  }).open()
}));
Object.defineProperties(LexisPlugin.prototype, createReaderUi({
  buildCurveSVG,
  FSRS,
  addDaysStr: addDaysString,
  daysBetween,
  fmtDate: formatDate,
  todayStr: todayString,
  TFile: import_obsidian7.TFile,
  Notice: import_obsidian7.Notice,
  boundedSource,
  escapeRe,
  Component: import_obsidian7.Component,
  renderLexisMarkdown,
  openRestoreModal: (app, plugin, file) => new LexisRestoreModal(app, plugin, file).open()
}));
var LexisSettingTab = createSettingsTab({
  obsidian: obsidian4,
  PluginSettingTab: import_obsidian7.PluginSettingTab,
  Setting: import_obsidian7.Setting,
  Notice: import_obsidian7.Notice,
  TFolder: import_obsidian7.TFolder,
  DEFAULT_SETTINGS,
  cssColorToHex,
  createReorderController,
  addAppearanceButton,
  moveItem,
  LEXIS_HOME_VIEW,
  LEXIS_REVIEW_VIEW
});
var main_default = LexisPlugin;
