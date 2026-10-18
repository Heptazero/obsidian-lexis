import type { App, TFile } from "obsidian";
import type { DictionarySetting, DictionarySource } from "./types";
export const sourcePath = (value: string): string => value.trim().normalize("NFC").replace(/^\/+|\/+$/g, "");
export const sourceLabel = (source: DictionarySource): string => source.kind === "tag" ? `#${source.value}` : source.kind === "links" ? `↗ ${source.value}` : source.value;
export const sourceKey = (source: DictionarySource): string => `${source.kind}:${source.value}`;
export function dictionarySources(dictionary: DictionarySetting): DictionarySource[] {
    // Only for pre-migration inputs; persisted rows acquire sources at load time.
    const sources = dictionary.sources ?? [
        ...(dictionary.folder ? [{ kind: "folder" as const, value: dictionary.folder }] : []),
        ...(dictionary.tag || "").split(/[,，;；\s]+/).filter(Boolean).map(value => ({ kind: "tag" as const, value })),
    ];
    const unique = new Map<string, DictionarySource>();
    for (const source of sources) {
        const value = source.kind === "tag" ? source.value.trim().replace(/^#/, "").toLowerCase() : sourcePath(source.value);
        if (value)
            unique.set(`${source.kind}:${value}`, { kind: source.kind, value });
    }
    return [...unique.values()];
}
export const dictionaryId = (dictionary: DictionarySetting): string => dictionary.id || dictionarySources(dictionary).map(sourceKey).join("|");
export const dictionaryName = (dictionary: DictionarySetting): string => dictionary.name?.trim() || dictionarySources(dictionary).map(sourceLabel).join(" + ");

/** Direct sources can be checked against one file without constructing a vault snapshot. */
export function dictionarySourceScore(source: DictionarySource, filePath: string, tags?: Set<string>): number {
    const path = filePath.normalize("NFC");
    if (source.kind === "file") return path === source.value ? 100000 : 0;
    if (source.kind === "folder") return path.startsWith(`${source.value}/`) ? source.value.length : 0;
    if (source.kind === "tag") return tags?.has(source.value) ? 10000 : 0;
    return 0;
}

/** Keep collection identity while Obsidian moves a source or one of its parents. */
export function renameDictionaryPaths(dictionaries: DictionarySetting[], before: string, after: string): boolean {
    const oldPath = sourcePath(before), newPath = sourcePath(after);
    let changed = false;
    const rename = (value: string): string => {
        const normalized = sourcePath(value);
        if (normalized !== oldPath && !normalized.startsWith(`${oldPath}/`)) return value;
        changed = true;
        return newPath + normalized.slice(oldPath.length);
    };
    for (const row of dictionaries) {
        row.folder = rename(row.folder);
        row.template = rename(row.template);
        for (const source of row.sources || []) if (source.kind !== "tag") source.value = rename(source.value);
    }
    return changed;
}
export function linkedMarkdownFiles(app: App, sourcePath: string): TFile[] {
    const source = app.vault.getFileByPath(sourcePath);
    if (!source)
        return [];
    const files = new Map<string, TFile>();
    for (const link of app.metadataCache.getFileCache(source)?.links || []) {
        const file = app.metadataCache.getFirstLinkpathDest(link.link, source.path);
        if (file?.extension === "md" && file.path !== source.path)
            files.set(file.path, file);
    }
    return [...files.values()];
}
/** Metadata-only membership snapshot shared by review, highlighting and grouping. */
export function resolveDictionaries(app: App, dictionaries: DictionarySetting[], getTags: (file: TFile) => Set<string>, files = app.vault.getMarkdownFiles()) {
    const paths = new Map<string, Set<string>>();
    const specificity = new Map<DictionarySetting, Map<string, number>>();
    const byFile = new Map<string, DictionarySetting[]>();
    const tags = new Map<string, Set<string>>();
    for (const dictionary of dictionaries) {
        const included = new Set<string>();
        const scores = new Map<string, number>();
        const include = (path: string, score: number) => { included.add(path); scores.set(path, Math.max(scores.get(path) || 0, score)); };
        for (const source of dictionarySources(dictionary)) {
            if (source.kind === "links")
                for (const file of linkedMarkdownFiles(app, source.value))
                    include(file.path, 50000);
            else
                for (const file of files) {
                    if (source.kind === "tag" && !tags.has(file.path))
                        tags.set(file.path, getTags(file));
                    const score = dictionarySourceScore(source, file.path, tags.get(file.path));
                    if (score) include(file.path, score);
                }
        }
        paths.set(dictionaryId(dictionary), included);
        specificity.set(dictionary, scores);
        for (const path of included) {
            const rows = byFile.get(path) || [];
            rows.push(dictionary);
            byFile.set(path, rows);
        }
    }
    return { paths, byFile, specificity, files };
}

/** Enabled memberships form a union; the most specific enabled source supplies style. */
export function preferredDictionary(snapshot: ReturnType<typeof resolveDictionaries>, path: string): DictionarySetting | null {
    const matches = snapshot.byFile.get(path) || [];
    const enabled = matches.filter(row => row.highlight !== false);
    let best: DictionarySetting | null = null, score = -1;
    for (const row of enabled.length ? enabled : matches) {
        const candidate = snapshot.specificity.get(row)?.get(path) || 0;
        if (candidate > score) { best = row; score = candidate; }
    }
    return best;
}
