import type { App, TFile } from "obsidian";
import { parseSyntaxCards, type FlashcardTemplates, type ParsedSyntaxCard } from "./flashcard-syntax";
import type { LexisSettings, ReviewCardState, ReviewItem, ReviewOptions, ReviewSortKey } from "./types";

interface ReviewQueueDependencies {
  todayStr: () => string;
}

interface ReviewQueueHost {
  app: App;
  settings: LexisSettings;
  inVocabFolder(path: string): boolean;
  readLifecycle(file: TFile): { archived: boolean; retired: boolean };
  normalizeFolder(folder: string): string;
  inScope(path: string, folders: string[]): boolean;
  getTags(file: TFile): Set<string>;
  readCard(file: TFile): ReviewCardState;
  readSyntaxCardState(id: string): ReviewCardState;
  freqVal(file: TFile): number;
  saveSettings(): Promise<void>;
}

const isFresh = (card: ReviewCardState): boolean => card.s == null || Number.isNaN(Number(card.s));

const syntaxTemplates = (settings: LexisSettings): FlashcardTemplates => ({
  inline: settings.flashcardInlineTemplate,
  bidirectional: settings.flashcardBidirectionalTemplate,
  block: settings.flashcardBlockTemplate,
  cloze: settings.flashcardClozeTemplate,
});

const representativeState = (states: ReviewCardState[]): ReviewCardState => {
  if (!states.length || states.some(isFresh)) return {};
  return [...states].sort((left, right) => String(left.due || "").localeCompare(String(right.due || "")))[0];
};

const stripFrontmatter = (markdown: string): string => markdown.replace(/^---\s*\n[\s\S]*?\n---(?:\n|$)/, "");

export const countNoteWords = (markdown: string): number => {
  const content = stripFrontmatter(markdown);
  const cjkPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const cjkCount = content.match(cjkPattern)?.length || 0;
  const otherWords = content.replace(cjkPattern, " ").match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)?.length || 0;
  return cjkCount + otherWords;
};

export function createReviewQueue({ todayStr }: ReviewQueueDependencies): PropertyDescriptorMap {
  class ReviewQueue {
    declare app: ReviewQueueHost["app"];
    declare settings: ReviewQueueHost["settings"];
    declare inVocabFolder: ReviewQueueHost["inVocabFolder"];
    declare readLifecycle: ReviewQueueHost["readLifecycle"];
    declare normalizeFolder: ReviewQueueHost["normalizeFolder"];
    declare inScope: ReviewQueueHost["inScope"];
    declare getTags: ReviewQueueHost["getTags"];
    declare readCard: ReviewQueueHost["readCard"];
    declare readSyntaxCardState: ReviewQueueHost["readSyntaxCardState"];
    declare freqVal: ReviewQueueHost["freqVal"];
    declare saveSettings: ReviewQueueHost["saveSettings"];

    collectReviewFolders(): string[] {
      const folders = new Set<string>();
      for (const file of this.app.vault.getMarkdownFiles()) {
        let path = file.path;
        for (let slash = path.lastIndexOf("/"); slash > 0; slash = path.lastIndexOf("/")) {
          path = path.slice(0, slash);
          folders.add(path);
        }
      }
      return [...folders].sort((left, right) => left.localeCompare(right));
    }

    collectReviewTags(): string[] {
      const tags = new Set<string>();
      for (const file of this.app.vault.getMarkdownFiles()) for (const tag of this.getTags(file)) tags.add(tag);
      return [...tags].sort((left, right) => left.localeCompare(right));
    }

    hubLinkedFiles(hubPath: string): TFile[] {
      const hub = this.app.vault.getFileByPath(hubPath);
      if (!hub) return [];
      const links = this.app.metadataCache.getFileCache(hub)?.links || [];
      const linked = new Map<string, TFile>();
      for (const link of links) {
        const file = this.app.metadataCache.getFirstLinkpathDest(link.link, hub.path);
        if (file?.extension === "md" && file.path !== hub.path) linked.set(file.path, file);
      }
      return [...linked.values()];
    }

    reviewScopeFiles(options: ReviewOptions): TFile[] {
      const scope = options.scope || "vocab";
      let files = this.app.vault.getMarkdownFiles();
      if (scope === "vocab") files = files.filter((file) => this.inVocabFolder(file.path));
      if (scope === "folder") {
        const folder = this.normalizeFolder(options.folder || "");
        if (folder) files = files.filter((file) => this.inScope(file.path, [folder]));
      }
      if (scope === "hub") files = this.hubLinkedFiles(options.hub || "");
      if (scope === "tag") {
        const tag = String(options.tag || "").toLowerCase().replace(/^#/, "");
        files = tag ? files.filter((file) => this.getTags(file).has(tag)) : [];
      }
      if (scope === "current") files = files.filter((file) => file.path === options.file);
      return files.filter((file) => {
        const lifecycle = this.readLifecycle(file);
        return !lifecycle.archived && !lifecycle.retired;
      });
    }

    syntaxItems(file: TFile, cards: ParsedSyntaxCard[], clozeMode: ReviewOptions["clozeMode"]): ReviewItem[] {
      const result: ReviewItem[] = [];
      const combinedGroups = new Map<string, ParsedSyntaxCard[]>();
      for (const syntax of cards) {
        if (syntax.kind === "cloze" && clozeMode === "combined") {
          const group = combinedGroups.get(syntax.groupId) || [];
          group.push(syntax);
          combinedGroups.set(syntax.groupId, group);
          continue;
        }
        result.push({
          type: "syntax",
          file,
          card: this.readSyntaxCardState(syntax.id),
          syntax: { id: syntax.id, memberIds: [syntax.id], kind: syntax.kind, front: syntax.front, back: syntax.back, line: syntax.line },
        });
      }
      for (const group of combinedGroups.values()) {
        const first = group[0];
        const memberIds = group.map((card) => card.id);
        result.push({
          type: "syntax",
          file,
          card: representativeState(memberIds.map((id) => this.readSyntaxCardState(id))),
          syntax: { id: first.groupId, memberIds, kind: "cloze", front: first.combinedFront || first.front, back: first.back, line: first.line },
        });
      }
      return result;
    }

    async migrateSyntaxCardPath(file: TFile, oldPath: string): Promise<void> {
      if (file.extension !== "md" || !oldPath.toLowerCase().endsWith(".md")) return;
      let markdown = "";
      try { markdown = await this.app.vault.cachedRead(file); } catch { return; }
      const templates = syntaxTemplates(this.settings);
      const previous = parseSyntaxCards(markdown, oldPath, templates);
      const current = parseSyntaxCards(markdown, file.path, templates);
      let changed = false;
      for (let index = 0; index < Math.min(previous.length, current.length); index++) {
        const before = previous[index], after = current[index];
        if (before.kind !== after.kind || before.front !== after.front || before.back !== after.back) continue;
        const state = this.settings.syntaxCardStates[before.id];
        if (state && !this.settings.syntaxCardStates[after.id]) {
          this.settings.syntaxCardStates[after.id] = state;
          delete this.settings.syntaxCardStates[before.id];
          changed = true;
        }
        const history = this.settings.reviewHistory[`syntax:${before.id}`];
        if (history && !this.settings.reviewHistory[`syntax:${after.id}`]) {
          this.settings.reviewHistory[`syntax:${after.id}`] = history;
          delete this.settings.reviewHistory[`syntax:${before.id}`];
          changed = true;
        }
      }
      if (changed) await this.saveSettings();
    }

    async buildQueue(options: ReviewOptions = {}): Promise<ReviewItem[]> {
      const resolved = options || {};
      const content = resolved.scope === "hub" ? "syntax" : resolved.content || "notes";
      const sortBy = resolved.sortBy || "due";
      const direction = resolved.sortDirection === "desc" ? -1 : 1;
      const files = this.reviewScopeFiles(resolved);
      const markdownByPath = new Map<string, string>();
      if (content !== "notes" || sortBy === "wordCount") {
        await Promise.all(files.map(async (file) => {
          try { markdownByPath.set(file.path, await this.app.vault.cachedRead(file)); }
          catch { markdownByPath.set(file.path, ""); }
        }));
      }
      const candidates: ReviewItem[] = [];
      if (content === "notes" || content === "both") {
        for (const file of files) candidates.push({ type: "note", file, card: this.readCard(file) });
      }
      if (content === "syntax" || content === "both") {
        const templates = syntaxTemplates(this.settings);
        const parsed = files.map((file) => this.syntaxItems(file, parseSyntaxCards(markdownByPath.get(file.path) || "", file.path, templates), resolved.clozeMode || "separate"));
        for (const items of parsed) candidates.push(...items);
      }

      const today = todayStr();
      const due = candidates.filter((item) => !isFresh(item.card) && (!item.card.due || String(item.card.due).slice(0, 10) <= today));
      const fresh = candidates.filter((item) => isFresh(item.card));
      let queue = due.concat(fresh);
      if (sortBy === "random") {
        for (let index = queue.length - 1; index > 0; index--) {
          const target = Math.floor(Math.random() * (index + 1));
          [queue[index], queue[target]] = [queue[target], queue[index]];
        }
      } else {
        const metric = (item: ReviewItem, key: Exclude<ReviewSortKey, "random">): number | string | null => {
          if (key === "due") return item.card.due ? String(item.card.due).slice(0, 10) : null;
          if (key === "wordCount") return countNoteWords(markdownByPath.get(item.file.path) || "");
          if (key === "modified") return item.file.stat.mtime;
          if (key === "created") return item.file.stat.ctime;
          const frequency = this.freqVal(item.file);
          return Number.isFinite(frequency) ? frequency : null;
        };
        const key = sortBy;
        queue.sort((left, right) => {
          const leftValue = metric(left, key), rightValue = metric(right, key);
          if (leftValue == null && rightValue == null) return left.file.path.localeCompare(right.file.path);
          if (leftValue == null) return 1;
          if (rightValue == null) return -1;
          const compared = typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue));
          return compared ? compared * direction : left.file.path.localeCompare(right.file.path);
        });
      }
      const newLimit = Math.max(0, this.settings.newPerDay ?? 20);
      let admittedFresh = 0;
      queue = queue.filter((item) => !isFresh(item.card) || admittedFresh++ < newLimit);
      return queue.slice(0, this.settings.maxReviewsPerSession || 200);
    }
  }

  const descriptors = Object.getOwnPropertyDescriptors(ReviewQueue.prototype);
  delete descriptors.constructor;
  return descriptors;
}
