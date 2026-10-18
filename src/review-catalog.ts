import { TFile, type App, type EventRef } from "obsidian";
import { parseSyntaxCards, type FlashcardTemplates, type ParsedSyntaxCard } from "./flashcard-syntax";
import type { LexisSettings } from "./types";

export interface ListedReviewCard {
  key: string;
  file: TFile;
  label: string;
  type: "note" | "syntax";
  line?: number;
  headingPath?: string[];
  syntax?: ParsedSyntaxCard;
}
interface CatalogHost {
  app: App;
  settings: LexisSettings;
  isVocabFile(file: TFile): boolean;
  isInlineSourceFile?(file: TFile): boolean;
  saveSettings(): Promise<void>;
  registerEvent(event: EventRef): void;
  register(cleanup: () => void): void;
}

export function rememberReviewCards(settings: LexisSettings, cards: ListedReviewCard[], baseline: boolean, at = new Date().toISOString()): boolean {
  let changed = false;
  for (const card of cards) {
    if (settings.reviewCardMeta[card.key]) continue;
    settings.reviewCardMeta[card.key] = { filePath: card.file.path, discoveredAt: baseline ? null : at };
    changed = true;
  }
  return changed;
}

export class ReviewCatalog {
  private parsed = new Map<string, ParsedSyntaxCard[]>();
  private keysByPath = new Map<string, Set<string>>();
  private pending: Promise<void> = Promise.resolve();
  private started = false;
  private disposed = false;
  private signature = "";
  private scanTask: Promise<void> | null = null;
  private queuedUpdates = new Set<TFile>();
  private failedPaths = new Set<string>();
  private needsReconcile = false;
  private dirty = false;
  private saving: Promise<void> | null = null;
  private saveTimer: number | null = null;

  constructor(private readonly host: CatalogHost) {}

  private templates(): FlashcardTemplates {
    const s = this.host.settings;
    return { inline: s.flashcardInlineTemplate, bidirectional: s.flashcardBidirectionalTemplate, block: s.flashcardBlockTemplate, cloze: s.flashcardClozeTemplate };
  }

  private parseOptions(file: TFile): { inlineEntryDelimiter?: string } {
    return this.host.isInlineSourceFile?.(file) ? { inlineEntryDelimiter: this.host.settings.inlineEntryDelimiter } : {};
  }

  private parsingSignature(): string {
    const s = this.host.settings;
    return JSON.stringify({ templates: this.templates(), inlineEntriesEnabled: s.inlineEntriesEnabled, inlineEntryDelimiter: s.inlineEntryDelimiter });
  }

  // Watching must not read note bodies: metadata emits many changes while a vault opens.
  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    for (const [key, meta] of Object.entries(this.host.settings.reviewCardMeta)) {
      const keys = this.keysByPath.get(meta.filePath) || new Set<string>();
      keys.add(key); this.keysByPath.set(meta.filePath, keys);
    }
    this.host.registerEvent(this.host.app.metadataCache.on("changed", (file) => {
      if (this.signature || this.scanTask !== null) this.queueUpdate(file);
    }));
    this.host.registerEvent(this.host.app.vault.on("delete", (file) => {
      void this.enqueue(async () => {
        let changed = false;
        for (const path of this.keysByPath.keys()) {
          if (path === file.path || path.startsWith(`${file.path}/`)) changed = this.removeFile(path) || changed;
        }
        if (changed) this.scheduleSave();
      });
    }));
    this.host.registerEvent(this.host.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile) void this.enqueue(() => this.rename(file, oldPath));
      else void this.enqueue(async () => {
        for (const path of new Set([...this.parsed.keys(), ...this.keysByPath.keys()])) {
          if (!path.startsWith(`${oldPath}/`)) continue;
          const current = this.host.app.vault.getFileByPath(file.path + path.slice(oldPath.length));
          if (current) await this.rename(current, path);
        }
      });
    }));
    this.host.register(() => {
      this.disposed = true;
      if (this.saveTimer) window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      if (this.dirty) void this.persist().catch((error) => console.warn("[Lexis] Cannot save card discovery", error));
      this.parsed.clear();
      this.keysByPath.clear();
      this.queuedUpdates.clear();
      this.failedPaths.clear();
    });
  }

  private enqueue(task: () => Promise<unknown>): Promise<void> {
    const work = this.pending.then(async () => { if (!this.disposed) await task(); });
    this.pending = work.catch((error) => console.warn("[Lexis] Card catalog update failed", error));
    return work;
  }

  private queueUpdate(file: TFile): void {
    if (this.disposed || this.queuedUpdates.has(file)) return;
    this.queuedUpdates.add(file);
    void this.enqueue(async () => {
      this.queuedUpdates.delete(file);
      await this.update(file);
    });
  }

  private async settle(): Promise<void> {
    let pending: Promise<void>;
    do { pending = this.pending; await pending; } while (pending !== this.pending);
  }

  private async ensureLoaded(): Promise<void> {
    this.start();
    for (const path of this.failedPaths) {
      const file = this.host.app.vault.getFileByPath(path);
      if (file) this.queueUpdate(file);
      else this.failedPaths.delete(path);
    }
    do {
      if (!this.disposed && this.scanTask === null && this.signature !== this.parsingSignature()) {
        if (this.saveTimer) window.clearTimeout(this.saveTimer);
        this.saveTimer = null;
        this.scanTask = this.enqueue(() => this.scan()).finally(() => {
          this.scanTask = null;
          if (this.dirty) this.scheduleSave();
        });
      }
      if (this.scanTask !== null) await this.scanTask;
      await this.settle();
    } while (!this.disposed && this.signature !== this.parsingSignature());
    // Apply queued renames/deletes before pruning, so a scan cannot erase their old keys.
    if (!this.disposed && this.needsReconcile && !this.failedPaths.size) this.reconcile();
  }

  async flush(): Promise<void> {
    await this.settle();
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    do { await this.persist(); } while (this.dirty || this.saving !== null);
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  private async persist(): Promise<void> {
    if (this.saving !== null) await this.saving;
    if (!this.dirty) return;
    this.dirty = false;
    this.saving = this.host.saveSettings();
    try { await this.saving; }
    catch (error) { this.dirty = true; throw error; }
    finally { this.saving = null; }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer || this.disposed || this.scanTask !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.persist().catch((error) => console.warn("[Lexis] Cannot save card discovery", error));
    }, 1000);
  }

  private async scan(): Promise<void> {
    const signature = this.parsingSignature();
    const files = this.host.app.vault.getMarkdownFiles();
    this.needsReconcile = false;
    // Only an explicit card-list request reaches here; keep the first scan responsive.
    for (let index = 0; index < files.length && !this.disposed; index += 16) {
      await Promise.all(files.slice(index, index + 16).map((file) => this.update(file)));
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
    if (this.disposed) return;
    this.signature = signature;
    this.needsReconcile = true;
  }

  private reconcile(): void {
    const paths = new Set(this.host.app.vault.getMarkdownFiles().map((file) => file.path));
    for (const path of new Set([...this.parsed.keys(), ...this.keysByPath.keys()])) {
      if (!paths.has(path) && this.removeFile(path)) this.scheduleSave();
    }
    const syntaxKeys = new Set([...this.parsed.values()].flatMap((cards) => cards.map((card) => `syntax:${card.id}`)));
    for (const key of Object.keys(this.host.settings.reviewPriorities)) {
      if (key.startsWith("syntax:") ? syntaxKeys.has(key) : paths.has(key)) continue;
      delete this.host.settings.reviewPriorities[key];
      this.scheduleSave();
    }
    if (!this.host.settings.reviewCatalogInitialized) {
      this.host.settings.reviewCatalogInitialized = true;
      this.scheduleSave();
    }
    this.needsReconcile = false;
  }

  private fileCards(file: TFile): ListedReviewCard[] {
    const cards: ListedReviewCard[] = (this.parsed.get(file.path) || []).map((syntax) => ({
      key: `syntax:${syntax.id}`, file, label: syntax.front, type: "syntax", line: syntax.line, headingPath: syntax.headingPath, syntax,
    }));
    if (this.host.isVocabFile(file)) cards.unshift({ key: file.path, file, label: file.basename, type: "note" });
    return cards;
  }

  private async update(file: TFile, markdown?: string): Promise<boolean> {
    if (file.extension !== "md" || this.disposed) return true;
    if (this.host.app.vault.getFileByPath(file.path) !== file) return true;
    try { markdown ??= await this.host.app.vault.cachedRead(file); }
    catch (error) {
      if (this.disposed) return false;
      this.failedPaths.add(file.path);
      console.warn("[Lexis] Cannot index review cards", file.path, error);
      return false;
    }
    if (this.disposed || this.host.app.vault.getFileByPath(file.path) !== file) return true;
    this.failedPaths.delete(file.path);
    this.parsed.set(file.path, parseSyntaxCards(markdown, file.path, this.templates(), this.parseOptions(file)));
    const cards = this.fileCards(file);
    const keys = new Set(cards.map((card) => card.key));
    let changed = rememberReviewCards(this.host.settings, cards, !this.host.settings.reviewCatalogInitialized);
    for (const key of this.keysByPath.get(file.path) || []) {
      if (keys.has(key)) continue;
      delete this.host.settings.reviewCardMeta[key];
      delete this.host.settings.reviewPriorities[key];
      changed = true;
    }
    this.keysByPath.set(file.path, keys);
    if (changed) this.scheduleSave();
    return true;
  }

  private removeFile(path: string): boolean {
    this.parsed.delete(path);
    this.failedPaths.delete(path);
    let changed = false;
    for (const key of new Set([path, ...this.keysByPath.get(path) || []])) {
      if (key in this.host.settings.reviewCardMeta || key in this.host.settings.reviewPriorities) changed = true;
      delete this.host.settings.reviewCardMeta[key];
      delete this.host.settings.reviewPriorities[key];
    }
    this.keysByPath.delete(path);
    return changed;
  }

  private async rename(file: TFile, oldPath: string): Promise<void> {
    if (this.disposed) return;
    if (file.extension !== "md") { if (this.removeFile(oldPath)) this.scheduleSave(); return; }
    if (!this.signature && this.scanTask === null && !this.keysByPath.has(oldPath)) return;
    const markdown = await this.host.app.vault.cachedRead(file);
    if (this.disposed) return;
    const previous = this.parsed.get(oldPath) || parseSyntaxCards(markdown, oldPath, this.templates(), this.parseOptions(file));
    const current = parseSyntaxCards(markdown, file.path, this.templates(), this.parseOptions(file));
    const pairs = [[oldPath, file.path], ...previous.flatMap((before, index) => {
      const after = current[index];
      return after && before.kind === after.kind && before.front === after.front && before.back === after.back
        ? [[`syntax:${before.id}`, `syntax:${after.id}`]] : [];
    })];
    for (const [oldKey, newKey] of pairs) {
      const s = this.host.settings;
      if (s.reviewCardMeta[oldKey]) { s.reviewCardMeta[newKey] = { ...s.reviewCardMeta[oldKey], filePath: file.path }; delete s.reviewCardMeta[oldKey]; }
      if (s.reviewPriorities[oldKey]) { s.reviewPriorities[newKey] = s.reviewPriorities[oldKey]; delete s.reviewPriorities[oldKey]; }
      const oldSuspended = oldKey.startsWith("syntax:") ? oldKey : `note:${oldKey}`;
      const newSuspended = newKey.startsWith("syntax:") ? newKey : `note:${newKey}`;
      if (s.suspendedReviewItems?.[oldSuspended]) { s.suspendedReviewItems[newSuspended] = true; delete s.suspendedReviewItems[oldSuspended]; }
    }
    this.removeFile(oldPath);
    await this.update(file, markdown);
    this.scheduleSave();
  }

  async cards(): Promise<ListedReviewCard[]> {
    await this.ensureLoaded();
    if (this.disposed) return [];
    const cards = this.host.app.vault.getMarkdownFiles().flatMap((file) => this.fileCards(file));
    if (rememberReviewCards(this.host.settings, cards, !this.host.settings.reviewCatalogInitialized)) this.scheduleSave();
    for (const card of cards) {
      const keys = this.keysByPath.get(card.file.path) || new Set<string>();
      keys.add(card.key); this.keysByPath.set(card.file.path, keys);
    }
    return cards;
  }
}
