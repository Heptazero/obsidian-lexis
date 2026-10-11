type ReaderRect = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">;

/** Stay in the current Obsidian window, but climb every embedded reader frame. */
export function overlayAnchorFor(element: Element): Element {
  let anchor = element;
  while (anchor.ownerDocument.defaultView?.frameElement) {
    anchor = anchor.ownerDocument.defaultView.frameElement;
  }
  return anchor;
}

export function overlayDocumentFor(element: Element): Document {
  return overlayAnchorFor(element).ownerDocument;
}

/** Convert chapter coordinates, including frame borders and CSS scaling. */
export function readerRectInDocument(rect: ReaderRect, source: Document, destination: Document): ReaderRect {
  let result = rect;
  let current = source;
  while (current !== destination) {
    const frame = current.defaultView?.frameElement as HTMLElement | null;
    if (!frame) break;
    const bounds = frame.getBoundingClientRect();
    const scaleX = frame.offsetWidth ? bounds.width / frame.offsetWidth : 1;
    const scaleY = frame.offsetHeight ? bounds.height / frame.offsetHeight : 1;
    const left = bounds.left + (frame.clientLeft + result.left) * scaleX;
    const top = bounds.top + (frame.clientTop + result.top) * scaleY;
    const width = result.width * scaleX, height = result.height * scaleY;
    result = { left, top, width, height, right: left + width, bottom: top + height };
    current = frame.ownerDocument;
  }
  return result;
}

export function frameBelongsToDocument(frame: HTMLIFrameElement, root: Document): boolean {
  let current: Element | null = frame;
  while (current) {
    if (!current.isConnected) return false;
    const owner = current.ownerDocument;
    if (owner === root) return true;
    const parent = owner.defaultView?.frameElement as HTMLIFrameElement | null;
    // A navigated-away document may still report isConnected for its children.
    if (!parent || parent.contentDocument !== owner) return false;
    current = parent;
  }
  return false;
}
