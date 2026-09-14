// PDF text remains owned by PDF.js. Overlay anchors carry interaction geometry only.
type PdfTarget = { anchor: HTMLElement; source: Range };
const targets = new WeakMap<HTMLElement, PdfTarget[]>();
const sources = new WeakMap<HTMLElement, Range>();

export function setPdfTargets(layer: HTMLElement, items: PdfTarget[]): void {
  targets.set(layer, items);
  for (const { anchor, source } of items) sources.set(anchor, source);
}

export function pdfTargetSource(anchor: HTMLElement): Range | undefined {
  return sources.get(anchor);
}

export function pdfHighlightAt(event: MouseEvent): HTMLElement | null {
  const node = event.target as Node | null;
  const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
  if (!element || element.closest('.lexis-popover, .annotationLayer, a, button')) return null;
  const layer = element.closest('.textLayer') || element.closest('.page')?.querySelector(':scope > .textLayer');
  if (!layer) return null;
  for (const { anchor } of targets.get(layer as HTMLElement) || []) {
    if (!anchor.isConnected || anchor.closest('.is-geometry-changing, .lexis-page-highlights-hidden')) continue;
    const rect = anchor.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return anchor;
  }
  return null;
}
