import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/canvas-edge-highlights.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { edgeLabelMatches } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("finds every dictionary match in a Canvas edge label", () => {
  const lattice = { display: "格点群" };
  const group = { display: "群" };
  const index = new Map([["格点群", lattice], ["群", group]]);
  const matches = edgeLabelMatches("格点群与群", "格点群|群", (value) => value, index);

  assert.deepEqual(matches.map(({ start, end, key, entry }) => ({ start, end, key, entry })), [
    { start: 0, end: 3, key: "格点群", entry: lattice },
    { start: 4, end: 5, key: "群", entry: group },
  ]);
});

test("returns no Canvas edge matches when highlighting is inactive", () => {
  assert.deepEqual(edgeLabelMatches("格点群", null, (value) => value, new Map()), []);
});
