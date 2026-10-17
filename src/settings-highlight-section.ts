"use strict";

import type { App, ColorComponent } from "obsidian";
import { addCurrentChoice } from "./settings-choice";
import { createSettingsSection } from "./settings-section";
import type { SettingsRuntime } from "./settings-tab";
import type { PathSuggestConstructor } from "./settings-suggest";

interface HighlightSettingsHost {
  app: App;
  plugin: SettingsRuntime;
  _colorComp: ColorComponent | null;
}

interface HighlightSectionContext {
  obsidian: typeof import("obsidian");
  Setting: typeof import("obsidian").Setting;
  PathSuggest: PathSuggestConstructor;
  topSection: (key: string, title: string, options?: { open?: boolean; desc?: string }) => HTMLElement;
  t: (key: string, vars?: Record<string, string | number | boolean | null | undefined>) => string;
  save: () => Promise<void>;
  refresh: () => void;
  accentHex: string;
  allTags: string[];
  hasSuggest: boolean;
  appearanceLabels: {
    color: string;
    opacity: string;
    style: string;
    defaultStyle: string;
    wavy: string;
    underline: string;
    background: string;
    reset: string;
    done: string;
  };
  createReorderController: typeof import("./settings-controls").createReorderController;
  moveItem: typeof import("./settings-controls").moveItem;
  addAppearanceButton: typeof import("./settings-controls").addAppearanceButton;
}

export function renderHighlightSettings(this: HighlightSettingsHost, context: HighlightSectionContext): void {
  const { Setting, topSection, t, save, refresh, accentHex } = context;
  const hlSection = topSection("highlight", t("settings.highlight"));
  const highlightSwitch = new Setting(hlSection).setName(t("settings.enableHighlight")).setDesc(t("settings.enableHighlightDesc"));
  const highlightOptions = hlSection.createEl("fieldset", { cls: "lexis-highlight-options" });
  let automaticGroups: HTMLElement[] = [];
  const syncHighlightOptions = () => {
    highlightOptions.disabled = !this.plugin.settings.enableHighlight;
    highlightOptions.toggleClass("is-disabled", !this.plugin.settings.enableHighlight);
    const automatic = this.plugin.settings.enableHighlight && this.plugin.settings.highlightMode !== "manual";
    for (const group of automaticGroups) {
      group.toggleClass("is-disabled", !automatic);
      group.toggleAttribute("inert", !automatic);
    }
  };
  syncHighlightOptions();
  highlightSwitch.addToggle((toggle) => toggle.setValue(this.plugin.settings.enableHighlight).onChange(async (v) => {
    this.plugin.settings.enableHighlight = v;
    syncHighlightOptions();
    if (v && this.plugin.settings.enablePdfHighlight) this.plugin.setupPdfHighlight();
    else this.plugin.teardownPdfHighlight();
    await save();
    refresh();
  }));
  const scopeSection = createSettingsSection(highlightOptions, t("settings.highlightScope"), { key: "scope", collapsible: false });
  const scopeGroup = scopeSection.body;
  new Setting(scopeGroup).setName(t("settings.livePreview")).setDesc(this.plugin.liveAvailable ? "" : t("settings.unsupported"))
    .addToggle((t) => t.setValue(this.plugin.settings.enableLivePreview).setDisabled(!this.plugin.liveAvailable).onChange(async (v) => { this.plugin.settings.enableLivePreview = v; await save(); refresh(); }));
  new Setting(scopeGroup).setName(t("settings.pdfHighlight")).setDesc(t("settings.pdfHighlightDesc"))
    .addToggle((t) => t.setValue(this.plugin.settings.enablePdfHighlight).onChange(async (v) => { this.plugin.settings.enablePdfHighlight = v; await save(); if (v) this.plugin.setupPdfHighlight(); else { this.plugin.teardownPdfHighlight(); this.plugin.rescanPdfLayers(); } }));
  const interactionGroup = createSettingsSection(highlightOptions, t("settings.highlightInteraction"), { key: "interaction", collapsible: false }).body;
  const modeSetting = new Setting(interactionGroup).setName(t("settings.highlightMode")).setDesc(t("settings.highlightModeDesc"));
  addCurrentChoice(modeSetting, [
    { value: "automatic", label: t("settings.highlightAutomatic") },
    { value: "manual", label: t("settings.highlightManual") },
  ], this.plugin.settings.highlightMode, async (mode) => {
    this.plugin.settings.highlightMode = mode;
    syncHighlightOptions();
    if (mode === "automatic" && this.plugin.settings.enablePdfHighlight) this.plugin.setupPdfHighlight();
    else this.plugin.teardownPdfHighlight();
    await save(); refresh();
  });
  const styleSection = createSettingsSection(highlightOptions, t("settings.highlightAppearance"), { key: "style", collapsible: false });
  const styleGroup = styleSection.body;
  addCurrentChoice(new Setting(styleGroup).setName(t("settings.highlightStyle")), [
    { value: "wavy", label: t("settings.wavy") }, { value: "underline", label: t("settings.underline") }, { value: "background", label: t("settings.background") },
  ], this.plugin.settings.highlightStyle, async (value) => { this.plugin.settings.highlightStyle = value; await save(); refresh(); });
  new Setting(styleGroup).setName(t("settings.highlightColor"))
    .addColorPicker((cp) => { this._colorComp = cp; cp.setValue(this.plugin.settings.highlightColor || accentHex).onChange(async (v) => { this.plugin.settings.highlightColor = v; await save(); refresh(); }); })
    .addExtraButton((b) => b.setIcon("reset").setTooltip(t("settings.resetTheme")).onClick(async () => { this.plugin.settings.highlightColor = ""; this._colorComp?.setValue(accentHex); await save(); refresh(); }));
  new Setting(styleGroup).setName(t("settings.opacity"))
    .addSlider((s) => s.setLimits(0.1, 1, 0.05).setValue(this.plugin.settings.highlightOpacity).onChange(async (v) => { this.plugin.settings.highlightOpacity = v; await save(); refresh(); }));
  new Setting(styleGroup).setName(t("settings.fade")).setDesc(t("settings.fadeDesc"))
    .addToggle((t) => t.setValue(this.plugin.settings.fadeByMemory).onChange(async (v) => { this.plugin.settings.fadeByMemory = v; await save(); refresh(); }));
  new Setting(styleGroup).setName(t("settings.fadeFloor"))
    .addSlider((s) => s.setLimits(0, 0.9, 0.05).setValue(this.plugin.settings.fadeFloor).onChange(async (v) => { this.plugin.settings.fadeFloor = v; await save(); refresh(); }));
  automaticGroups = [scopeSection.element, styleSection.element];
  syncHighlightOptions();
}

export function renderVocabularyRules(this: HighlightSettingsHost, context: HighlightSectionContext): void {
  const { obsidian, Setting, PathSuggest, topSection, t, save, refresh, accentHex, allTags, hasSuggest, appearanceLabels, createReorderController, moveItem, addAppearanceButton } = context;
  const rulesGroup = topSection("vocabulary-rules", t("settings.vocabularyRules"));
  const excludeSetting = new Setting(rulesGroup).setName(t("settings.excludeTags")).setDesc(t("settings.excludeTagsDesc"));
  excludeSetting.settingEl.addClass("lexis-tags-setting");
  const excludeEditor = excludeSetting.controlEl.createDiv({ cls: "lexis-tag-editor" });
  const excludeChips = excludeEditor.createDiv({ cls: "lexis-tag-editor-chips" });
  const excludeAdd = excludeEditor.createDiv({ cls: "lexis-tag-editor-add" });
  const excludeInput = new obsidian.TextComponent(excludeAdd).setPlaceholder(t("settings.addExcludedTag"));
  const excludedTags = () => [...new Set(this.plugin.parseTags(this.plugin.settings.excludeTags))];
  const saveExcludedTags = async (tags: string[]) => {
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
      chip.addEventListener("click", () => { void (async () => { await saveExcludedTags(excludedTags().filter((value) => value !== tag)); renderExcludedTags(); })(); });
    }
  };
  const addExcludedTags = async (raw: string) => {
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
      void addExcludedTags(excludeInput.inputEl.value);
    } else if (event.key === "Backspace" && !excludeInput.inputEl.value) {
      const tags = excludedTags();
      if (tags.length) { tags.pop(); void saveExcludedTags(tags).then(renderExcludedTags); }
    }
  });
  new obsidian.ExtraButtonComponent(excludeAdd).setIcon("plus").setTooltip(t("settings.addExcludedTag")).onClick(() => { void addExcludedTags(excludeInput.inputEl.value); });
  if (hasSuggest) new PathSuggest(this.app, excludeInput.inputEl, () => allTags.filter((tag) => !excludedTags().includes(tag)), (value) => { void addExcludedTags(value); });
  renderExcludedTags();

  const tagColorSection = createSettingsSection(rulesGroup, t("settings.tagColors"), { key: "tag-colors", collapsible: false }).body;
  const rulesWrap = tagColorSection.createDiv();
  const renderRules = () => {
    rulesWrap.empty();
    const grid = rulesWrap.createDiv({ cls: "lexis-rule-grid" });
    const reorder = createReorderController({
      container: grid,
      setIcon: obsidian.setIcon,
      label: t("settings.reorder"),
      onMove: async (from, to) => {
        this.plugin.settings.tagRules = moveItem(this.plugin.settings.tagRules, from, to);
        await save();
        refresh();
        renderRules();
      },
    });
    this.plugin.settings.tagRules.forEach((rule, i) => {
      const cell = grid.createDiv({ cls: "lexis-setting-row lexis-rule" });
      const tagIn = new obsidian.TextComponent(cell).setPlaceholder(t("settings.tagPlaceholder")).setValue(rule.tag);
      const applyTag = async (v: string) => { rule.tag = (v || "").trim(); await save(); refresh(); };
      tagIn.onChange(applyTag);
      if (hasSuggest) new PathSuggest(this.app, tagIn.inputEl, () => allTags, (v) => { tagIn.setValue(v); void applyTag(v); });
      addAppearanceButton({
        app: this.app,
        obsidian,
        parent: cell,
        title: t("settings.tagAppearance"),
        labels: appearanceLabels,
        allowStyle: true,
        state: () => ({ color: rule.color || accentHex, opacity: Number(rule.opacity ?? this.plugin.settings.highlightOpacity), style: rule.style || "" }),
        onChange: async (patch) => { Object.assign(rule, patch); await save(); refresh(); },
        onReset: async () => { delete rule.color; delete rule.opacity; delete rule.style; await save(); refresh(); },
      });
      new obsidian.ExtraButtonComponent(cell).setIcon("trash").setTooltip(t("common.delete")).onClick(async () => { this.plugin.settings.tagRules.splice(i, 1); await save(); refresh(); renderRules(); });
      reorder.attach(cell, i);
    });
    const addRule = rulesWrap.createEl("button", { text: t("settings.addTagRule") });
    addRule.setCssStyles({ marginTop: "2px" });
    addRule.addEventListener("click", () => { void (async () => { this.plugin.settings.tagRules.push({ tag: "", color: accentHex, style: "" }); await save(); renderRules(); })(); });
  };
  renderRules();
}
