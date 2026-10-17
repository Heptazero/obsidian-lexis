import { Setting } from "obsidian";
import type { SettingsRuntime } from "./settings-tab";
import type { PathSuggestConstructor } from "./settings-suggest";
import { addCurrentChoice } from "./settings-choice";
import { addSelectionPillPosition } from "./settings-selection-pill";
import { DEFAULT_SETTINGS } from "./default-settings";
import type { SelectionPillOrder } from "./types";

interface ReaderSettingsContext {
  plugin: SettingsRuntime;
  topSection(this: void, key: string, title: string): HTMLElement;
  PathSuggest: PathSuggestConstructor;
  mdFiles: string[];
  hasSuggest: boolean;
}

export function renderReaderSettings({ plugin, topSection, PathSuggest, mdFiles, hasSuggest }: ReaderSettingsContext): void {
  const t = plugin.t.bind(plugin), save = () => plugin.saveSettings();
  const card = topSection("popover", t("settings.readingInteractions"));
  new Setting(card).setName(t("settings.clickHighlightToOpen")).setDesc(t("settings.clickHighlightToOpenDesc"))
    .addToggle((toggle) => toggle.setValue(plugin.settings.clickHighlightToOpen !== false).onChange(async (value) => { plugin.settings.clickHighlightToOpen = value; await save(); }));
  addCurrentChoice(new Setting(card).setName(t("settings.popoverEditMode")), [
    { value: "inline", label: t("settings.popoverEditInline") }, { value: "window", label: t("settings.popoverEditWindow") },
  ], plugin.settings.popoverEditMode, async (value) => { plugin.settings.popoverEditMode = value; await save(); });
  new Setting(card).setName(t("settings.hoverDelay")).setDesc(t("settings.hoverDelayDesc"))
    .addSlider((slider) => slider.setLimits(0, 3, .1).setValue(plugin.settings.hoverDelayMs / 1000).onChange(async (value) => { plugin.settings.hoverDelayMs = Math.round(value * 1000); await save(); }));
  new Setting(card).setName(t("settings.showRelated")).addToggle((toggle) => toggle.setValue(plugin.settings.showRelated).onChange(async (value) => { plugin.settings.showRelated = value; await save(); }));
  new Setting(card).setName(t("settings.selectionPill"))
    .addToggle((toggle) => toggle.setValue(plugin.settings.selectionPill).onChange(async (value) => { plugin.settings.selectionPill = value; await save(); if (!value) plugin.removeSelPill(); }));
  const dictionary = t("home.reviewDictionary");
  addCurrentChoice(new Setting(card).setName(t("settings.selectionPillOrder")), [
    { value: "add-dictionary-alias", label: `＋ · ${dictionary} · 🔗` },
    { value: "add-alias-dictionary", label: `＋ · 🔗 · ${dictionary}` },
    { value: "dictionary-add-alias", label: `${dictionary} · ＋ · 🔗` },
    { value: "dictionary-alias-add", label: `${dictionary} · 🔗 · ＋` },
    { value: "alias-add-dictionary", label: `🔗 · ＋ · ${dictionary}` },
    { value: "alias-dictionary-add", label: `🔗 · ${dictionary} · ＋` },
  ] as const, plugin.settings.selectionPillOrder, async (value: SelectionPillOrder) => {
    plugin.settings.selectionPillOrder = value; await save(); plugin.removeSelPill();
  });
  addSelectionPillPosition(card, { Setting, settings: plugin.settings, t, save });

  const templates = topSection("templates", t("settings.newEntry"));
  addCurrentChoice(new Setting(templates).setName(t("settings.emptyNotePreset")).setDesc(t("settings.emptyNotePresetDesc")), [
    { value: "blank", label: t("settings.emptyNoteBlank") }, { value: "occ", label: t("settings.emptyNoteOccurrences") },
  ], plugin.settings.emptyNotePreset, async (value) => { plugin.settings.emptyNotePreset = value; await save(); });
  new Setting(templates).setName(t("settings.defaultTemplate")).setDesc(t("settings.defaultTemplateDesc"))
    .addText((input) => {
      input.setValue(plugin.settings.newWordTemplate);
      const apply = async (value: string) => { plugin.settings.newWordTemplate = value.trim(); await save(); };
      input.onChange(apply);
      if (hasSuggest) new PathSuggest(plugin.app, input.inputEl, () => mdFiles, (value) => { input.setValue(value); void apply(value); });
    });

  const sources = topSection("occurrences", t("settings.sourcesAndNotes"));
  const clear = async () => { plugin._occCache.clear(); await save(); };
  new Setting(sources).setName(t("settings.showOccurrences")).setDesc(t("settings.showOccurrencesDesc"))
    .addToggle((toggle) => toggle.setValue(plugin.settings.showOccurrences).onChange(async (value) => { plugin.settings.showOccurrences = value; await clear(); }));
  new Setting(sources).setName(t("settings.pdfOccurrences")).setDesc(t("settings.pdfOccurrencesDesc"))
    .addToggle((toggle) => toggle.setValue(plugin.settings.includePdfOccurrences !== false).onChange(async (value) => { plugin.settings.includePdfOccurrences = value; await clear(); }));
  new Setting(sources).setName(t("settings.occurrenceLimit"))
    .addSlider((slider) => slider.setLimits(1, 15, 1).setValue(plugin.settings.occurrenceLimit).onChange(async (value) => { plugin.settings.occurrenceLimit = value; await clear(); }));
  new Setting(sources).setName(t("settings.occurrenceScope")).setDesc(t("settings.occurrenceScopeDesc"))
    .addText((input) => input.setPlaceholder(t("settings.wholeVault")).setValue(plugin.settings.occurrenceFolders).onChange(async (value) => { plugin.settings.occurrenceFolders = value.trim(); await clear(); }));
  const occurrence = new Setting(sources).setName(t("settings.occurrenceTemplate")).setDesc(t("settings.occurrenceTemplateDesc"))
    .addTextArea((input) => input.setPlaceholder(DEFAULT_SETTINGS.occurrenceTemplate).setValue(plugin.settings.occurrenceTemplate)
      .onChange(async (value) => { plugin.settings.occurrenceTemplate = value; await save(); }));
  occurrence.settingEl.addClass("lexis-template-setting");
  occurrence.controlEl.querySelector("textarea").rows = 4;
  new Setting(sources).setName(t("settings.annotationHeading")).setDesc(t("settings.annotationHeadingDesc"))
    .addText((input) => input.setPlaceholder("#### 批注").setValue(plugin.settings.annotationHeading).onChange(async (value) => { plugin.settings.annotationHeading = value; await save(); }));
}
