import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadConfig() {
  const source = await readFile("pkg/browser-extension/config.js", "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  return context.globalThis.LexisWebConfig;
}

test("browser dictionary visibility uses the current site and longest matching dictionary", async () => {
  const config = await loadConfig();
  const dictionaries = ["60_english", "60_english/00-word", "10_atom"];
  assert.equal(config.dictionaryForFolder("60_english/00-word/nested", dictionaries), "60_english/00-word");
  const visibility = {
    "https://example.com": { "60_english/00-word": false },
    "https://other.example": {},
  };
  assert.equal(config.isDictionaryVisible("https://example.com", "60_english/00-word", dictionaries, visibility), false);
  assert.equal(config.isDictionaryVisible("https://other.example", "60_english/00-word", dictionaries, visibility), true);
  assert.equal(config.isDictionaryVisible("https://example.com", "unmanaged", dictionaries, visibility), true);
});

test("browser highlighting leaves the active selection untouched", async () => {
  const config = await loadConfig();
  const selectedNode = {};
  const outsideNode = {};
  const selection = {
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => ({ intersectsNode: (node) => node === selectedNode }),
  };
  assert.equal(config.hasExpandedSelection(selection), true);
  assert.equal(config.selectionIntersectsNode(selection, selectedNode), true);
  assert.equal(config.selectionIntersectsNode(selection, outsideNode), false);
  assert.equal(config.selectionIntersectsNode({ ...selection, isCollapsed: true }, selectedNode), false);
});
