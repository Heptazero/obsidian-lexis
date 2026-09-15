import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/reading-highlights.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { refreshReadingHighlightsInPlace } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("refreshes reading highlights without rerendering the document", () => {
  const events = [];
  const parent = { normalize: () => events.push("normalize") };
  const text = { value: "word" };
  const highlight = {
    childNodes: [text],
    parentNode: parent,
    closest: () => null,
    replaceWith: (...nodes) => events.push(["unwrap", ...nodes]),
  };
  const popoverHighlight = {
    childNodes: [],
    parentNode: parent,
    closest: () => ({}),
    replaceWith: () => events.push("unexpected"),
  };
  const root = { querySelectorAll: () => [highlight, popoverHighlight] };

  refreshReadingHighlightsInPlace(root, () => events.push("apply"));

  assert.deepEqual(events, [["unwrap", text], "normalize", "apply"]);
});
