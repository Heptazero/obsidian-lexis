"use strict";

import { Modal, Notice, type App, type TFile } from "obsidian";
import { splitEditableNote, replaceEditableBody } from "./note-edit-session";

type Translate = (key: string, vars?: Record<string, string | number | boolean>) => string;
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

export class LexisQuickEditModal extends Modal {
  private baselineBody = "";
  private textarea: HTMLTextAreaElement | null = null;
  private saveButton: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly t: Translate,
    private readonly onSaved: () => void | Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("lexis-quick-edit-modal");
    this.setTitle(this.t("popover.editTitle", { word: this.file.basename }));
    const hint = this.contentEl.createDiv({ cls: "lexis-quick-edit-hint", text: this.t("popover.editHint") });
    const textarea = this.contentEl.createEl("textarea", { cls: "lexis-quick-edit-textarea", attr: { "aria-label": this.t("popover.editEntry") } });
    this.textarea = textarea;
    textarea.disabled = true;
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: this.t("common.cancel") }).addEventListener("click", () => this.close());
    const save = actions.createEl("button", { cls: "mod-cta", text: this.t("common.save") });
    this.saveButton = save;
    save.disabled = true;
    save.addEventListener("click", () => { void this.save(); });
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void this.save(); }
    });
    void this.load(hint);
  }

  private async load(hint: HTMLElement): Promise<void> {
    try {
      const parts = splitEditableNote(await this.app.vault.read(this.file));
      this.baselineBody = parts.body;
      if (!this.textarea || !this.saveButton) return;
      this.textarea.value = parts.body;
      this.textarea.disabled = false;
      this.saveButton.disabled = false;
      this.textarea.focus();
    } catch (error) {
      hint.setText(this.t("popover.readFailed", { error: errorMessage(error) }));
    }
  }

  private async save(): Promise<void> {
    if (!this.textarea || !this.saveButton || this.textarea.disabled) return;
    const nextBody = this.textarea.value;
    this.textarea.disabled = true;
    this.saveButton.disabled = true;
    let conflict = false;
    try {
      await this.app.vault.process(this.file, (current) => {
        const next = replaceEditableBody(current, this.baselineBody, nextBody);
        if (next == null) { conflict = true; return current; }
        return next;
      });
      if (conflict) {
        new Notice(this.t("popover.editConflict"));
        if (this.textarea) this.textarea.disabled = false;
        if (this.saveButton) this.saveButton.disabled = false;
        return;
      }
      new Notice(this.t("popover.editSaved", { word: this.file.basename }));
      this.close();
      await this.onSaved();
    } catch (error) {
      new Notice(this.t("popover.readFailed", { error: errorMessage(error) }));
      if (this.textarea) this.textarea.disabled = false;
      if (this.saveButton) this.saveButton.disabled = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
    this.textarea = null;
    this.saveButton = null;
  }
}
