"use strict";

import * as obsidian from "obsidian";
import type { App, Component as ObsidianComponent, Editor, MarkdownView, TFile as ObsidianTFile } from "obsidian";
import { openAliasCombobox, type AliasComboboxController } from "./alias-combobox";
import { collectAliasTargets } from "./alias-search";
import type { LexisEntry, LexisSettings } from "./types";
import { pdfHighlightAt } from "./pdf-highlight-targets";
import { positionSelectionPill } from "./selection-pill-position";
import { selectionPillActions } from "./selection-pill-order";
import { canvasHighlightAt } from "./canvas-highlight-target";
import type { ExcalidrawHighlights } from "./excalidraw-highlights";
import { manualLookupEnabled } from "./highlight-mode";
import { finishPopoverEdit } from "./popover-edit-lifecycle";
import { overlayDocumentFor, readerRectInDocument } from "./reader-frame-geometry";
import type { ReaderHover } from "./reader-hover";

type AddWordOptions = {
  openExisting?: boolean;
  alias?: string;
  sentence?: string;
  sourceFile?: ObsidianTFile | null;
  page?: number;
};
type TranslationVars = Record<string, string | number | boolean>;
type ManualLookupSource = { file: ObsidianTFile | null; sentence: string; page?: number };

function eventElement(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return null;
  const node = target as Node;
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  return element && "dataset" in element ? element : null;
}

function closestHighlight(target: EventTarget | null): HTMLElement | null {
  return eventElement(target)?.closest<HTMLElement>(".lexis-hl,.lexis-pdf-hl") || null;
}

function hasExpandedSelection(element: Element): boolean {
  const selection = element.ownerDocument.defaultView?.getSelection();
  return !!selection && !selection.isCollapsed && selection.rangeCount > 0;
}

export function shouldHandleHighlightClick(isMobile: boolean, clickToOpen: boolean | undefined): boolean {
  return isMobile || clickToOpen !== false;
}

function createReaderInteractions(): PropertyDescriptorMap {
  class ReaderInteractions {
  declare app: App;
  declare settings: LexisSettings;
  declare index: Map<string, LexisEntry>;
  declare readerHover: ReaderHover;
  declare _excalidrawHighlights: ExcalidrawHighlights;
  declare _popover: HTMLElement | null;
  declare _popoverComp: ObsidianComponent | null;
  declare _selPill: HTMLElement | null;
  declare _manualLookupAnchor: HTMLElement | null;
  declare _manualLookupSource: ManualLookupSource | null;
  declare _aliasSearch: AliasComboboxController | null;
  declare _mobileTapStart: { pointerId: number; x: number; y: number; time: number; target: HTMLElement } | null;
  declare _mobileTapClick: { x: number; y: number; time: number } | null;
  declare addWordFromSelection: (text: string, editor: Editor | null, view: MarkdownView | null, folder?: string, options?: AddWordOptions) => Promise<void>;
  declare attachAlias: (aliasText: string, file: ObsidianTFile) => Promise<void>;
  declare extractSentence: (content: string, index: number) => string;
  declare dictFolders: () => string[];
  declare normalizeFolder: (folder: string) => string;
  declare openInlineEntry: (entry: LexisEntry, newTab: boolean) => Promise<void>;
  declare resolveIndexKey: (value: string) => string;
  declare positionPopover: (popover: HTMLElement, target: HTMLElement) => void;
  declare saveSettings: () => Promise<void>;
  declare showPopover: (target: HTMLElement) => Promise<void>;
  declare t: (key: string, vars?: TranslationVars) => string;

  // ---------- 悬浮卡 ----------
  highlightTarget(event: MouseEvent): HTMLElement | null {
    for (const target of event.composedPath()) {
      const highlight = closestHighlight(target);
      if (highlight) return highlight;
    }
    return closestHighlight(event.target)
      || pdfHighlightAt(event)
      || canvasHighlightAt(event)
      || this._excalidrawHighlights?.highlightAt(event)
      || null;
  }
  onMouseMove(event: MouseEvent): void {
    if (obsidian.Platform.isMobile) return;
    const target = pdfHighlightAt(event)
      || canvasHighlightAt(event)
      || this._excalidrawHighlights?.highlightAt(event)
      || null;
    if (!this.readerHover.move(target, !!eventElement(event.target)?.closest('.lexis-popover'))) return;
    if (target) this.onMouseOver(event);
  }
  onMouseOver(e: MouseEvent): void {
    if (obsidian.Platform.isMobile) return;
    const t = this.highlightTarget(e);
    if (!t) return;
    if ((e.buttons & 1) || hasExpandedSelection(t)) return;
    const delay = Math.max(0, Number(this.settings.hoverDelayMs) || 0);
    this.readerHover.enter(t, delay);
  }
  onMouseOut(e: MouseEvent): void {
    if (obsidian.Platform.isMobile) return;
    const t = this.highlightTarget(e);
    if (!t) return;
    this.readerHover.leave(t);
  }
  onPointerDown(e: PointerEvent): void {
    if (!obsidian.Platform.isMobile || e.pointerType !== "touch") return;
    if (!e.isPrimary || this._mobileTapStart) { this._mobileTapStart = null; return; }
    const target = this.highlightTarget(e);
    this._mobileTapStart = target && !hasExpandedSelection(target)
      ? { pointerId: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp, target }
      : null;
  }
  onPointerMove(e: PointerEvent): void {
    const start = this._mobileTapStart;
    if (start?.pointerId === e.pointerId && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) {
      this._mobileTapStart = null;
    }
  }
  onPointerUp(e: PointerEvent): void {
    const start = this._mobileTapStart;
    this._mobileTapStart = null;
    if (!start || e.pointerId !== start.pointerId || e.pointerType !== "touch") return;
    if (e.timeStamp - start.time > 500 || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
    const target = start.target.isConnected ? start.target : this.highlightTarget(e);
    if (!target || hasExpandedSelection(target) || !this.index.has(target.dataset.lexisKey)) return;
    this._mobileTapClick = { x: e.clientX, y: e.clientY, time: Date.now() };
    e.preventDefault();
    e.stopPropagation();
    this.activateHighlight(target, false);
  }
  onPointerCancel(): void {
    this._mobileTapStart = null;
  }
  activateHighlight(target: HTMLElement, newTab: boolean): void {
    const entry = this.index.get(target.dataset.lexisKey);
    if (!entry) return;
    if (obsidian.Platform.isMobile && this.settings.mobileTapAction !== "open") {
      void this.showPopover(target);
    } else if (entry.inline) {
      void this.openInlineEntry(entry, newTab);
    } else {
      void this.app.workspace.getLeaf(newTab ? "tab" : false).openFile(entry.file);
      this.removePopover();
    }
  }
  showManualLookup(key: string, rect: Pick<DOMRect, "left" | "top" | "width" | "height">, overlayDoc: Document, source: ManualLookupSource): boolean {
    if (!this.index.has(key)) return false;
    this.removeSelPill();
    this.removePopover();
    const anchor = overlayDoc.body.createDiv({ cls: "lexis-manual-lookup-anchor" });
    anchor.dataset.lexisKey = key;
    anchor.setCssStyles({ left: `${rect.left}px`, top: `${rect.top}px`, width: `${Math.max(1, rect.width)}px`, height: `${Math.max(1, rect.height)}px` });
    void this.showPopover(anchor);
    this._manualLookupAnchor = anchor;
    this._manualLookupSource = source;
    return true;
  }
  manualLookupFromClick(event: MouseEvent): boolean {
    if (!manualLookupEnabled(this.settings) || event.detail < 2) return false;
    const target = eventElement(event.target);
    if (!target || target.closest(".lexis-popover,.lexis-sel-pill,code,pre,a,input,textarea,[contenteditable=true]")) return false;
    if (!target.closest(".markdown-reading-view,.markdown-preview-view")) return false;
    const sourceDoc = target.ownerDocument;
    const selection = sourceDoc.defaultView?.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount < 1) return false;
    const text = selection.toString().trim();
    if (!text || text.length > 60 || /[\n\r]/.test(text)) return false;
    const key = this.resolveIndexKey(text);
    if (!this.index.has(key)) return false;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return false;
    const node = selection.anchorNode;
    const sentence = node ? this.extractSentence(node.textContent || "", selection.anchorOffset || 0) : text;
    const page = Number(target.closest("[data-page-number]")?.getAttribute("data-page-number")) || undefined;
    return this.showManualLookup(key, rect, sourceDoc, { file: this.app.workspace.getActiveFile(), sentence, page });
  }
  onClick(e: MouseEvent): void {
    if (!obsidian.Platform.isMobile && this.manualLookupFromClick(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const recentTap = this._mobileTapClick;
    if (recentTap && Date.now() - recentTap.time < 700
      && Math.hypot(e.clientX - recentTap.x, e.clientY - recentTap.y) < 20
      && !eventElement(e.target)?.closest(".lexis-popover")) {
      this._mobileTapClick = null;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const t = this.highlightTarget(e);
    if (t) {
      if (hasExpandedSelection(t)) return;
      if (this.index.has(t.dataset.lexisKey)) {
        if (!shouldHandleHighlightClick(obsidian.Platform.isMobile, this.settings.clickHighlightToOpen)) return;
        e.preventDefault();
        this.activateHighlight(t, e.ctrlKey || e.metaKey);
      }
    } else if (this._popover && !this._popover.contains(eventElement(e.target))) this.removePopover();
  }
  scheduleHide() {
    this.readerHover.scheduleHide();
  }
  removePopover() {
    const editing = this._popover;
    if (editing?.dataset.lexisEditing === "1") {
      void finishPopoverEdit(editing).then((saved) => { if (saved && this._popover === editing) this.removePopover(); });
      return;
    }
    this.readerHover.cancelOpen();
    this.readerHover.keepOpen();
    if (this._popoverComp) { this._popoverComp.unload(); this._popoverComp = null; }
    if (this._popover) { this._popover.remove(); this._popover = null; }
    if (this._manualLookupAnchor) { this._manualLookupAnchor.remove(); this._manualLookupAnchor = null; }
    this._manualLookupSource = null;
  }
  attachPopoverResize(popover: HTMLElement, target: HTMLElement): void {
    const hostWindow = popover.ownerDocument.defaultView || window;
    if (hostWindow.matchMedia?.("(pointer: coarse)").matches) return;
    const handle = popover.createDiv({ cls: "lexis-popover-resize-handle" });
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-label", this.t("popover.resize"));
    handle.setAttribute("title", this.t("popover.resize"));
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      this.readerHover.keepOpen();
      const start = popover.getBoundingClientRect();
      const startHeight = popover.style.height;
      const startMaxHeight = popover.style.maxHeight;
      const startX = event.clientX;
      const startY = event.clientY;
      popover.dataset.lexisResizing = "1";
      try { handle.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional in embedded documents. */ }
      const resize = (move: PointerEvent) => {
        const maxWidth = Math.max(260, hostWindow.innerWidth - start.left - 10);
        const maxHeight = Math.max(160, hostWindow.innerHeight - start.top - 10);
        const width = Math.max(260, Math.min(maxWidth, start.width + move.clientX - startX));
        const height = Math.max(160, Math.min(maxHeight, start.height + move.clientY - startY));
        popover.setCssStyles({ width: `${width}px`, height: `${height}px`, maxHeight: `${height}px` });
      };
      const finish = (cancelled: boolean) => {
        handle.removeEventListener("pointermove", resize);
        handle.removeEventListener("pointerup", onPointerUp);
        handle.removeEventListener("pointercancel", onPointerCancel);
        delete popover.dataset.lexisResizing;
        if (cancelled) {
          popover.setCssStyles({ width: `${start.width}px`, height: startHeight, maxHeight: startMaxHeight });
        } else {
          const result = popover.getBoundingClientRect();
          this.settings.popoverWidth = Math.round(result.width);
          this.settings.popoverMaxHeight = Math.round(result.height);
          popover.setCssStyles({ height: "", maxHeight: `${this.settings.popoverMaxHeight}px` });
          void this.saveSettings();
        }
        this.positionPopover(popover, target);
      };
      const onPointerUp = () => finish(false);
      const onPointerCancel = () => finish(true);
      handle.addEventListener("pointermove", resize);
      handle.addEventListener("pointerup", onPointerUp);
      handle.addEventListener("pointercancel", onPointerCancel);
    });
  }
  // ---------- 划词添加药丸(普通笔记,阅读/编辑两种模式) ----------
  removeSelPill() {
    this._aliasSearch?.close();
    this._aliasSearch = null;
    if (this._selPill) { this._selPill.remove(); this._selPill = null; }
  }
  maybeShowSelPill(e: Pick<MouseEvent, "target">, fromEpubIframe = false): void {
    if (!this.settings.selectionPill) return;
    const tgt = eventElement(e.target);
    // 点到自己的 UI(药丸/悬浮卡/菜单)不处理,避免抢选区
    if (tgt?.closest(".lexis-sel-pill, .lexis-popover, .menu")) return;
    const sourceDoc = tgt?.ownerDocument || document;
    const sourceWin = sourceDoc.defaultView || window;
    const overlayDoc = tgt ? overlayDocumentFor(tgt) : sourceDoc;
    const overlayWin = overlayDoc.defaultView || window;
    let sel: Selection | null, text: string;
    try { sel = sourceWin.getSelection(); text = sel ? sel.toString().trim() : ""; } catch { return; }
    if (!text || text.length > 60 || /[\n\r]/.test(text)) { this.removeSelPill(); return; }
    // 选区必须落在 Markdown 笔记内容、PDF 文字层,或已识别的 EPUB iframe 里。
    const node = sel.anchorNode;
    const host = node ? (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement) : null;
    if (!host || (!fromEpubIframe && !host.closest(".markdown-source-view, .markdown-reading-view, .markdown-preview-view, .pdf-viewer, .pdf-container, .pdf-embed, .textLayer"))) { this.removeSelPill(); return; }
    let rect: Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">; try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch { return; }
    if (!rect || (!rect.width && !rect.height)) { this.removeSelPill(); return; }
    rect = readerRectInDocument(rect, sourceDoc, overlayDoc);
    this.removeSelPill();
    const known = this.index.has(this.resolveIndexKey(text));
    const selectedSourceFile = this.app.workspace.getActiveFile();
    const selectedSentence = (() => {
      const selectedNode = sel?.anchorNode;
      if (!selectedNode) return "";
      return this.extractSentence(selectedNode.textContent || "", sel?.anchorOffset || 0);
    })();
    const selectedPage = Number(host.closest("[data-page-number]")?.getAttribute("data-page-number")) || 0;
    const pill = overlayDoc.body.createDiv({ cls: "lexis-sel-pill" });
    // 阻止 mousedown 收起选区/夺焦(事件冒泡到 pill 即可覆盖子按钮)
    pill.addEventListener("mousedown", (ev) => ev.preventDefault());
    if (known) {
      const manual = manualLookupEnabled(this.settings);
      const b = pill.createSpan({ cls: "lexis-sel-pill-btn", text: `📖 ${this.t(manual ? "selection.lookupExisting" : "selection.openExisting")}` });
      b.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (manual) this.showManualLookup(this.resolveIndexKey(text), rect, overlayDoc, { file: selectedSourceFile, sentence: selectedSentence, page: selectedPage || undefined });
        else void this.addFromPill(text, undefined, { openExisting: true });
      });
    } else {
      const dicts = this.dictFolders();
      let selectedFolder = this.preferredSelectionFolder();
      const folderLabel = (f: string) => String(f || this.t("common.root")).split("/").pop() || "";
      const addB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "＋" });
      addB.setAttribute("title", this.t("selection.add"));
      addB.setAttribute("aria-label", this.t("selection.add"));
      addB.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        void this.addFromPill(text, selectedFolder);
      });
      let folderB: HTMLElement | null = null;
      if (dicts.length > 1) {
        folderB = pill.createSpan({ cls: "lexis-sel-pill-btn lexis-sel-pill-folder", text: folderLabel(selectedFolder) });
        folderB.setAttribute("title", this.t("selection.chooseDictionary"));
        folderB.setAttribute("aria-label", this.t("selection.chooseDictionary"));
        folderB.addEventListener("click", (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const menu = new obsidian.Menu();
          for (const f of dicts) menu.addItem((it) => it.setTitle(f || this.t("common.root")).setIcon(f === selectedFolder ? "check" : "folder").onClick(() => {
            selectedFolder = f;
            folderB?.setText(folderLabel(f));
            void this.rememberSelectionFolder(f);
          }));
          menu.showAtPosition({ x: ev.clientX, y: ev.clientY });
        });
      }
      // 设为别名:选一个已有词条(标题或别名都行),把当前选中的词并入它的 aliases
      const aliasB = pill.createSpan({ cls: "lexis-sel-pill-btn", text: "🔗" });
      aliasB.setAttribute("title", this.t("selection.alias"));
      aliasB.setAttribute("aria-label", this.t("selection.alias"));
      aliasB.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this._aliasSearch?.close();
        this._aliasSearch = openAliasCombobox({
          document: overlayDoc,
          anchor: pill,
          targets: collectAliasTargets(this.index),
          initialValue: text,
          placeholder: this.t("selection.aliasSearch"),
          createLabel: this.t("selection.aliasCreate"),
          existingLabel: (target) => this.t("selection.aliasExisting", { word: target.title }),
          emptyText: this.t("selection.aliasNoResults"),
          onCreate: (targetText) => {
            this.removeSelPill();
            void this.addWordFromSelection(targetText, null, null, selectedFolder, {
              alias: text,
              sentence: selectedSentence,
              sourceFile: selectedSourceFile,
              page: selectedPage,
            });
          },
          onPick: (target) => { this.removeSelPill(); void this.attachAlias(text, target.file); },
          onClose: () => { this._aliasSearch = null; },
        });
      });
      const actions = { add: addB, dictionary: folderB, alias: aliasB };
      for (const action of selectionPillActions(this.settings.selectionPillOrder)) {
        const element = actions[action];
        if (element) pill.appendChild(element);
      }
    }
    const { top, left } = positionSelectionPill(rect,
      { width: pill.offsetWidth, height: pill.offsetHeight },
      { width: overlayWin.innerWidth, height: overlayWin.innerHeight },
      { x: this.settings.selectionPillOffsetX ?? 0, y: this.settings.selectionPillOffsetY ?? 0 });
    pill.setCssStyles({ top: top + "px", left: left + "px" });
    this._selPill = pill;
  }
  preferredSelectionFolder() {
    const dicts = this.dictFolders();
    const saved = this.normalizeFolder(this.settings.lastSelectionFolder || "");
    return dicts.includes(saved) ? saved : (dicts[0] || "");
  }
  async rememberSelectionFolder(folder: string): Promise<void> {
    const value = this.normalizeFolder(folder || "");
    if (!this.dictFolders().includes(value) || this.settings.lastSelectionFolder === value) return;
    this.settings.lastSelectionFolder = value;
    await this.saveSettings();
  }
  async addFromPill(text: string, folder?: string, options: AddWordOptions = {}): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    const editor = (view && view.getMode && view.getMode() === "source" && view.editor) ? view.editor : null;
    this.removeSelPill();
    if (folder) await this.rememberSelectionFolder(folder);
    await this.addWordFromSelection(text, editor, view, folder, options);
  }

  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderInteractions.prototype);
  return descriptors;
}

export { createReaderInteractions, overlayDocumentFor, hasExpandedSelection };
