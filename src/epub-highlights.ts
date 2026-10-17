import type { LexisSettings } from "./types";
import { automaticHighlighting } from "./highlight-mode";
import { refreshReadingHighlightsInPlace } from "./reading-highlights";
import { EpubSurfaces, EPUB_FRAMES } from "./epub-surfaces";
import { epubDocumentEvents, type EpubInteractions } from "./epub-document-events";
import { frameBelongsToDocument } from "./reader-frame-geometry";

interface EpubHighlightHost extends EpubInteractions {
  readonly settings: Pick<LexisSettings, "enableHighlight" | "highlightMode">;
  wrapMatchesInElement(element: HTMLElement, rejectSelector: string, options: { external: boolean }): void;
}

type DocumentEvents = ReturnType<typeof epubDocumentEvents>;
type Chapter = { load: () => void; document: Document | null; events: DocumentEvents | null };

function releaseDocument(chapter: Chapter): void {
  chapter.events?.dispose();
  chapter.document = null;
  chapter.events = null;
}

/** Owns chapter listeners and discovery; the host supplies rendering and actions only. */
export class EpubHighlights {
  private surfaces: EpubSurfaces | null = null;
  private document: Document | null = null;
  private readonly chapters = new Map<HTMLIFrameElement, Chapter>();

  constructor(private readonly host: EpubHighlightHost) {}

  start(document: Document): void {
    this.dispose();
    this.document = document;
    this.surfaces = new EpubSurfaces(document, (frame) => this.observe(frame), () => this.prune());
    this.surfaces.start();
  }

  rescan(): void { this.surfaces?.rescan(); }

  dispose(): void {
    this.surfaces?.dispose();
    this.surfaces = null;
    for (const [frame, chapter] of this.chapters) {
      frame.removeEventListener("load", chapter.load);
      releaseDocument(chapter);
    }
    this.chapters.clear();
    this.document = null;
  }

  private owns(frame: HTMLIFrameElement): boolean {
    return frame.matches(EPUB_FRAMES) || frame.hasAttribute("enable-annotation") || !!this.surfaces?.ownsChapter(frame);
  }

  private observe(frame: HTMLIFrameElement): void {
    if (!this.document || !frame.isConnected || !this.owns(frame)) return;
    if (!this.chapters.has(frame)) {
      const load = () => this.scan(frame);
      this.chapters.set(frame, { load, document: null, events: null });
      frame.addEventListener("load", load);
    }
    this.scan(frame);
  }

  private scan(frame: HTMLIFrameElement): void {
    const chapter = this.chapters.get(frame);
    if (!chapter || !frame.isConnected || !this.owns(frame)) return;
    let document: Document | null;
    try { document = frame.contentDocument; } catch { releaseDocument(chapter); return; }
    if (chapter.document !== document) releaseDocument(chapter);
    if (!document?.body) return;
    // Bind before rendering: selection remains usable if rendering fails or is disabled.
    if (!chapter.document) {
      chapter.events = epubDocumentEvents(document, this.host);
      chapter.document = document;
    }
    // document.open() clears callbacks without necessarily replacing the Document.
    chapter.events.bind();
    refreshReadingHighlightsInPlace(document.body, (root) => {
      if (automaticHighlighting(this.host.settings)) {
        this.host.wrapMatchesInElement(root, "script,style,code,pre,.lexis-hl,.lexis-popover", { external: true });
      }
    });
  }

  private prune(): void {
    for (const [frame, chapter] of this.chapters) {
      if (frameBelongsToDocument(frame, this.document) && this.surfaces?.ownsChapter(frame)) continue;
      frame.removeEventListener("load", chapter.load);
      releaseDocument(chapter);
      this.chapters.delete(frame);
    }
  }
}
