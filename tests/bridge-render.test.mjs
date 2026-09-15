import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/bridge-render.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { containsMath, withTimeout } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
globalThis.window = globalThis;

test("detects math that needs the MathJax queue", () => {
  assert.equal(containsMath("plain text"), false);
  assert.equal(containsMath("price is $ 5"), false);
  assert.equal(containsMath("$x+y$"), true);
  assert.equal(containsMath("\\(x+y\\)"), true);
  assert.equal(containsMath("$$x+y$$"), true);
});

test("returns settled work and rejects stalled work", async () => {
  assert.equal(await withTimeout(Promise.resolve("done"), 20), "done");
  await assert.rejects(withTimeout(new Promise(() => {}), 5), /render-timeout/);
});
