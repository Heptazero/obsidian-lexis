import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadCategoryResolver() {
  const result = await build({ entryPoints: ["src/inline-category.ts"], bundle: true, write: false, format: "esm", platform: "node", external: ["obsidian"] });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

const entry = {
  headingPath: [
    { name: "小说", level: 1, line: 0 },
    { name: "人物", level: 2, line: 2 },
    { name: "阵营", level: 3, line: 8 },
    { name: "经历", level: 4, line: 12 },
  ],
};

test("uses the nearest heading when no fixed level is selected", async () => {
  const { inlineClassificationHeading } = await loadCategoryResolver();
  assert.equal(inlineClassificationHeading(entry, 0)?.name, "经历");
});

test("makes deeper headings inherit the selected global heading level", async () => {
  const { inlineClassificationHeading, inlineClassificationPath } = await loadCategoryResolver();
  assert.equal(inlineClassificationHeading(entry, 2)?.name, "人物");
  assert.equal(inlineClassificationHeading(entry, 3)?.name, "阵营");
  assert.deepEqual(inlineClassificationPath(entry, 2).map(({ name }) => name), ["人物", "阵营", "经历"]);
});

test("formats the selected category and its nested headings as a breadcrumb", async () => {
  const { inlineCategoryLabel } = await loadCategoryResolver();
  assert.equal(inlineCategoryLabel({ category: "人物", categoryPath: ["人物", "忒修斯号船员"] }), "人物 / 忒修斯号船员");
});

test("falls back to the nearest higher heading when the selected level is absent", async () => {
  const { inlineClassificationHeading } = await loadCategoryResolver();
  const sparseEntry = { headingPath: [entry.headingPath[0], entry.headingPath[1], entry.headingPath[3]] };
  assert.equal(inlineClassificationHeading(sparseEntry, 3)?.name, "人物");
});
