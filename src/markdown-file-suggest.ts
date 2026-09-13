import { AbstractInputSuggest, prepareFuzzySearch, type App, type TFile } from "obsidian";

class MarkdownFileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private readonly getFiles: () => TFile[],
    private readonly onPick: (file: TFile) => void,
  ) {
    super(app, inputEl);
    this.limit = 50;
  }

  protected getSuggestions(query: string): TFile[] {
    const value = query.trim();
    const files = this.getFiles();
    if (!value) return [];
    const match = prepareFuzzySearch(value);
    return files.filter((file) => match(`${file.basename} ${file.path}`)).slice(0, this.limit);
  }

  renderSuggestion(file: TFile, element: HTMLElement): void {
    element.createDiv({ cls: "lexis-file-suggest-name", text: file.basename });
    element.createDiv({ cls: "lexis-file-suggest-path", text: file.path });
  }

  selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    this.close();
    this.onPick(file);
  }
}

export { MarkdownFileSuggest };
