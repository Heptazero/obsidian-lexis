"use strict";

import { Component, type App, type ColorComponent, type MetadataCache, type Plugin, type Setting, type SettingDefinitionItem, type View } from "obsidian";
import type { TranslationVars } from "./i18n";
import type { InlineCategoryOccurrence, InlineColorTokenUsage, LexisEntry, LexisSettings, LexisStats } from "./types";
import type { LexisStatusBar } from "./status-bar";
import { renderHighlightSettings, renderVocabularyRules } from "./settings-highlight-section";
import { renderInlineSettings } from "./settings-inline-section";
import { createPathSuggest } from "./settings-suggest";
import { renderStorageSettings } from "./settings-storage-section";
import { renderReaderSettings } from "./settings-reader-section";
import { askSettingsTabName } from "./settings-tab-name-modal";
import { renderSettingsManual, type ManualRuntime } from "./settings-manual";
import { createSettingsNavigation } from "./settings-navigation";
import { renderReviewGoalSettings } from "./settings-review-goals";
import { renderMarginNoteSettings } from "./settings-marginnote";
import type { MarginNoteExport } from "./marginnote-export";
import { addCurrentChoice } from "./settings-choice";
import { createSettingsSection } from "./settings-section";
import { renderPluginMaintenance } from "./settings-maintenance";
import { renderDictionarySettings } from "./settings-dictionaries";
import { inlineEntryConflictsWithFlashcard } from "./flashcard-syntax";

export interface SettingsRuntime extends Plugin, ManualRuntime {
  settings: LexisSettings;
  index: Map<string, LexisEntry>;
  stats: LexisStats;
  inlineCategoryOccurrences: InlineCategoryOccurrence[];
  inlineColorTokenUsages: InlineColorTokenUsage[];
  liveAvailable: boolean;
  _occCache: Map<string, unknown>;
  templateProvider: {
    templaterTemplateFor(folder: string): { path: string } | null;
  };
  bridge: {
    generateToken(): string;
    restart(): void;
  };
  statusBar: LexisStatusBar;
  marginNoteExport: MarginNoteExport;
  t(key: string, vars?: TranslationVars): string;
  saveSettings(): Promise<void>;
  prepareReload(): Promise<void>;
  setEncounterFolder(folder: string): Promise<void>;
  refreshAllViews(): void;
  rebuildIndex(notify?: boolean): Promise<void>;
  collectVocabTags(): string[];
  inlineDelimiter(): string;
  inlineAliasDelimiter(): string;
  removeSelPill(): void;
  setupPdfHighlight(): void;
  teardownPdfHighlight(): void;
  rescanPdfLayers(): void;
  parseTags(text: string): string[];
  applyPopoverAppearance(popover: HTMLElement): void;
  applyReviewMetadataVisibility(): void;
  openHome(): Promise<void>;
}

interface SettingsTabDependencies {
  obsidian: typeof import("obsidian");
  PluginSettingTab: typeof import("obsidian").PluginSettingTab;
  Setting: typeof import("obsidian").Setting;
  Notice: typeof import("obsidian").Notice;
  TFolder: typeof import("obsidian").TFolder;
  DEFAULT_SETTINGS: Pick<LexisSettings, "occurrenceTemplate" | "flashcardInlineTemplate" | "flashcardBidirectionalTemplate" | "flashcardBlockTemplate" | "flashcardClozeTemplate">;
  cssColorToHex: (color: string, document: Document) => string;
  addAppearanceButton: typeof import("./settings-controls").addAppearanceButton;
  createReorderController: typeof import("./settings-controls").createReorderController;
  moveItem: typeof import("./settings-controls").moveItem;
  LEXIS_HOME_VIEW: string;
  LEXIS_REVIEW_VIEW: string;
}

type RenderableView = View & { render?: () => void };
type MetadataCacheWithSuggestions = MetadataCache & {
  getTags?: () => Record<string, number>;
  getAllPropertyInfos?: () => Record<string, { name?: string }>;
};

const createSettingsTab = ({ obsidian, PluginSettingTab, Setting, Notice, TFolder, DEFAULT_SETTINGS, cssColorToHex, addAppearanceButton, createReorderController, moveItem, LEXIS_HOME_VIEW, LEXIS_REVIEW_VIEW }: SettingsTabDependencies) => {
  const PathSuggest = createPathSuggest(obsidian);

  return class LexisSettingTab extends PluginSettingTab {
    declare plugin: SettingsRuntime;
    statsEl: HTMLElement | null = null;
    _colorComp: ColorComponent | null = null;
    private renderTargetEl: HTMLElement | null = null;
    private manualComponent: Component | null = null;
    constructor(app: App, plugin: SettingsRuntime) { super(app, plugin); this.plugin = plugin; plugin.register(() => this.hide()); }

    display(): void {
      this.renderSettings(this.containerEl);
    }

    hide(): void { this.manualComponent?.unload(); this.manualComponent = null; }

    private rerender(): void {
      this.renderSettings(this.renderTargetEl?.isConnected ? this.renderTargetEl : this.containerEl);
    }

    section(containerEl: HTMLElement, title: string, { desc = "" }: { open?: boolean; desc?: string } = {}): HTMLElement {
      return createSettingsSection(containerEl, title, {
        level: "section", description: desc,
      }).body;
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
      return [{
        name: "Lexis",
        aliases: ["dictionary", "highlight", "review", "browser", "PDF", "词典", "高亮", "复习"],
        render: (setting: Setting) => {
          this.renderSettings(setting.settingEl);
        },
      }];
    }

    renderSettings(containerEl: HTMLElement): void {
      this.hide();
      this.manualComponent = new Component();
      this.manualComponent.load();
      this.renderTargetEl = containerEl;
      containerEl.addClass("lexis-settings-root");
      containerEl.empty();
      const t = (key: string, vars?: TranslationVars) => this.plugin.t(key, vars);
      const document = containerEl.ownerDocument;
      const accentHex = cssColorToHex(document.defaultView?.getComputedStyle(document.body).getPropertyValue("--text-accent") || "", document);
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
        done: t("common.done"),
      };
      const title = new Setting(containerEl).setName(t("settings.title")).setHeading();
      title.settingEl.addClass("lexis-settings-title-row");
      renderPluginMaintenance(title.controlEl, this.plugin, this.manualComponent);

      const sectionsContainer = containerEl.createDiv({ cls: "lexis-settings-navigation" });
      const sections = new Map<string, HTMLElement>();
      const topSection = (key: string, title: string, options: { open?: boolean; desc?: string } = {}) => {
        const body = this.section(sectionsContainer, title, options);
        const section = body.parentElement;
        section.dataset.lexisSectionKey = key;
        sections.set(key, section);
        return body;
      };
      const generalSection = topSection("general", t("settings.tabGeneral"));

      addCurrentChoice(new Setting(generalSection).setName(t("language.name")), [
        { value: "zh", label: t("language.zh") }, { value: "en", label: t("language.en") },
      ], this.plugin.settings.language || "zh", async (value) => {
          this.plugin.settings.language = value === "en" ? "en" : "zh";
          await save();
          this.plugin.refreshAllViews();
          this.app.workspace.iterateAllLeaves((leaf) => {
            const type = leaf?.view?.getViewType?.();
            if (type === LEXIS_HOME_VIEW || type === LEXIS_REVIEW_VIEW) (leaf.view as RenderableView).render?.();
          });
          new Notice(t("language.reload"));
          this.rerender();
        });

      new Setting(generalSection).setName(t("settings.statusBar")).setDesc(t("settings.statusBarDesc"))
        .addToggle((toggle) => toggle.setValue(this.plugin.settings.statusBarVisible !== false).onChange((value) => this.plugin.statusBar.setVisible(value)));

      const folders = this.app.vault.getAllLoadedFiles().filter((f) => f instanceof TFolder).map((f) => f.path).filter((p) => p && p !== "/").sort();
      const mdFiles = this.app.vault.getMarkdownFiles().map((f) => f.path).sort();
      const hasSuggest = !!obsidian.AbstractInputSuggest;
      const allTags = (() => {
        const s = new Set(this.plugin.collectVocabTags());
        try { const tg = (this.app.metadataCache as MetadataCacheWithSuggestions).getTags?.() || {}; for (const k in tg) s.add(k.replace(/^#/, "").toLowerCase()); } catch { /* Suggestions are optional. */ }
        return [...s].filter(Boolean).sort();
      })();
      const allProps = (() => {
        try {
          const infos = (this.app.metadataCache as MetadataCacheWithSuggestions).getAllPropertyInfos?.();
          if (infos) return Object.values(infos).map((info) => info.name).filter((name): name is string => !!name).sort();
        } catch { /* Suggestions are optional. */ }
        return [];
      })();
      const defaultEncounterFolder = `${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}/encounters`;
      renderStorageSettings.call(this, {
        obsidian, Setting, Notice, PathSuggest, topSection, t, save, folders, hasSuggest, defaultEncounterFolder,
      });

      const dictSection = topSection("dictionary", t("settings.dictionary"), { open: true });
      renderDictionarySettings(dictSection, this.plugin, accentHex, appearanceLabels, () => this.renderStats());
      new Setting(dictSection).setName(t("settings.includeAliases"))
        .addToggle((t) => t.setValue(this.plugin.settings.includeAliases).onChange(async (v) => { this.plugin.settings.includeAliases = v; await save(); await this.plugin.rebuildIndex(false); this.renderStats(); }));
      new Setting(dictSection).setName(t("settings.aliasProperties")).setDesc(t("settings.aliasPropertiesDesc"))
        .addText((t) => {
          t.setPlaceholder("Past, forms, variants").setValue(this.plugin.settings.aliasSources);
          const apply = async (v: string) => { this.plugin.settings.aliasSources = (v || "").trim(); await save(); if (this.plugin.settings.includeAliases) { void this.plugin.rebuildIndex(false); this.renderStats(); } };
          t.onChange(apply);
          if (hasSuggest) new PathSuggest(this.app, t.inputEl, () => allProps, (v) => { t.setValue(v); void apply(v); }, { multi: true, sep: "," });
        });

      renderInlineSettings.call(this, {
        obsidian, Setting, topSection, t, save, refresh, accentHex, appearanceLabels,
        createReorderController, moveItem, addAppearanceButton,
      });

      renderHighlightSettings.call(this, {
        obsidian, Setting, PathSuggest, topSection, t, save, refresh, accentHex, allTags, hasSuggest,
        appearanceLabels, createReorderController, moveItem, addAppearanceButton,
      });

      renderVocabularyRules.call(this, {
        obsidian, Setting, PathSuggest, topSection, t, save, refresh, accentHex, allTags, hasSuggest,
        appearanceLabels, createReorderController, moveItem, addAppearanceButton,
      });

      renderReaderSettings({ plugin: this.plugin, topSection, PathSuggest, mdFiles, hasSuggest });

      const fsrsSection = topSection("review", t("settings.review"));
      renderReviewGoalSettings(fsrsSection, this.plugin);
      addCurrentChoice(new Setting(fsrsSection).setName(t("settings.reviewLinkMode")).setDesc(t("settings.reviewLinkDesc")), [
        { value: "current", label: t("settings.reviewLinkCurrent") }, { value: "tab", label: t("settings.reviewLinkTab") },
      ], this.plugin.settings.reviewLinkMode, async (value) => { this.plugin.settings.reviewLinkMode = value; await save(); });
      const syntaxTemplates: Array<[keyof Pick<LexisSettings, "flashcardInlineTemplate" | "flashcardBidirectionalTemplate" | "flashcardBlockTemplate" | "flashcardClozeTemplate">, string]> = [
        ["flashcardInlineTemplate", "settings.flashcardInline"],
        ["flashcardBidirectionalTemplate", "settings.flashcardBidirectional"],
        ["flashcardBlockTemplate", "settings.flashcardBlock"],
        ["flashcardClozeTemplate", "settings.flashcardCloze"],
      ];
      for (const [field, label] of syntaxTemplates) {
        const setting = new Setting(fsrsSection).setName(t(label));
        const updateDescription = () => {
          const conflict = field === "flashcardInlineTemplate"
            && inlineEntryConflictsWithFlashcard(this.plugin.settings.inlineEntryDelimiter, this.plugin.settings[field]);
          setting.setDesc(`${t("settings.flashcardTemplateDesc")}${conflict ? ` ${t("settings.syntaxConflict")}` : ""}`);
        };
        updateDescription();
        const saveTemplate = async (value: string) => {
          this.plugin.settings[field] = value;
          updateDescription();
          await save();
        };
        if (field === "flashcardBlockTemplate") {
          setting.addTextArea((input) => input.setPlaceholder(t("settings.templateDisabledPlaceholder")).setValue(this.plugin.settings[field]).onChange(saveTemplate));
          const textarea = setting.controlEl.querySelector("textarea");
          if (textarea) textarea.rows = 2;
        } else setting.addText((input) => input.setPlaceholder(t("settings.templateDisabledPlaceholder")).setValue(this.plugin.settings[field]).onChange(saveTemplate));
        setting.addExtraButton((button) => button.setIcon("reset").setTooltip(t("settings.resetTemplate")).onClick(async () => {
          const value = DEFAULT_SETTINGS[field];
          this.plugin.settings[field] = value;
          await save();
          this.rerender();
        }));
      }
      new Setting(fsrsSection).setName(t("settings.retention")).setDesc(t("settings.retentionDesc"))
        .addSlider((s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).onChange(async (v) => { this.plugin.settings.requestRetention = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.newLimit")).addSlider((s) => s.setLimits(0, 100, 5).setValue(this.plugin.settings.newPerDay).onChange(async (v) => { this.plugin.settings.newPerDay = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.sessionLimit")).addSlider((s) => s.setLimits(10, 500, 10).setValue(this.plugin.settings.maxReviewsPerSession).onChange(async (v) => { this.plugin.settings.maxReviewsPerSession = v; await save(); }));
      const suspendedCount = Object.values(this.plugin.settings.suspendedReviewItems || {}).filter(Boolean).length;
      new Setting(fsrsSection)
        .setName(t("settings.suspendedCards"))
        .setDesc(t("settings.suspendedCardsDesc", { count: suspendedCount }))
        .addButton((button) => button
          .setButtonText(t("settings.restoreSuspended"))
          .setDisabled(!suspendedCount)
          .onClick(async () => {
            this.plugin.settings.suspendedReviewItems = {};
            await save();
            new Notice(t("settings.suspendedRestored"));
            this.rerender();
          }));
      addCurrentChoice(new Setting(fsrsSection).setName(t("settings.cardFront")).setDesc(t("settings.cardFrontDesc")), [
        { value: "note", label: t("settings.noteCard") }, { value: "cloze", label: t("settings.clozeCard") },
      ], this.plugin.settings.cardFront, async (value) => { this.plugin.settings.cardFront = value; await save(); });
      new Setting(fsrsSection).setName(t("settings.showReviewMetadata")).setDesc(t("settings.showReviewMetadataDesc"))
        .addToggle((toggle) => toggle.setValue(!!this.plugin.settings.showReviewMetadata).onChange(async (value) => {
          this.plugin.settings.showReviewMetadata = value;
          this.plugin.applyReviewMetadataVisibility();
          await save();
        }));
      new Setting(fsrsSection).setName(t("home.start")).addButton((b) => b.setButtonText(t("settings.openReview")).setCta().onClick(() => this.plugin.openHome()));
      new Setting(fsrsSection).setName(t("settings.hoverFeedback")).setDesc(t("settings.hoverFeedbackDesc"))
        .addToggle((t) => t.setValue(this.plugin.settings.hoverFeedback).onChange(async (v) => { this.plugin.settings.hoverFeedback = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.feedbackDays")).setDesc(t("settings.feedbackDaysDesc"))
        .addSlider((s) => s.setLimits(1, 30, 1).setValue(this.plugin.settings.hoverFeedbackDays).onChange(async (v) => { this.plugin.settings.hoverFeedbackDays = v; await save(); }));
      new Setting(fsrsSection).setName(t("settings.retireDays")).setDesc(t("settings.retireDaysDesc"))
        .addSlider((s) => s.setLimits(14, 365, 1).setValue(this.plugin.settings.retireCandidateDays).onChange(async (v) => { this.plugin.settings.retireCandidateDays = v; await save(); }));
      const bridgeSection = topSection("bridge", t("settings.bridge"), { desc: t("settings.bridgeDesc") });
      renderMarginNoteSettings(topSection("marginnote", t("mn.exportSection")), this.plugin);
      renderSettingsManual(topSection("manual", t("settings.syntaxManual")), this.plugin, this.manualComponent);
      new Setting(bridgeSection).setName(t("settings.enableBridge"))
        .addToggle((t) => t.setValue(this.plugin.settings.bridgeEnabled).onChange(async (v) => {
          this.plugin.settings.bridgeEnabled = v;
          if (v && !this.plugin.settings.bridgeToken) this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken();
          await save();
          this.plugin.bridge.restart();
          this.rerender();
        }));
      new Setting(bridgeSection).setName(t("settings.port")).setDesc(t("settings.portDesc"))
        .addText((t) => t.setValue(String(this.plugin.settings.bridgePort)).onChange(async (v) => { const n = parseInt(v, 10); if (n >= 1024 && n <= 65535) { this.plugin.settings.bridgePort = n; await save(); } }))
        .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip(t("settings.restartBridge")).onClick(() => { this.plugin.bridge.restart(); new Notice(t("notice.bridgeRestarted")); }));
      new Setting(bridgeSection).setName(t("settings.token")).setDesc(t("settings.tokenDesc"))
        .addText((input) => { input.setValue(this.plugin.settings.bridgeToken || t("settings.tokenPending")).setDisabled(true); input.inputEl.addClass("lexis-bridge-token-input"); })
        .addExtraButton((b) => b.setIcon("copy").setTooltip(t("settings.copyToken")).onClick(async () => { if (this.plugin.settings.bridgeToken) { await navigator.clipboard.writeText(this.plugin.settings.bridgeToken); new Notice(t("notice.tokenCopied")); } }))
        .addExtraButton((b) => b.setIcon("refresh-cw").setTooltip(t("settings.regenerateToken")).onClick(async () => { this.plugin.settings.bridgeToken = this.plugin.bridge.generateToken(); await save(); this.plugin.bridge.restart(); this.rerender(); }));

      createSettingsNavigation(sectionsContainer, sections, {
        activeTab: this.plugin.settings.settingsActiveTab, sectionOrder: this.plugin.settings.settingsSectionOrder, t,
        setIcon: obsidian.setIcon, tabOrder: this.plugin.settings.settingsTabOrder,
        assignments: this.plugin.settings.settingsTabAssignments, groupOrder: this.plugin.settings.settingsGroupOrder,
        tabNames: this.plugin.settings.settingsTabNames, customTabs: this.plugin.settings.settingsCustomTabs,
        requestTabName: (current, deletable) => askSettingsTabName(this.app, t(current ? "settings.renameTab" : "settings.addTab"), current, t("common.done"),
          deletable ? t("settings.deleteTab") : undefined, deletable ? t("settings.deleteTabHint") : undefined),
        onGroupsChange: (names, custom) => { this.plugin.settings.settingsTabNames = names; this.plugin.settings.settingsCustomTabs = custom; void save(); },
        onTabChange: (id) => { this.plugin.settings.settingsActiveTab = id; void save(); },
        onOrderChange: (order) => { this.plugin.settings.settingsSectionOrder = order; void save(); },
        onTabOrderChange: (order) => { this.plugin.settings.settingsTabOrder = order; void save(); },
        onAssignmentsChange: (assignments) => { this.plugin.settings.settingsTabAssignments = assignments; void save(); },
        onGroupOrderChange: (orders) => { this.plugin.settings.settingsGroupOrder = orders; void save(); },
      });
      new Setting(dictSection).setName(t("settings.rebuild")).addButton((b) => b.setButtonText(t("settings.rebuildNow")).onClick(() => { void this.plugin.rebuildIndex(true); this.renderStats(); }));
      this.statsEl = dictSection.createEl("p", { cls: "lexis-stats" });
      this.renderStats();
    }

    renderStats() {
      if (!this.statsEl) return;
      const s = this.plugin.stats;
      this.statsEl.setText(this.plugin.t("settings.stats", { words: s.words, aliases: s.aliases, inline: s.inlineEntries || 0, due: s.due || 0 }));
    }
  }
};

export { createSettingsTab };
