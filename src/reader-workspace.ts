import type { EpubHighlights } from "./epub-highlights";
import type { EpubInteractions } from "./epub-document-events";
import type { CanvasEdgeHighlights } from "./canvas-edge-highlights";
import { WorkspaceDocuments, type WorkspaceDocumentHost } from "./workspace-documents";

interface ReaderWorkspaceHost extends WorkspaceDocumentHost, EpubInteractions {
  readonly epubHighlights: Pick<EpubHighlights, "start">;
  readonly _canvasEdgeHighlights: Pick<CanvasEdgeHighlights, "activate" | "close">;
  readonly _popover: HTMLElement | null;
  readonly _selPill: HTMLElement | null;
  onMouseMove(event: MouseEvent): void;
  removePopover(): void;
  removeSelPill(): void;
  setupPdfHighlight(document: Document): void;
  applyReviewMetadataVisibility(): void;
  syncActivePageHighlightState(): void;
}

/** Workspace events route to reader services; they do not own those services' state. */
export function createReaderWorkspace(host: ReaderWorkspaceHost): WorkspaceDocuments {
  return new WorkspaceDocuments(host, {
    mousemove: (event) => host.onMouseMove(event),
    mouseover: (event) => host.onMouseOver(event),
    mouseout: (event) => host.onMouseOut(event),
    click: (event) => host.onClick(event),
    pointerdown: (event) => host.onPointerDown(event),
    pointermove: (event) => host.onPointerMove(event),
    pointerup: (event) => host.onPointerUp(event),
    pointercancel: () => host.onPointerCancel(),
    mouseup: (event) => host.maybeShowSelPill(event),
    escape: () => host.removeSelPill(),
    scroll: (event) => {
      host.onPointerCancel();
      const target = event.target;
      const node = target && typeof target === "object" && "nodeType" in target ? target as Node : null;
      if (host._popover && node && host._popover.contains(node)) return;
      const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
      if (element?.closest(".lexis-alias-search")) return;
      host.removePopover();
      host.removeSelPill();
    },
    activate: (document, documentChanged) => {
      host._canvasEdgeHighlights.activate(document);
      if (documentChanged) {
        host.setupPdfHighlight(document);
        host.epubHighlights.start(document);
      }
      host.applyReviewMetadataVisibility();
      host.syncActivePageHighlightState();
    },
    close: (document) => {
      host._canvasEdgeHighlights.close(document);
      if (host._popover?.ownerDocument === document) host.removePopover();
      if (host._selPill?.ownerDocument === document) host.removeSelPill();
    },
  });
}
