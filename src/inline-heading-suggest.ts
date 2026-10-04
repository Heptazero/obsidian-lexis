"use strict";

import { EditorSuggest, type App, type Editor, type EditorPosition, type EditorSuggestContext, type EditorSuggestTriggerInfo, type TFile } from "obsidian";
import type { LexisSettings } from "./types";
import { collectInlineHeadingSuggestions, inlineHeadingQuery, rankInlineHeadingSuggestions, type InlineHeadingSuggestion } from "./inline-heading-suggestions";

interface InlineHeadingSuggestHost {
  settings: Pick<LexisSettings, "inlineEntriesEnabled" | "inlineClassificationMode" | "inlineHeadingLevel">;
  isInlineSourceFile(file: TFile | null | undefined): boolean;
  t(key: string, vars?: Record<string, string | number | boolean | null | undefined>): string;
}

export class InlineHeadingSuggest extends EditorSuggest<InlineHeadingSuggestion> {
  constructor(app: App, private readonly plugin: InlineHeadingSuggestHost) {
    super(app);
    this.limit = 30;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!file || !this.plugin.settings.inlineEntriesEnabled || this.plugin.settings.inlineClassificationMode !== "heading" || !this.plugin.isInlineSourceFile(file)) return null;
    const match = inlineHeadingQuery(editor.getLine(cursor.line), cursor.ch, this.plugin.settings.inlineHeadingLevel);
    if (!match) return null;
    return { start: { line: cursor.line, ch: match.startCh }, end: cursor, query: match.query };
  }

  getSuggestions(context: EditorSuggestContext): InlineHeadingSuggestion[] {
    const level = this.plugin.settings.inlineHeadingLevel;
    if (level < 1 || level > 6) return [];
    const sources = this.app.vault.getMarkdownFiles()
      .filter((file) => this.plugin.isInlineSourceFile(file))
      .map((file) => ({ path: file.path, headings: this.app.metadataCache.getFileCache(file)?.headings || [] }));
    return rankInlineHeadingSuggestions(collectInlineHeadingSuggestions(sources, level), context.query, this.limit);
  }

  renderSuggestion(suggestion: InlineHeadingSuggestion, element: HTMLElement): void {
    element.createDiv({ cls: "lexis-file-suggest-name", text: suggestion.name });
    element.createDiv({ cls: "lexis-file-suggest-path", text: this.plugin.t("suggest.headingSources", { count: suggestion.fileCount }) });
  }

  selectSuggestion(suggestion: InlineHeadingSuggestion): void {
    if (!this.context) return;
    this.context.editor.replaceRange(suggestion.name, this.context.start, this.context.end);
    this.close();
  }
}
