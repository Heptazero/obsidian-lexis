import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/reading-scroll.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { rerenderPreservingScroll } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("restores reading scroll after the forced highlight rerender", () => {
  let scroll = 640;
  let forced = false;
  let nextFrame;
  const preview = {
    getScroll: () => scroll,
    rerender: (full) => { forced = full; scroll = 0; },
    applyScroll: (value) => { scroll = value; },
  };
  rerenderPreservingScroll(preview, (callback) => { nextFrame = callback; return 1; }, () => true);
  assert.equal(forced, true);
  assert.equal(scroll, 0);
  nextFrame(0);
  assert.equal(scroll, 640);
});

test("does not restore an obsolete view after its leaf changes", () => {
  let restored = false;
  let nextFrame;
  const preview = {
    getScroll: () => 200,
    rerender: () => {},
    applyScroll: () => { restored = true; },
  };
  rerenderPreservingScroll(preview, (callback) => { nextFrame = callback; return 1; }, () => false);
  nextFrame(0);
  assert.equal(restored, false);
});
