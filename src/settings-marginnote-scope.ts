import { Setting } from "obsidian";
import type { SettingsRuntime } from "./settings-tab";
import { marginNoteSources } from "./marginnote-scope";

export function renderMarginNoteScope(container: HTMLElement, plugin: SettingsRuntime): void {
  const t = plugin.t.bind(plugin);
  const options = marginNoteSources(plugin.settings, plugin.index || new Map());
  const rows = container.createDiv();
  const save = async () => { await plugin.saveSettings(); plugin.marginNoteExport.schedule(); };
  const render = () => {
    rows.empty();
    const all = plugin.settings.marginNoteSources == null;
    new Setting(rows).setName(t("mn.scopeAll")).addToggle((toggle) => toggle.setValue(all).onChange(async (value) => {
      plugin.settings.marginNoteSources = value ? null : options.map(({ id }) => id);
      await save();
      render();
    }));
    if (!all) for (const option of options) {
      new Setting(rows).setName(option.label).addToggle((toggle) =>
        toggle.setValue(plugin.settings.marginNoteSources.includes(option.id)).onChange(async (value) => {
          const selected = new Set(plugin.settings.marginNoteSources);
          if (value) selected.add(option.id); else selected.delete(option.id);
          plugin.settings.marginNoteSources = [...selected];
          await save();
        }));
    }
  };
  render();
}
