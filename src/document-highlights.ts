"use strict";

import type { App, TFile } from "obsidian";
import type { LexisEntry, LexisSettings } from "./types";

type HighlightStyleOptions = { external?: boolean; pdf?: boolean };
type PdfPart = { node: Text; text: string; rect: DOMRect };
type PdfRun = { parts: PdfPart[]; left: number; right: number; top: number; center: number; height: number };
type PdfRef = { node: Text; offset: number };
type PdfStream = { text: string; map: (PdfRef | null)[] };
type PdfSegment = { node: Text; start: number; end: number };
type PdfCandidate = { key: string; entry: LexisEntry; segments: PdfSegment[]; length: number };
type EpubHooks = { over: (event: MouseEvent) => void; out: (event: MouseEvent) => void; click: (event: MouseEvent) => void; mouseup: (event: MouseEvent) => void };
type ObserverWindow = Window & { MutationObserver: typeof MutationObserver; ResizeObserver?: typeof ResizeObserver };

function selectionTouchesLayer(layer: Pick<Node, "contains">, selection: Pick<Selection, "isCollapsed" | "anchorNode" | "focusNode"> | null): boolean {
  if (!selection || selection.isCollapsed) return false;
  return !!((selection.anchorNode && layer.contains(selection.anchorNode)) || (selection.focusNode && layer.contains(selection.focusNode)));
}

function createDocumentHighlights(): PropertyDescriptorMap {
  class DocumentHighlights {
  declare app: App;
  declare settings: LexisSettings;
  declare index: Map<string, LexisEntry>;
  declare _pattern: string | null;
  declare _pdfObserver: MutationObserver | null;
  declare _pdfDocument: Document | null;
  declare _pdfWindow: Window | null;
  declare _pdfRaf: number;
  declare _pdfResizeObserver: ResizeObserver | null;
  declare _pdfResizeTimer: number;
  declare _pdfObservedLayers: WeakSet<Element> | null;
  declare _pdfObservedSizes: WeakMap<Element, string> | null;
  declare _pdfPending: Set<HTMLElement>;
  declare _pdfScheduleFlush: ((delay?: number) => void) | null;
  declare _epubIframeObserver: MutationObserver | null;
  declare _epubHostDocument: Document | null;
  declare _epubIframeFrames: WeakSet<HTMLIFrameElement> | null;
  declare _epubIframeDocs: Map<Document, EpubHooks> | null;
  declare applyAlpha: (color: string, alpha: number | null) => string;
  declare colorForEntry: (entry: LexisEntry) => string;
  declare highlightAlphaForEntry: (entry: LexisEntry) => number;
  declare highlightVisibleForEntry: (entry: LexisEntry) => boolean;
  declare inlineStyleForEntry: (entry: LexisEntry | undefined, options?: HighlightStyleOptions) => string;
  declare maybeShowSelPill: (event: MouseEvent, fromEpubIframe?: boolean) => void;
  declare onClick: (event: MouseEvent) => void;
  declare onMouseOut: (event: MouseEvent) => void;
  declare onMouseOver: (event: MouseEvent) => void;
  declare passiveEncounter: (file: TFile) => void;
  declare wrapMatchesInElement: (element: HTMLElement, rejectSelector: string, styleOptions?: HighlightStyleOptions, excludeKeys?: Set<string> | null) => void;
  declare resolveMatchKey: (value: string) => string;

  // ---------- PDF 高亮(钩 pdf.js 文字层) ----------
  // pdf.js 会把同一行甚至同一个词拆成多个 span。普通 TreeWalker 只能逐文本节点匹配，
  // 所以 PDF 先按几何位置还原短的视觉行，再把跨片段命中映射回原文本节点。
  pdfTextRuns(layer: HTMLElement): PdfRun[] {
    const doc = layer.ownerDocument || document;
    const walker = doc.createTreeWalker(layer, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest(".lexis-hl,.lexis-popover")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const parts: PdfPart[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      try {
        const range = doc.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        parts.push({ node: node as Text, text: node.nodeValue || "", rect });
      } catch { /* Detached PDF.js text nodes are skipped. */ }
    }

    const runs: PdfRun[] = [];
    for (const part of parts) {
      const last = runs[runs.length - 1];
      const center = part.rect.top + part.rect.height / 2;
      const sameLine = last && Math.abs(center - last.center) <= Math.max(2, Math.min(last.height, part.rect.height) * 0.45);
      const gap = last ? part.rect.left - last.right : 0;
      // 同一高度但横向相距很远，通常是双栏的另一栏，必须拆成两个视觉行。
      const sameRun = sameLine && gap >= -2 && gap <= Math.max(24, Math.min(last.height, part.rect.height) * 2.5);
      if (!sameRun) {
        runs.push({ parts: [part], left: part.rect.left, right: part.rect.right, top: part.rect.top, center, height: part.rect.height });
        continue;
      }
      last.parts.push(part);
      last.right = Math.max(last.right, part.rect.right);
      last.top = Math.min(last.top, part.rect.top);
      last.height = Math.max(last.height, part.rect.height);
      last.center = (last.center * (last.parts.length - 1) + center) / last.parts.length;
    }
    return runs;
  }

  pdfRunStream(run: PdfRun): PdfStream {
    const text: string[] = [];
    const map: (PdfRef | null)[] = [];
    const appendSpace = (source: PdfRef | null) => {
      if (!text.length || text[text.length - 1] === " ") return;
      text.push(" "); map.push(source || null);
    };
    const appendPart = (part: PdfPart) => {
      for (let i = 0; i < part.text.length; i++) {
        const ch = part.text[i];
        if (/\s/.test(ch)) appendSpace({ node: part.node, offset: i });
        else { text.push(ch); map.push({ node: part.node, offset: i }); }
      }
    };
    let previous: PdfPart | null = null;
    for (const part of run.parts) {
      if (previous && !/\s$/.test(previous.text) && !/^\s/.test(part.text)) {
        const gap = part.rect.left - previous.rect.right;
        const threshold = Math.max(1.5, Math.min(previous.rect.height, part.rect.height) * 0.16);
        if (gap > threshold) appendSpace(null);
      }
      appendPart(part);
      previous = part;
    }
    while (text[0] === " ") { text.shift(); map.shift(); }
    while (text[text.length - 1] === " ") { text.pop(); map.pop(); }
    return { text: text.join(""), map };
  }

  wrapPdfFragmentMatches(layer: HTMLElement): void {
    if (!this._pattern || !this.index.size) return;
    const runs = this.pdfTextRuns(layer);
    if (!runs.length) return;
    const streams = runs.map((run) => this.pdfRunStream(run));
    const candidates: PdfCandidate[] = [];
    const nodeOrder = new WeakMap<Text, number>();
    const regex = new RegExp(this._pattern, "gi");
    let order = 0;
    for (const run of runs) for (const part of run.parts) if (!nodeOrder.has(part.node)) nodeOrder.set(part.node, order++);

    const collect = (stream: PdfStream, accepts: (refs: PdfRef[]) => boolean, droppedHyphen: PdfRef | null) => {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(stream.text))) {
        const refs = stream.map.slice(match.index, match.index + match[0].length).filter((ref): ref is PdfRef => ref !== null);
        if (!refs.length || !accepts(refs)) {
          if (!match[0].length) regex.lastIndex++;
          continue;
        }
        const key = this.resolveMatchKey(match[0]);
        const entry = this.index.get(key);
        if (!entry) continue;
        const byNode = new Map<Text, PdfSegment>();
        for (const ref of refs) {
          const current = byNode.get(ref.node);
          if (current) { current.start = Math.min(current.start, ref.offset); current.end = Math.max(current.end, ref.offset + 1); }
          else byNode.set(ref.node, { node: ref.node, start: ref.offset, end: ref.offset + 1 });
        }
        if (droppedHyphen && byNode.has(droppedHyphen.node)) {
          const segment = byNode.get(droppedHyphen.node);
          segment.end = Math.max(segment.end, droppedHyphen.offset + 1);
        }
        const segments = [...byNode.values()].sort((a, b) => (nodeOrder.get(a.node) || 0) - (nodeOrder.get(b.node) || 0));
        candidates.push({ key, entry, segments, length: match[0].length });
        if (!match[0].length) regex.lastIndex++;
      }
    };

    // 先处理同一视觉行内被多个 span 拆开的词。
    for (let i = 0; i < runs.length; i++) {
      collect(streams[i], (refs) => new Set(refs.map((ref) => ref.node)).size > 1, null);
    }

    // 再连接真正相邻的上下行。只在同一栏、相邻行距内找下一行，避免双栏串接。
    for (let i = 0; i < runs.length; i++) {
      const current = runs[i];
      let nextIndex = -1, bestScore = Infinity;
      for (let j = i + 1; j < Math.min(runs.length, i + 9); j++) {
        const next = runs[j];
        const dy = next.top - current.top;
        const lineHeight = Math.max(current.height, next.height);
        if (dy <= lineHeight * 0.45 || dy > lineHeight * 3) continue;
        const dx = Math.abs(next.left - current.left);
        if (dx > Math.max(32, lineHeight * 3)) continue;
        const score = dy + dx * 0.2;
        if (score < bestScore) { bestScore = score; nextIndex = j; }
      }
      if (nextIndex < 0) continue;
      const left = streams[i], right = streams[nextIndex];
      if (!left.text || !right.text) continue;
      const leftNodes = new Set(runs[i].parts.map((part) => part.node));
      const rightNodes = new Set(runs[nextIndex].parts.map((part) => part.node));
      const crossesLines = (refs: PdfRef[]) => refs.some((ref) => leftNodes.has(ref.node)) && refs.some((ref) => rightNodes.has(ref.node));
      const combine = (leftText: string, leftMap: (PdfRef | null)[], separator: string): PdfStream => ({
        text: leftText + separator + right.text,
        map: leftMap.concat(separator ? [null] : [], right.map),
      });
      const hyphen = /[-\u00ad\u2010\u2011]$/.test(left.text);
      if (hyphen) {
        const dropped = left.map[left.map.length - 1];
        collect(combine(left.text.slice(0, -1), left.map.slice(0, -1), ""), crossesLines, dropped);
        // 保留真正属于词条的连字符，例如 state-of-the-art。
        collect(combine(left.text, left.map, ""), crossesLines, null);
      } else {
        // 换行可能发生在词内/中日韩文本中，也可能等价于一个普通空格；两种都是明确的 PDF 行缝语义。
        collect(combine(left.text, left.map, ""), crossesLines, null);
        collect(combine(left.text, left.map, " "), crossesLines, null);
      }
    }

    // 同一物理字符只接受最长命中，防止短词覆盖跨行长词；随后从后往前切文本节点。
    candidates.sort((a, b) => b.length - a.length || a.segments[0].start - b.segments[0].start);
    const used = new WeakMap<Text, PdfSegment[]>();
    const accepted: PdfCandidate[] = [];
    const signatures = new Set<string>();
    for (const candidate of candidates) {
      const signature = candidate.key + "|" + candidate.segments.map((s) => `${nodeOrder.get(s.node)}:${s.start}-${s.end}`).join(",");
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      const overlaps = candidate.segments.some((segment) => (used.get(segment.node) || []).some((range) => segment.start < range.end && segment.end > range.start));
      if (overlaps) continue;
      for (const segment of candidate.segments) {
        const ranges = used.get(segment.node) || [];
        ranges.push(segment); used.set(segment.node, ranges);
      }
      accepted.push(candidate);
    }

    const rangesByNode = new Map<Text, (PdfSegment & { key: string; entry: LexisEntry })[]>();
    for (const candidate of accepted) {
      if (!candidate.entry.inline) this.passiveEncounter(candidate.entry.file);
      for (const segment of candidate.segments) {
        const ranges = rangesByNode.get(segment.node) || [];
        ranges.push({ ...segment, key: candidate.key, entry: candidate.entry });
        rangesByNode.set(segment.node, ranges);
      }
    }
    const doc = layer.ownerDocument || document;
    for (const [textNode, ranges] of rangesByNode) {
      ranges.sort((a, b) => b.start - a.start);
      for (const range of ranges) {
        textNode.splitText(range.end);
        const matched = textNode.splitText(range.start);
        const span = doc.body.createSpan();
        span.className = "lexis-hl";
        span.dataset.lexisKey = range.key;
        span.setAttribute("style", this.inlineStyleForEntry(range.entry, { pdf: true }));
        matched.parentNode.replaceChild(span, matched);
        span.appendChild(matched);
      }
    }
  }

  // ob 内置 PDF 阅读器 = pdf.js,.textLayer 在主 DOM(无 iframe),文字层文字是透明的、
  // 仅供选中复制;我们把命中词包成 .lexis-hl(下划线/背景色显式带颜色,所以透明文字上也看得见),
  // 顺带白嫖现成的 document 级 mouseover/click → 悬浮卡 + 跳转。翻页/缩放时 pdf.js 重建文字层,
  // 用 MutationObserver 重扫;.lexis-hl 在 rejectSelector 里,重扫不会重复包。
  setupPdfHighlight(document: Document = this._pdfDocument || this.app.workspace.containerEl.ownerDocument) {
    this.teardownPdfHighlight();
    this._pdfDocument = document;
    this._pdfWindow = document.defaultView || window;
    const observerWindow = this._pdfWindow as ObserverWindow;
    this._pdfObservedLayers = new WeakSet();
    this._pdfObservedSizes = new WeakMap();
    const MutationObserverConstructor = observerWindow.MutationObserver;
    if (!this.settings.enablePdfHighlight || !MutationObserverConstructor) return;
    this._pdfPending = new Set();
    const flush = () => {
      this._pdfRaf = 0;
      const next = this._pdfPending.values().next();
      if (!next.done) {
        this._pdfPending.delete(next.value);
        if (next.value.isConnected) {
          if (this.pdfLayerHasSelection(next.value)) {
            this._pdfPending.add(next.value);
            next.value.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.remove("is-geometry-changing");
            if (!this._pdfResizeTimer) {
              this._pdfResizeTimer = this._pdfWindow?.setTimeout(() => {
                this._pdfResizeTimer = 0;
                if (!this._pdfRaf) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
              }, 120) || 0;
            }
            return;
          }
          this.scanPdfLayer(next.value);
          next.value.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.remove("is-geometry-changing");
        }
      }
      if (this._pdfPending.size) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
      else document.querySelectorAll(".lexis-pdf-hl-layer.is-geometry-changing").forEach((element) => element.classList.remove("is-geometry-changing"));
    };
    const scheduleFlush = (delay = 0) => {
      if (delay) {
        if (this._pdfResizeTimer || this._pdfRaf) return;
        this._pdfResizeTimer = this._pdfWindow?.setTimeout(() => {
          this._pdfResizeTimer = 0;
          if (!this._pdfRaf) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
        }, delay) || 0;
      } else if (this._pdfPending.size && !this._pdfRaf) this._pdfRaf = this._pdfWindow?.requestAnimationFrame(flush) || 0;
    };
    this._pdfScheduleFlush = scheduleFlush;
    const ResizeObserverConstructor = observerWindow.ResizeObserver;
    if (ResizeObserverConstructor) {
      this._pdfResizeObserver = new ResizeObserverConstructor((entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
          const target = entry.target;
          const size = `${entry.contentRect.width}:${entry.contentRect.height}`;
          const previousSize = this._pdfObservedSizes?.get(target);
          this._pdfObservedSizes?.set(target, size);
          if (previousSize == null || previousSize === size) continue;
          const layer = target.classList.contains("textLayer") ? target as HTMLElement : target.querySelector<HTMLElement>(".textLayer");
          if (layer) this.markPdfGeometryChanging(layer);
        }
        if (this._pdfPending.size) scheduleFlush(220);
      });
    }
    this._pdfObserver = new MutationObserverConstructor((muts: MutationRecord[]) => {
      let geometryChanged = false;
      for (const mu of muts) {
        const targetElement = mu.target.nodeType === 1 ? mu.target as Element : mu.target.parentElement;
        if (mu.type === "attributes") {
          if (targetElement?.classList.contains("textLayer")) {
            this.markPdfGeometryChanging(targetElement as HTMLElement);
            geometryChanged = true;
          } else if (targetElement?.matches(".page, .canvasWrapper, canvas")) {
            const page = targetElement.classList.contains("page") ? targetElement : targetElement.closest(".page");
            const layer = page?.querySelector<HTMLElement>(":scope > .textLayer");
            if (layer) { this.markPdfGeometryChanging(layer); geometryChanged = true; }
          }
          continue;
        }
        if (targetElement && !targetElement.closest(".lexis-hl,.lexis-pdf-hl-layer")) {
          const containingLayer = targetElement.classList.contains("textLayer")
            ? targetElement as HTMLElement
            : targetElement.closest<HTMLElement>(".textLayer");
          if (containingLayer) {
            this.markPdfGeometryChanging(containingLayer);
            geometryChanged = true;
          } else if (targetElement.matches(".page, .canvasWrapper, canvas")) {
            const page = targetElement.classList.contains("page") ? targetElement : targetElement.closest(".page");
            const layer = page?.querySelector<HTMLElement>(":scope > .textLayer");
            if (layer) { this.markPdfGeometryChanging(layer); geometryChanged = true; }
          }
        }
        for (const node of mu.addedNodes) {
          if (node.nodeType !== 1) continue;
          const element = node as Element;
          if (element.classList.contains("lexis-hl") || element.closest(".lexis-hl")) continue;
          if (element.classList.contains("textLayer")) { this.markPdfGeometryChanging(element as HTMLElement); geometryChanged = true; }
          else element.querySelectorAll<HTMLElement>(".textLayer").forEach((layer) => { this.markPdfGeometryChanging(layer); geometryChanged = true; });
        }
      }
      if (geometryChanged) scheduleFlush(220);
    });
    this._pdfObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    // 已打开的 PDF 分帧扫描，插件启动和交互监听不等待整份文档处理完。
    document.querySelectorAll<HTMLElement>(".textLayer").forEach((layer) => this.markPdfGeometryChanging(layer));
    scheduleFlush();
  }
  observePdfLayer(layer: HTMLElement): void {
    if (!this._pdfResizeObserver || !layer || this._pdfObservedLayers?.has(layer)) return;
    try {
      this._pdfObservedLayers.add(layer);
      this._pdfResizeObserver.observe(layer);
      if (layer.parentElement) this._pdfResizeObserver.observe(layer.parentElement);
    } catch { /* PDF.js may replace a layer during observation. */ }
  }
  markPdfGeometryChanging(layer: HTMLElement): void {
    if (!layer?.isConnected) return;
    this._pdfPending?.add(layer);
    if (!this.pdfLayerHasSelection(layer)) layer.parentElement?.querySelector(":scope > .lexis-pdf-hl-layer")?.classList.add("is-geometry-changing");
  }
  pdfLayerHasSelection(layer: HTMLElement): boolean {
    return selectionTouchesLayer(layer, this._pdfWindow?.getSelection() || null);
  }
  scanPdfLayer(layer: HTMLElement): void {
    if (!this.settings.enablePdfHighlight || !this.settings.enableHighlight) return;
    this.observePdfLayer(layer);
    // 1. PDF 专属跨片段匹配先抢占长词，再用通用匹配器补单节点命中。
    this.wrapPdfFragmentMatches(layer);
    // 2. 在 textLayer 里注入隐形 .lexis-hl(仅事件代理,无视觉样式)
    this.wrapMatchesInElement(layer, ".lexis-hl,.lexis-popover", { pdf: true });
    // 3. 建独立高亮 overlay,叠在 Canvas 上、textLayer 下(不沾 textLayer 的 opacity)
    const page = layer.parentElement;
    if (!page) return;
    // pdf.js 的 canvas 实际包在 .canvasWrapper 里,插到 canvas 后面会落进那层容器,
    // 定位/裁切都跟着 canvasWrapper 走,容易跟 textLayer 对不齐——直接挂在 .page 下、textLayer 前面最稳。
    if (getComputedStyle(page).position === "static") page.setCssStyles({ position: "relative" });
    let hl = page.querySelector<HTMLElement>(":scope > .lexis-pdf-hl-layer");
    if (!hl) {
      hl = page.createDiv({ cls: "lexis-pdf-hl-layer" });
      layer.insertAdjacentElement("beforebegin", hl);
    }
    const hlBB = layer.getBoundingClientRect();
    const layerW = layer.offsetWidth || layer.clientWidth || hlBB.width || 1;
    const layerH = layer.offsetHeight || layer.clientHeight || hlBB.height || 1;
    const scaleX = hlBB.width ? hlBB.width / layerW : 1;
    const scaleY = hlBB.height ? hlBB.height / layerH : 1;
    hl.setCssStyles({
      position: "absolute",
      left: `${layer.offsetLeft}px`,
      top: `${layer.offsetTop}px`,
      width: `${layerW}px`,
      height: `${layerH}px`,
      zIndex: "1",
      pointerEvents: "none",
    });
    hl.empty();
    // 4. 遍历内联 .lexis-hl,在 overlay 层画出对应荧光笔矩形
    const spans = layer.querySelectorAll<HTMLElement>(".lexis-hl");
    for (const s of spans) {
      const key = s.dataset.lexisKey;
      if (!key) continue;
      const entry = this.index.get(key);
      if (!entry) continue;
      if (entry.archived || !this.highlightVisibleForEntry(entry)) continue; // 保留 hover 代理，只不画可视高亮
      try {
        const color = this.colorForEntry(entry);
        const alpha = Math.max(0.04, Math.min(0.75, this.highlightAlphaForEntry(entry) * 0.65));
        const rects = Array.from(s.getClientRects()).filter((rect) => rect.width && rect.height);
        for (const rect of rects.length ? rects : [s.getBoundingClientRect()]) {
          const d = hl.createDiv({ cls: "lexis-pdf-hl" });
          d.dataset.lexisKey = key;
          d.setCssStyles({
            position: "absolute",
            left: `${(rect.left - hlBB.left) / scaleX}px`,
            top: `${(rect.top - hlBB.top) / scaleY}px`,
            width: `${rect.width / scaleX}px`,
            height: `${rect.height / scaleY}px`,
            background: this.applyAlpha(color, alpha),
            borderRadius: "2px",
            pointerEvents: "auto",
          });
          hl.appendChild(d);
        }
      } catch { /* PDF.js may replace page geometry between measurements. */ }
    }
  }
  teardownPdfHighlight() {
    const document = this._pdfDocument;
    const hostWindow = this._pdfWindow || window;
    if (this._pdfObserver) { this._pdfObserver.disconnect(); this._pdfObserver = null; }
    if (this._pdfRaf) { hostWindow.cancelAnimationFrame(this._pdfRaf); this._pdfRaf = 0; }
    if (this._pdfResizeObserver) { this._pdfResizeObserver.disconnect(); this._pdfResizeObserver = null; }
    if (this._pdfResizeTimer) { hostWindow.clearTimeout(this._pdfResizeTimer); this._pdfResizeTimer = 0; }
    this._pdfScheduleFlush = null;
    this._pdfObservedLayers = null;
    this._pdfObservedSizes = null;
    if (document) {
      document.querySelectorAll(".lexis-pdf-hl-layer").forEach((layer) => layer.remove());
      document.querySelectorAll(".textLayer .lexis-hl").forEach((span) => {
        const text = document.createTextNode(span.textContent || "");
        span.parentNode?.replaceChild(text, span);
      });
    }
    this._pdfDocument = null;
    this._pdfWindow = null;
  }
  // 词库/配色变化后,清掉 PDF 里旧高亮再重扫(.lexis-hl 拆回纯文本)
  rescanPdfLayers() {
    const document = this._pdfDocument || this.app.workspace.containerEl.ownerDocument;
    document.querySelectorAll(".textLayer .lexis-hl").forEach((span) => {
      const text = document.createTextNode(span.textContent || "");
      span.parentNode?.replaceChild(text, span);
    });
    document.querySelectorAll(".lexis-pdf-hl-layer").forEach((layer) => layer.remove());
    document.querySelectorAll<HTMLElement>(".textLayer").forEach((layer) => { layer.normalize(); this.markPdfGeometryChanging(layer); });
    this._pdfScheduleFlush?.();
  }

  // ---------- 第三方 EPUB 阅读器高亮 ----------
  // EPUB Marginalia 与 ePub Reader 都用 epub.js,章节放在同源 iframe 中。
  // 主文档的事件/TreeWalker 无法穿透 iframe,所以只对 epub.js 的 iframe 单独注入。
  isEpubIframe(frame: Element): frame is HTMLIFrameElement {
    return frame.tagName === "IFRAME" && (
      frame.hasAttribute("enable-annotation") ||
      frame.matches?.(".epub-reader-area iframe, .epub-container iframe, .epub-view iframe") ||
      frame.closest(".epub-reader-area, .epub-container, .epub-view")
    ) != null;
  }
  setupEpubIframeHighlight(document: Document = this._epubHostDocument || this.app.workspace.containerEl.ownerDocument) {
    this.teardownEpubIframeHighlight();
    this._epubHostDocument = document;
    this._epubIframeFrames = new WeakSet();
    this._epubIframeDocs = new Map();
    const MutationObserverConstructor = (document.defaultView as ObserverWindow | null)?.MutationObserver || MutationObserver;
    this._epubIframeObserver = new MutationObserverConstructor((muts) => {
      for (const mu of muts) for (const node of mu.addedNodes) {
        if (node.nodeType !== 1) continue;
        const element = node as Element;
        if (this.isEpubIframe(element)) this.observeEpubIframe(element);
        element.querySelectorAll<HTMLIFrameElement>("iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe").forEach((frame) => this.observeEpubIframe(frame));
      }
    });
    this._epubIframeObserver.observe(document.body, { childList: true, subtree: true });
    this.rescanEpubIframes();
  }
  observeEpubIframe(frame: HTMLIFrameElement): void {
    if (!this.isEpubIframe(frame)) return;
    if (!this._epubIframeFrames.has(frame)) {
      this._epubIframeFrames.add(frame);
      frame.addEventListener("load", () => this.scanEpubIframe(frame));
    }
    this.scanEpubIframe(frame);
  }
  scanEpubIframe(frame: HTMLIFrameElement): void {
    if (!this.settings.enableHighlight || !this.isEpubIframe(frame)) return;
    let doc: Document | null;
    try { doc = frame.contentDocument; } catch { return; }
    if (!doc?.body) return;
    // 插件重载/配色变化后 iframe 可能还留着旧 span；先拆回文本再按当前索引与实际颜色重建。
    doc.querySelectorAll(".lexis-hl").forEach((span) => {
      const textNode = doc.createTextNode(span.textContent || "");
      span.parentNode?.replaceChild(textNode, span);
    });
    doc.body.normalize();
    this.wrapMatchesInElement(doc.body, "script,style,code,pre,.lexis-hl,.lexis-popover", { external: true });
    if (this._epubIframeDocs.has(doc)) return;
    const over = (event: MouseEvent) => this.onMouseOver(event);
    const out = (event: MouseEvent) => this.onMouseOut(event);
    const click = (event: MouseEvent) => this.onClick(event);
    const mouseup = (event: MouseEvent) => this.maybeShowSelPill(event, true);
    doc.addEventListener("mouseover", over);
    doc.addEventListener("mouseout", out);
    doc.addEventListener("click", click);
    doc.addEventListener("mouseup", mouseup);
    this._epubIframeDocs.set(doc, { over, out, click, mouseup });
  }
  rescanEpubIframes() {
    const document = this._epubHostDocument || this.app.workspace.containerEl.ownerDocument;
    document.querySelectorAll<HTMLIFrameElement>("iframe[enable-annotation], .epub-reader-area iframe, .epub-container iframe, .epub-view iframe").forEach((frame) => this.observeEpubIframe(frame));
  }
  teardownEpubIframeHighlight() {
    if (this._epubIframeObserver) { this._epubIframeObserver.disconnect(); this._epubIframeObserver = null; }
    if (this._epubIframeDocs) {
      for (const [doc, hooks] of this._epubIframeDocs) {
        doc.removeEventListener("mouseover", hooks.over); doc.removeEventListener("mouseout", hooks.out); doc.removeEventListener("click", hooks.click); doc.removeEventListener("mouseup", hooks.mouseup);
      }
    }
    this._epubIframeDocs = null;
    this._epubIframeFrames = null;
    this._epubHostDocument = null;
  }


  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(DocumentHighlights.prototype);
  return descriptors;
}

export { createDocumentHighlights, selectionTouchesLayer };
