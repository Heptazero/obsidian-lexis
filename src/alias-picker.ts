import { FuzzySuggestModal, type App } from "obsidian";
import type { TranslationVars } from "./i18n";
import type { LexisEntry } from "./types";

interface AliasPickerHost {
  index: Map<string, LexisEntry>;
  t(key: string, variables?: TranslationVars): string;
}

export class LexisAliasPicker extends FuzzySuggestModal<LexisEntry> {
  constructor(
    app: App,
    private readonly plugin: AliasPickerHost,
    aliasText: string,
    private readonly onPick: (entry: LexisEntry) => void,
  ) {
    super(app);
    this.setPlaceholder(this.plugin.t("selection.aliasPrompt", { alias: aliasText }));
  }

  getItems(): LexisEntry[] {
    const seen = new Set<string>();
    const entries: LexisEntry[] = [];
    for (const entry of this.plugin.index.values()) {
      if (!entry?.file) continue;
      const key = `${entry.file.path}|${entry.display || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
    return entries;
  }

  getItemText(entry: LexisEntry): string {
    return entry.isAlias
      ? this.plugin.t("selection.aliasItem", { alias: entry.display, word: entry.file.basename })
      : entry.display;
  }

  onChooseItem(entry: LexisEntry): void {
    if (entry.file) this.onPick(entry);
  }
}
