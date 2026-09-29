import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/settings-section-order.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { orderedSectionKeys } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const sections = ["data", "mobile", "dictionary", "review"];

test("new settings keep their default section order", () => {
  assert.deepEqual(orderedSectionKeys(sections, []), sections);
});

test("saved order survives added, removed, and duplicate section keys", () => {
  assert.deepEqual(orderedSectionKeys(sections, ["review", "data", "review", "old", "mobile"]), ["review", "data", "mobile", "dictionary"]);
  assert.deepEqual(orderedSectionKeys(sections, null), sections);
});
