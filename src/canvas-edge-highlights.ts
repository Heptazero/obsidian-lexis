import type { LexisEntry, LexisSettings } from "./types";
import { textHighlightMatches } from "./text-highlight-matches";

interface CanvasEdgeHighlightHost {
  settings: LexisSettings;
  index: Map<string, LexisEntry>;
  _pattern: string | null;
  _indexBuildId: number;
  resolveMatchKey(value: string): string;
  inlineStyleForEntry(entry: LexisEntry | undefined, options?: { external?: boolean }): string;
}

interface DocumentState {
  observer: MutationObserver;
  input: (event: Event) => void;
  frame: number;
}

export function edgeLabelMatches(
  text: string,
  pattern: string | null,
  resolveKey: (value: string) => string,
  index: Map<string, LexisEntry>,
): ReturnType<typeof textHighlightMatches> {
  return textHighlightMatches(text, pattern, resolveKey, index);
}

function containsEdgeLabel(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as Element;
  return element.matches(".canvas-path-label-wrapper, .canvas-path-label-wrapper *")
    || !!element.querySelector(".canvas-path-label-wrapper");
}

export class CanvasEdgeHighlights {
  private readonly documents = new Map<Document, DocumentState>();

  constructor(private readonly host: CanvasEdgeHighlightHost) {}

  activate(document: Document): void {
    if (!document.body) return;
    if (!this.documents.has(document)) {
      const Observer = document.defaultView?.MutationObserver || MutationObserver;
      const observer = new Observer((mutations) => {
        if (!mutations.some((mutation) => {
          if ((mutation.target as Element).closest?.(".lexis-canvas-edge-hl-layer")) return false;
          return containsEdgeLabel(mutation.target)
            || [...mutation.addedNodes, ...mutation.removedNodes].some(containsEdgeLabel);
        })) return;
        this.schedule(document);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const input = (event: Event) => {
        const target = event.target;
        const textarea = target && typeof target === "object" && "nodeType" in target && (target as Node).nodeType === Node.ELEMENT_NODE
          ? target as HTMLTextAreaElement
          : null;
        if (textarea?.tagName === "TEXTAREA" && textarea.closest(".canvas-path-label-wrapper")) this.schedule(document);
      };
      document.addEventListener("input", input, true);
      document.addEventListener("scroll", input, true);
      this.documents.set(document, { observer, input, frame: 0 });
    }
    this.schedule(document);
  }

  close(document: Document): void {
    const state = this.documents.get(document);
    if (!state) return;
    state.observer.disconnect();
    document.removeEventListener("input", state.input, true);
    document.removeEventListener("scroll", state.input, true);
    document.defaultView?.cancelAnimationFrame(state.frame);
    document.querySelectorAll(".lexis-canvas-edge-hl-layer").forEach((element) => element.remove());
    this.documents.delete(document);
  }

  destroy(): void {
    for (const document of [...this.documents.keys()]) this.close(document);
  }

  refresh(): void {
    for (const document of this.documents.keys()) this.schedule(document, true);
  }

  private schedule(document: Document, force = false): void {
    const state = this.documents.get(document);
    if (!state) return;
    if (force) document.querySelectorAll<HTMLElement>(".lexis-canvas-edge-hl-layer").forEach((layer) => delete layer.dataset.lexisSignature);
    if (state.frame) return;
    state.frame = (document.defaultView || window).requestAnimationFrame(() => {
      state.frame = 0;
      this.render(document);
    });
  }

  private render(document: Document): void {
    for (const wrapper of document.querySelectorAll<HTMLElement>(".canvas-path-label-wrapper")) this.renderLabel(wrapper);
  }

  private renderLabel(wrapper: HTMLElement): void {
    const textarea = wrapper.querySelector<HTMLTextAreaElement>("textarea");
    let layer = wrapper.querySelector<HTMLElement>(":scope > .lexis-canvas-edge-hl-layer");
    const active = this.host.settings.enableHighlight && this.host._pattern && this.host.index.size;
    const matches = active
      ? edgeLabelMatches(textarea?.value || "", this.host._pattern, (value) => this.host.resolveMatchKey(value), this.host.index)
      : [];
    if (!textarea || !matches.length) {
      layer?.remove();
      return;
    }

    const signature = [
      this.host._indexBuildId || 0,
      textarea.value,
      textarea.scrollLeft,
      textarea.scrollTop,
      ...matches.map((match) => `${match.start}:${match.end}:${match.key}:${this.host.inlineStyleForEntry(match.entry, { external: true })}`),
    ].join("|");
    if (layer?.dataset.lexisSignature === signature) return;
    if (!layer) {
      layer = wrapper.createDiv({ cls: "lexis-canvas-edge-hl-layer", attr: { "aria-hidden": "true" } });
    }
    layer.dataset.lexisSignature = signature;
    layer.replaceChildren();

    const content = layer.createDiv({ cls: "lexis-canvas-edge-hl-content" });
    this.copyTypography(textarea, content);
    content.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    let offset = 0;
    for (const match of matches) {
      if (match.start > offset) content.appendChild(content.ownerDocument.createTextNode(textarea.value.slice(offset, match.start)));
      const highlight = content.createSpan({ cls: "lexis-hl lexis-canvas-edge-hl", text: textarea.value.slice(match.start, match.end) });
      highlight.dataset.lexisKey = match.key;
      highlight.setAttribute("style", `${this.host.inlineStyleForEntry(match.entry, { external: true })};padding:0;`);
      offset = match.end;
    }
    if (offset < textarea.value.length) content.appendChild(content.ownerDocument.createTextNode(textarea.value.slice(offset)));
  }

  private copyTypography(source: HTMLTextAreaElement, target: HTMLElement): void {
    const style = source.ownerDocument.defaultView?.getComputedStyle(source);
    if (!style) return;
    target.style.fontFamily = style.fontFamily;
    target.style.fontSize = style.fontSize;
    target.style.fontStyle = style.fontStyle;
    target.style.fontWeight = style.fontWeight;
    target.style.borderStyle = style.borderStyle;
    target.style.borderWidth = style.borderWidth;
    target.style.letterSpacing = style.letterSpacing;
    target.style.lineHeight = style.lineHeight;
    target.style.padding = style.padding;
    target.style.textAlign = style.textAlign;
    target.style.textIndent = style.textIndent;
    target.style.textTransform = style.textTransform;
    target.style.wordSpacing = style.wordSpacing;
  }
}
