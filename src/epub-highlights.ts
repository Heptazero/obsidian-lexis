"use strict";

import type { App } from "obsidian";
import type { LexisSettings } from "./types";

type EpubHooks = { over: (event: MouseEvent) => void; out: (event: MouseEvent) => void; click: (event: MouseEvent) => void; mouseup: (event: MouseEvent) => void };
type ObserverWindow = Window & { MutationObserver: typeof MutationObserver };
type HighlightStyleOptions = { external?: boolean; pdf?: boolean };

function createEpubHighlights(): PropertyDescriptorMap {
  class EpubHighlights {
    declare app: App;
    declare settings: LexisSettings;
    declare _epubIframeObserver: MutationObserver | null;
    declare _epubHostDocument: Document | null;
    declare _epubIframeFrames: WeakSet<HTMLIFrameElement> | null;
    declare _epubIframeDocs: Map<Document, EpubHooks> | null;
    declare wrapMatchesInElement: (element: HTMLElement, rejectSelector: string, styleOptions?: HighlightStyleOptions, excludeKeys?: Set<string> | null) => void;
    declare maybeShowSelPill: (event: MouseEvent, fromEpubIframe?: boolean) => void;
    declare onClick: (event: MouseEvent) => void;
    declare onMouseOut: (event: MouseEvent) => void;
    declare onMouseOver: (event: MouseEvent) => void;

    isEpubIframe(frame: Element): frame is HTMLIFrameElement {
      return frame.tagName === "IFRAME" && (
        frame.hasAttribute("enable-annotation") ||
        frame.matches?.(".epub-reader-area iframe, .epub-container iframe, .epub-view iframe") ||
        frame.closest(".epub-reader-area, .epub-container, .epub-view")
      ) != null;
    }

    setupEpubIframeHighlight(document: Document = this._epubHostDocument || this.app.workspace.containerEl.ownerDocument) {
      this.teardownEpubIframeHighlight();
      this._epubHostDocument = document;
      this._epubIframeFrames = new WeakSet();
      this._epubIframeDocs = new Map();
      const MutationObserverConstructor = (document.defaultView as ObserverWindow | null)?.MutationObserver || MutationObserver;
      this._epubIframeObserver = new MutationObserverConstructor((muts) => {
        for (const mu of muts) for (const node of mu.addedNodes) {
          if (node.nodeType !== 1) continue;
          const element = node as Element;
          if (this.isEpubIframe(element)) this.observeEpubIframe(element);
          element.querySelectorAll<HTMLIFrameElement>("iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe").forEach((frame) => this.observeEpubIframe(frame));
        }
      });
      this._epubIframeObserver.observe(document.body, { childList: true, subtree: true });
      this.rescanEpubIframes();
    }

    observeEpubIframe(frame: HTMLIFrameElement): void {
      if (!this.isEpubIframe(frame)) return;
      if (!this._epubIframeFrames.has(frame)) {
        this._epubIframeFrames.add(frame);
        frame.addEventListener("load", () => this.scanEpubIframe(frame));
      }
      this.scanEpubIframe(frame);
    }

    scanEpubIframe(frame: HTMLIFrameElement): void {
      if (!this.settings.enableHighlight || !this.isEpubIframe(frame)) return;
      let doc: Document | null;
      try { doc = frame.contentDocument; } catch { return; }
      if (!doc?.body) return;
      doc.querySelectorAll(".lexis-hl").forEach((span) => {
        const textNode = doc.createTextNode(span.textContent || "");
        span.parentNode?.replaceChild(textNode, span);
      });
      doc.body.normalize();
      this.wrapMatchesInElement(doc.body, "script,style,code,pre,.lexis-hl,.lexis-popover", { external: true });
      if (this._epubIframeDocs.has(doc)) return;
      const over = (event: MouseEvent) => this.onMouseOver(event);
      const out = (event: MouseEvent) => this.onMouseOut(event);
      const click = (event: MouseEvent) => this.onClick(event);
      const mouseup = (event: MouseEvent) => this.maybeShowSelPill(event, true);
      doc.addEventListener("mouseover", over);
      doc.addEventListener("mouseout", out);
      doc.addEventListener("click", click);
      doc.addEventListener("mouseup", mouseup);
      this._epubIframeDocs.set(doc, { over, out, click, mouseup });
    }

    rescanEpubIframes() {
      const document = this._epubHostDocument || this.app.workspace.containerEl.ownerDocument;
      document.querySelectorAll<HTMLIFrameElement>("iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe").forEach((frame) => this.observeEpubIframe(frame));
    }

    teardownEpubIframeHighlight() {
      if (this._epubIframeObserver) { this._epubIframeObserver.disconnect(); this._epubIframeObserver = null; }
      if (this._epubIframeDocs) {
        for (const [doc, hooks] of this._epubIframeDocs) {
          doc.removeEventListener("mouseover", hooks.over);
          doc.removeEventListener("mouseout", hooks.out);
          doc.removeEventListener("click", hooks.click);
          doc.removeEventListener("mouseup", hooks.mouseup);
        }
      }
      this._epubIframeDocs = null;
      this._epubIframeFrames = null;
      this._epubHostDocument = null;
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(EpubHighlights.prototype);
  return descriptors;
}

export { createEpubHighlights };
