import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/selection-pill-position.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { positionSelectionPill, normalizePillOffset, positionBrowserSelectionPill } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
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

test("browser keeps centered default placement and flips at the bottom only for automatic placement", () => {
  const rect = {left:100,top:70,bottom:90,width:60};
  assert.deepEqual(positionBrowserSelectionPill(rect,pill,viewport,{x:0,y:0}),{left:85,top:96});
  assert.deepEqual(positionBrowserSelectionPill(rect,pill,viewport,{x:40,y:-80}),{left:125,top:16});
  const bottom = {...rect,top:270,bottom:290};
  assert.deepEqual(positionBrowserSelectionPill(bottom,pill,viewport,{x:0,y:0}),{left:85,top:234});
  assert.deepEqual(positionBrowserSelectionPill(bottom,pill,viewport,{x:0,y:15}),{left:85,top:264});
});

test("browser offset normalization rejects invalid persisted values without touching Obsidian defaults", () => {
  for (const input of [null,undefined,[],"invalid",{x:Infinity,y:NaN}]) assert.deepEqual(normalizePillOffset(input),{x:0,y:0});
  assert.deepEqual(normalizePillOffset({x:42.8,y:-70.2}),{x:43,y:-70});
  assert.deepEqual(positionSelectionPill(anchor,pill,viewport,{x:0,y:0}),{left:120,top:106});
});
