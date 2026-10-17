"use strict";

let highlightSheetPromise;
function installHighlightStyle(root) {
  if (!highlightSheetPromise) highlightSheetPromise = fetch(chrome.runtime.getURL("highlight.css"))
    .then((response) => response.text())
    .then((css) => { const sheet = new CSSStyleSheet(); sheet.replaceSync(css); return sheet; });
  void highlightSheetPromise.then((sheet) => {
    if (root.host.isConnected && !root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  }).catch(() => {});
}

const pageScope = LexisWebDom.createScope({
  onRoot(root) { installHighlightStyle(root); pendingRoots.add(root); scheduleScan(); },
  onMutations(mutations) {
    for (const mu of mutations) {
      if (mu.type === "attributes") {
        if (!LexisWebDom.ignored(mu.target, true)) pendingRoots.add(mu.target);
        continue;
      }
      if (mu.type === "characterData") {
        if (!skip(mu.target) && mu.target.parentElement) pendingRoots.add(mu.target.parentElement);
        continue;
      }
      for (const node of mu.addedNodes) {
        if (LexisWebDom.ignored(node, true)) continue;
        if (node.nodeType === 1) pendingRoots.add(node);
        else if (node.nodeType === 3 && node.parentElement) pendingRoots.add(node.parentElement);
      }
    }
    if (pendingRoots.size) scheduleScan();
  },
  onSelectionChange: () => handleSelectionChange(),
  onScroll: () => { hideSelBtn(); removePop(); },
  onHover: (event) => handleHighlightHover(event),
  onLeave: (event) => handleHighlightLeave(event),
});

function pageSelection() { return LexisWebDom.selection([...pageScope.roots(), ...(popHost?.shadowRoot ? [popHost.shadowRoot] : [])]); }
function skip(node) { return LexisWebDom.ignored(node, true); }

function scan(root) {
  const shadows = pageScope.discover(root);
  if (!regex || !(cfg && cfg.highlight)) return;
  const selection = pageSelection();
  for (const tree of [root, ...shadows]) {
    const walker = document.createTreeWalker(tree, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || (n.nodeValue.length < 2 && !/[^\x00-\x7f]/.test(n.nodeValue)) || skip(n)) return NodeFilter.FILTER_REJECT;
        if (selectionIntersectsNode(selection, n)) {
          if (n.parentElement) selectionDeferredRoots.add(n.parentElement);
          return NodeFilter.FILTER_REJECT;
        }
        regex.lastIndex = 0;
        return regex.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const targets = [];
    let node;
    while ((node = walker.nextNode())) targets.push(node);
    for (const target of targets) wrap(target);
  }
}

function unwrapAll() {
  const parents = new Set();
  for (const span of pageScope.queryAll("." + HL)) {
    if (!span.parentNode) continue;
    parents.add(span.parentNode);
    span.replaceWith(document.createTextNode(span.textContent));
  }
  for (const parent of parents) if (parent.isConnected) parent.normalize();
}

function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(flushScan, 120); }
function flushScan() {
  const roots = [...pendingRoots];
  pendingRoots.clear();
  // Root discovery also runs while highlighting is disabled: selection-add still works.
  for (const root of roots) if (root.isConnected) scan(root);
}
function startObserver() { pageScope.start(); }
