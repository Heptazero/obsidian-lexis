import { overlayDocumentFor } from "./reader-frame-geometry";

export interface EpubInteractions {
  onMouseOver(event: MouseEvent): void;
  onMouseOut(event: MouseEvent): void;
  onClick(event: MouseEvent): void;
  onPointerDown(event: PointerEvent): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void;
  onPointerCancel(): void;
  maybeShowSelPill(event: Pick<MouseEvent, "target">, fromEpub?: boolean): void;
}

export function epubDocumentEvents(document: Document, host: EpubInteractions) {
  // EPUB sandboxes can forbid scripts/timers. Schedule in the Obsidian window.
  const window = document.defaultView ? overlayDocumentFor(document.body).defaultView : null;
  let timer: number | null = null;
  let previous: Range | null = null;
  let dragging = false;
  const cancel = () => { if (timer !== null) window?.clearTimeout(timer); timer = null; };
  const remember = () => {
    const selection = document.defaultView?.getSelection();
    previous = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  };
  const schedule = () => {
    cancel();
    if (dragging || !window) return;
    timer = window.setTimeout(() => {
      timer = null;
      const selection = document.defaultView?.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (range && previous && range.startContainer === previous.startContainer && range.startOffset === previous.startOffset
        && range.endContainer === previous.endContainer && range.endOffset === previous.endOffset) return;
      host.maybeShowSelPill({ target: selection?.anchorNode || document.body }, true);
      remember();
    }, 180);
  };
  const hooks: Record<string, EventListener> = {
    mouseover: (event) => host.onMouseOver(event as MouseEvent),
    mouseout: (event) => host.onMouseOut(event as MouseEvent),
    click: (event) => host.onClick(event as MouseEvent),
    mouseup: (event) => { dragging = false; cancel(); host.maybeShowSelPill(event, true); remember(); },
    pointerdown: (event) => { dragging = true; previous = null; cancel(); host.onPointerDown(event as PointerEvent); },
    pointermove: (event) => host.onPointerMove(event as PointerEvent),
    pointerup: (event) => { dragging = false; host.onPointerUp(event as PointerEvent); schedule(); },
    pointercancel: () => { dragging = false; cancel(); host.onPointerCancel(); },
    touchstart: () => { dragging = true; previous = null; cancel(); },
    touchend: () => { dragging = false; schedule(); },
    selectionchange: schedule,
    keyup: schedule,
  };
  return {
    hooks,
    bind: () => { for (const [event, hook] of Object.entries(hooks)) document.addEventListener(event, hook, { capture: true }); },
    dispose: () => { cancel(); for (const [event, hook] of Object.entries(hooks)) document.removeEventListener(event, hook, { capture: true }); },
  };
}
