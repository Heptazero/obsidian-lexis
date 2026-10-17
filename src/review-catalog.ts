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

  start(): Promise<void> {
    if (this.started) return this.pending;
    this.started = true;
    for (const [key, meta] of Object.entries(this.host.settings.reviewCardMeta)) {
      const keys = this.keysByPath.get(meta.filePath) || new Set<string>();
      keys.add(key); this.keysByPath.set(meta.filePath, keys);
    }
    this.host.registerEvent(this.host.app.metadataCache.on("changed", (file) => this.enqueue(() => this.update(file))));
    this.host.registerEvent(this.host.app.vault.on("delete", (file) => {
      this.enqueue(async () => {
        for (const path of this.keysByPath.keys()) if (path === file.path || path.startsWith(`${file.path}/`)) this.removeFile(path);
        this.scheduleSave();
      });
    }));
    this.host.registerEvent(this.host.app.vault.on("rename", (file, oldPath) => {
      if (file instanceof TFile) this.enqueue(() => this.rename(file, oldPath));
      else this.enqueue(async () => {
        for (const path of [...this.parsed.keys()]) {
          if (!path.startsWith(`${oldPath}/`)) continue;
          const current = this.host.app.vault.getFileByPath(file.path + path.slice(oldPath.length));
          if (current) await this.rename(current, path);
        }
      });
    }));
    this.host.register(() => {
      this.disposed = true;
      if (this.saveTimer) { window.clearTimeout(this.saveTimer); this.saveTimer = null; void this.host.saveSettings().catch((error) => console.warn("[Lexis] Cannot save card discovery", error)); }
      this.parsed.clear();
      this.keysByPath.clear();
    });
    this.enqueue(() => this.scan());
    return this.pending;
  }

  private enqueue(task: () => Promise<unknown>): void {
    this.pending = this.pending.then(async () => { if (!this.disposed) await task(); })
      .catch((error) => console.warn("[Lexis] Card catalog update failed", error));
  }

  async flush(): Promise<void> {
    await this.start();
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    await this.host.saveSettings();
  }

  private scheduleSave(): void {
    if (this.saveTimer || this.disposed) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.host.saveSettings().catch((error) => console.warn("[Lexis] Cannot save card discovery", error));
    }, 1000);
  }

  private async scan(): Promise<void> {
    this.signature = this.parsingSignature();
    const files = this.host.app.vault.getMarkdownFiles();
    const paths = new Set(files.map((file) => file.path));
    let complete = true;
    // Bound parallel reads; don't launch thousands of vault reads at startup.
    for (let index = 0; index < files.length && !this.disposed; index += 16) {
      const results = await Promise.all(files.slice(index, index + 16).map((file) => this.update(file)));
      if (results.some((result) => !result)) complete = false;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
    if (this.disposed) return;
    for (const path of this.parsed.keys()) if (!paths.has(path)) this.removeFile(path);
    for (const path of this.keysByPath.keys()) if (!paths.has(path)) this.removeFile(path);
    if (complete) {
      const syntaxKeys = new Set([...this.parsed.values()].flatMap((cards) => cards.map((card) => `syntax:${card.id}`)));
      for (const key of Object.keys(this.host.settings.reviewPriorities)) {
        if (key.startsWith("syntax:") ? syntaxKeys.has(key) : paths.has(key)) continue;
        delete this.host.settings.reviewPriorities[key];
        this.scheduleSave();
      }
    }
    if (complete && !this.host.settings.reviewCatalogInitialized) {
      this.host.settings.reviewCatalogInitialized = true;
      this.scheduleSave();
    }
  }

  private fileCards(file: TFile): ListedReviewCard[] {
    const cards: ListedReviewCard[] = (this.parsed.get(file.path) || []).map((syntax) => ({
      key: `syntax:${syntax.id}`, file, label: syntax.front, type: "syntax", line: syntax.line, headingPath: syntax.headingPath, syntax,
    }));
    if (this.host.isVocabFile(file)) cards.unshift({ key: file.path, file, label: file.basename, type: "note" });
    return cards;
  }

  private async update(file: TFile): Promise<boolean> {
    if (file.extension !== "md" || this.disposed) return true;
    let markdown: string;
    try { markdown = await this.host.app.vault.cachedRead(file); }
    catch (error) { console.warn("[Lexis] Cannot index review cards", file.path, error); return false; }
    if (this.disposed || this.host.app.vault.getFileByPath(file.path) !== file) return true;
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

  private removeFile(path: string): void {
    this.parsed.delete(path);
    delete this.host.settings.reviewPriorities[path];
    for (const key of this.keysByPath.get(path) || []) {
      delete this.host.settings.reviewCardMeta[key];
      delete this.host.settings.reviewPriorities[key];
    }
    this.keysByPath.delete(path);
  }

  private async rename(file: TFile, oldPath: string): Promise<void> {
    if (file.extension !== "md") { this.removeFile(oldPath); this.scheduleSave(); return; }
    const previous = this.parsed.get(oldPath) || [];
    const current = parseSyntaxCards(await this.host.app.vault.cachedRead(file), file.path, this.templates(), this.parseOptions(file));
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
    await this.update(file);
    this.scheduleSave();
  }

  async cards(): Promise<ListedReviewCard[]> {
    await this.start();
    if (this.signature !== this.parsingSignature()) { this.enqueue(() => this.scan()); await this.pending; }
    const cards = this.host.app.vault.getMarkdownFiles().flatMap((file) => this.fileCards(file));
    if (rememberReviewCards(this.host.settings, cards, !this.host.settings.reviewCatalogInitialized)) this.scheduleSave();
    for (const card of cards) {
      const keys = this.keysByPath.get(card.file.path) || new Set<string>();
      keys.add(card.key); this.keysByPath.set(card.file.path, keys);
    }
    return cards;
  }
}
