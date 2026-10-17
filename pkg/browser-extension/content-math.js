"use strict";

globalThis.LexisWebMath = (() => {
  const FORMULA = ".katex-display,.katex,mjx-container,.MathJax_Display,.MathJax_SVG_Display,.MathJax,.MathJax_SVG,math,[data-tex],[data-latex]";
  let sequence = 0;

  function formulaSource(element) {
    const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
    let tex = annotation?.textContent || element.getAttribute("data-tex") || element.getAttribute("data-latex");
    const script = element.nextElementSibling;
    let sourceScript = null;
    if (!tex && script?.matches('script[type^="math/tex"]')) { tex = script.textContent; sourceScript = script; }
    let display = !!element.closest(".katex-display,.MathJax_Display,.MathJax_SVG_Display")
      || element.getAttribute("display") === "true" || element.getAttribute("display") === "block"
      || sourceScript?.getAttribute("type")?.includes("mode=display");
    if (!tex && element.matches("mjx-container")) {
      const id = `lexis-${++sequence}`;
      const receive = (event) => {
        if (typeof event.detail !== "string" || event.detail.length > 40000) return;
        try {
          const value = JSON.parse(event.detail);
          if (value.id === id && typeof value.tex === "string" && value.tex.length <= 32768) { tex = value.tex; display = value.display === true; }
        } catch { /* Page-provided data is not trusted as code. */ }
      };
      element.addEventListener("lexis-math-result", receive);
      try { element.dispatchEvent(new CustomEvent("lexis-read-math", { detail: id, bubbles: true, composed: true })); }
      finally { element.removeEventListener("lexis-math-result", receive); }
    }
    if (typeof tex !== "string" || !tex.trim() || tex.length > 32768) return null;
    tex = tex.trim();
    if (tex.startsWith("$$") && tex.endsWith("$$")) { tex = tex.slice(2, -2).trim(); display = true; }
    else if (tex.startsWith("\\[") && tex.endsWith("\\]")) { tex = tex.slice(2, -2).trim(); display = true; }
    else if (tex.startsWith("\\(") && tex.endsWith("\\)")) tex = tex.slice(2, -2).trim();
    else if (tex.startsWith("$") && tex.endsWith("$") && !tex.endsWith("\\$")) tex = tex.slice(1, -1).trim();
    return tex ? { tex, display: !!display, sourceScript } : null;
  }

  function context(root, anchor, offset = 0) {
    let text = "", position = null;
    const ranges = [], consumed = new Set();
    const plain = (value) => value.replace(/[ \t\u00a0]+/g, " ");
    const appendFormula = (element, source) => {
      if (!source.display && ranges.at(-1)?.end === text.length) text += " ";
      const start = text.length;
      if (source.display) text += `\n\n$$\n${source.tex}\n$$\n\n`;
      else text += `$${source.tex}$`;
      ranges.push({ start, end: text.length });
      if (element === anchor || element.contains(anchor)) position = start;
    };
    function walk(node) {
      if (node === anchor && node.nodeType !== 3) position = text.length;
      if (node.nodeType === 3) {
        if (node === anchor) position = text.length + plain((node.nodeValue || "").slice(0, offset)).length;
        text += plain(node.nodeValue || ""); return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;
      if (node.nodeType === 1) {
        if (consumed.has(node) || node.hidden || node.matches("style,noscript,.MathJax_Preview")) return;
        if (node.matches(FORMULA)) {
          const source = formulaSource(node);
          if (source) {
            if (source.sourceScript) consumed.add(source.sourceScript);
            appendFormula(node, source); return;
          }
          // Do not copy both visual output and the accessibility duplicate.
          const fallback = node.querySelector(".katex-mathml,mjx-assistive-mml") || node;
          if (node === anchor || node.contains(anchor)) position = text.length;
          text += plain(fallback.textContent || "[公式源码不可用]"); return;
        }
        if (node.matches("script")) {
          if (node.matches('script[type^="math/tex"]')) appendFormula(node, { tex: node.textContent, display: node.type.includes("mode=display") });
          return;
        }
        if (node.matches("br")) { text += "\n"; return; }
      }
      const children = node.shadowRoot ? [...node.shadowRoot.childNodes] : [...node.childNodes];
      children.forEach((child, index) => {
        if (node === anchor && index === offset) position = text.length;
        walk(child);
      });
      if (node === anchor && offset >= children.length) position = text.length;
    }
    // If the anchor is inside an atomic formula, include its whole source.
    const element = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
    if (element?.closest(FORMULA) && root.contains(element.closest(FORMULA))) position = 0;
    walk(root);
    return { text, position: position ?? 0, ranges };
  }

  function sentence(root, anchor, offset = 0) {
    const result = context(root, anchor, offset);
    // String offsets are UTF-16 offsets; don't use code-point array indexing here.
    let projection = result.text;
    for (const range of [...result.ranges].reverse()) projection = projection.slice(0, range.start) + "m".repeat(range.end - range.start) + projection.slice(range.end);
    let start = 0, end = result.text.length;
    const separators = /[.!?。！？…\n]/;
    for (let index = result.position - 1; index >= 0; index--) if (separators.test(projection[index])) { start = index + 1; break; }
    for (let index = result.position; index < projection.length; index++) if (separators.test(projection[index])) { end = index + 1; break; }
    return result.text.slice(start, end).trim();
  }
  return { formulaSource, context, sentence };
})();
