"use strict";

import type { App } from "obsidian";
import type { LexisSettings } from "./types";
import type { SettingsRuntime } from "./settings-tab";
import type { PathSuggestConstructor } from "./settings-suggest";

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
  const encounterFolderSetting = new Setting(dataSection).setName(t("settings.encounterFolder")).setDesc(t("settings.encounterFolderDesc"));
  encounterFolderSetting.settingEl.addClass("lexis-data-path-setting");
  const savedEncounterFolder = () => this.plugin.settings.encounterFolder || defaultEncounterFolder;
  const folderInput = new obsidian.TextComponent(encounterFolderSetting.controlEl).setValue(savedEncounterFolder());
  const undoFolder = new obsidian.ExtraButtonComponent(encounterFolderSetting.controlEl).setIcon("undo").setTooltip(t("settings.encounterFolderUndo"));
  const confirmFolder = new obsidian.ExtraButtonComponent(encounterFolderSetting.controlEl).setIcon("check").setTooltip(t("settings.encounterFolderConfirm"));
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
      await this.plugin.setEncounterFolder(value === defaultEncounterFolder ? "" : value);
      folderInput.setValue(savedEncounterFolder());
      new Notice(t("settings.encounterFolderSaved"));
    } catch (error) {
      new Notice(t("settings.encounterFolderError", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" }));
    } finally { switchingFolder = false; refreshFolderActions(); }
  })(); });
  if (hasSuggest) new PathSuggest(this.app, folderInput.inputEl, () => folders, (value) => { folderInput.setValue(value); refreshFolderActions(); });
  refreshFolderActions();
  new Setting(dataSection).setName(t("settings.pluginDataPath"))
    .setDesc(t("settings.pluginDataPathDesc", { path: `${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}/data.json` }));

  const mobileSection = topSection("mobile", t("settings.mobileInteractions"), { desc: t("settings.mobileSectionDesc") });
  new Setting(mobileSection).setName(t("settings.mobileTapAction")).setDesc(t("settings.mobileTapDesc"))
    .addDropdown((dropdown) => dropdown
      .addOption("popover", t("settings.mobileTapPopover"))
      .addOption("open", t("settings.mobileTapOpen"))
      .setValue(this.plugin.settings.mobileTapAction)
      .onChange(async (value) => { this.plugin.settings.mobileTapAction = value as LexisSettings["mobileTapAction"]; await save(); }));
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
