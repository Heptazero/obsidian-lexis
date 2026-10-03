"use strict";

import type { App, Notice as ObsidianNotice, TFile } from "obsidian";
import type { OccurrenceSearch } from "./occurrence-search";
import type { InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats } from "./types";
import { parseInlineEntries } from "./inline-entry-parser";

type TranslationVars = Record<string, string | number | boolean>;

interface HighlightIndexDependencies {
  Notice: typeof ObsidianNotice;
  boundedSource: (value: string) => string;
  compactMixedScriptSpacing: (value: string) => string;
  todayStr: () => string;
}

function createHighlightIndex({ Notice, boundedSource, compactMixedScriptSpacing, todayStr }: HighlightIndexDependencies): PropertyDescriptorMap {
  class HighlightIndex {
    declare app: App;
    declare settings: LexisSettings;
    declare index: Map<string, LexisEntry>;
    declare stats: LexisStats;
    declare inlineCategoryOccurrences: InlineCategoryOccurrence[];
    declare inlineCategories: { name: string; count: number }[];
    declare vocabPaths: Set<string>;
    declare inlineSourcePaths: Set<string>;
    declare _selfKeysByPath: Map<string, Set<string>>;
    declare _occCache: Map<string, unknown>;
    declare _indexBuildId: number;
    declare _rebuildTimer: number;
    declare _pattern: string | null;
    declare _indexKeysByCompact: Map<string, string>;
    declare _matchKeysByCompact: Map<string, string>;
    declare statusBarEl: HTMLElement | null;
    declare bridge: { running: boolean } | null;
    declare occurrenceSearch: OccurrenceSearch;
    declare saveSettings: () => Promise<void>;
    declare isVocabFile: (file: TFile | null | undefined) => boolean;
    declare inFolderScope: (path: string) => boolean;
    declare excludeTagSet: () => Set<string>;
    declare dictFolders: () => string[];
    declare vocabTagSet: () => Set<string>;
    declare t: (key: string, vars?: TranslationVars) => string;
    declare refreshAllViews: () => void;

    normalizeFolder(path: string): string { return (path || "").trim().replace(/^\/+|\/+$/g, ""); }
    inVocabFolder(path: string): boolean { return this.vocabPaths ? this.vocabPaths.has(path) : false; }
    selfKeysFor(path: string): Set<string> | null { return (this._selfKeysByPath && this._selfKeysByPath.get(path)) || null; }

    maybeRebuild(file: TFile | null, oldPath?: string) {
      const path = file?.path || "";
      this._occCache.clear();
      if (file?.extension === "pdf") this.occurrenceSearch?.invalidatePdf(file.path);
      if (oldPath && /\.pdf$/i.test(oldPath)) this.occurrenceSearch?.invalidatePdf(oldPath);
      if (oldPath && path) {
        let reviewChanged = false;
        if (this.settings.reviewHistory?.[oldPath]) {
          this.settings.reviewHistory[path] = this.settings.reviewHistory[oldPath];
          delete this.settings.reviewHistory[oldPath];
          reviewChanged = true;
        }
        if (this.settings.reviewAddedAt?.[oldPath]) {
          this.settings.reviewAddedAt[path] = this.settings.reviewAddedAt[oldPath];
          delete this.settings.reviewAddedAt[oldPath];
          reviewChanged = true;
        }
        for (const event of this.settings.reviewEvents || []) {
          if (event.filePath === oldPath) { event.filePath = path; reviewChanged = true; }
          if (event.type === "note" && event.memberKeys.includes(oldPath)) {
            event.memberKeys = event.memberKeys.map((key) => key === oldPath ? path : key);
            event.label = file?.basename || event.label;
            reviewChanged = true;
          }
        }
        if (reviewChanged) void this.saveSettings();
      }
      if (this.isVocabFile(file) || this.vocabPaths.has(path) || this.isInlineSourceFile(file) || this.inlineSourcePaths?.has(path) || (oldPath && (this.inFolderScope(oldPath) || this.vocabPaths.has(oldPath) || this.inlineSourcePaths?.has(oldPath)))) this.scheduleRebuild();
    }

    scheduleRebuild() {
      window.clearTimeout(this._rebuildTimer);
      this._rebuildTimer = window.setTimeout(() => { void this.rebuildIndex(false); }, 800);
    }

    inlineDelimiter() { return String(this.settings.inlineEntryDelimiter || "::").trim() || "::"; }
    inlineAliasDelimiter() { return String(this.settings.inlineAliasDelimiter || "/").trim() || "/"; }

    isInlineSourceFile(file: TFile | null | undefined): boolean {
      if (!this.settings.inlineEntriesEnabled || !file?.path) return false;
      const frontmatter = (this.app.metadataCache.getFileCache(file)?.frontmatter || {}) as Record<string, unknown>;
      const marker = frontmatter["lexis-inline"];
      if (marker === true || marker === 1 || (typeof marker === "string" && /^(true|yes|1)$/i.test(marker))) return true;
      return this.getTags(file).has("lexis-inline");
    }

    parseInlineEntries(content: string, file: TFile): LexisEntry[] {
      return parseInlineEntries(content, file, {
        entryDelimiter: this.inlineDelimiter(),
        aliasDelimiter: this.inlineAliasDelimiter(),
      });
    }

    extractAliases(file: TFile): string[] {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
      if (!frontmatter) return [];
      const extra = (this.settings.aliasSources || "").split(/[,，\s]+/).map((value) => value.trim()).filter(Boolean);
      const sources = [...new Set(["aliases", "alias", ...extra])];
      const seen = new Set<string>();
      const results: string[] = [];
      for (const source of sources) {
        const raw = frontmatter[source];
        if (raw == null || raw === "") continue;
        const values: unknown[] = typeof raw === "string" ? raw.split(/[,，;；]/) : Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
          const alias = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
          if (!alias || alias.toLowerCase() === "null" || seen.has(alias)) continue;
          seen.add(alias);
          results.push(alias);
        }
      }
      return results;
    }

    getTags(file: TFile): Set<string> {
      const cache = this.app.metadataCache.getFileCache(file);
      const tags = new Set<string>();
      const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
      if (frontmatter) {
        const raw = frontmatter.tags ?? frontmatter.tag ?? [];
        const values: unknown[] = typeof raw === "string" ? raw.split(/[,，;；\s]+/) : Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
          const tag = typeof value === "string" || typeof value === "number" ? String(value).trim().replace(/^#/, "") : "";
          if (tag && tag.toLowerCase() !== "null") tags.add(tag.toLowerCase());
        }
      }
      if (cache?.tags) for (const item of cache.tags) {
        const tag = (item.tag || "").replace(/^#/, "");
        if (tag) tags.add(tag.toLowerCase());
      }
      return tags;
    }

    async rebuildIndex(notify: boolean): Promise<LexisStats> {
      const buildId = (this._indexBuildId || 0) + 1;
      this._indexBuildId = buildId;
      const index = new Map<string, LexisEntry>();
      const selfKeysByPath = new Map<string, Set<string>>();
      const today = todayStr();
      let words = 0, aliases = 0, inlineEntries = 0, due = 0;
      const categoryOccurrences = new Map<string, InlineCategoryOccurrence>();
      const files = this.app.vault.getMarkdownFiles().filter((file) => this.isVocabFile(file));
      const vocabPaths = new Set(files.map((file) => file.path));
      for (const file of files) {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
        const tags = this.getTags(file);
        const display = file.basename;
        const key = display.toLowerCase();
        const own = new Set([key]);
        const archived = frontmatter["lexis-status"] === "archived";
        const retired = frontmatter["lexis-status"] === "retired";
        const pinned = !!frontmatter["lexis-pinned"];
        const stability = Number(frontmatter["lexis-s"]);
        const cardS = frontmatter["lexis-s"] == null || isNaN(stability) ? null : stability;
        if (!index.has(key)) { index.set(key, { display, file, isAlias: false, tags, archived, retired, pinned, cardS }); words++; }
        if (this.settings.includeAliases) for (const alias of this.extractAliases(file)) {
          const aliasKey = alias.toLowerCase();
          own.add(aliasKey);
          if (!index.has(aliasKey)) { index.set(aliasKey, { display: alias, file, isAlias: true, tags, archived, retired, pinned, cardS }); aliases++; }
        }
        selfKeysByPath.set(file.path, own);
        if (!archived && !retired && (frontmatter["lexis-s"] == null || !frontmatter["lexis-due"] || String(frontmatter["lexis-due"]).slice(0, 10) <= today)) due++;
      }
      const inlineFiles = this.app.vault.getMarkdownFiles().filter((file) => this.isInlineSourceFile(file));
      const inlineSourcePaths = new Set(inlineFiles.map((file) => file.path));
      const parsed = await Promise.all(inlineFiles.map(async (file) => {
        try { return this.parseInlineEntries(await this.app.vault.cachedRead(file), file); }
        catch { return []; }
      }));
      if (buildId !== this._indexBuildId) return this.stats;
      for (const entries of parsed) {
        const own = new Set<string>();
        for (const entry of entries) {
          const key = entry.display.toLowerCase();
          own.add(key);
          const heading = (entry.headingPath || []).at(-1);
          if (heading) {
            const id = `${entry.file.path}::${heading.name}`;
            const node = categoryOccurrences.get(id) || { id, name: heading.name, level: heading.level, line: heading.line, file: entry.file, count: 0 };
            node.count++;
            categoryOccurrences.set(id, node);
          }
          if (!index.has(key)) { index.set(key, entry); inlineEntries++; }
          if (this.settings.includeAliases) for (const alias of entry.aliases || []) {
            const aliasKey = alias.toLowerCase();
            own.add(aliasKey);
            if (!index.has(aliasKey)) {
              index.set(aliasKey, { ...entry, display: alias, canonical: entry.display, isAlias: true });
              aliases++;
            }
          }
        }
        if (entries.length) selfKeysByPath.set(entries[0].file.path, own);
      }
      this.vocabPaths = vocabPaths;
      this.inlineSourcePaths = inlineSourcePaths;
      const legacyRank = new Map((this.settings.inlineCategoryOrder || []).map((name, rank) => [name, rank]));
      this.inlineCategoryOccurrences = [...categoryOccurrences.values()].sort((left, right) => {
        const leftRank = legacyRank.get(left.name) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = legacyRank.get(right.name) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || left.name.localeCompare(right.name) || left.file.path.localeCompare(right.file.path) || left.line - right.line;
      });
      const categories = new Map<string, { name: string; count: number }>();
      for (const node of this.inlineCategoryOccurrences) {
        const current = categories.get(node.name) || { name: node.name, count: 0 };
        current.count += node.count;
        categories.set(node.name, current);
      }
      this.inlineCategories = [...categories.values()].sort((left, right) => {
        const leftRank = legacyRank.get(left.name) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = legacyRank.get(right.name) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || left.name.localeCompare(right.name);
      });
      this.index = index;
      this._selfKeysByPath = selfKeysByPath;
      this.stats = { words, aliases, inlineEntries, due };
      this._occCache.clear();
      this.buildMatcher();
      this.updateStatusBar();
      this.refreshAllViews();
      if (notify) {
        const aliasPart = this.settings.includeAliases ? this.t("notice.aliasCount", { count: aliases }) : "";
        const folderCount = this.dictFolders().length;
        const tagCount = this.vocabTagSet().size;
        const scope = [folderCount ? this.t("notice.scopeFolders", { count: folderCount }) : "", tagCount ? this.t("notice.scopeTags", { count: tagCount }) : ""].filter(Boolean).join(" + ") || this.t("notice.scopeEmpty");
        const inlinePart = inlineEntries ? this.t("notice.inlineCount", { count: inlineEntries }) : "";
        new Notice(this.t("notice.indexBuilt", { scope, words, aliases: aliasPart, inline: inlinePart }));
      }
      return this.stats;
    }

    buildMatcher() {
      let keys = [...this.index.keys()].filter((key) => key.length >= 2 || [...key].some((character) => (character.codePointAt(0) || 0) > 127));
      const excluded = this.excludeTagSet();
      if (excluded.size) keys = keys.filter((key) => {
        const entry = this.index.get(key);
        return !(entry?.tags && [...entry.tags].some((tag) => excluded.has(tag)));
      });
      keys = keys.filter((key) => !this.index.get(key)?.retired);
      keys.sort((left, right) => right.length - left.length);
      this._indexKeysByCompact = new Map();
      for (const key of this.index.keys()) {
        this._indexKeysByCompact.set(key, key);
        const compact = compactMixedScriptSpacing(key);
        if (!this._indexKeysByCompact.has(compact)) this._indexKeysByCompact.set(compact, key);
      }
      this._matchKeysByCompact = new Map();
      for (const key of keys) {
        this._matchKeysByCompact.set(key, key);
        const compact = compactMixedScriptSpacing(key);
        if (!this._matchKeysByCompact.has(compact)) this._matchKeysByCompact.set(compact, key);
      }
      this._pattern = keys.length ? keys.map(boundedSource).join("|") : null;
    }

    resolveIndexKey(value: string): string {
      const key = String(value || "").toLowerCase();
      return this._indexKeysByCompact.get(key) || this._indexKeysByCompact.get(compactMixedScriptSpacing(key)) || key;
    }

    resolveMatchKey(value: string): string {
      const key = String(value || "").toLowerCase();
      return this._matchKeysByCompact.get(key) || this._matchKeysByCompact.get(compactMixedScriptSpacing(key)) || key;
    }

    updateStatusBar() {
      if (!this.statusBarEl) return;
      const aliasPart = this.settings.includeAliases && this.stats.aliases ? this.t("status.aliases", { count: this.stats.aliases }) : "";
      const inlinePart = this.stats.inlineEntries ? this.t("status.inline", { count: this.stats.inlineEntries }) : "";
      const duePart = this.stats.due ? ` · ⏰${this.stats.due}` : "";
      const bridgePart = this.bridge?.running ? " · 🌐" : "";
      this.statusBarEl.setText(this.t("status.summary", { words: this.stats.words, aliases: aliasPart, inline: inlinePart, due: duePart, bridge: bridgePart }));
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(HighlightIndex.prototype);
  return descriptors;
}

export { createHighlightIndex };
