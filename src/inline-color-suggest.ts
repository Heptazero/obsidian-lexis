"use strict";

import { EditorSuggest, type App, type Editor, type EditorPosition, type EditorSuggestContext, type EditorSuggestTriggerInfo, type TFile } from "obsidian";
import { collectEntryColorSuggestions, inlineColorQuery, rankEntryColorSuggestions, type EntryColorSuggestion } from "./entry-color-suggestions";
import type { LexisSettings } from "./types";

interface InlineColorSuggestHost {
  settings: Pick<LexisSettings, "entryColors" | "inlineEntriesEnabled" | "inlineEntryDelimiter">;
  isInlineSourceFile(file: TFile | null | undefined): boolean;
}

export class InlineColorSuggest extends EditorSuggest<EntryColorSuggestion> {
  constructor(app: App, private readonly plugin: InlineColorSuggestHost) {
    super(app);
    this.limit = 30;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!file || !this.plugin.settings.inlineEntriesEnabled || !this.plugin.isInlineSourceFile(file)) return null;
    const match = inlineColorQuery(editor.getLine(cursor.line), cursor.ch, this.plugin.settings.inlineEntryDelimiter);
    if (!match) return null;
    return { start: { line: cursor.line, ch: match.startCh }, end: cursor, query: match.query };
  }

  getSuggestions(context: EditorSuggestContext): EntryColorSuggestion[] {
    return rankEntryColorSuggestions(collectEntryColorSuggestions(this.plugin.settings.entryColors), context.query, this.limit);
  }

  renderSuggestion(suggestion: EntryColorSuggestion, element: HTMLElement): void {
    const title = element.createDiv({ cls: "lexis-color-suggest-name" });
    title.createSpan({ cls: "lexis-color-suggest-swatch" }).setCssStyles({ backgroundColor: suggestion.color });
    title.createSpan({ text: suggestion.name });
    if (suggestion.group !== suggestion.name) element.createDiv({ cls: "lexis-file-suggest-path", text: suggestion.group });
  }

  selectSuggestion(suggestion: EntryColorSuggestion): void {
    if (!this.context) return;
    const { editor, start, end } = this.context;
    const hasClosingBrace = editor.getLine(end.line).charAt(end.ch) === "}";
    editor.replaceRange(suggestion.name + (hasClosingBrace ? "" : "}"), start, end);
    editor.setCursor({ line: end.line, ch: start.ch + suggestion.name.length + 1 });
    this.close();
  }
}
