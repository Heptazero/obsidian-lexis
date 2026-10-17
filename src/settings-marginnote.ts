import { Notice, Setting, TFolder } from "obsidian";
import type { SettingsRuntime } from "./settings-tab";
import { marginNoteExportPath } from "./marginnote-export-data";
import { FolderSuggest } from "./folder-suggest";
import { renderMarginNoteScope } from "./settings-marginnote-scope";

export function renderMarginNoteSettings(container: HTMLElement, plugin: SettingsRuntime): void {
  const t = plugin.t.bind(plugin);
  const row = new Setting(container).setName(t("mn.folder")).setDesc(t("mn.folderDescription"));
  row.settingEl.addClass("lexis-data-path-setting");
  const folders = plugin.app.vault.getAllLoadedFiles().filter((file): file is TFolder => file instanceof TFolder)
    .map((folder) => folder.path).filter((path) => path && path !== "/").sort();
  let draft = plugin.settings.marginNoteExportFolder;
  row.addText((input) => {
    input.setValue(draft).onChange((value) => { draft = value; });
    new FolderSuggest(plugin.app, input.inputEl, () => folders, (value) => {
      draft = value;
      input.setValue(value);
    });
    input.inputEl.addEventListener("keydown", (event) => { if (event.key === "Enter") event.preventDefault(); });
    row.addExtraButton((button) => button.setIcon("undo").setTooltip(t("mn.undo")).onClick(() => {
      draft = plugin.settings.marginNoteExportFolder;
      input.setValue(draft);
    }));
    row.addExtraButton((button) => button.setIcon("check").setTooltip(t("mn.confirm")).onClick(async () => {
      try {
        draft = marginNoteExportPath(draft).replace(/\/lexis-marginnote\.json$/, "");
        plugin.settings.marginNoteExportFolder = draft;
        await plugin.saveSettings();
        input.setValue(draft);
        plugin.marginNoteExport.schedule();
      } catch (error) { new Notice(t("mn.exportFailed", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" })); }
    }));
  });
  renderMarginNoteScope(container, plugin);
  new Setting(container).setName(t("mn.auto")).setDesc(t("mn.autoDescription"))
    .addToggle((toggle) => toggle.setValue(plugin.settings.marginNoteAutoExport).onChange(async (value) => {
      plugin.settings.marginNoteAutoExport = value;
      await plugin.saveSettings();
      plugin.marginNoteExport.schedule();
    }));
  new Setting(container).setName(t("mn.export")).addButton((button) => button.setButtonText(t("mn.export")).onClick(async () => {
    try {
      await plugin.rebuildIndex(false);
      const count = await plugin.marginNoteExport.export();
      new Notice(t("mn.exported", { count, path: marginNoteExportPath(plugin.settings.marginNoteExportFolder) }));
    } catch (error) { new Notice(t("mn.exportFailed", { error: error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error" })); }
  }));
}
