"use strict";

import type { App, ColorComponent, MetadataCache, Plugin, Setting, SettingDefinitionItem, View } from "obsidian";
import type { TranslationVars } from "./i18n";
import type { InlineCategoryOccurrence, LexisSettings, LexisStats } from "./types";
import { renderHighlightSettings } from "./settings-highlight-section";
import { renderInlineSettings } from "./settings-inline-section";
import { createPathSuggest } from "./settings-suggest";
import { renderStorageSettings } from "./settings-storage-section";
import { addSelectionPillPosition } from "./settings-selection-pill";
import { orderedSectionKeys } from "./settings-section-order";

export interface SettingsRuntime extends Plugin {
  settings: LexisSettings;
  stats: LexisStats;
  inlineCategoryOccurrences: InlineCategoryOccurrence[];
  liveAvailable: boolean;
  _occCache: Map<string, unknown>;
  templateProvider: {
    templaterTemplateFor(folder: string): { path: string } | null;
  };
  bridge: {
    generateToken(): string;
    restart(): void;
  };
  t(key: string, vars?: TranslationVars): string;
  saveSettings(): Promise<void>;
  setEncounterFolder(folder: string): Promise<void>;
  refreshAllViews(): void;
  rebuildIndex(notify?: boolean): Promise<void>;
  collectVocabTags(): string[];
  inlineDelimiter(): string;
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
    constructor(app: App, plugin: SettingsRuntime) { super(app, plugin); this.plugin = plugin; }

    display(): void {
      this.renderSettings(this.containerEl);
    }

    private rerender(): void {
      this.renderSettings(this.renderTargetEl?.isConnected ? this.renderTargetEl : this.containerEl);
    }

    section(containerEl: HTMLElement, title: string, { open = false, desc = "" }: { open?: boolean; desc?: string } = {}): HTMLElement {
      const details = containerEl.createEl("details", { cls: "lexis-settings-section" });
      details.open = open;
      const summary = details.createEl("summary");
      summary.createSpan({ text: title });
      if (desc) summary.createSpan({ cls: "lexis-settings-section-hint", text: desc });
      return details.createDiv({ cls: "lexis-settings-section-body" });
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
      return [{
        name: "Lexis",
        aliases: ["dictionary", "highlight", "review", "browser", "PDF", "词典", "高亮", "复习"],
        render: (setting: Setting) => {
          setting.settingEl.empty();
          setting.settingEl.addClass("lexis-settings-root");
          this.renderSettings(setting.settingEl);
        },
      }];
    }

    renderSettings(containerEl: HTMLElement): void {
      this.renderTargetEl = containerEl;
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
      new Setting(containerEl).setName(t("settings.title")).setHeading();

      new Setting(containerEl).setName(t("language.name"))
        .addDropdown((dd) => dd.addOption("zh", t("language.zh")).addOption("en", t("language.en")).setValue(this.plugin.settings.language || "zh").onChange(async (value) => {
          this.plugin.settings.language = value === "en" ? "en" : "zh";
          await save();
          this.plugin.refreshAllViews();
          this.app.workspace.iterateAllLeaves((leaf) => {
            const type = leaf?.view?.getViewType?.();
            if (type === LEXIS_HOME_VIEW || type === LEXIS_REVIEW_VIEW) (leaf.view as RenderableView).render?.();
          });
          new Notice(t("language.reload"));
          this.rerender();
        }));

      const sectionsContainer = containerEl.createDiv({ cls: "lexis-settings-sections" });
      const sections = new Map<string, HTMLElement>();
      const topSection = (key: string, title: string, options: { open?: boolean; desc?: string } = {}) => {
        const body = this.section(sectionsContainer, title, options);
        const details = body.parentElement;
        details.dataset.lexisSectionKey = key;
        sections.set(key, details);
        return body;
      };
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
      const dictHeading = new Setting(dictSection).setDesc(t("settings.dictionaryDesc")).setHeading();
      const dictsWrap = dictSection.createDiv();
      let renderDicts: () => void;
      const addSource = (tag: boolean) => {
        this.plugin.settings.dicts.push(tag ? { folder: "", template: "", tag: "" } : { folder: "", template: "", highlight: true });
        renderDicts();
        void save();
      };
      dictHeading.addButton((button) => button.setButtonText(t("settings.addFolderSource")).onClick(() => addSource(false)));
      dictHeading.addButton((button) => button.setButtonText(t("settings.addTagSource")).onClick(() => addSource(true)));
      renderDicts = () => {
        dictsWrap.empty();
        const reorder = createReorderController({
          container: dictsWrap,
          setIcon: obsidian.setIcon,
          label: t("settings.reorder"),
          onMove: async (from, to) => {
            this.plugin.settings.dicts = moveItem(this.plugin.settings.dicts, from, to);
            await save();
            await this.plugin.rebuildIndex(false);
            renderDicts();
          },
        });
        (this.plugin.settings.dicts || []).forEach((d, i) => {
          const row = dictsWrap.createDiv({ cls: "lexis-setting-row lexis-dictionary-row" });
          const isTagSource = () => typeof d.tag === "string";
          const fIn = new obsidian.TextComponent(row);
          fIn.setPlaceholder(t("settings.folderPlaceholder")).setValue(isTagSource() ? `#${d.tag || ""}` : (d.folder || ""));
          const tIn = new obsidian.TextComponent(row);
          tIn.setPlaceholder(t("settings.templatePlaceholder")).setValue(d.template || "");
          if (isTagSource()) {
            tIn.setDisabled(true);
            tIn.setPlaceholder(t("settings.tagSourcePlaceholder"));
          }
          const updateTemplateSource = () => {
            if (isTagSource()) {
              tIn.setDisabled(true);
              tIn.setValue("");
              tIn.inputEl.title = "";
              return;
            }
            const match = this.plugin.templateProvider.templaterTemplateFor(d.folder);
            tIn.setDisabled(!!match);
            tIn.setValue(match ? match.path : (d.template || ""));
            tIn.inputEl.title = match ? t("settings.templaterTemplate", { path: match.path }) : "";
          };
          const onSource = async (v: string) => {
            const value = (v || "").trim();
            if (value.startsWith("#")) {
              d.tag = this.plugin.parseTags(value)[0] || "";
              d.folder = "";
              tIn.setDisabled(true);
              tIn.setValue("");
            } else {
              delete d.tag;
              d.folder = value;
              tIn.setDisabled(false);
              updateTemplateSource();
            }
            await save();
            void this.plugin.rebuildIndex(false);
            this.renderStats();
          };
          fIn.onChange(onSource);
          const onTpl = async (v: string) => { d.template = (v || "").trim(); await save(); };
          tIn.onChange(onTpl);
          updateTemplateSource();
          if (hasSuggest) {
            new PathSuggest(this.app, fIn.inputEl, () => [...folders, ...allTags.map((tag) => `#${tag}`)], (v) => { fIn.setValue(v); void onSource(v); });
            new PathSuggest(this.app, tIn.inputEl, () => mdFiles, (v) => { tIn.setValue(v); void onTpl(v); });
          }
          if (!isTagSource()) {
            new obsidian.ToggleComponent(row)
              .setTooltip(t("settings.showDictionaryHighlight"))
              .setValue(d.highlight !== false)
              .onChange(async (value) => { d.highlight = value; refresh(); await save(); });
            const globalColor = this.plugin.settings.highlightColor || accentHex;
            addAppearanceButton({
              app: this.app,
              obsidian,
              parent: row,
              title: t("settings.dictionaryAppearance"),
              labels: appearanceLabels,
              state: () => ({ color: d.color || globalColor, opacity: Number(d.opacity ?? this.plugin.settings.highlightOpacity) }),
              onChange: async (patch) => { Object.assign(d, patch); await save(); refresh(); },
              onReset: async () => { delete d.color; delete d.opacity; await save(); refresh(); },
            });
          } else {
            row.createSpan({ cls: "lexis-source-kind", text: t("settings.tagSource") });
          }
          new obsidian.ExtraButtonComponent(row).setIcon("trash").setTooltip(t("settings.deleteDictionary")).onClick(async () => { this.plugin.settings.dicts.splice(i, 1); await save(); await this.plugin.rebuildIndex(false); renderDicts(); this.renderStats(); });
          reorder.attach(row, i);
        });
      };
      renderDicts();
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

      const cardSection = topSection("popover", t("settings.popover"));
      const preview = cardSection.createDiv({ cls: "lexis-popover lexis-popover-preview" });
      const previewScroll = preview.createDiv({ cls: "lexis-popover-scroll" });
      previewScroll.createDiv({ cls: "lexis-popover-title", text: "Yalda · 人物" });
      previewScroll.createDiv({ cls: "lexis-popover-body", text: t("settings.popoverPreview") });
      const updateCards = () => {
        this.plugin.applyPopoverAppearance(preview);
        const doc = preview.ownerDocument || document;
        doc.querySelectorAll<HTMLElement>(".lexis-popover:not(.lexis-popover-preview)").forEach((el) => this.plugin.applyPopoverAppearance(el));
      };
      updateCards();
      new Setting(cardSection).setName(t("settings.popoverFont"))
        .addSlider((s) => s.setLimits(11, 24, 1).setValue(this.plugin.settings.popoverFontSize).onChange(async (v) => { this.plugin.settings.popoverFontSize = v; updateCards(); await save(); }));
      new Setting(cardSection).setName(t("settings.hoverDelay")).setDesc(t("settings.hoverDelayDesc"))
        .addSlider((s) => s.setLimits(0, 3, 0.1).setValue((this.plugin.settings.hoverDelayMs || 0) / 1000).onChange(async (v) => { this.plugin.settings.hoverDelayMs = Math.round(v * 1000); await save(); }));
      new Setting(cardSection).setName(t("settings.showRelated")).addToggle((toggle) => toggle.setValue(this.plugin.settings.showRelated).onChange(async (v) => { this.plugin.settings.showRelated = v; await save(); }));
      new Setting(cardSection).setName(t("settings.showOccurrences")).setDesc(t("settings.showOccurrencesDesc"))
        .addToggle((t) => t.setValue(this.plugin.settings.showOccurrences).onChange(async (v) => { this.plugin.settings.showOccurrences = v; await save(); }));
      new Setting(cardSection).setName(t("settings.pdfOccurrences")).setDesc(t("settings.pdfOccurrencesDesc"))
        .addToggle((toggle) => toggle.setValue(this.plugin.settings.includePdfOccurrences !== false).onChange(async (v) => { this.plugin.settings.includePdfOccurrences = v; this.plugin._occCache.clear(); await save(); }));
      new Setting(cardSection).setName(t("settings.occurrenceLimit")).addSlider((s) => s.setLimits(1, 15, 1).setValue(this.plugin.settings.occurrenceLimit).onChange(async (v) => { this.plugin.settings.occurrenceLimit = v; await save(); this.plugin._occCache.clear(); }));
      new Setting(cardSection).setName(t("settings.occurrenceScope")).setDesc(t("settings.occurrenceScopeDesc"))
        .addText((input) => input.setPlaceholder(t("settings.wholeVault")).setValue(this.plugin.settings.occurrenceFolders).onChange(async (v) => { this.plugin.settings.occurrenceFolders = v.trim(); await save(); this.plugin._occCache.clear(); }));

      const addSection = topSection("selection-add", t("settings.selectionAdd"));
      new Setting(addSection).setName(t("settings.selectionPill"))
        .addToggle((toggle) => toggle.setValue(this.plugin.settings.selectionPill).onChange(async (v) => { this.plugin.settings.selectionPill = v; await save(); if (!v) this.plugin.removeSelPill(); }));
      addSelectionPillPosition(addSection, { Setting, settings: this.plugin.settings, t, save });
      new Setting(addSection).setName(t("settings.emptyNotePreset")).setDesc(t("settings.emptyNotePresetDesc"))
        .addDropdown((dropdown) => dropdown
          .addOption("blank", t("settings.emptyNoteBlank"))
          .addOption("occ", t("settings.emptyNoteOccurrences"))
          .setValue(this.plugin.settings.emptyNotePreset || "blank")
          .onChange(async (value) => { this.plugin.settings.emptyNotePreset = value === "occ" ? "occ" : "blank"; await save(); }));
      new Setting(addSection).setName(t("settings.defaultTemplate")).setDesc(t("settings.defaultTemplateDesc"))
        .addText((input) => {
          input.setPlaceholder("template/word.md").setValue(this.plugin.settings.newWordTemplate);
          const onTpl = async (v: string) => { this.plugin.settings.newWordTemplate = (v || "").trim(); await save(); };
          input.onChange(onTpl);
          if (hasSuggest) new PathSuggest(this.app, input.inputEl, () => mdFiles, (v) => { input.setValue(v); void onTpl(v); });
        });
      const occurrenceSetting = new Setting(addSection).setName(t("settings.occurrenceTemplate")).setDesc(t("settings.occurrenceTemplateDesc"))
        .addTextArea((input) => input
          .setPlaceholder(DEFAULT_SETTINGS.occurrenceTemplate)
          .setValue(this.plugin.settings.occurrenceTemplate ?? DEFAULT_SETTINGS.occurrenceTemplate)
          .onChange(async (v) => { this.plugin.settings.occurrenceTemplate = v; await save(); }));
      occurrenceSetting.settingEl.addClass("lexis-template-setting");
      const occurrenceTextarea = occurrenceSetting.controlEl.querySelector("textarea");
      if (occurrenceTextarea) occurrenceTextarea.rows = 4;
      new Setting(addSection).setName(t("settings.annotationHeading")).setDesc(t("settings.annotationHeadingDesc"))
        .addText((input) => input.setPlaceholder("#### 批注").setValue(this.plugin.settings.annotationHeading).onChange(async (value) => { this.plugin.settings.annotationHeading = value; await save(); }));
      new Setting(addSection).setName(t("settings.annotationImageLocation")).setDesc(t("settings.annotationImageLocationDesc"))
        .addDropdown((dropdown) => dropdown
          .addOption("obsidian", t("settings.annotationImageObsidian"))
          .addOption("custom", t("settings.annotationImageCustom"))
          .setValue(this.plugin.settings.annotationImageLocation || "obsidian")
          .onChange(async (value) => {
            this.plugin.settings.annotationImageLocation = value === "custom" ? "custom" : "obsidian";
            await save();
            this.rerender();
          }));
      if (this.plugin.settings.annotationImageLocation === "custom") {
        new Setting(addSection).setName(t("settings.annotationImageFolder")).setDesc(t("settings.annotationImageFolderDesc"))
          .addText((input) => {
            const apply = async (value: string) => { this.plugin.settings.annotationImageFolder = value.trim(); await save(); };
            input.setPlaceholder("Attachments/lexis").setValue(this.plugin.settings.annotationImageFolder || "").onChange(apply);
            if (hasSuggest) new PathSuggest(this.app, input.inputEl, () => folders, (value) => { input.setValue(value); void apply(value); });
          });
      }

      const fsrsSection = topSection("review", t("settings.review"));
      const syntaxTemplates: Array<[keyof Pick<LexisSettings, "flashcardInlineTemplate" | "flashcardBidirectionalTemplate" | "flashcardBlockTemplate" | "flashcardClozeTemplate">, string, string]> = [
        ["flashcardInlineTemplate", "settings.flashcardInline", "{{question}}::{{answer}}"],
        ["flashcardBidirectionalTemplate", "settings.flashcardBidirectional", "{{sideA}}:::{{sideB}}"],
        ["flashcardBlockTemplate", "settings.flashcardBlock", "{{question}}??\n{{answer}}"],
        ["flashcardClozeTemplate", "settings.flashcardCloze", "=={{answer}}=="],
      ];
      for (const [field, label, placeholder] of syntaxTemplates) {
        const setting = new Setting(fsrsSection).setName(t(label)).setDesc(t("settings.flashcardTemplateDesc"));
        const saveTemplate = async (value: string) => { this.plugin.settings[field] = value; await save(); };
        if (field === "flashcardBlockTemplate") {
          setting.addTextArea((input) => input.setPlaceholder(placeholder).setValue(this.plugin.settings[field]).onChange(saveTemplate));
          const textarea = setting.controlEl.querySelector("textarea");
          if (textarea) textarea.rows = 2;
        } else setting.addText((input) => input.setPlaceholder(placeholder).setValue(this.plugin.settings[field]).onChange(saveTemplate));
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
      new Setting(fsrsSection).setName(t("settings.cardFront")).setDesc(t("settings.cardFrontDesc"))
        .addDropdown((dd) => dd.addOption("note", t("settings.noteCard")).addOption("cloze", t("settings.clozeCard")).setValue(this.plugin.settings.cardFront).onChange(async (v) => { this.plugin.settings.cardFront = v === "cloze" ? "cloze" : "note"; await save(); }));
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

      const sectionOrder = orderedSectionKeys([...sections.keys()], this.plugin.settings.settingsSectionOrder);
      for (const key of sectionOrder) sectionsContainer.appendChild(sections.get(key));
      const sectionReorder = createReorderController({
        container: sectionsContainer,
        setIcon: obsidian.setIcon,
        label: t("settings.reorder"),
        onMove: async () => {
          this.plugin.settings.settingsSectionOrder = Array.from(sectionsContainer.children)
            .map((element) => (element as HTMLElement).dataset.lexisSectionKey)
            .filter((key): key is string => !!key);
          await save();
        },
      });
      sectionOrder.forEach((key, index) => {
        const details = sections.get(key);
        sectionReorder.attach(details, index, { handleParent: details.querySelector("summary") });
      });

      new Setting(containerEl).setName(t("settings.rebuild")).addButton((b) => b.setButtonText(t("settings.rebuildNow")).onClick(() => { void this.plugin.rebuildIndex(true); this.renderStats(); }));
      this.statsEl = containerEl.createEl("p", { cls: "lexis-stats" });
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
