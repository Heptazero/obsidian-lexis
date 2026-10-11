"use strict";

import type { App } from "obsidian";
import type { LexisSettings } from "./types";
import { automaticHighlighting } from "./highlight-mode";
import { refreshReadingHighlightsInPlace } from "./reading-highlights";
import { EpubSurfaces, EPUB_FRAMES } from "./epub-surfaces";
import { epubDocumentEvents } from "./epub-document-events";
import { frameBelongsToDocument } from "./reader-frame-geometry";

type DocumentEvents = ReturnType<typeof epubDocumentEvents>;
type EpubFrame = { load: () => void; document: Document | null; hooks: DocumentEvents["hooks"] | null; events: DocumentEvents | null };
type HighlightStyleOptions = { external?: boolean; pdf?: boolean };

function unbindEpubDocument(state: EpubFrame): void {
  state.events?.dispose();
  state.document = null;
  state.hooks = null;
  state.events = null;
}

function createEpubHighlights(): PropertyDescriptorMap {
  class EpubHighlights {
    declare app: App;
    declare settings: LexisSettings;
    declare _epubSurfaces: EpubSurfaces | null;
    declare _epubHostDocument: Document | null;
    declare _epubIframeFrames: Map<HTMLIFrameElement, EpubFrame> | null;
    declare wrapMatchesInElement: (element: HTMLElement, rejectSelector: string, styleOptions?: HighlightStyleOptions, excludeKeys?: Set<string> | null) => void;
    declare maybeShowSelPill: (event: Pick<MouseEvent, "target">, fromEpubIframe?: boolean) => void;
    declare onPointerDown: (event: PointerEvent) => void;
    declare onPointerMove: (event: PointerEvent) => void;
    declare onPointerUp: (event: PointerEvent) => void;
    declare onPointerCancel: () => void;
    declare onClick: (event: MouseEvent) => void;
    declare onMouseOut: (event: MouseEvent) => void;
    declare onMouseOver: (event: MouseEvent) => void;

    isEpubIframe(frame: Element): frame is HTMLIFrameElement {
      return frame.tagName === "IFRAME" && (frame.matches(EPUB_FRAMES)
        || frame.hasAttribute("enable-annotation") || !!this._epubSurfaces?.ownsChapter(frame as HTMLIFrameElement));
    }

    setupEpubIframeHighlight(document: Document = this._epubHostDocument || this.app.workspace.containerEl.ownerDocument) {
      this.teardownEpubIframeHighlight();
      this._epubHostDocument = document;
      this._epubIframeFrames = new Map();
      this._epubSurfaces = new EpubSurfaces(document, (frame) => this.observeEpubIframe(frame), () => this.pruneEpubIframes());
      this._epubSurfaces.start();
    }

    observeEpubIframe(frame: HTMLIFrameElement): void {
      if (!this._epubIframeFrames || !frame.isConnected || !this.isEpubIframe(frame)) return;
      if (!this._epubIframeFrames.has(frame)) {
        const load = () => this.scanEpubIframe(frame);
        this._epubIframeFrames.set(frame, { load, document: null, hooks: null, events: null });
        frame.addEventListener("load", load);
      }
      this.scanEpubIframe(frame);
    }

    scanEpubIframe(frame: HTMLIFrameElement): void {
      const state = this._epubIframeFrames?.get(frame);
      if (!state || !frame.isConnected || !this.isEpubIframe(frame)) return;
      let doc: Document | null;
      try { doc = frame.contentDocument; } catch { unbindEpubDocument(state); return; }
      if (state.document !== doc) unbindEpubDocument(state);
      if (!doc?.body) return;
      // Selection works independently of automatic highlighting and is bound first.
      if (!state.document) {
        const events = epubDocumentEvents(doc, this);
        state.document = doc;
        state.hooks = events.hooks;
        state.events = events;
      }
      // document.open() can clear listeners without replacing the Document object.
      // Re-adding the same callbacks is idempotent for ordinary rescans.
      state.events.bind();
      refreshReadingHighlightsInPlace(doc.body, (root) => {
        if (automaticHighlighting(this.settings)) {
          this.wrapMatchesInElement(root, "script,style,code,pre,.lexis-hl,.lexis-popover", { external: true });
        }
      });
    }

    pruneEpubIframes(): void {
      for (const [frame, state] of this._epubIframeFrames || []) {
        if (frameBelongsToDocument(frame, this._epubHostDocument)
          && (!this._epubSurfaces || this._epubSurfaces.ownsChapter(frame))) continue;
        frame.removeEventListener("load", state.load);
        unbindEpubDocument(state);
        this._epubIframeFrames.delete(frame);
      }
    }

    rescanEpubIframes() {
      this._epubSurfaces?.rescan();
    }

    teardownEpubIframeHighlight() {
      this._epubSurfaces?.dispose(); this._epubSurfaces = null;
      for (const [frame, state] of this._epubIframeFrames || []) {
        frame.removeEventListener("load", state.load);
        unbindEpubDocument(state);
      }
      this._epubIframeFrames = null;
      this._epubHostDocument = null;
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(EpubHighlights.prototype);
  return descriptors;
}

export { createEpubHighlights };
