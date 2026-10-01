import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const roots = ["src", "pkg/browser-extension", "pkg/zotero-extension"];
const generatedDirectories = new Set(["dist", "node_modules"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || generatedDirectories.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (/\.(?:js|ts)$/.test(entry.name)) files.push(target);
  }
  return files;
}

test("keeps handwritten source files within 500 lines", async () => {
  const files = (await Promise.all(roots.map(sourceFiles))).flat();
  const oversized = [];
  for (const file of files) {
    const lineCount = (await readFile(file, "utf8")).split("\n").length - 1;
    if (lineCount > 500) oversized.push(`${file}: ${lineCount}`);
  }
  assert.deepEqual(oversized, []);
});
