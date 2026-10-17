"use strict";

// Page-world code only reads existing MathJax items. It has no extension APIs,
// tokens, vault data, network access or dynamic-code execution.
(() => {
  document.addEventListener("lexis-read-math", (event) => {
    const element = event.composedPath()[0];
    if (typeof event.detail !== "string" || event.detail.length > 100 || !element?.matches?.("mjx-container")) return;
    const mathDocument = globalThis.MathJax?.startup?.document;
    if (!mathDocument?.getMathItemsWithin) return;
    try {
      // start.node may be adjacent to typesetRoot rather than inside it.
      const items = mathDocument.getMathItemsWithin([element.parentElement || element]);
      const item = items.find((value) => value.typesetRoot === element && /tex/i.test(value.inputJax?.name || ""));
      if (typeof item?.math !== "string" || item.math.length > 32768) return;
      element.dispatchEvent(new CustomEvent("lexis-math-result", {
        detail: JSON.stringify({ id: event.detail, tex: item.math, display: !!item.display }),
      }));
    } catch { /* MathJax not ready: retain the visible text instead. */ }
  });
})();
