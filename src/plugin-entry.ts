"use strict";

import * as obsidian from "obsidian";
import { Notice, TFile } from "obsidian";
import { todayString as todayStr } from "./shared-utils";
import { LexisPluginReview } from "./plugin-review";
import { errorMessage, type AddSelectionOptions } from "./plugin-base";

export class LexisPluginEntry extends LexisPluginReview {
  sanitizeName(name: string): string { return (name || "").replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim(); }
  async ensureFolder(folder: string): Promise<void> {
    if (!folder) return;
    if (!this.app.vault.getAbstractFileByPath(folder)) { try { await this.app.vault.createFolder(folder); } catch { /* Another write may have created the folder first. */ } }
  }
  async readTemplatePath(p: string): Promise<string | null> {
    p = (p || "").trim();
    if (!p) return null;
    const f = this.app.vault.getAbstractFileByPath(p);
    if (f instanceof TFile) { try { return await this.app.vault.read(f); } catch { return null; } }
    return null;
  }
  async createEntryFile(path: string, folder: string, fallbackContent: string, transform: (content: string) => string): Promise<TFile> {
    const file = await this.templateProvider.create({ path, folder, fallbackContent, transform });
    this.settings.reviewAddedAt[file.path] = new Date().toISOString();
    await this.saveSettings();
    return file;
  }
  // 无模板可选纯空白，或只放一个内置的出处面板；用户自己的模板始终优先。
  minimalSkeleton() { return this.settings.emptyNotePreset === "occ" ? "```lexis\nocc\n```\n" : ""; }
  getSelectionSentence(editor: obsidian.Editor | null): string {
    if (!editor) return "";
    try { const from = editor.getCursor("from"); const line = editor.getLine(from.line) || ""; return this.extractSentence(line, from.ch || 0); } catch { return ""; }
  }
  getReadingSentence(): string {
    try { const sel = window.getSelection(); if (!sel || !sel.anchorNode) return ""; const text = sel.anchorNode.textContent || ""; return this.extractSentence(text, sel.anchorOffset || 0); } catch { return ""; }
  }
  // 当前选区所在 PDF 页码(pdf.js 在 .page 上挂 data-page-number);取不到返回 0
  currentPdfPage(): number {
    try {
      const sel = window.getSelection();
      const n = sel && sel.anchorNode;
      const el = n?.nodeType === Node.ELEMENT_NODE ? n as Element : n?.parentElement;
      const page = el?.closest("[data-page-number]");
      const v = page && page.getAttribute("data-page-number");
      return v ? parseInt(v, 10) || 0 : 0;
    } catch { return 0; }
  }
  addSelectedWordCommand(): void {
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    let word = "", editor = null;
    if (view && view.editor && view.getMode && view.getMode() === "source") { word = (view.editor.getSelection() || "").trim(); editor = view.editor; }
    if (!word) { const sel = window.getSelection(); word = (sel ? sel.toString() : "").trim(); }
    if (!word) { new Notice(this.t("notice.selectWord")); return; }
    void this.addWordFromSelection(word, editor, view);
  }
  async addWordFromSelection(word: string, editor: obsidian.Editor | null = null, view: obsidian.MarkdownFileInfo | obsidian.MarkdownView | null = null, targetFolder = "", options: AddSelectionOptions = {}): Promise<void> {
    const clean = (word || "").trim();
    const aliasText = (options.alias || "").trim();
    const alias = aliasText && aliasText.normalize("NFKC").toLowerCase() !== clean.normalize("NFKC").toLowerCase() ? aliasText : "";
    const fileName = this.sanitizeName(clean);
    if (!fileName) { new Notice(this.t("notice.invalidWord")); return; }
    const reqFolder = this.normalizeFolder(targetFolder || "");
    const folder = (reqFolder && this.dictFolders().includes(reqFolder)) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + fileName + ".md";
    const target = this.app.vault.getAbstractFileByPath(targetPath);
    let existing: TFile | null = target instanceof TFile ? target : null;
    // 路径不同名也可能已经是某词条的标题或别名(比如刚被"设为别名"并入了别的文件)——按索引兜底查,别重复建
    if (!existing) {
      const hit = this.index.get(this.resolveIndexKey(clean));
      if (hit && hit.file instanceof TFile) existing = hit.file;
    }
    const srcFile = options.sourceFile !== undefined ? options.sourceFile : (view && view.file) || this.app.workspace.getActiveFile();
    const sentence = options.sentence !== undefined ? options.sentence : editor ? this.getSelectionSentence(editor) : this.getReadingSentence();
    // 从 PDF 划词加词时,新词笔记开到新标签页,免得把正在读的 PDF 顶掉
    const fromPdf = srcFile && srcFile.extension === "pdf" && !editor;
    if (existing) {
      if (alias) {
        await this.attachAlias(alias, existing);
        return;
      }
      new Notice(this.t(options.openExisting ? "notice.exists" : "notice.existsNoOpen", { word: existing.basename }));
      if (options.openExisting) void this.app.workspace.getLeaf(fromPdf ? "tab" : false).openFile(existing);
      return;
    }
    try {
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      const content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word: clean, date: todayStr() });
      const addOccurrence = (templateContent: string) => {
        let next = templateContent;
        // 出处写进正文(而不是 frontmatter 属性),好看且笔记里直接可见
        if (!(sentence || srcFile)) return next;
        // PDF 出处带上页码,链接可直接跳到那一页
        let sub = "", disp = srcFile ? srcFile.basename : "";
        if (fromPdf) {
          const pg = options.page || this.currentPdfPage();
          if (pg) { sub = `#page=${pg}`; disp = `${srcFile.basename} p.${pg}`; }
        }
        const sourceTarget = this.sourceLinkTarget(srcFile);
        const source = srcFile ? (sub ? `[[${sourceTarget}${sub}|${disp}]]` : `[[${sourceTarget}]]`) : "";
        next = this.insertOccurrence(next, { word: clean, sentence: sentence || "", source, date: todayStr() });
        return next;
      };
      const file = await this.createEntryFile(targetPath, folder, content, addOccurrence);
      if (alias) await this.addAliasToFile(file, alias);
      this.recordEncounter(file, "add");
      // 划词添加只写入并留在原文；"添加"不再暗含一次页面跳转。
      await this.rebuildIndex(false);
      if (alias && !this.index.has(this.resolveIndexKey(alias))) this.index.set(this.resolveIndexKey(alias), { display: alias, file, isAlias: true, tags: this.getTags(file) });
      new Notice(alias
        ? this.t("notice.aliasAdded", { alias, word: file.basename })
        : this.t(fromPdf ? "notice.addedPdf" : "notice.created", { word: fileName }));
    } catch (err) { new Notice(this.t("notice.createFailed", { error: errorMessage(err) })); }
  }}

export function pluginEntryDescriptors(): PropertyDescriptorMap {
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(LexisPluginEntry.prototype);
  return descriptors;
}
