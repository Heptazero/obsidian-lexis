"use strict";

// Open component trees share DOM with the page, but not traversal, styles or event targets.
globalThis.LexisWebDom = (() => {
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "KBD", "SAMP"]);
  const CODE_EDITOR_SELECTOR = ".monaco-editor,.CodeMirror,.cm-editor,.ace_editor";
  const OWN_UI = "lexis-web-popover,.lexis-web-pop,.lexis-web-selpill,.lexis-web-selbtn,.lexis-web-folderlist,.lexis-web-alias-results,.lexis-web-toast";
  const OPT_OUT = "[data-lexis-ignore]";
  function parentAcross(node) {
    return node.parentElement || node.getRootNode()?.host || null;
  }
  function ignored(node, includeHighlights = false) {
    let p = node?.nodeType === 1 ? node : node?.parentElement || node?.host;
    while (p) {
      // aria-hidden controls accessibility, not visual visibility (e.g. duplicated captions).
      if (SKIP_TAGS.has(p.tagName) || p.isContentEditable || p.hidden) return true;
      if (p.matches(CODE_EDITOR_SELECTOR) || p.matches(OWN_UI + "," + OPT_OUT)) return true;
      if (includeHighlights && p.classList.contains("lexis-web-hl")) return true;
      p = parentAcross(p);
    }
    return false;
  }
  function eventHighlight(event) {
    return event.composedPath().find((node) => node.classList?.contains("lexis-web-hl")) || null;
  }
  function activeElement() {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element;
  }

  function createScope({ onRoot, onMutations, onSelectionChange, onScroll, onHover, onLeave }) {
    const observed = new Map();
    function roots() {
      return [document, ...[...observed.keys()].filter((root) => root.host?.isConnected)];
    }
    function forgetDetached() {
      for (const [root, observer] of observed) {
        if (root === document || root.host.isConnected) continue;
        observer.disconnect();
        root.removeEventListener("selectionchange", onSelectionChange);
        root.removeEventListener("scroll", onScroll, true);
        root.removeEventListener("mouseover", onHover, true);
        root.removeEventListener("mouseout", onLeave, true);
        observed.delete(root);
      }
    }
    function observe(root) {
      if (observed.has(root)) return;
      const observer = new MutationObserver((mutations) => {
        if (mutations.some((mu) => mu.removedNodes.length)) forgetDetached();
        onMutations(mutations);
      });
      observer.observe(root === document ? document.body : root, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ["hidden", "contenteditable", "aria-hidden", "data-lexis-ignore"],
      });
      observed.set(root, observer);
      if (root !== document) {
        root.addEventListener("selectionchange", onSelectionChange);
        root.addEventListener("scroll", onScroll, { capture: true, passive: true });
        root.addEventListener("mouseover", onHover, true);
        root.addEventListener("mouseout", onLeave, true);
        onRoot(root);
      }
    }
    function discover(node) {
      const found = new Set();
      function visit(element) {
        if (ignored(element, true)) return;
        if (element.shadowRoot) {
          const shadow = element.shadowRoot;
          observe(shadow);
          found.add(shadow);
          walk(shadow);
        }
        walk(element);
      }
      function walk(parent) {
        for (const element of parent.children || []) visit(element);
      }
      if (node.nodeType === 1) visit(node);
      else walk(node);
      return [...found];
    }
    function start() { observe(document); discover(document.body); }
    function discoverEventRoots(event) {
      for (const node of event.composedPath()) if (node.host && !observed.has(node)) discover(node.host);
    }
    function queryAll(selector) { return roots().flatMap((root) => [...root.querySelectorAll(selector)]); }
    return { roots, discover, discoverEventRoots, start, queryAll };
  }

  // Native getRangeAt() can return the shadow host rather than the selected text.
  function selection(roots) {
    let native = window.getSelection();
    if (!native?.rangeCount || native.isCollapsed) {
      for (const root of roots) {
        const local = root.getSelection?.();
        if (local?.rangeCount && !local.isCollapsed) { native = local; break; }
      }
    }
    if (!native?.rangeCount) return native;
    let boundaries;
    if (native.getComposedRanges) boundaries = native.getComposedRanges({ shadowRoots: roots.filter((root) => root.host) });
    else boundaries = Array.from({ length: native.rangeCount }, (_, index) => native.getRangeAt(index));
    if (!boundaries.length) return native;
    const ranges = boundaries.map((boundary) => {
      if (boundary.startContainer.getRootNode() !== boundary.endContainer.getRootNode()) return null;
      const range = document.createRange();
      range.setStart(boundary.startContainer, boundary.startOffset);
      range.setEnd(boundary.endContainer, boundary.endOffset);
      return range;
    });
    const first = boundaries[0];
    return {
      anchorNode: first.startContainer, anchorOffset: first.startOffset,
      isCollapsed: boundaries.every((range) => range.startContainer === range.endContainer && range.startOffset === range.endOffset),
      rangeCount: ranges.length,
      getRangeAt(index) {
        if (ranges[index]) return ranges[index];
        // A DOM Range cannot span distinct trees; defer scanning both endpoint trees.
        return { intersectsNode: (node) => boundaries.some((range) =>
          node.getRootNode() === range.startContainer.getRootNode() || node.getRootNode() === range.endContainer.getRootNode()) };
      },
      toString: () => ranges.every(Boolean) ? ranges.map((range) => range.toString()).join("") : native.toString(),
    };
  }
  return { ignored, parentAcross, eventHighlight, activeElement, createScope, selection };
})();
