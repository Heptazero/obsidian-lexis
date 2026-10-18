import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
  const context = { module: { exports: {} }, require: () => ({}) };
  context.exports = context.module.exports;
  vm.runInNewContext(result.outputFiles[0].text, context);
  return context.module.exports;
}
const { escapeOccurrenceHashes } = await load("src/occurrence-text.ts");
const { renderOccurrenceContent } = await load("src/occurrence-render.ts");

test("captured Zulip titles and prose hashtags remain literal without deleting text", () => {
  const sentence = "(I think this is dealt with now, please let me know if you see new problems like this. —— #Tau Ceti > review/merge race - Lean - Zulip";
  assert.equal(escapeOccurrenceHashes(sentence), sentence.replace("#Tau", "\\#Tau"));
  assert.equal(escapeOccurrenceHashes("#中文 #nested/tag C#\n## heading"), "\\#中文 \\#nested/tag C\\#\n\\#\\# heading");
  for (const text of ["#Tau #中文", String.raw`\#escaped \\#unescaped`, "no hashes"]) {
    const escaped = escapeOccurrenceHashes(text);
    assert.equal(escapeOccurrenceHashes(escaped), escaped);
  }
});

test("code and LaTeX hashes remain unchanged while adjacent prose is escaped", () => {
  for (const syntax of [
    "`#code`", "`` `#code` ``", "```cpp\n#define X 1\n```", "````md\n```\n#code\n```\n````", "~~~cpp\n#define X 1\n~~~",
    String.raw`$\#A + #1$`, "$$\n\\#A + #1\n$$",
  ]) assert.equal(escapeOccurrenceHashes(`${syntax} #Tau`), `${syntax} \\#Tau`);
});

test("web destinations, PDF pages and wiki headings retain their hashes", () => {
  for (const link of [
    "https://example.com/a#part", "<https://example.com/a#part>", "obsidian://open?vault=test#part",
    "[[paper.pdf#page=22|paper p.22]]", "[[note#Heading]]",
    "[source](https://example.com/a#part)", "[source](#Heading)", "[source](https://example.com/a_(b)#part)",
  ]) assert.equal(escapeOccurrenceHashes(`${link} #Tau`), `${link} \\#Tau`);
});

test("only the sentence variable is escaped, not custom headings or source links", () => {
  assert.equal(renderOccurrenceContent("### 出处\n> {{sentence}}{{sourceSuffix}}", {
    sentence: "#Tau\n$\\#A$", sourceSuffix: " —— [[paper.pdf#page=22|paper p.22]]",
  }), "### 出处\n> \\#Tau\n> $\\#A$ —— [[paper.pdf#page=22|paper p.22]]");
});

test("browser repeat captures recognize both existing raw and escaped occurrences", async () => {
  const { createBridgeApi } = await load("src/bridge-api.ts");
  class TFile { path = "terms/Tau.md"; basename = "Tau"; }
  const file = new TFile(), sentence = "Context #Tau Ceti > review/merge race";
  for (const saved of [sentence, escapeOccurrenceHashes(sentence)]) {
    let writes = 0;
    const host = {
      settings: { dicts: [] }, index: new Map(), sanitizeName: (name) => name,
      normalizeFolder: (folder) => folder, primaryVocabFolder: () => "terms",
      app: { vault: { getAbstractFileByPath: () => file, cachedRead: async () => `> ${saved}`, process: async () => { writes++; } } },
    };
    Object.defineProperties(host, createBridgeApi({ TFile, todayStr: () => "2026-10-18" }));
    const result = await host.bridgeAddWord({ word: "Tau", sentence });
    assert.equal(result.dup, true);
    assert.equal(writes, 0);
  }
});
