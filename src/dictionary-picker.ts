import { AbstractInputSuggest, prepareFuzzySearch, type App } from "obsidian";
import type { DictionarySetting } from "./types";
import { dictionaryId, dictionaryName } from "./dictionary-sources";
class DictionarySuggest extends AbstractInputSuggest<DictionarySetting> {
    constructor(app: App, input: HTMLInputElement, private dictionaries: DictionarySetting[], private pick: (row: DictionarySetting) => void) { super(app, input); }
    getSuggestions(query: string): DictionarySetting[] {
        const match = prepareFuzzySearch(query.trim());
        return this.dictionaries.filter(row => !query.trim() || match(dictionaryName(row))).slice(0, 50);
    }
    renderSuggestion(row: DictionarySetting, element: HTMLElement): void { element.setText(dictionaryName(row)); }
    selectSuggestion(row: DictionarySetting): void { this.setValue(""); this.close(); this.pick(row); }
}
/** A single collection picker reused by plans, one-off review and the library. */
export function mountDictionaryPicker(parent: HTMLElement, app: App, dictionaries: DictionarySetting[], initial: string[] | null, changed: (ids: string[] | null) => void, t: (key: string) => string): () => void {
    let selected = initial === null ? null : [...initial];
    const root = parent.createDiv({ cls: "lexis-dictionary-picker" });
    const allLabel = root.createEl("label", { cls: "lexis-dictionary-all" });
    const all = allLabel.createEl("input", { type: "checkbox" });
    allLabel.createSpan({ text: t("home.scopeAllDictionaries") });
    const chips = root.createDiv({ cls: "lexis-dictionary-chips" });
    const input = root.createEl("input", { attr: { type: "search", placeholder: t("collection.choose"), "aria-label": t("collection.choose") } });
    const notify = () => { render(); changed(selected === null ? null : [...selected]); };
    const render = () => {
        all.checked = selected === null;
        chips.empty();
        for (const id of selected || []) {
            const row = dictionaries.find(row => dictionaryId(row) === id);
            const chip = chips.createEl("button", { text: `${row ? dictionaryName(row) : t("collection.missing")} ×`, attr: { type: "button" } });
            chip.onclick = () => { selected = (selected || []).filter(value => value !== id); notify(); };
        }
    };
    all.onchange = () => { selected = all.checked ? null : []; notify(); };
    const suggest = new DictionarySuggest(app, input, dictionaries, row => {
        selected = [...new Set([...(selected || []), dictionaryId(row)])];
        notify();
        input.value = "";
    });
    render();
    return () => suggest.close();
}
