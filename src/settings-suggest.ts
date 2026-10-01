"use strict";

import type { App } from "obsidian";

export interface SuggestOptions {
  multi?: boolean;
  sep?: string;
}

export type PathSuggestConstructor = new (
  app: App,
  inputEl: HTMLInputElement,
  getItems: () => string[],
  onPick: (value: string) => void,
  options?: SuggestOptions,
) => import("obsidian").AbstractInputSuggest<string>;

export function createPathSuggest(obsidian: typeof import("obsidian")): PathSuggestConstructor {
  class PathSuggest extends obsidian.AbstractInputSuggest<string> {
    getItems: () => string[];
    onPick: (value: string) => void;
    multi: boolean;
    sep: string;
    inputEl: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement, getItems: () => string[], onPick: (value: string) => void, options: SuggestOptions = {}) {
      super(app, inputEl);
      this.inputEl = inputEl;
      this.getItems = getItems;
      this.onPick = onPick;
      this.multi = !!options.multi;
      this.sep = options.sep || " ";
    }

    private splitInput() {
      const value = this.inputEl?.value || "";
      const match = value.match(/[^\s,，;；]*$/);
      const token = match ? match[0] : "";
      return { before: value.slice(0, value.length - token.length), token };
    }

    getSuggestions(query: string): string[] {
      let items = this.getItems();
      let normalizedQuery: string;
      if (this.multi) {
        const { token } = this.splitInput();
        normalizedQuery = token.toLowerCase();
        const chosen = new Set((this.inputEl?.value || "").toLowerCase().split(/[\s,，;；]+/).filter(Boolean));
        items = items.filter((item) => item.toLowerCase() === normalizedQuery || !chosen.has(item.toLowerCase()));
      } else normalizedQuery = (query || "").toLowerCase();
      return items.filter((item) => item.toLowerCase().includes(normalizedQuery)).slice(0, 50);
    }

    renderSuggestion(value: string, element: HTMLElement): void { element.setText(value); }

    selectSuggestion(value: string): void {
      if (this.multi) {
        const { before } = this.splitInput();
        const nextValue = before + value + this.sep;
        this.inputEl.value = nextValue;
        this.onPick(nextValue);
        this.setValue(nextValue);
        this.inputEl.focus();
        return;
      }
      this.setValue(value);
      this.inputEl.value = value;
      this.close();
      this.onPick(value);
    }
  }

  return PathSuggest;
}
