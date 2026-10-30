"use strict";
import { addCurrentChoice } from "./settings-choice";

import type { App } from "obsidian";
import type { SettingsRuntime } from "./settings-tab";
import type { PathSuggestConstructor } from "./settings-suggest";
import { learningData, pruneLearning } from "./learning-data";

interface StorageSettingsHost {
  app: App;
  plugin: SettingsRuntime;
}

interface StorageSectionContext {
  obsidian: typeof import("obsidian");
  Setting: typeof import("obsidian").Setting;
  Notice: typeof import("obsidian").Notice;
  PathSuggest: PathSuggestConstructor;
  topSection: (key: string, title: string, options?: { open?: boolean; desc?: string }) => HTMLElement;
  t: (key: string, vars?: Record<string, string | number | boolean | null | undefined>) => string;
  save: () => Promise<void>;
  folders: string[];
  hasSuggest: boolean;
  defaultEncounterFolder: string;
}

export function renderStorageSettings(this: StorageSettingsHost, context: StorageSectionContext): void {
  const { obsidian, Setting, Notice, PathSuggest, topSection, t, save, folders, hasSuggest, defaultEncounterFolder } = context;
  const dataSection = topSection("data", t("settings.dataStorage"), { open: true });
  dataSection.addClass("lexis-data-section");
  const encounterFolderSetting = new Setting(dataSection).setName(t("settings.dataFolder")).setDesc(t("settings.dataFolderDesc"));
  encounterFolderSetting.settingEl.addClass("lexis-data-path-setting");
  const savedEncounterFolder = () => this.plugin.settings.dataFolder || defaultEncounterFolder;
  const folderInput = new obsidian.TextComponent(encounterFolderSetting.controlEl).setValue(savedEncounterFolder());
  const undoFolder = new obsidian.ExtraButtonComponent(encounterFolderSetting.controlEl).setIcon("undo").setTooltip(t("settings.encounterFolderUndo"));
  const confirmFolder = new obsidian.ExtraButtonComponent(encounterFolderSetting.controlEl).setIcon("check").setTooltip(t("settings.dataFolderConfirm"));
  let switchingFolder = false;
  const refreshFolderActions = () => {
    const changed = folderInput.getValue().trim() !== savedEncounterFolder();
    undoFolder.setDisabled(!changed || switchingFolder);
    confirmFolder.setDisabled(!changed || switchingFolder);
  };
  folderInput.onChange(refreshFolderActions);
  folderInput.inputEl.addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); });
  undoFolder.onClick(() => { folderInput.setValue(savedEncounterFolder()); refreshFolderActions(); });
  confirmFolder.onClick(() => { void (async () => {
    if (switchingFolder || folderInput.getValue().trim() === savedEncounterFolder()) return;
    switchingFolder = true;
    refreshFolderActions();
    try {
      const value = folderInput.getValue().trim();
      await this.plugin.setDataFolder(value);
      folderInput.setValue(savedEncounterFolder());
      new Notice(t("settings.dataFolderSaved"));
    } catch (error) {
      new Notice(t("settings.dataFolderError", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" }));
    } finally { switchingFolder = false; refreshFolderActions(); }
  })(); });
  if (hasSuggest) new PathSuggest(this.app, folderInput.inputEl, () => folders, (value) => { folderInput.setValue(value); refreshFolderActions(); });
  refreshFolderActions();
  new Setting(dataSection).setName(t("settings.pluginDataPath"))
    .setDesc(t("settings.pluginDataPathDesc", { path: `${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}/data.json` }));

  const retention = new Setting(dataSection).setName(t("settings.reviewRetention")).setDesc(t("settings.reviewRetentionDesc"));
  retention.settingEl.addClass("lexis-data-path-setting");
  const days = new obsidian.TextComponent(retention.controlEl).setValue(String(this.plugin.settings.reviewEventsRetentionDays));
  days.inputEl.type = "number"; days.inputEl.min = "1"; days.inputEl.max = "3650"; days.inputEl.step = "1";
  let savingDays = false;
  const undoDays = new obsidian.ExtraButtonComponent(retention.controlEl).setIcon("undo").setTooltip(t("settings.encounterFolderUndo"));
  const confirmDays = new obsidian.ExtraButtonComponent(retention.controlEl).setIcon("check").setTooltip(t("settings.reviewRetentionConfirm"));
  const updateDays = () => {
    const value = Number(days.getValue()), changed = value !== this.plugin.settings.reviewEventsRetentionDays;
    const pending = this.plugin.settings.reviewRetentionConfirmed !== true;
    const valid = Number.isInteger(value) && value >= 1 && value <= 3650;
    undoDays.setDisabled(savingDays || !changed);
    confirmDays.setDisabled(savingDays || (!changed && !pending) || !valid);
    if (pending && valid) {
      const current = learningData(this.plugin.settings), retained = pruneLearning(current, value);
      const count = (history: typeof current.reviewHistory) => Object.values(history).reduce((sum, events) => sum + events.length, 0);
      retention.setDesc(t("settings.reviewRetentionPending", { events: current.reviewEvents.length - retained.reviewEvents.length, points: count(current.reviewHistory) - count(retained.reviewHistory) }));
    } else retention.setDesc(t("settings.reviewRetentionDesc"));
  };
  days.onChange(updateDays);
  days.inputEl.addEventListener("keydown", event => { if (event.key === "Enter") event.preventDefault(); });
  undoDays.onClick(() => { days.setValue(String(this.plugin.settings.reviewEventsRetentionDays)); updateDays(); });
  confirmDays.onClick(() => { void (async () => {
    const value = Number(days.getValue());
    if (savingDays || !Number.isInteger(value) || value < 1 || value > 3650) return;
    const previous = this.plugin.settings.reviewEventsRetentionDays;
    const previousConfirmation = this.plugin.settings.reviewRetentionConfirmed;
    savingDays = true; this.plugin.settings.reviewEventsRetentionDays = value; this.plugin.settings.reviewRetentionConfirmed = true; updateDays();
    try { await save(); new Notice(t("settings.reviewRetentionSaved")); }
    catch (error) {
      this.plugin.settings.reviewEventsRetentionDays = previous;
      this.plugin.settings.reviewRetentionConfirmed = previousConfirmation;
      new Notice(t("settings.dataFolderError", { error: error instanceof Error ? error.message : "Unknown error" }));
    } finally { savingDays = false; updateDays(); }
  })(); });
  updateDays();

  const mobileSection = topSection("mobile", t("settings.mobileInteractions"), { desc: t("settings.mobileSectionDesc") });
  addCurrentChoice(new Setting(mobileSection).setName(t("settings.mobileTapAction")).setDesc(t("settings.mobileTapDesc")), [
    { value: "popover", label: t("settings.mobileTapPopover") }, { value: "open", label: t("settings.mobileTapOpen") },
  ], this.plugin.settings.mobileTapAction, async (value) => { this.plugin.settings.mobileTapAction = value; await save(); });
  new Setting(mobileSection).setName(t("settings.ratingOffset")).setDesc(t("settings.ratingOffsetDesc"))
    .addSlider((s) => s
      .setLimits(0, 200, 5)
      .setValue(this.plugin.settings.reviewBottomSpace)
      .setInstant(true)
      .onChange(async (value) => {
        this.plugin.settings.reviewBottomSpace = value;
        this.app.workspace.containerEl.ownerDocument
          .querySelectorAll<HTMLElement>('.workspace-leaf-content[data-type="lexis-review-view"]')
          .forEach((view) => view.setCssProps({ "--lexis-review-bottom-space": `${value}px` }));
        await save();
      }));

}
