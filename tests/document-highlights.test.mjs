import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadHighlights() {
  const result = await build({ entryPoints: ["src/document-highlights.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function loadReaderInteractions() {
  const result = await build({
    entryPoints: ["src/reader-interactions.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    plugins: [{
      name: "obsidian-stub",
      setup(buildApi) {
        buildApi.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "stub" }));
        buildApi.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export class MarkdownView {}; export class Menu {}" }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("recognizes an active PDF text selection", async () => {
  const { selectionTouchesLayer } = await loadHighlights();
  const selectedNode = {};
  const outsideNode = {};
  const layer = { contains: (node) => node === selectedNode };
  assert.equal(selectionTouchesLayer(layer, { isCollapsed: false, anchorNode: selectedNode, focusNode: outsideNode }), true);
  assert.equal(selectionTouchesLayer(layer, { isCollapsed: true, anchorNode: selectedNode, focusNode: selectedNode }), false);
  assert.equal(selectionTouchesLayer(layer, { isCollapsed: false, anchorNode: outsideNode, focusNode: outsideNode }), false);
});

test("does not open a highlight while text remains selected", async () => {
  const { hasExpandedSelection } = await loadReaderInteractions();
  const selection = { isCollapsed: false, rangeCount: 1 };
  const element = { ownerDocument: { defaultView: { getSelection: () => selection } } };
  assert.equal(hasExpandedSelection(element), true);
  selection.isCollapsed = true;
  assert.equal(hasExpandedSelection(element), false);
});
