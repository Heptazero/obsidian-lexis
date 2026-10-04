import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadSuggestions() {
  const result = await build({ entryPoints: ["src/entry-color-suggestions.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("opens color suggestions inside an inline entry color token", async () => {
  const { inlineColorQuery } = await loadSuggestions();
  assert.deepEqual(inlineColorQuery("萨拉斯第 {船}:: 批注", 7, "::"), { startCh: 6, query: "船" });
  assert.deepEqual(inlineColorQuery("萨拉斯第 {}:: 批注", 6, "::"), { startCh: 6, query: "" });
  assert.equal(inlineColorQuery("萨拉斯第:: 批注 {船", 12, "::"), null);
});

test("offers every slash-separated color alias and fuzzy ranks them", async () => {
  const { collectEntryColorSuggestions, rankEntryColorSuggestions } = await loadSuggestions();
  const suggestions = collectEntryColorSuggestions([
    { name: "船长 / 指挥官 / ENTJ", color: "#8b5cf6" },
    { name: "学者 / INTP", color: "#2563eb" },
  ]);

  assert.deepEqual(suggestions.map(({ name }) => name), ["船长", "指挥官", "ENTJ", "学者", "INTP"]);
  assert.deepEqual(rankEntryColorSuggestions(suggestions, "int").map(({ name }) => name), ["INTP"]);
});
