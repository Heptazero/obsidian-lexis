import { AbstractInputSuggest, prepareFuzzySearch, type App } from "obsidian";

class FolderSuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private readonly getFolders: () => string[],
    private readonly onPick: (folder: string) => void,
  ) {
    super(app, inputEl);
    this.limit = 50;
  }

  protected getSuggestions(query: string): string[] {
    const folders = this.getFolders();
    const value = query.trim();
    if (!value) return folders.slice(0, this.limit);
    const match = prepareFuzzySearch(value);
    return folders.filter((folder) => match(folder)).slice(0, this.limit);
  }

  renderSuggestion(folder: string, element: HTMLElement): void {
    const name = folder.split("/").pop() || folder;
    element.createDiv({ cls: "lexis-file-suggest-name", text: name });
    element.createDiv({ cls: "lexis-file-suggest-path", text: folder });
  }

  selectSuggestion(folder: string): void {
    this.setValue(folder);
    this.close();
    this.onPick(folder);
  }
}

export { FolderSuggest };
