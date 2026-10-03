import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadParser() {
  const result = await build({ entryPoints: ["src/inline-entry-parser.ts"], bundle: true, write: false, format: "esm", platform: "node", external: ["obsidian"] });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("parses inline aliases with optional whitespace and escaped delimiters", async () => {
  const { parseInlineEntries } = await loadParser();
  const file = { path: "People.md", basename: "People" };
  const content = [
    "---",
    "lexis-inline: true",
    "---",
    "## 人物",
    "亚尔达/亚尔 / Yalda:: 多个名字指向同一个人物。",
    "I\\/O / 输入输出:: 保留术语里的字面斜杠。",
  ].join("\n");
  const entries = parseInlineEntries(content, file, { entryDelimiter: "::", aliasDelimiter: "/" });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].aliases, ["亚尔", "Yalda"]);
  assert.equal(entries[0].display, "亚尔达");
  assert.equal(entries[0].category, "人物");
  assert.equal(entries[1].display, "I/O");
  assert.deepEqual(entries[1].aliases, ["输入输出"]);
});

test("supports a custom inline alias delimiter and removes duplicates", async () => {
  const { parseInlineEntries } = await loadParser();
  const file = { path: "People.md", basename: "People" };
  const [entry] = parseInlineEntries("Alpha | A | alpha:: note", file, { entryDelimiter: "::", aliasDelimiter: "|" });

  assert.equal(entry.display, "Alpha");
  assert.deepEqual(entry.aliases, ["A"]);
});

test("parses a trailing color role without changing names", async () => {
  const { parseInlineEntries } = await loadParser();
  const file = { path: "People.md", basename: "People" };
  const entries = parseInlineEntries([
    "亚尔达 / Yalda {船长}:: 人物批注",
    "I\\/O {#8b5cf6}:: 术语批注",
  ].join("\n"), file, { entryDelimiter: "::", aliasDelimiter: "/" });

  assert.equal(entries[0].display, "亚尔达");
  assert.deepEqual(entries[0].aliases, ["Yalda"]);
  assert.equal(entries[0].colorToken, "船长");
  assert.equal(entries[1].display, "I/O");
  assert.equal(entries[1].colorToken, "#8b5cf6");
});
