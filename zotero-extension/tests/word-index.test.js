const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ LexisZotero: {} });
vm.runInContext(fs.readFileSync(path.join(root, "src/word-index.js"), "utf8"), context);

const index = new context.LexisZotero.WordIndex();
index.update([
  { key: "energy gap", word: "energy gap", tags: ["physics"], file: "10_atom/energy gap.md" },
  { key: "能量差", word: "能量差", tags: [], file: "10_atom/能量差.md" },
  { key: "cat", word: "cat", tags: ["hide"], file: "01-word/cat.md" },
  { key: "state-of-the-art", word: "state-of-the-art", tags: [], file: "01-word/state-of-the-art.md" },
], {
  excludeTags: ["hide"],
  highlightColor: "#7c5cff",
  highlightOpacity: .8,
  highlightStyle: "wavy",
  dicts: ["01-word", "10_atom"],
  dictColors: { "10_atom": "#00aa88" },
  tagRules: [{ tag: "physics", color: "#ff8800", style: "underline" }],
});

assert.equal(index.has("Energy Gap"), true);
assert.equal(index.has("cat"), false);
assert.equal(index.isExcluded("cat"), true);
assert.equal(index.regex().exec("the energy gap changed")[0].toLowerCase(), "energy gap");
assert.equal(index.regex().exec("这是能量差模型")[0], "能量差");
assert.equal(index.regex().exec("a state-of-the-art result")[0], "state-of-the-art");
assert.deepEqual(JSON.parse(JSON.stringify(index.appearance("energy gap"))), {
  visible: true,
  color: "#ff8800",
  opacity: .8,
  style: "underline",
});
assert.equal(index.folderOf("10_atom/energy gap.md"), "10_atom");
assert.deepEqual(JSON.parse(JSON.stringify(index.dictionaries())), ["01-word", "10_atom"]);

console.log("word-index tests passed");
