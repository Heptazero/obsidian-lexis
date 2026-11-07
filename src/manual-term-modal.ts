import { Modal, Notice, type App } from "obsidian";
import type { TranslationVars } from "./i18n";
import type { LexisSettings } from "./types";
import { currentWebSource, type ManualTermDraft } from "./manual-term-data";

interface ManualTermHost {
  app: App;
  settings: LexisSettings;
  dictFolders(): string[];
  t(key: string, vars?: TranslationVars): string;
  saveManualTerm(draft: ManualTermDraft): Promise<void>;
}

export function openManualTerm(host: ManualTermHost, sourceUrl = currentWebSource(host.app.workspace.getMostRecentLeaf())): void {
  const folders = host.dictFolders();
  if (!folders.length) {
    new Notice(host.t("manualTerm.noDictionary"));
    return;
  }
  new ManualTermModal(host, folders, sourceUrl).open();
}

class ManualTermModal extends Modal {
  constructor(private host: ManualTermHost, private folders: string[], private sourceUrl: string) {
    super(host.app);
  }

  onOpen(): void {
    const t = (key: string) => this.host.t(key);
    this.setTitle(t("manualTerm.add"));
    const form = this.contentEl.createEl("form", { cls: "lexis-manual-term-form" });
    const field = (key: string) => form.createEl("label", { text: t(key), cls: "lexis-manual-term-field" });
    const term = field("manualTerm.name").createEl("input", { type: "text", attr: { required: "true" } });
    const aliases = field("manualTerm.aliases").createEl("input", { type: "text", attr: { placeholder: t("manualTerm.aliasPlaceholder") } });
    const definition = field("manualTerm.definition").createEl("textarea", { attr: { rows: "3" } });
    const last = this.host.settings.lastSelectionFolder;
    let folder = this.folders.includes(last) ? last : this.folders[0];
    if (this.folders.length > 1) {
      const target = field("selection.chooseDictionary").createEl("select", { cls: "dropdown" });
      for (const path of this.folders) target.createEl("option", { value: path, text: path });
      target.value = folder;
      target.onchange = () => { folder = target.value; };
    }

    const sourceLabel = form.createEl("label", { cls: "lexis-manual-term-source" });
    const includeSource = sourceLabel.createEl("input", { type: "checkbox" });
    sourceLabel.createSpan({ text: t("manualTerm.includeSource") });
    const urlLabel = field("manualTerm.sourceUrl");
    const url = urlLabel.createEl("input", { type: "url" });
    url.value = this.sourceUrl;
    url.required = true;
    const updateSource = () => { urlLabel.hidden = !includeSource.checked; url.disabled = !includeSource.checked; };
    includeSource.onchange = updateSource;
    updateSource();

    const error = form.createDiv({ cls: "lexis-manual-term-error", attr: { role: "alert" } });
    const actions = form.createDiv({ cls: "modal-button-container" });
    const cancel = actions.createEl("button", { type: "button", text: t("common.cancel") });
    cancel.onclick = () => this.close();
    const save = actions.createEl("button", { type: "submit", text: t("common.save"), cls: "mod-cta" });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (save.disabled) return;
      save.disabled = cancel.disabled = true;
      error.setText("");
      void this.host.saveManualTerm({
        term: term.value, aliases: aliases.value, definition: definition.value,
        folder, sourceUrl: includeSource.checked ? url.value : "",
      }).then(() => this.close(), (failure: unknown) => {
        error.setText(failure instanceof Error ? failure.message : t("common.failed"));
        save.disabled = cancel.disabled = false;
      });
    });
    term.focus();
  }

  onClose(): void { this.contentEl.empty(); }
}
