import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadDom(native) {
  const document = {
    createRange() {
      return {
        setStart(node, offset) { this.start = node; this.startOffset = offset; },
        setEnd(node, offset) { this.end = node; this.endOffset = offset; },
        toString() { return this.start.text.slice(this.startOffset, this.endOffset); },
        intersectsNode(node) { return node === this.start; },
      };
    },
  };
  const context = { window: { getSelection: () => native }, document };
  vm.runInNewContext(await readFile("pkg/browser-extension/content-dom.js", "utf8"), context);
  return context.LexisWebDom;
}
function boundary(node, startOffset = 0, endOffset = 5) {
  return { startContainer: node, startOffset, endContainer: node, endOffset };
}

test("composed selection resolves real text instead of retargeted shadow hosts", async () => {
  const root = { host: {} };
  const node = { text: "novel text", getRootNode: () => root };
  let roots;
  const native = {
    rangeCount: 1, isCollapsed: false,
    getRangeAt: () => { throw new Error("must not use rescoped native Range"); },
    getComposedRanges(options) { roots = options.shadowRoots; return [boundary(node)]; },
  };
  const dom = await loadDom(native);
  const selection = dom.selection([root]);
  assert.equal(selection.anchorNode, node);
  assert.equal(selection.toString(), "novel");
  assert.equal(selection.getRangeAt(0).intersectsNode(node), true);
  assert.equal(roots[0], root);
});

test("legacy browsers use native ranges or root-local selection without losing text", async () => {
  const root = { host: {} };
  const node = { text: "novel text", getRootNode: () => root };
  const native = { rangeCount: 1, isCollapsed: false, getRangeAt: () => boundary(node) };
  const dom = await loadDom(native);
  assert.equal(dom.selection([root]).toString(), "novel");
  const noDocumentSelection = await loadDom({ rangeCount: 0, isCollapsed: true });
  root.getSelection = () => native;
  assert.equal(noDocumentSelection.selection([root]).anchorNode, node);
  assert.equal(noDocumentSelection.selection([root]).toString(), "novel");
});

test("cross-tree selection defers scanning endpoint trees instead of creating an invalid Range", async () => {
  const roots = [{ host: {} }, { host: {} }];
  const nodes = roots.map((root) => ({ getRootNode: () => root }));
  const native = {
    rangeCount: 1, isCollapsed: false, toString: () => "cross tree text",
    getComposedRanges: () => [{ ...boundary(nodes[0]), endContainer: nodes[1] }],
  };
  const selection = (await loadDom(native)).selection(roots);
  assert.equal(selection.toString(), "cross tree text");
  assert.equal(selection.getRangeAt(0).intersectsNode(nodes[1]), true);
  assert.equal(selection.getRangeAt(0).intersectsNode({ getRootNode: () => ({}) }), false);
});
