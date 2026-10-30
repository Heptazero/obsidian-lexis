import type { App, TFile } from "obsidian";
import { parseSyntaxCards, type FlashcardTemplates, type ParsedSyntaxCard } from "./flashcard-syntax";
import { noteSuspensionKey, syntaxSuspensionKey, restrictReviewItem, reviewItemKeys, reviewGroupState } from "./review-item";
import type { LexisSettings, ReviewCardState, ReviewItem, ReviewOptions, ReviewSortKey, SuspendedReviewEntry } from "./types";
import { orderByReviewPriority } from "./review-priority";
import { linkedMarkdownFiles, resolveDictionaries } from "./dictionary-sources";
import { renamePracticeKey, takeReviewBatch } from "./review-batch";

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
  isInlineSourceFile?(file: TFile): boolean;
  readCard(file: TFile): ReviewCardState;
  readSyntaxCardState(id: string): ReviewCardState;
  freqVal(file: TFile): number;
  saveSettings(): Promise<void>;
}

const isFresh = (card: ReviewCardState): boolean => card.s == null || Number.isNaN(Number(card.s));

const reviewedToday = (card: ReviewCardState, today: string): boolean => {
  const latest = card.history?.[card.history.length - 1];
  return latest?.date === today && latest.grade !== 1;
};

const syntaxTemplates = (settings: LexisSettings): FlashcardTemplates => ({
  inline: settings.flashcardInlineTemplate,
  bidirectional: settings.flashcardBidirectionalTemplate,
  block: settings.flashcardBlockTemplate,
  cloze: settings.flashcardClozeTemplate,
});

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
    declare isInlineSourceFile: (file: TFile) => boolean;
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

    async collectSuspendedReviewItems(): Promise<SuspendedReviewEntry[]> {
      const suspended = Object.entries(this.settings.suspendedReviewItems || {}).filter(([, enabled]) => enabled);
      const syntaxKeys = new Set(suspended
        .filter(([key]) => key.startsWith("syntax:"))
        .map(([key]) => key.slice("syntax:".length)));
      const syntaxMatches = new Map<string, { file: TFile; card: ParsedSyntaxCard }>();
      if (syntaxKeys.size) {
        const templates = syntaxTemplates(this.settings);
        await Promise.all(this.app.vault.getMarkdownFiles().map(async (file) => {
          let markdown = "";
          try { markdown = await this.app.vault.cachedRead(file); } catch { return; }
          const options = this.isInlineSourceFile?.(file) ? { inlineEntryDelimiter: this.settings.inlineEntryDelimiter } : {};
          for (const card of parseSyntaxCards(markdown, file.path, templates, options)) {
            if (syntaxKeys.has(card.id)) syntaxMatches.set(card.id, { file, card });
          }
        }));
      }

      const entries: SuspendedReviewEntry[] = [];
      for (const [key] of suspended) {
        if (key.startsWith("note:")) {
          const file = this.app.vault.getFileByPath(key.slice("note:".length));
          if (file?.extension === "md") entries.push({ key, type: "note", file, label: file.basename });
          continue;
        }
        if (key.startsWith("syntax:")) {
          const match = syntaxMatches.get(key.slice("syntax:".length));
          if (match) entries.push({
            key,
            type: "syntax",
            file: match.file,
            label: `${match.file.basename} · ${match.card.front}`,
            line: match.card.line,
          });
        }
      }
      return entries.sort((left, right) => left.file.path.localeCompare(right.file.path)
        || (left.line ?? -1) - (right.line ?? -1)
        || left.label.localeCompare(right.label));
    }

    directLinkedFiles(sourcePath: string): TFile[] {
      return linkedMarkdownFiles(this.app, sourcePath);
    }

    reviewScopeFiles(options: ReviewOptions): TFile[] {
      if (options.dictionaryIds !== undefined) {
        const membership = resolveDictionaries(this.app, this.settings.dicts || [], file => this.getTags(file));
        const ids = options.dictionaryIds === null ? [...membership.paths.keys()] : options.dictionaryIds;
        const included = new Set(ids.flatMap(id => [...(membership.paths.get(id) || [])]));
        return membership.files.filter(file => included.has(file.path) && !this.readLifecycle(file).archived && !this.readLifecycle(file).retired);
      }
      if (options.sources) {
        const files = new Map<string, TFile>();
        for (const source of options.sources) {
          for (const file of this.reviewScopeFiles({ scope: source.scope === "file" ? "current" : source.scope, file: source.value, folder: source.value, linkSource: source.value, tag: source.value })) files.set(file.path, file);
        }
        return [...files.values()];
      }
      const scope = options.scope || "vocab";
      const current = scope === "current" ? this.app.vault.getFileByPath(options.file || "") : null;
      let files = scope === "current" ? (current?.extension === "md" ? [current] : []) : this.app.vault.getMarkdownFiles();
      if (scope === "vocab") {
        files = files.filter((file) => this.inVocabFolder(file.path));
        const dictionary = this.normalizeFolder(options.folder || "");
        if (dictionary) files = files.filter((file) => this.inScope(file.path, [dictionary]));
      }
      if (scope === "folder") {
        const folder = this.normalizeFolder(options.folder || "");
        if (folder) files = files.filter((file) => this.inScope(file.path, [folder]));
      }
      if (scope === "links") files = this.directLinkedFiles(options.linkSource || "");
      if (scope === "tag") {
        const tag = String(options.tag || "").toLowerCase().replace(/^#/, "");
        files = tag ? files.filter((file) => this.getTags(file).has(tag)) : [];
      }
      return files.filter((file) => {
        const lifecycle = this.readLifecycle(file);
        return !lifecycle.archived && !lifecycle.retired;
      });
    }

    syntaxItems(file: TFile, cards: ParsedSyntaxCard[], today: string, includeReviewed = false): ReviewItem[] {
      const result: ReviewItem[] = [];
      const combinedGroups = new Map<string, ParsedSyntaxCard[]>();
      for (const syntax of cards) {
        const card = this.readSyntaxCardState(syntax.id);
        if (this.settings.suspendedReviewItems?.[syntaxSuspensionKey(syntax.id)] || (!includeReviewed && reviewedToday(card, today))) continue;
        if (syntax.kind === "cloze") {
          const group = combinedGroups.get(syntax.groupId) || [];
          group.push(syntax);
          combinedGroups.set(syntax.groupId, group);
          continue;
        }
        result.push({
          type: "syntax",
          file,
          card,
          syntax: { id: syntax.id, memberIds: [syntax.id], kind: syntax.kind, front: syntax.front, back: syntax.back, line: syntax.line, headingPath: syntax.headingPath },
        });
      }
      for (const group of combinedGroups.values()) {
        const first = group[0];
        const members = group.map((syntax) => ({ id: syntax.id, front: syntax.front, answer: syntax.clozeAnswer, clozeIndex: syntax.clozeIndex, card: this.readSyntaxCardState(syntax.id) }));
        result.push({
          type: "syntax",
          file,
          card: reviewGroupState(members.map((member) => member.card)),
          syntax: {
            id: first.groupId,
            headingPath: first.headingPath,
            memberIds: members.map((member) => member.id),
            members,
            kind: "cloze",
            front: members[0].front,
            combinedFront: first.combinedFront || first.front,
            clozeAnswer: first.clozeAnswer,
            clozeIndex: first.clozeIndex,
            back: first.back,
            line: first.line,
          },
        });
      }
      return result;
    }

    async migrateSyntaxCardPath(file: TFile, oldPath: string): Promise<void> {
      if (file.extension !== "md" || !oldPath.toLowerCase().endsWith(".md")) return;
      let markdown = "";
      try { markdown = await this.app.vault.cachedRead(file); } catch { return; }
      const templates = syntaxTemplates(this.settings);
      const options = this.isInlineSourceFile?.(file) ? { inlineEntryDelimiter: this.settings.inlineEntryDelimiter } : {};
      const previous = parseSyntaxCards(markdown, oldPath, templates, options);
      const current = parseSyntaxCards(markdown, file.path, templates, options);
      let changed = renamePracticeKey(this.settings,oldPath,file.path);
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
        const oldKey = `syntax:${before.id}`;
        const newKey = `syntax:${after.id}`;
        changed = renamePracticeKey(this.settings,oldKey,newKey) || changed;
        for (const event of this.settings.reviewEvents) {
          if (!event.memberKeys.includes(oldKey)) continue;
          event.memberKeys = event.memberKeys.map((key) => key === oldKey ? newKey : key);
          event.filePath = file.path;
          changed = true;
        }
      }
      if (changed) await this.saveSettings();
    }

    async collectReviewItems(options: ReviewOptions = {}, includeReviewed = false): Promise<ReviewItem[]> {
      const resolved = options || {};
      const content = resolved.content || "notes";
      const files = this.reviewScopeFiles(resolved);
      const today = todayStr();
      const markdownByPath = new Map<string, string>();
      if (content === "syntax" || content === "both") {
        await Promise.all(files.map(async (file) => {
          try { markdownByPath.set(file.path, await this.app.vault.cachedRead(file)); }
          catch { markdownByPath.set(file.path, ""); }
        }));
      }
      const candidates: ReviewItem[] = [];
      if (content === "notes" || content === "context" || content === "both") {
        for (const file of files) {
          const card = this.readCard(file);
          if (!this.settings.suspendedReviewItems?.[noteSuspensionKey(file.path)] && (includeReviewed || !reviewedToday(card, today))) {
            candidates.push({ type: "note", file, card });
          }
        }
      }
      if (content === "syntax" || content === "both") {
        const templates = syntaxTemplates(this.settings);
        const parsed = files.map((file) => {
          const options = this.isInlineSourceFile?.(file) ? { inlineEntryDelimiter: this.settings.inlineEntryDelimiter } : {};
          return this.syntaxItems(file, parseSyntaxCards(markdownByPath.get(file.path) || "", file.path, templates, options), today, includeReviewed);
        });
        for (const items of parsed) candidates.push(...items);
      }
      return candidates;
    }

    async buildQueue(options: ReviewOptions = {}): Promise<ReviewItem[]> {
      const resolved = options || {};
      const sortBy = resolved.sortBy || "due";
      const direction = resolved.sortDirection === "desc" ? -1 : 1;
      const today = todayStr();
      const practice = resolved.mode === "cram";
      let candidates = await this.collectReviewItems(resolved, practice);
      if (resolved.excludedKeys?.length) {
        const excluded = new Set(resolved.excludedKeys);
        candidates = candidates.map(item => restrictReviewItem(item, new Set(reviewItemKeys(item).filter(key => !excluded.has(key))))).filter((item): item is ReviewItem => !!item);
      }
      if (resolved.targetKeys) {
        const allowed = new Set(resolved.targetKeys);
        candidates = candidates.map((item) => restrictReviewItem(item, allowed)).filter((item): item is ReviewItem => !!item);
      }
      const markdownByPath = new Map<string, string>();
      if (sortBy === "wordCount") await Promise.all([...new Map(candidates.map((item) => [item.file.path, item.file])).values()].map(async (file) => {
        try { markdownByPath.set(file.path, await this.app.vault.cachedRead(file)); }
        catch { markdownByPath.set(file.path, ""); }
      }));

      const due = candidates.filter((item) => !isFresh(item.card) && (!item.card.due || String(item.card.due).slice(0, 10) <= today));
      const fresh = candidates.filter((item) => isFresh(item.card));
      let queue = practice ? candidates : due.concat(fresh);
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
      queue = orderByReviewPriority(queue, this.settings.reviewPriorities);
      let admittedFresh = 0;
      if (!practice) queue = queue.filter((item) => !isFresh(item.card) || admittedFresh++ < newLimit);
      if (resolved.dailyCardLimit != null) {
        let left = Math.max(0, resolved.dailyCardLimit);
        queue = queue.map((item) => {
          const keys = reviewItemKeys(item).slice(0, left);
          left -= keys.length;
          return restrictReviewItem(item, new Set(keys));
        }).filter((item): item is ReviewItem => !!item);
      }
      if (resolved.batchSize !== undefined) return takeReviewBatch(queue, resolved.batchSize).selected;
      return practice ? queue : queue.slice(0, this.settings.maxReviewsPerSession || 200);
    }
  }

  const descriptors = Object.getOwnPropertyDescriptors(ReviewQueue.prototype);
  delete descriptors.constructor;
  return descriptors;
}
