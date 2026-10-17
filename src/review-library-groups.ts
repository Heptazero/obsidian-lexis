import type { App, TFile } from "obsidian";
import type { DictionarySetting } from "./types";
import type { ListedReviewCard } from "./review-catalog";
import { dictionaryId, dictionaryName, resolveDictionaries } from "./dictionary-sources";
export const libraryGroups = ["none", "dictionary", "folder", "tag", "file", "heading"] as const;
export type LibraryGroup = typeof libraryGroups[number];
export interface CardGroup {
    id: string;
    label: string;
    cards: ListedReviewCard[];
}
export function groupLibraryCards(cards: ListedReviewCard[], mode: LibraryGroup, dictionaries: DictionarySetting[], app: App, getTags: (file: TFile) => Set<string>, ungrouped: string): CardGroup[] {
    if (mode === "none")
        return [{ id: "all", label: "", cards }];
    const files = [...new Map(cards.map(card => [card.file.path, card.file])).values()];
    const membership = mode === "dictionary" ? resolveDictionaries(app, dictionaries, getTags, files) : null;
    const tagsByFile = mode === "tag" ? new Map(files.map(file => [file.path, getTags(file)])) : null;
    const groups = new Map<string, CardGroup>();
    const labelsFor = (card: ListedReviewCard): Array<[string,string]> => {
        const path = card.file.path;
        switch (mode) {
            case "dictionary": return (membership.byFile.get(path) || []).map(row => [dictionaryId(row),dictionaryName(row)]);
            case "tag": return [...tagsByFile.get(path)].sort().map(tag=>[tag,`#${tag}`]);
            case "file": return [[path,path]];
            case "heading": { const heading=(card.headingPath || []).join(" / "); return [[heading,heading]]; }
            default: { const folder=path.includes("/")?path.slice(0,path.lastIndexOf("/")):"/"; return [[folder,folder]]; }
        }
    };
    for (const card of cards) {
        const labels = labelsFor(card);
        for (const [id, label] of labels.length ? labels : [["", ungrouped]]) {
            const key = id || "ungrouped", group = groups.get(key) || { id: key, label: label || ungrouped, cards: [] };
            group.cards.push(card);
            groups.set(key, group);
        }
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}
