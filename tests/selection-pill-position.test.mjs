import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/selection-pill-position.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { positionSelectionPill } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const anchor = { left: 120, bottom: 100 };
const pill = { width: 90, height: 30 };
const viewport = { width: 400, height: 300 };

test("keeps default placement and allows offsets in every direction", () => {
  assert.deepEqual(positionSelectionPill(anchor, pill, viewport, { x: 0, y: 0 }), { left: 120, top: 106 });
  assert.deepEqual(positionSelectionPill(anchor, pill, viewport, { x: -40, y: -70 }), { left: 80, top: 36 });
  assert.deepEqual(positionSelectionPill(anchor, pill, viewport, { x: 60, y: 40 }), { left: 180, top: 146 });
});

test("clamps all edges using the actual pill dimensions on narrow screens", () => {
  const mobile = { width: 320, height: 480 };
  const largePill = { width: 190, height: 44 };
  assert.deepEqual(positionSelectionPill(anchor, largePill, mobile, { x: 500, y: 500 }), { left: 124, top: 430 });
  assert.deepEqual(positionSelectionPill(anchor, largePill, mobile, { x: -500, y: -500 }), { left: 6, top: 6 });
});
