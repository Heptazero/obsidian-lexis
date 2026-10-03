function eventElement(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof target !== "object" || !("nodeType" in target)) return null;
  const node = target as Node;
  return node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
}

function pointInside(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function pointInsideElement(element: HTMLElement, x: number, y: number): boolean {
  return Array.from(element.getClientRects()).some((rect) => pointInside(rect, x, y));
}

/**
 * Canvas preview mode places an interaction surface above rendered Markdown cards.
 * The Lexis spans still exist below it, so resolve them by viewport position without
 * changing Canvas pointer-events or node dragging behavior.
 */
export function canvasHighlightAt(event: MouseEvent): HTMLElement | null {
  const target = eventElement(event.target);
  const canvas = target?.closest<HTMLElement>(".canvas-wrapper,.canvas");
  if (!canvas) return null;

  const document = canvas.ownerDocument;
  for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
    const highlight = element.closest<HTMLElement>(".canvas-node .lexis-hl,.canvas-path-label-wrapper .lexis-hl");
    if (highlight && canvas.contains(highlight)) return highlight;
  }

  for (const highlight of canvas.querySelectorAll<HTMLElement>(".canvas-node .lexis-hl,.canvas-path-label-wrapper .lexis-hl")) {
    if (pointInsideElement(highlight, event.clientX, event.clientY)) return highlight;
  }
  return null;
}
