"use strict";

import * as obsidian from "obsidian";
import type { App, Component as ObsidianComponent, Editor, MarkdownView, TFile as ObsidianTFile } from "obsidian";
import type { LexisEntry, LexisSettings } from "./types";

type AddWordOptions = { openExisting?: boolean };
type TranslationVars = Record<string, string | number | boolean>;

interface ReaderInteractionDependencies {
  openAliasPicker: (app: App, plugin: object, text: string, select: (entry: LexisEntry) => Promise<void>) => void;
}

function eventElement(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return null;
  const node = target as Node;
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  return element && "dataset" in element ? element : null;
}

function closestHighlight(target: EventTarget | null): HTMLElement | null {
  return eventElement(target)?.closest<HTMLElement>(".lexis-hl,.lexis-pdf-hl") || null;
}

function overlayDocumentFor(element: Element): Document {
  const sourceDocument = element.ownerDocument;
  return sourceDocument.defaultView?.frameElement?.ownerDocument || sourceDocument;
}

function createReaderInteractions({ openAliasPicker }: ReaderInteractionDependencies): PropertyDescriptorMap {
  class ReaderInteractions {
  declare app: App;
  declare settings: LexisSettings;
  declare index: Map<string, LexisEntry>;
  declare _hideTimer: number;
  declare _showTimer: number | null;
  declare _showTarget: HTMLElement | null;
  declare _popover: HTMLElement | null;
  declare _popoverComp: ObsidianComponent | null;
  declare _selPill: HTMLElement | null;
  declare addWordFromSelection: (text: string, editor: Editor | null, view: MarkdownView | null, folder?: string, options?: AddWordOptions) => Promise<void>;
  declare attachAlias: (aliasText: string, file: ObsidianTFile) => Promise<void>;
  declare dictFolders: () => string[];
  declare normalizeFolder: (folder: string) => string;
  declare openInlineEntry: (entry: LexisEntry, newTab: boolean) => Promise<void>;
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
    return closestHighlight(event.target);
  }
  onMouseOver(e: MouseEvent): void {
    const t = this.highlightTarget(e);
    if (!t) return;
    window.clearTimeout(this._hideTimer);
    if (this._popover?.dataset.lexisKey === t.dataset.lexisKey) return;
    if (this._showTarget === t) return;
    window.clearTimeout(this._showTimer);
    this._showTarget = t;
    const open = () => {
      this._showTimer = null;
      if (this._showTarget === t && t.isConnected) void this.showPopover(t);
    };
    const delay = Math.max(0, Number(this.settings.hoverDelayMs) || 0);
    if (delay) this._showTimer = window.setTimeout(open, delay); else open();
  }
  onMouseOut(e: MouseEvent): void {
    const t = this.highlightTarget(e);
    if (!t) return;
    if (this._showTarget === t) {
      window.clearTimeout(this._showTimer);
      this._showTimer = null;
      this._showTarget = null;
    }
    if (this._popover?.dataset.lexisKey === t.dataset.lexisKey) this.scheduleHide();
  }
  onClick(e: MouseEvent): void {
    const t = this.highlightTarget(e);
    if (t) {
      const entry = this.index.get(t.dataset.lexisKey);
      if (entry) {
        e.preventDefault();
        if (entry.inline) void this.openInlineEntry(entry, e.ctrlKey || e.metaKey);
        else { void this.app.workspace.getLeaf(e.ctrlKey || e.metaKey ? "tab" : false).openFile(entry.file); this.removePopover(); }
      }
    } else if (this._popover && !this._popover.contains(eventElement(e.target))) this.removePopover();
  }
  scheduleHide() {
    window.clearTimeout(this._hideTimer);
    this._hideTimer = window.setTimeout(() => {
      if (this._popover?.dataset.lexisResizing !== "1") this.removePopover();
    }, 220);
  }
  removePopover() {
    window.clearTimeout(this._showTimer);
    this._showTimer = null;
    this._showTarget = null;
    if (this._popoverComp) { this._popoverComp.unload(); this._popoverComp = null; }
    if (this._popover) { this._popover.remove(); this._popover = null; }
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
      window.clearTimeout(this._hideTimer);
      const start = popover.getBoundingClientRect();
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
          popover.setCssStyles({ width: `${start.width}px`, height: `${start.height}px`, maxHeight: `${start.height}px` });
        } else {
          const result = popover.getBoundingClientRect();
          this.settings.popoverWidth = Math.round(result.width);
          this.settings.popoverMaxHeight = Math.round(result.height);
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
  removeSelPill() { if (this._selPill) { this._selPill.remove(); this._selPill = null; } }
  maybeShowSelPill(e: MouseEvent, fromEpubIframe = false): void {
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
    if (sourceWin.frameElement && sourceWin.frameElement.ownerDocument === overlayDoc) {
      const frameRect = sourceWin.frameElement.getBoundingClientRect();
      rect = { left: rect.left + frameRect.left, right: rect.right + frameRect.left, top: rect.top + frameRect.top, bottom: rect.bottom + frameRect.top, width: rect.width, height: rect.height };
    }
    this.removeSelPill();
    const known = this.index.has(text.toLowerCase());
    const pill = overlayDoc.body.createDiv({ cls: "lexis-sel-pill" });
    // 阻止 mousedown 收起选区/夺焦(事件冒泡到 pill 即可覆盖子按钮)
    pill.addEventListener("mousedown", (ev) => ev.preventDefault());
    if (known) {
      const b = pill.createSpan({ cls: "lexis-sel-pill-btn", text: `📖 ${this.t("selection.openExisting")}` });
      b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); void this.addFromPill(text, undefined, { openExisting: true }); });
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
      if (dicts.length > 1) {
        const folderB = pill.createSpan({ cls: "lexis-sel-pill-btn lexis-sel-pill-folder", text: `📁 ${folderLabel(selectedFolder)}` });
        folderB.setAttribute("title", this.t("selection.chooseDictionary"));
        folderB.addEventListener("click", (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const menu = new obsidian.Menu();
          for (const f of dicts) menu.addItem((it) => it.setTitle(f || this.t("common.root")).setIcon(f === selectedFolder ? "check" : "folder").onClick(() => {
            selectedFolder = f;
            folderB.setText(`📁 ${folderLabel(f)}`);
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
        this.removeSelPill();
        openAliasPicker(this.app, this, text, (entry) => this.attachAlias(text, entry.file));
      });
    }
    // 定位:选区下方略偏左;贴边时夹回视口
    const top = Math.min(rect.bottom + 6, overlayWin.innerHeight - 36);
    const left = Math.max(6, Math.min(rect.left, overlayWin.innerWidth - pill.offsetWidth - 6));
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

export { createReaderInteractions, overlayDocumentFor };
