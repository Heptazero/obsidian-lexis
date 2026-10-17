import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/selection-pill-order.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`;
const { SELECTION_PILL_ORDERS, selectionPillActions } = await import(moduleUrl);

test("selection pill exposes all six action orders", () => {
  assert.equal(SELECTION_PILL_ORDERS.length, 6);
  for (const order of SELECTION_PILL_ORDERS) {
    const actions = selectionPillActions(order);
    assert.equal(actions.join("-"), order);
    assert.deepEqual(new Set(actions), new Set(["add", "dictionary", "alias"]));
  }
});

test("selection pill falls back to the original order", () => {
  assert.deepEqual(selectionPillActions(undefined), ["add", "dictionary", "alias"]);
});
