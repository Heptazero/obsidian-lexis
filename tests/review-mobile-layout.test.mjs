import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/review-mobile-layout.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { reviewBottomClearance } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("mobile scroll clearance uses the actual floating bar's top, not a fixed estimated height", () => {
  assert.equal(reviewBottomClearance(800, 900, 690, 110), 122);
  assert.equal(reviewBottomClearance(900, 900, 760, 70), 152);
  assert.equal(reviewBottomClearance(900, 900, 700, 130), 212);
});

test("hidden buttons do not reserve phantom space and keyboard viewport limits are respected", () => {
  assert.equal(reviewBottomClearance(900, 900, 0, 0), 12);
  assert.equal(reviewBottomClearance(900, 600, 490, 110), 122);
  assert.equal(reviewBottomClearance(900, 600, 700, 110), 12);
});
