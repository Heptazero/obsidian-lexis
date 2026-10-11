import { frameBelongsToDocument } from "./reader-frame-geometry";

export const EPUB_FRAMES = "iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe";
const ANNOTATOR_SHELLS = '.workspace-leaf-content[data-type="pdf-annotator"] iframe';
// react-offline-iframe inserts a proxy frame between the Obsidian view and EPUB.js.
const ANNOTATOR_EPUB_PROXY = 'iframe[patched-src*="/demos/epub/epub.js/"]';
type ObserverWindow = Window & { MutationObserver: typeof MutationObserver };
type FoliateView = Element & { renderer?: { getContents(): { doc: Document | null }[] } };
type Shell = { load: () => void; document: Document | null };

/** Discover chapter documents; rendering and interactions belong to the caller. */
export class EpubSurfaces {
  private documents = new Map<Document, { body: HTMLElement; observer: MutationObserver }>();
  private shells = new Map<HTMLIFrameElement, Shell>();
  private foliate = new Map<FoliateView, EventListener>();
  private chapters = new Set<HTMLIFrameElement>();

  constructor(private root: Document, private onChapter: (frame: HTMLIFrameElement) => void, private onPrune: () => void) {}

  start(): void { this.watchDocument(this.root); }

  ownsChapter(frame: HTMLIFrameElement): boolean { return this.chapters.has(frame); }

  private watchDocument(document: Document): void {
    if (!document.body || this.documents.get(document)?.body === document.body) return;
    this.documents.get(document)?.observer.disconnect();
    const Constructor = (document.defaultView as ObserverWindow).MutationObserver;
    const observer = new Constructor((mutations) => {
      if (mutations.some((mutation) => mutation.removedNodes.length)) this.prune();
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) this.scanNode(node as Element, document !== this.root);
      }
    });
    this.documents.set(document, { body: document.body, observer });
    observer.observe(document.body, { childList: true, subtree: true });
    this.scanNode(document.body, document !== this.root);
  }

  private scanNode(node: Element, inShell: boolean): void {
    const selector = `${EPUB_FRAMES},${ANNOTATOR_SHELLS},foliate-view${inShell ? `,${ANNOTATOR_EPUB_PROXY},#viewer iframe` : ""}`;
    const candidates = [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)];
    for (const candidate of candidates) {
      if (candidate.tagName.toLowerCase() === "foliate-view") this.observeFoliate(candidate);
      else if (candidate.matches(EPUB_FRAMES) || (inShell && candidate.matches("#viewer iframe"))) {
        const frame = candidate as HTMLIFrameElement;
        this.chapters.add(frame);
        this.onChapter(frame);
      } else this.observeShell(candidate as HTMLIFrameElement);
    }
  }

  private observeShell(frame: HTMLIFrameElement): void {
    if (!this.shells.has(frame)) {
      const load = () => this.scanShell(frame);
      this.shells.set(frame, { load, document: null });
      frame.addEventListener("load", load);
    }
    this.scanShell(frame);
  }

  private scanShell(frame: HTMLIFrameElement): void {
    const state = this.shells.get(frame);
    if (!state || !frameBelongsToDocument(frame, this.root)) return;
    let document: Document | null;
    try { document = frame.contentDocument; } catch { return; }
    if (state.document !== document) {
      if (state.document) { this.documents.get(state.document)?.observer.disconnect(); this.documents.delete(state.document); }
      state.document = document;
      this.prune();
    }
    if (document?.body) {
      this.watchDocument(document);
    }
  }

  private observeFoliate(view: FoliateView): void {
    if (!this.foliate.has(view)) {
      const update = () => this.scanFoliate(view);
      this.foliate.set(view, update);
      view.addEventListener("load", update);
      view.addEventListener("relocate", update);
    }
    this.scanFoliate(view);
  }

  private scanFoliate(view: FoliateView): void {
    // Foliate uses closed shadow roots. Its public document API avoids patching them.
    const active = new Map<HTMLIFrameElement, Document>();
    for (const { doc } of view.renderer?.getContents() || []) {
      const frame = doc?.defaultView?.frameElement as HTMLIFrameElement | null;
      if (frame && frameBelongsToDocument(frame, this.root)) {
        active.set(frame, doc);
        this.chapters.add(frame);
        // Relocation is frequent; unchanged chapter documents must not be rewritten.
        if (this.foliateChapters.get(view)?.get(frame) !== doc) this.onChapter(frame);
      }
    }
    for (const frame of this.foliateChapters.get(view)?.keys() || []) if (!active.has(frame)) this.chapters.delete(frame);
    this.foliateChapters.set(view, active);
    this.onPrune();
  }
  private foliateChapters = new Map<FoliateView, Map<HTMLIFrameElement, Document>>();

  prune(): void {
    for (const [frame, state] of this.shells) if (!frameBelongsToDocument(frame, this.root)) {
      frame.removeEventListener("load", state.load);
      if (state.document) { this.documents.get(state.document)?.observer.disconnect(); this.documents.delete(state.document); }
      this.shells.delete(frame);
    }
    for (const [view, update] of this.foliate) if (!view.isConnected) {
      view.removeEventListener("load", update); view.removeEventListener("relocate", update);
      for (const frame of this.foliateChapters.get(view)?.keys() || []) this.chapters.delete(frame);
      this.foliateChapters.delete(view); this.foliate.delete(view);
    }
    for (const frame of this.chapters) if (!frameBelongsToDocument(frame, this.root)) this.chapters.delete(frame);
    this.onPrune();
  }

  rescan(): void {
    this.prune();
    for (const document of this.documents.keys()) this.scanNode(document.body, document !== this.root);
    for (const view of this.foliate.keys()) {
      this.scanFoliate(view);
      for (const frame of this.foliateChapters.get(view)?.keys() || []) this.onChapter(frame);
    }
  }

  dispose(): void {
    for (const { observer } of this.documents.values()) observer.disconnect();
    for (const [frame, state] of this.shells) frame.removeEventListener("load", state.load);
    for (const [view, update] of this.foliate) { view.removeEventListener("load", update); view.removeEventListener("relocate", update); }
    this.documents.clear(); this.shells.clear(); this.foliate.clear(); this.foliateChapters.clear(); this.chapters.clear();
  }
}
