import type { DictionarySetting, DictionarySource, LexisSettings } from "./types";
import { dictionaryId, dictionarySources, sourceKey } from "./dictionary-sources";
/** One-way settings migration; card keys, schedules and daily targets never change. */
export function migrateDictionaryCollections(settings: LexisSettings): boolean {
    let changed = false;
    const configuredTags = new Set(settings.dicts.flatMap(row => dictionarySources(row).filter(source => source.kind === "tag").map(source => source.value)));
    for (const source of dictionarySources({ folder: "", template: "", tag: settings.vocabTags || "" })) {
        if (!configuredTags.has(source.value)) {
            settings.dicts.push({ folder: "", template: "", sources: [source] });
            configuredTags.add(source.value);
        }
    }
    if (settings.vocabTags) {
        settings.vocabTags = "";
        changed = true;
    }
    const ids = new Set<string>();
    const stableId = (row: DictionarySetting, index: number) => {
        let hash = 2166136261;
        for (const character of `${index}:${dictionaryId(row)}`)
            hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
        return `dictionary-${(hash >>> 0).toString(36)}`;
    };
    for (const [index, row] of settings.dicts.entries()) {
        if (!row.sources) {
            row.sources = dictionarySources(row);
            changed = true;
        }
        if (!row.id || ids.has(row.id)) {
            row.id = stableId(row, index);
            changed = true;
        }
        ids.add(row.id);
        if (row.tag !== undefined) {
            delete row.tag;
            changed = true;
        }
    }
    const findOrAdd = (source: DictionarySource): string => {
        source = dictionarySources({folder:"",template:"",sources:[source]})[0];
        if (!source) return "";
        const existing = settings.dicts.find(row => {
            const sources = dictionarySources(row);
            return sources.length === 1 && sourceKey(sources[0]) === sourceKey(source);
        });
        if (existing)
            return existing.id;
        const row: DictionarySetting = { folder: source.kind === "folder" ? source.value : "", template: "", sources: [source], highlight: false };
        row.id = stableId(row, settings.dicts.length);
        settings.dicts.push(row);
        changed = true;
        return row.id;
    };
    for (const plan of settings.reviewPlans || []) {
        if (plan.dictionaryIds !== undefined)
            continue;
        let all = false;
        const selected = new Set<string>();
        for (const source of plan.sources || []) {
            if (source.scope === "vocab" && !source.value) {
                all = true;
                continue;
            }
            const id = findOrAdd({ kind: source.scope === "vocab" ? "folder" : source.scope, value: source.value });
            if (id) selected.add(id);
        }
        plan.dictionaryIds = all ? null : [...selected];
        delete plan.sources;
        changed = true;
    }
    if (Array.isArray(settings.marginNoteSources)) {
        settings.marginNoteSources = settings.marginNoteSources.flatMap(id => {
            const match = /^(folder|tag):(.*)$/.exec(id);
            if (!match)
                return id;
            changed = true;
            const dictionary = findOrAdd({ kind: match[1] as "folder" | "tag", value: match[2] });
            return dictionary ? [`dictionary:${dictionary}`] : [];
        });
    }
    return changed;
}
