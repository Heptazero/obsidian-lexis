"use strict";

import type { App, Notice as ObsidianNotice, TFile as ObsidianTFile } from "obsidian";
import type { LexisEntry } from "./types";

type BridgeResult = { ok: boolean; error?: string; tags?: string[] };
type TranslationVars = Record<string, string | number | boolean>;
type HighlightSource = { file: ObsidianTFile | null; sentence: string; page?: number };

interface ReaderPopoverHost {
  app: App;
  t(key: string, vars?: TranslationVars): string;
  dictFolders(): string[];
  bridgeMoveWord(payload: Record<string, unknown>): Promise<BridgeResult>;
  bridgeAnnotate(payload: Record<string, unknown>): Promise<BridgeResult>;
  bridgeDeleteWord(key: string): Promise<BridgeResult>;
  bridgeTagWord(payload: Record<string, unknown>): Promise<BridgeResult>;
  highlightSource(span: HTMLElement): HighlightSource;
  addExampleToWord(wordFile: ObsidianTFile, sentence: string, sourceFile?: ObsidianTFile | null, page?: number): Promise<boolean>;
  collectVocabTags(): string[];
  removePopover(): void;
}

interface ReaderPopoverDependencies {
  obsidian: typeof import("obsidian");
  Notice: typeof ObsidianNotice;
}

function confirmAction(obsidian: typeof import("obsidian"), app: App, title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    class ConfirmModal extends obsidian.Modal {
      onOpen() {
        this.setTitle(title);
        this.contentEl.createEl("p", { text: message });
        const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
        actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
        actions.createEl("button", { cls: "mod-warning", text: "删除" }).addEventListener("click", () => { settled = true; resolve(true); this.close(); });
      }
      onClose() { this.contentEl.empty(); if (!settled) resolve(false); }
    }
    new ConfirmModal(app).open();
  });
}

export function renderReaderPopoverControls(
  this: ReaderPopoverHost,
  { obsidian, Notice }: ReaderPopoverDependencies,
  meta: HTMLElement,
  corner: HTMLElement,
  body: HTMLElement,
  entry: LexisEntry,
  sourceSpan: HTMLElement,
): void {
  if (entry.inline) return;
  const baseKey = entry.file?.basename || entry.display;
  const path = entry.file?.path || "";
  const slash = path.lastIndexOf("/");
  const folder = slash > 0 ? path.slice(0, slash) : "";
  const shortFolder = (f: string) => String(f || this.t("common.root")).split("/").pop() || "";
  const folderChip = meta.createSpan({ cls: "lexis-popover-chip", text: shortFolder(folder) });
  folderChip.setAttribute("title", folder || this.t("common.root"));
  const dicts = this.dictFolders();
  if (dicts.length > 1) {
    folderChip.addClass("is-clickable");
    folderChip.setAttribute("title", `${folder || this.t("common.root")} — ${this.t("popover.moveDictionary")}`);
    folderChip.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const menu = new obsidian.Menu();
      for (const target of dicts) menu.addItem((it) => it.setTitle(shortFolder(target)).setIcon(target === folder ? "check" : "folder").onClick(async () => {
        if (target === folder) return;
        const result = await this.bridgeMoveWord({ key: baseKey, folder: target });
        new Notice(result.ok ? this.t("notice.moved", { folder: shortFolder(target) }) : this.t("notice.moveFailed", { error: result.error || this.t("common.failed") }));
        if (result.ok) this.removePopover();
      }));
      menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
    });
  }
  const occurrenceBtn = meta.createEl("button", { cls: "lexis-popover-action", text: this.t("popover.addCurrentOccurrence") });
  occurrenceBtn.setAttribute("title", this.t("popover.addCurrentOccurrenceTitle"));
  occurrenceBtn.addEventListener("click", (ev) => { void (async () => {
    ev.preventDefault(); ev.stopPropagation();
    const source = this.highlightSource(sourceSpan);
    occurrenceBtn.disabled = true;
    if (await this.addExampleToWord(entry.file, source.sentence, source.file, source.page)) {
      occurrenceBtn.setText("✓");
      occurrenceBtn.removeAttribute("title");
    } else occurrenceBtn.disabled = false;
  })(); });
  const noteBtn = corner.createEl("button", { cls: "lexis-popover-action", text: "✎" });
  noteBtn.setAttribute("title", this.t("popover.addNote"));
  noteBtn.addEventListener("click", (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const existing = body.querySelector(".lexis-popover-note-row");
    if (existing) { existing.querySelector("input")?.focus(); return; }
    const row = body.createDiv({ cls: "lexis-popover-note-row" });
    const input = row.createEl("input", { attr: { type: "text", placeholder: this.t("popover.notePlaceholder") } });
    const imageInput = row.createEl("input", { cls: "lexis-popover-note-file", attr: { type: "file", accept: "image/*" } });
    const imageBtn = row.createEl("button", { cls: "lexis-popover-note-image", attr: { type: "button", title: this.t("popover.addImage") } });
    obsidian.setIcon(imageBtn, "image-plus");
    input.addEventListener("click", (e) => e.stopPropagation());
    imageBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); imageInput.click(); });
    imageInput.addEventListener("click", (e) => e.stopPropagation());
    imageInput.addEventListener("change", () => { void (async () => {
      const image = imageInput.files?.[0];
      if (!image) return;
      input.disabled = true;
      imageBtn.disabled = true;
      const result = await this.bridgeAnnotate({ key: baseKey, note: input.value.trim(), image });
      new Notice(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
      if (result.ok) this.removePopover();
      else { input.disabled = false; imageBtn.disabled = false; imageInput.value = ""; }
    })(); });
    input.addEventListener("keydown", (e) => { void (async () => {
      if (e.key === "Escape") { row.remove(); return; }
      if (e.key !== "Enter") return;
      e.preventDefault();
      const note = input.value.trim();
      if (!note) { row.remove(); return; }
      input.disabled = true;
      const result = await this.bridgeAnnotate({ key: baseKey, note });
      new Notice(result.ok ? this.t("notice.noteAdded", { word: entry.display }) : this.t("notice.noteFailed", { error: result.error || this.t("common.failed") }));
      this.removePopover();
    })(); });
    body.prepend(row);
    input.focus();
  });
  const delBtn = corner.createEl("button", { cls: "lexis-popover-action is-danger", text: "🗑" });
  delBtn.setAttribute("title", this.t("popover.deleteEntry"));
  delBtn.addEventListener("click", (ev) => { void (async () => {
    ev.preventDefault(); ev.stopPropagation();
    if (!await confirmAction(obsidian, this.app, this.t("popover.deleteEntry"), this.t("popover.deleteConfirm", { word: entry.display }))) return;
    const result = await this.bridgeDeleteWord(baseKey);
    new Notice(result.ok ? this.t("notice.deleted", { word: entry.display }) : this.t("notice.deleteFailed", { error: result.error || this.t("common.failed") }));
    this.removePopover();
  })(); });

  const tagWrap = body.createDiv({ cls: "lexis-popover-tags" });
  const tags = new Set(entry.tags || []);
  const renderTags = () => {
    tagWrap.empty();
    for (const tag of [...tags].sort()) {
      const pill = tagWrap.createSpan({ cls: "lexis-popover-tag", text: `#${tag}` });
      const remove = pill.createSpan({ cls: "lexis-popover-tag-remove", text: " ×" });
      remove.setAttribute("title", this.t("popover.deleteTag"));
      remove.addEventListener("click", (ev) => { void (async () => {
        ev.preventDefault(); ev.stopPropagation();
        const result = await this.bridgeTagWord({ key: baseKey, tag, action: "remove" });
        if (result.ok) { tags.delete(tag); entry.tags = new Set(result.tags || []); renderTags(); }
      })(); });
    }
    const add = tagWrap.createSpan({ cls: "lexis-popover-tag is-add", text: tags.size ? "+" : this.t("popover.addTag") });
    add.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const menu = new obsidian.Menu();
      for (const tag of this.collectVocabTags().filter((t) => !tags.has(t))) menu.addItem((it) => it.setTitle(`#${tag}`).setIcon("tag").onClick(async () => {
        const result = await this.bridgeTagWord({ key: baseKey, tag, action: "add" });
        if (result.ok) { tags.add(tag); entry.tags = new Set(result.tags || []); renderTags(); }
      }));
      menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
    });
  };
  renderTags();
}

