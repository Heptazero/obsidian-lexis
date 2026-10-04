import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadHeadingSuggest() {
  const result = await build({ entryPoints: ["src/inline-heading-suggestions.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("triggers only for the configured heading level", async () => {
  const { inlineHeadingQuery } = await loadHeadingSuggest();
  assert.deepEqual(inlineHeadingQuery("### 人", 5, 3), { startCh: 4, query: "人" });
  assert.deepEqual(inlineHeadingQuery("  ### ", 6, 3), { startCh: 6, query: "" });
  assert.equal(inlineHeadingQuery("## 人", 4, 3), null);
  assert.equal(inlineHeadingQuery("### 人", 5, 0), null);
});

test("deduplicates same-level headings across inline files", async () => {
  const { collectInlineHeadingSuggestions } = await loadHeadingSuggest();
  const suggestions = collectInlineHeadingSuggestions([
    { path: "Novel A.md", headings: [{ heading: "人物", level: 3 }, { heading: "人物", level: 3 }, { heading: "设定", level: 2 }] },
    { path: "Novel B.md", headings: [{ heading: "人物", level: 3 }, { heading: "地点", level: 3 }] },
  ], 3);

  assert.deepEqual(suggestions.find(({ name }) => name === "人物"), { name: "人物", fileCount: 2, occurrenceCount: 3 });
  assert.equal(suggestions.some(({ name }) => name === "设定"), false);
});

test("fuzzy ranks matching global headings", async () => {
  const { rankInlineHeadingSuggestions } = await loadHeadingSuggest();
  const suggestions = [
    { name: "人物关系", fileCount: 2, occurrenceCount: 2 },
    { name: "地点", fileCount: 4, occurrenceCount: 4 },
    { name: "主要人物", fileCount: 1, occurrenceCount: 1 },
  ];

  assert.deepEqual(rankInlineHeadingSuggestions(suggestions, "人物").map(({ name }) => name), ["人物关系", "主要人物"]);
});
