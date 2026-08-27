import { Modal, Notice, type App, type TFile } from "obsidian";
import type { TranslationVars } from "./i18n";
import type { LexisSettings } from "./types";

interface RestoreModalHost {
  settings: LexisSettings;
  t(key: string, variables?: TranslationVars): string;
  setArchived(file: TFile, archived: boolean): Promise<void>;
  saveSettings(): Promise<void>;
  rebuildIndex(notify: boolean): Promise<unknown>;
}

export class LexisRestoreModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: RestoreModalHost,
    private readonly file: TFile,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("lexis-restore-modal");
    contentEl.createEl("h3", { text: this.plugin.t("restore.title", { word: this.file.basename }) });
    contentEl.createEl("p", { text: this.plugin.t("restore.question") });
    const row = contentEl.createDiv({ cls: "lexis-modal-btns" });
    const keepButton = row.createEl("button", { cls: "mod-cta", text: this.plugin.t("restore.keep") });
    keepButton.addEventListener("click", () => {
      void (async () => {
        await this.plugin.setArchived(this.file, false);
        new Notice(this.plugin.t("restore.kept", { word: this.file.basename }));
        this.close();
      })();
    });
    const resetButton = row.createEl("button", { text: this.plugin.t("restore.reset") });
    resetButton.addEventListener("click", () => {
      void (async () => {
        await this.app.fileManager.processFrontMatter(this.file, (frontmatter: Record<string, unknown>) => {
          delete frontmatter["lexis-status"];
          delete frontmatter["lexis-s"];
          delete frontmatter["lexis-d"];
          delete frontmatter["lexis-due"];
          delete frontmatter["lexis-last"];
          delete frontmatter["lexis-reps"];
          delete frontmatter["lexis-lapses"];
        });
        delete this.plugin.settings.reviewHistory[this.file.path];
        await this.plugin.saveSettings();
        await this.plugin.rebuildIndex(false);
        new Notice(this.plugin.t("restore.resetDone", { word: this.file.basename }));
        this.close();
      })();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
