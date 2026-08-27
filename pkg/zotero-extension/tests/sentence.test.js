const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ LexisZotero: {} });
vm.runInContext(fs.readFileSync(path.join(root, "src/pdf-highlighter.js"), "utf8"), context);

assert.equal(context.LexisZotero.sentenceAt("First. The energy gap changed. Last.", 14), "The energy gap changed.");
assert.equal(context.LexisZotero.sentenceAt("这是第一句。能量差发生变化。最后一句。", 8), "能量差发生变化。" );
assert.equal(context.LexisZotero.sentenceAt("cross\nline", 7), "line");

const plainItems = context.LexisZotero.plainTextItems([{
  str: "Energy", width: 30, height: 10, hasEOL: true, transform: [1, 0, 0, 10, 20, 30], extra: "ignored",
}]);
assert.equal(plainItems[0].str, "Energy");
assert.equal(plainItems[0].transform.join(","), "1,0,0,10,20,30");
assert.equal(Object.prototype.hasOwnProperty.call(plainItems[0], "extra"), false);

let frameCallback;
let rescans = 0;
let errors = 0;
const highlighter = new context.LexisZotero.PdfHighlighter({
  win: {
    document: {},
    requestAnimationFrame: (callback) => { frameCallback = callback; return 1; },
    cancelAnimationFrame() {},
  },
  index: {},
  onError: () => { errors++; },
});
highlighter.active = true;
highlighter.rescan = () => { rescans++; };
highlighter.updateIndex({ pattern: "energy" });
assert.equal(rescans, 0);
frameCallback();
assert.equal(rescans, 1);
assert.equal(errors, 0);

const matches = context.LexisZotero.findPdfMatches([
  { str: "The energy", transform: [1, 0, 0, 10, 10, 100], width: 48, height: 10 },
  { str: "gap changed.", transform: [1, 0, 0, 10, 62, 100], width: 60, height: 10 },
  { str: "Metric", transform: [1, 0, 0, 10, 10, 80], width: 32, height: 10, hasEOL: true },
], {
  regex: () => /energy gap|metric/gi,
  get: (key) => ({ key }),
  isExcluded: () => false,
}).matches;
assert.equal(matches.length, 2);
assert.equal(matches[0].key, "energy gap");
assert.equal(matches[0].ranges.map((range) => range.itemIndex).join(","), "0,1");
assert.equal(matches[1].key, "metric");

console.log("sentence tests passed");
