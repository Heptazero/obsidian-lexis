import { Setting, type App, type Component } from "obsidian";
import { addCurrentChoice } from "./settings-choice";
import { mountDictionaryPicker } from "./dictionary-picker";
import type { LexisSettings, ReviewContentMode, ReviewOptions, ReviewSortDirection, ReviewSortKey } from "./types";
export function renderCollectionReview(parent: HTMLElement, app: App, host: {
    settings: LexisSettings;
    t(key: string): string;
    openReview(options: ReviewOptions): Promise<void>;
}, component: Component): void {
    let dictionaryIds: string[] | null = null, content: ReviewContentMode = "syntax", sortBy: ReviewSortKey = "due", sortDirection: ReviewSortDirection = "asc";
    const t = (key: string) => host.t(key);
    new Setting(parent).setName(t("home.reviewDictionary"));
    let start: import("obsidian").ButtonComponent;
    component.register(mountDictionaryPicker(parent, app, host.settings.dicts, dictionaryIds, ids => { dictionaryIds = ids; start?.setDisabled(ids !== null && !ids.length); }, t));
    addCurrentChoice(new Setting(parent).setName(t("home.reviewContent")), ([["notes", "home.contentNotes"], ["context", "home.contentContext"], ["syntax", "home.contentSyntax"], ["both", "home.contentBoth"]] as const)
        .map(([value, label]) => ({ value, label: t(label) })), content, value => { content = value; });
    addCurrentChoice(new Setting(parent).setName(t("home.sortBy")), ([["due", "home.sortDue"], ["wordCount", "home.sortWordCount"], ["modified", "home.sortModified"], ["created", "home.sortCreated"], ["frequency", "home.frequency"], ["random", "home.random"]] as const)
        .map(([value, label]) => ({ value, label: t(label) })), sortBy, value => { sortBy = value; });
    addCurrentChoice(new Setting(parent).setName(t("home.sortDirection")), [{ value: "asc" as const, label: t("home.ascending") }, { value: "desc" as const, label: t("home.descending") }], sortDirection, value => { sortDirection = value; });
    const setting = new Setting(parent);
    setting.settingEl.addClass("lexis-review-start");
    setting.addButton(button => { start = button; button.setButtonText(t("home.start")).setCta().onClick(() => host.openReview({ dictionaryIds, content, sortBy, sortDirection })); });
}
