"use strict";

import type { App, ColorComponent } from "obsidian";
import type { HighlightStyle } from "./types";
import type { SettingsRuntime } from "./settings-tab";
import type { PathSuggestConstructor } from "./settings-suggest";
import { unconfiguredEntryColorUsages } from "./entry-colors";

interface HighlightSettingsHost {
  app: App;
  plugin: SettingsRuntime;
  _colorComp: ColorComponent | null;
  section(containerEl: HTMLElement, title: string, options?: { open?: boolean; desc?: string }): HTMLElement;
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
  const { obsidian, Setting, PathSuggest, topSection, t, save, refresh, accentHex, allTags, hasSuggest, appearanceLabels, createReorderController, moveItem, addAppearanceButton } = context;
  const hlSection = topSection("highlight", t("settings.highlight"));
  const highlightSwitch = new Setting(hlSection).setName(t("settings.enableHighlight")).setDesc(t("settings.enableHighlightDesc"));
  const highlightOptions = hlSection.createEl("fieldset", { cls: "lexis-highlight-options" });
  const syncHighlightOptions = () => {
    highlightOptions.disabled = !this.plugin.settings.enableHighlight;
    highlightOptions.toggleClass("is-disabled", !this.plugin.settings.enableHighlight);
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
  const scopeGroup = highlightOptions.createDiv({ cls: "lexis-settings-subgroup" });
  scopeGroup.createDiv({ cls: "lexis-settings-subheading", text: t("settings.highlightScope") });
  new Setting(scopeGroup).setName(t("settings.livePreview")).setDesc(this.plugin.liveAvailable ? "" : t("settings.unsupported"))
    .addToggle((t) => t.setValue(this.plugin.settings.enableLivePreview).setDisabled(!this.plugin.liveAvailable).onChange(async (v) => { this.plugin.settings.enableLivePreview = v; await save(); refresh(); }));
  new Setting(scopeGroup).setName(t("settings.pdfHighlight")).setDesc(t("settings.pdfHighlightDesc"))
    .addToggle((t) => t.setValue(this.plugin.settings.enablePdfHighlight).onChange(async (v) => { this.plugin.settings.enablePdfHighlight = v; await save(); if (v) this.plugin.setupPdfHighlight(); else { this.plugin.teardownPdfHighlight(); this.plugin.rescanPdfLayers(); } }));
  const interactionGroup = highlightOptions.createDiv({ cls: "lexis-settings-subgroup" });
  interactionGroup.createDiv({ cls: "lexis-settings-subheading", text: t("settings.highlightInteraction") });
  new Setting(interactionGroup).setName(t("settings.clickHighlightToOpen")).setDesc(t("settings.clickHighlightToOpenDesc"))
    .addToggle((toggle) => toggle.setValue(this.plugin.settings.clickHighlightToOpen !== false).onChange(async (value) => { this.plugin.settings.clickHighlightToOpen = value; await save(); }));
  const styleGroup = highlightOptions.createDiv({ cls: "lexis-settings-subgroup" });
  styleGroup.createDiv({ cls: "lexis-settings-subheading", text: t("settings.highlightAppearance") });
  new Setting(styleGroup).setName(t("settings.highlightStyle"))
    .addDropdown((dd) => dd.addOption("wavy", t("settings.wavy")).addOption("underline", t("settings.underline")).addOption("background", t("settings.background")).setValue(this.plugin.settings.highlightStyle).onChange(async (v) => { this.plugin.settings.highlightStyle = ["wavy", "underline", "background"].includes(v) ? v as HighlightStyle : "wavy"; await save(); refresh(); }));
  new Setting(styleGroup).setName(t("settings.highlightColor"))
    .addColorPicker((cp) => { this._colorComp = cp; cp.setValue(this.plugin.settings.highlightColor || accentHex).onChange(async (v) => { this.plugin.settings.highlightColor = v; await save(); refresh(); }); })
    .addExtraButton((b) => b.setIcon("reset").setTooltip(t("settings.resetTheme")).onClick(async () => { this.plugin.settings.highlightColor = ""; this._colorComp?.setValue(accentHex); await save(); refresh(); }));
  new Setting(styleGroup).setName(t("settings.opacity"))
    .addSlider((s) => s.setLimits(0.1, 1, 0.05).setValue(this.plugin.settings.highlightOpacity).onChange(async (v) => { this.plugin.settings.highlightOpacity = v; await save(); refresh(); }));
  new Setting(styleGroup).setName(t("settings.fade")).setDesc(t("settings.fadeDesc"))
    .addToggle((t) => t.setValue(this.plugin.settings.fadeByMemory).onChange(async (v) => { this.plugin.settings.fadeByMemory = v; await save(); refresh(); }));
  new Setting(styleGroup).setName(t("settings.fadeFloor"))
    .addSlider((s) => s.setLimits(0, 0.9, 0.05).setValue(this.plugin.settings.fadeFloor).onChange(async (v) => { this.plugin.settings.fadeFloor = v; await save(); refresh(); }));
  const rulesGroup = highlightOptions.createDiv({ cls: "lexis-settings-subgroup" });
  rulesGroup.createDiv({ cls: "lexis-settings-subheading", text: t("settings.highlightRules") });
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

  const entryColorSection = this.section(rulesGroup, t("settings.entryColors"), { desc: t("settings.entryColorsDesc") });
  const missingColorsWrap = entryColorSection.createDiv({ cls: "lexis-missing-entry-colors" });
  const entryColorsWrap = entryColorSection.createDiv();
  const renderMissingColors = () => {
    missingColorsWrap.empty();
    const missing = unconfiguredEntryColorUsages(this.plugin.inlineColorTokenUsages || [], this.plugin.settings.entryColors);
    if (!missing.length) return;
    missingColorsWrap.createDiv({ cls: "lexis-missing-entry-colors-label", text: t("settings.unconfiguredEntryColors") });
    const list = missingColorsWrap.createDiv({ cls: "lexis-missing-entry-colors-list" });
    for (const usage of missing) {
      const add = list.createEl("button", {
        cls: "lexis-missing-entry-color",
        attr: { type: "button", title: t("settings.addUnconfiguredEntryColor", { name: usage.token }) },
      });
      add.createSpan({ text: usage.token });
      add.createSpan({ cls: "lexis-missing-entry-color-count", text: String(usage.count) });
      add.addEventListener("click", () => { void (async () => {
        this.plugin.settings.entryColors.push({ name: usage.token, color: accentHex });
        await save();
        refresh();
        renderEntryColors();
      })(); });
    }
  };
  const renderEntryColors = () => {
    entryColorsWrap.empty();
    const grid = entryColorsWrap.createDiv({ cls: "lexis-rule-grid" });
    const reorder = createReorderController({
      container: grid,
      setIcon: obsidian.setIcon,
      label: t("settings.reorder"),
      onMove: async (from, to) => {
        this.plugin.settings.entryColors = moveItem(this.plugin.settings.entryColors, from, to);
        await save();
        refresh();
        renderEntryColors();
      },
    });
    this.plugin.settings.entryColors.forEach((entryColor, index) => {
      const cell = grid.createDiv({ cls: "lexis-setting-row lexis-rule lexis-entry-color-row" });
      new obsidian.TextComponent(cell).setPlaceholder(t("settings.entryColorPlaceholder")).setValue(entryColor.name).onChange(async (value) => {
        entryColor.name = value.trim();
        await save();
        refresh();
        renderMissingColors();
      });
      new obsidian.ColorComponent(cell).setValue(entryColor.color || accentHex).onChange(async (value) => {
        entryColor.color = value;
        await save();
        refresh();
      });
      new obsidian.ExtraButtonComponent(cell).setIcon("trash").setTooltip(t("common.delete")).onClick(async () => {
        this.plugin.settings.entryColors.splice(index, 1);
        await save();
        refresh();
        renderEntryColors();
      });
      reorder.attach(cell, index);
    });
    const addColor = entryColorsWrap.createEl("button", { text: t("settings.addEntryColor") });
    addColor.setCssStyles({ marginTop: "2px" });
    addColor.addEventListener("click", () => { void (async () => {
      this.plugin.settings.entryColors.push({ name: "", color: accentHex });
      await save();
      renderEntryColors();
    })(); });
    renderMissingColors();
  };
  renderEntryColors();

  const tagColorSection = this.section(rulesGroup, t("settings.tagColors"));
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
