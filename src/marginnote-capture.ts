import { Modal, Notice, Setting, type Plugin, type TFile, type TextComponent } from "obsidian";
import type { LexisSettings } from "./types";
import type { AddSelectionOptions } from "./plugin-base";
import { FolderSuggest } from "./folder-suggest";
import { collectAliasTargets } from "./alias-search";
import { openAliasCombobox, type AliasComboboxController } from "./alias-combobox";
import { parseMarginNoteCapture, type MarginNoteCapture } from "./marginnote-capture-data";
import type { LexisEntry } from "./types";

interface CaptureHost extends Plugin {
  settings: LexisSettings;
  index: Map<string, LexisEntry>;
  t(key: string, vars?: Record<string, string>): string;
  dictFolders(): string[];
  rebuildIndex(notify: boolean): Promise<unknown>;
  addWordFromSelection(word: string, editor: null, view: null, folder: string, options: AddSelectionOptions): Promise<void>;
  rememberSelectionFolder(folder: string): Promise<void>;
  attachAlias(alias: string, file: TFile): Promise<void>;
}

class MarginNoteCaptureModal extends Modal {
  private aliasSearch: AliasComboboxController | null = null;

  constructor(private host: CaptureHost, private draft: MarginNoteCapture) { super(host.app); }

  onOpen(): void {
    const t = this.host.t.bind(this.host);
    this.titleEl.setText(t("mn.capture"));
    let word = this.draft.word;
    let alias = "";
    let aliasFile: TFile | null = null;
    let folderInput: TextComponent | undefined;
    const folders = this.host.dictFolders();
    let folder = folders.includes(this.host.settings.lastSelectionFolder) ? this.host.settings.lastSelectionFolder : folders[0] || "";
    let pending = false;
    const root = this.contentEl;
    root.createDiv({ text: [this.draft.source, this.draft.sentence].filter(Boolean).join("\n") });
    const title = new Setting(root).setName(t("mn.captureWord"));
    title.addText((input) => {
      input.setValue(word).onChange((value) => { word = value; alias = ""; aliasFile = null; folderInput?.setDisabled(false); });
      title.addExtraButton((button) => button.setIcon("link").setTooltip(t("selection.alias")).onClick(() => {
        this.aliasSearch?.close();
        this.aliasSearch = openAliasCombobox({
          document: root.ownerDocument, anchor: button.extraSettingsEl,
          targets: collectAliasTargets(this.host.index), initialValue: word,
          placeholder: t("selection.aliasSearch"), createLabel: t("selection.aliasCreate"),
          existingLabel: (target) => t("selection.aliasExisting", { word: target.title }), emptyText: t("selection.aliasNoResults"),
          onCreate: (value) => { word = value; alias = this.draft.word; aliasFile = null; input.setValue(word); folderInput?.setDisabled(false); },
          onPick: (target) => { word = target.title; alias = this.draft.word; aliasFile = target.file; input.setValue(word); folderInput?.setDisabled(true); },
          onClose: () => { this.aliasSearch = null; },
        });
      }));
    });
    new Setting(root).setName(t("selection.chooseDictionary")).addText((input) => {
      folderInput = input;
      input.setValue(folder).onChange((value) => { folder = value.trim(); });
      new FolderSuggest(this.app, input.inputEl, () => folders, (value) => { folder = value; input.setValue(value); });
    });
    new Setting(root)
      .addButton((button) => button.setButtonText(t("mn.cancel")).onClick(() => this.close()))
      .addButton((button) => button.setButtonText(t("selection.add")).setCta().onClick(async () => {
        if (pending) return;
        if (!word.trim() || (!aliasFile && folders.length > 0 && !this.host.dictFolders().includes(folder))) { new Notice(t("mn.captureInvalid")); return; }
        pending = true;
        button.setDisabled(true);
        try {
          if (aliasFile) await this.host.attachAlias(alias, aliasFile);
          else {
            await this.host.rememberSelectionFolder(folder);
            await this.host.addWordFromSelection(word, null, null, folder, {
              alias, sentence: this.draft.sentence, sourceFile: null, source: this.draft.source,
            });
          }
          this.close();
        } catch { new Notice(t("mn.captureFailed")); }
        finally { pending = false; button.setDisabled(false); }
      }));
  }

  onClose(): void { this.aliasSearch?.close(); this.contentEl.empty(); }
}

export function registerMarginNoteCapture(host: CaptureHost): void {
  host.registerObsidianProtocolHandler("lexis-add", (params) => {
    try {
      const draft = parseMarginNoteCapture(params);
      host.app.workspace.onLayoutReady(() => {
        void host.rebuildIndex(false).then(() => new MarginNoteCaptureModal(host, draft).open())
          .catch(() => { new Notice(host.t("mn.captureInvalid")); });
      });
    } catch { new Notice(host.t("mn.captureInvalid")); }
  });
}
