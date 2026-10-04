import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadColors() {
  const result = await build({ entryPoints: ["src/entry-colors.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("resolves slash-separated entry color aliases without case sensitivity", async () => {
  const { resolveEntryColorToken } = await loadColors();
  const entries = [{ name: "Captain / Commander / 船长", color: "#8b5cf6" }];

  assert.equal(resolveEntryColorToken(" captain ", entries), "#8b5cf6");
  assert.equal(resolveEntryColorToken("COMMANDER", entries), "#8b5cf6");
  assert.equal(resolveEntryColorToken("船长", entries), "#8b5cf6");
});

test("accepts direct hex colors and rejects unknown values", async () => {
  const { resolveEntryColorToken, entryColorLabel } = await loadColors();

  assert.equal(resolveEntryColorToken("#abc", []), "#abc");
  assert.equal(resolveEntryColorToken("red", []), "");
  assert.equal(entryColorLabel("ENTJ"), "ENTJ");
  assert.equal(entryColorLabel("#8b5cf6"), "");
});
