import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/review-log-rows.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
function fixture() {
  const requests = [], jobs = [];
  const document = { getSelection: () => null };
  class Element {
    constructor(options = {}) { this.options = options; this.text = options.text || ""; this.children = []; this.ownerDocument = document; }
    createDiv(options) { const child = new Element(options); this.children.push(child); return child; }
    createSpan(options) { return this.createDiv(options); }
    addClass() {}
    setText(text) { this.text = text; }
    contains() { return true; }
  }
  const context = { module: { exports: {} }, require: () => ({ MarkdownRenderer: { render: async (...args) => { requests.push(args); } } }), console };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  return { ...context.module.exports, root: new Element(), document, requests, jobs, queue: { add(element, render) { jobs.push({ element, render }); } } };
}

test("syntax titles use complete parsed Markdown and source paths while note filenames stay literal", async () => {
  const { root, requests, jobs, queue, renderReviewTitle } = fixture();
  const host = { app: {}, t: (key) => key }, component = {};
  const front = "- **面积**、`code` 和 $\\int_0^1 x^2 dx$";
  const displayed = "**面积**、`code` 和 $\\int_0^1 x^2 dx$";
  renderReviewTitle(root, { type: "syntax", label: "**面积", syntax: { front, kind: "inline" }, file: { path: "a.md" } }, host, queue, undefined, "1.");
  assert.equal(jobs.length, 1);
  assert.equal(requests.length, 0, "Markdown work goes through the bounded viewport queue");
  await jobs[0].render(component);
  assert.equal(requests[0][1], displayed, "list containers are not rendered as blank title gutters");
  assert.equal(requests[0][3], "a.md");
  assert.equal(requests[0][4], component);
  renderReviewTitle(root, { type: "note", label: "literal ** name" }, host, queue);
  assert.equal(jobs.length, 1, "filenames are not interpreted as Markdown");
  assert.equal(root.children[1].children[0].text, "literal ** name");
});

test("content rows keep mouse and keyboard activation without intercepting links or text selection", () => {
  const { root, document, createReviewRow } = fixture();
  let activations = 0;
  const row = createReviewRow(root, () => { activations++; });
  assert.equal(row.options.attr.role, "button"); assert.equal(row.options.attr.tabindex, "0");
  const target = { closest: () => null };
  row.onclick({ target }); assert.equal(activations, 1);
  row.onclick({ target: { closest: () => ({}) } }); assert.equal(activations, 1);
  document.getSelection = () => ({ isCollapsed: false, anchorNode: {} });
  row.onclick({ target }); assert.equal(activations, 1);
  let prevented = false;
  row.onkeydown({ target: row, key: "Enter", preventDefault() { prevented = true; } });
  assert.equal(activations, 2); assert.equal(prevented, true);
  row.onkeydown({ target, key: "Enter", preventDefault() {} }); assert.equal(activations, 2);
});
