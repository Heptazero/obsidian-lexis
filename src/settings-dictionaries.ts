import * as obsidian from "obsidian";
import { Setting } from "obsidian";
import type { SettingsRuntime } from "./settings-tab";
import { DictionaryEditor } from "./dictionary-editor";
import { dictionaryName, dictionarySources, sourceLabel } from "./dictionary-sources";
import { addAppearanceButton, createReorderController, moveItem } from "./settings-controls";
export function renderDictionarySettings(container: HTMLElement, plugin: SettingsRuntime, accent: string, labels: Parameters<typeof addAppearanceButton>[0]["labels"], stats: () => void): void {
    const t = (key: string) => plugin.t(key);
    const list = container.createDiv({ cls: "lexis-dictionary-list" });
    const changed = async () => { await plugin.saveSettings(); await plugin.rebuildIndex(false); stats(); };
    const header = new Setting(container).setDesc(t("collection.sourcesHint")).setHeading();
    header.addButton(button => {
      button.setIcon("plus").setTooltip(t("collection.add"));
      button.buttonEl.setAttribute("aria-label",t("collection.add"));
      button.onClick(() => new DictionaryEditor(plugin.app, plugin, null, async (row) => {
        plugin.settings.dicts.push(row);
        await changed();
        render();
      }).open());
    });
    container.insertBefore(header.settingEl, list);
    function render() {
        list.empty();
        const reorder = createReorderController({ container: list, setIcon: obsidian.setIcon, label: t("settings.reorder"), onMove: async (from, to) => {
                plugin.settings.dicts = moveItem(plugin.settings.dicts, from, to);
                await changed();
                render();
            } });
        plugin.settings.dicts.forEach((dictionary, index) => {
            const row = list.createDiv({ cls: "lexis-setting-row lexis-dictionary-row" });
            const info = row.createDiv({ cls: "lexis-collection-info" });
            const name = info.createEl("button", { cls: "lexis-collection-name", text: dictionaryName(dictionary) || t("collection.empty") });
            const edit = () => new DictionaryEditor(plugin.app, plugin, dictionary, async (next) => { plugin.settings.dicts[index] = next; await changed(); render(); }).open();
            name.onclick = edit;
            info.createDiv({ cls: "lexis-dim lexis-collection-sources", text: dictionarySources(dictionary).map(sourceLabel).join(" · ") });
            new obsidian.ToggleComponent(row).setTooltip(t("settings.showDictionaryHighlight")).setValue(dictionary.highlight !== false).onChange(async (value) => { dictionary.highlight = value; await plugin.saveSettings(); plugin.refreshAllViews(); });
            addAppearanceButton({ app: plugin.app, obsidian, parent: row, title: t("settings.dictionaryAppearance"), labels,
                state: () => ({ color: dictionary.color || plugin.settings.highlightColor || accent, opacity: Number(dictionary.opacity ?? plugin.settings.highlightOpacity) }),
                onChange: async (patch) => { Object.assign(dictionary, patch); await plugin.saveSettings(); plugin.refreshAllViews(); },
                onReset: async () => { delete dictionary.color; delete dictionary.opacity; await plugin.saveSettings(); plugin.refreshAllViews(); } });
            new obsidian.ExtraButtonComponent(row).setIcon("pencil").setTooltip(t("collection.edit")).onClick(edit);
            new obsidian.ExtraButtonComponent(row).setIcon("trash").setTooltip(t("settings.deleteDictionary")).onClick(async () => { plugin.settings.dicts.splice(index, 1); await changed(); render(); });
            reorder.attach(row, index);
        });
    }
    render();
}
