import { createDocumentHighlights } from '../../src/document-highlights';
import { pdfHighlightAt, pdfTargetSource } from '../../src/pdf-highlight-targets';

// Minimal Obsidian DOM conveniences, without running or clicking the user's app.
Object.assign(HTMLElement.prototype, {
  createDiv({ cls }: { cls: string }) {
    const element = document.createElement('div');
    element.className = cls;
    this.appendChild(element);
    return element;
  },
  setCssStyles(styles: Record<string, string>) { Object.assign(this.style, styles); },
  empty() { this.replaceChildren(); },
});

const host = Object.defineProperties({
  settings: { enablePdfHighlight: true, enableHighlight: true },
  index: new Map(['alpha', 'beta', 'gamma', 'energy'].map(key => [key, { inline: true, display: key }])),
  _pattern: 'alpha|beta|gamma|energy',
  resolveMatchKey: (key: string) => key,
  colorForEntry: () => '#7755cc',
  highlightAlphaForEntry: () => 1,
  highlightVisibleForEntry: () => true,
  styleKindForEntry: () => 'background',
  applyAlpha: (color: string) => color,
}, createDocumentHighlights()) as unknown as {
  observePdfLayer: () => void;
  scanPdfLayer: (layer: HTMLElement) => void;
};
Object.defineProperty(host, 'observePdfLayer', { value: () => {} });

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function characters(layer: HTMLElement) {
  const result: { node: Node; offset: number; left: number; top: number; width: number }[] = [];
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    for (let i = 0; i < (node.textContent || '').length; i++) {
      const range = document.createRange();
      range.setStart(node, i); range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      result.push({ node, offset: i, left: rect.left, top: rect.top, width: rect.width });
    }
  }
  return result;
}
function makePage(scale: number) {
  const page = document.createElement('div');
  page.className = 'page';
  page.style.transform = `scale(${scale})`;
  page.innerHTML = '<div class="textLayer"><span style="left:24px;top:20px;transform:scaleX(1.17)">alpha gap beta gap gamma gap alpha</span><span style="left:24px;top:60px">ener</span><span style="left:62.5px;top:60px">gy</span></div>';
  document.body.appendChild(page);
  return page.querySelector<HTMLElement>('.textLayer')!;
}

try {
  // Reproduce the previous mutation with the shipped PDF.js absolute-span rule.
  const legacy = makePage(1);
  const beforeLegacy = characters(legacy);
  legacy.firstElementChild!.innerHTML = '<span>alpha</span> gap <span>beta</span> gap <span>gamma</span> gap <span>alpha</span>';
  const afterLegacy = characters(legacy);
  const legacyError = Math.max(...beforeLegacy.map((char, i) => Math.abs(char.left - afterLegacy[i].left)));
  assert(legacyError > 20, 'fixture must reproduce the old cumulative offset');
  legacy.parentElement!.remove();

  const results = [];
  for (const scale of [0.75, 1, 1.5, 2]) {
    const layer = makePage(scale);
    const before = characters(layer);
    const markup = layer.innerHTML;
    const selection = window.getSelection()!;
    const selected = document.createRange();
    selected.setStart(before[0].node, 0); selected.setEnd(before[0].node, 18);
    selection.removeAllRanges(); selection.addRange(selected);
    const selectedText = selection.toString();
    let maxError = 0;
    for (let pass = 0; pass < 3; pass++) {
      host.scanPdfLayer(layer);
      assert(layer.innerHTML === markup, 'scan changed the native PDF text tree');
      assert(selection.toString() === selectedText, 'scan changed the active selection');
      const after = characters(layer);
      before.forEach((char, i) => {
        assert(char.node === after[i].node, 'scan replaced a PDF.js text node');
        assert(Math.abs(char.left - after[i].left) < 0.01, 'adding highlights moved a character');
      });
      const anchors = layer.parentElement!.querySelectorAll<HTMLElement>('.lexis-pdf-target');
      assert(anchors.length === 6, `expected four same-line words and two cross-span fragments, got ${anchors.length}`);
      for (const anchor of anchors) {
        const expected = pdfTargetSource(anchor)!.getBoundingClientRect();
        const actual = anchor.getBoundingClientRect();
        const error = Math.max(Math.abs(actual.left - expected.left), Math.abs(actual.top - expected.top), Math.abs(actual.width - expected.width));
        maxError = Math.max(maxError, error);
        assert(error < 0.1, `overlay drifted ${error}px at scale ${scale}`);
        const background = anchor.querySelector<HTMLElement>('.lexis-pdf-hl')!.getBoundingClientRect();
        assert(Math.abs(background.top - expected.top) < 0.1 && Math.abs(background.height - expected.height) < 0.1,
          `background was compressed or shifted at scale ${scale}`);
        const point = { target: layer, clientX: actual.left + actual.width / 2, clientY: actual.top + actual.height / 2 } as unknown as MouseEvent;
        assert(pdfHighlightAt(point) === anchor, 'coordinate lookup did not resolve the matching word');
        assert(getComputedStyle(anchor).pointerEvents === 'none', 'overlay intercepts selection');
      }
    }
    results.push({ scale, words: 5, maxError });
    selection.removeAllRanges();
    layer.parentElement!.remove();
  }
  document.body.textContent = JSON.stringify({ ok: true, legacyError, results });
} catch (error) {
  document.body.textContent = JSON.stringify({ ok: false, error: String(error) });
}
