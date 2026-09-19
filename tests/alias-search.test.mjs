import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

async function loadObsidianSearch() {
  const result = await build({ entryPoints: ["src/alias-search.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function loadBrowserSearch() {
  const source = await readFile("pkg/browser-extension/alias-search.js", "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  return context.globalThis.LexisAliasSearch;
}

test("Obsidian and browser rank one target per file with aliases as search terms", async () => {
  const obsidian = await loadObsidianSearch();
  const browser = await loadBrowserSearch();
  const hopfield = { path: "words/Hopfield network.md", basename: "Hopfield network" };
  const hebbian = { path: "words/Hebbian learning.md", basename: "Hebbian learning" };
  const inline = { path: "notes/inline.md", basename: "inline" };
  const index = new Map([
    ["hopfield network", { display: "Hopfield network", file: hopfield }],
    ["联想记忆", { display: "联想记忆", file: hopfield, isAlias: true }],
    ["hebbian learning", { display: "Hebbian learning", file: hebbian }],
    ["inline", { display: "inline", file: inline, inline: true }],
  ]);
  const cachedWords = [
    { k: "hopfield network", w: "Hopfield network", p: hopfield.path, a: false },
    { k: "联想记忆", w: "联想记忆", p: hopfield.path, a: true },
    { k: "hebbian learning", w: "Hebbian learning", p: hebbian.path, a: false },
    { k: "inline", w: "inline", p: inline.path, i: true },
  ];

  const obsidianTargets = obsidian.collectAliasTargets(index);
  const browserTargets = browser.collectAliasTargets(cachedWords);
  assert.equal(obsidianTargets.length, 2);
  assert.equal(browserTargets.length, 2);
  assert.deepEqual(
    obsidian.rankAliasTargets(obsidianTargets, "hpfld").map((target) => target.title),
    ["Hopfield network"],
  );
  assert.deepEqual(
    Array.from(browser.rankAliasTargets(browserTargets, "hpfld"), (target) => target.title),
    ["Hopfield network"],
  );
  assert.equal(obsidian.rankAliasTargets(obsidianTargets, "联想")[0].matched, "联想记忆");
  assert.equal(browser.rankAliasTargets(browserTargets, "联想")[0].matched, "联想记忆");
  assert.equal(obsidian.findExactAliasTarget(obsidianTargets, "联想记忆")?.title, "Hopfield network");
  assert.equal(browser.findExactAliasTarget(browserTargets, "联想记忆")?.title, "Hopfield network");
  assert.equal(obsidian.findExactAliasTarget(obsidianTargets, "new entry"), null);
  assert.equal(browser.findExactAliasTarget(browserTargets, "new entry"), null);
});

test("exact title wins over the same text used as another entry alias", async () => {
  const obsidian = await loadObsidianSearch();
  const browser = await loadBrowserSearch();
  const targets = [
    { id: "alias", title: "Long form", terms: ["Long form", "Network"] },
    { id: "title", title: "Network", terms: ["Network"] },
  ];
  assert.equal(obsidian.findExactAliasTarget(targets, "network")?.id, "title");
  assert.equal(browser.findExactAliasTarget(targets, "network")?.id, "title");
});
