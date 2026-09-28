import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const built = await build({ entryPoints: ["src/relation-sections.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { parseSectionLinks, relationTypes, relationBlockSource, replaceLexisFences } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);

test("classifies arbitrary relation headings at every Markdown heading level", () => {
  const note = [
    "---", "aliases: [foo]", "---",
    "# 反义词", "[[cold]]",
    "### 1. 同领域术语", "[[heat]]",
    "###### 反义词 ###", "[[cool#用法|cool]] ![[picture.png]]",
    "```lexis", "rel 反义词", "[[ignored]]", "```",
  ].join("\n");
  assert.deepEqual(parseSectionLinks(note), [
    { type: "反义词", target: "cold" },
    { type: "同领域术语", target: "heat" },
    { type: "反义词", target: "cool" },
  ]);
});

test("discovers custom types in overview without a fixed category list", () => {
  assert.deepEqual(relationTypes({ "反义词": [{}], "相关": [{}] }, { "同领域术语": [{}] }), ["反义词", "同领域术语", "相关"]);
});

test("supports shorthand rel fences and existing lexis blocks", () => {
  assert.equal(relationBlockSource("", "```rel 反义词\n```"), "rel 反义词");
  assert.equal(relationBlockSource("", "## 反义词\n```rel 反义词\n```"), "rel 反义词");
  assert.equal(relationBlockSource("反义词", null), "rel 反义词");
  const sources = [];
  const markdown = ["## 反义词", "```rel 反义词", "```", "```lexis", "rel 近义词", "```"].join("\n");
  const replaced = replaceLexisFences(markdown, (source) => { sources.push(source); return "@@BLOCK@@"; });
  assert.deepEqual(sources, ["rel 反义词", "rel 近义词"]);
  assert.equal(replaced.includes("## 反义词"), true);
  assert.equal((replaced.match(/@@BLOCK@@/g) || []).length, 2);
});
