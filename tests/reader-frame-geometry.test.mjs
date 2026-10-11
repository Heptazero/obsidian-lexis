import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/reader-frame-geometry.ts"], bundle: true, write: false, format: "esm" });
const { overlayDocumentFor, overlayAnchorFor, readerRectInDocument, frameBelongsToDocument } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const rect = { left: 4, top: 6, width: 20, height: 10, right: 24, bottom: 16 };

function nested() {
  const root = { defaultView: {} };
  const outer = { isConnected: true, ownerDocument: root, clientLeft: 2, clientTop: 2,
    offsetWidth: 100, offsetHeight: 100, getBoundingClientRect: () => ({ left: 100, top: 50, width: 50, height: 50 }) };
  const shell = { defaultView: { frameElement: outer } };
  outer.contentDocument = shell;
  const inner = { isConnected: true, ownerDocument: shell, clientLeft: 1, clientTop: 1,
    offsetWidth: 50, offsetHeight: 50, getBoundingClientRect: () => ({ left: 10, top: 20, width: 50, height: 50 }) };
  const chapter = { defaultView: { frameElement: inner } };
  inner.contentDocument = chapter;
  return { root, outer, shell, inner, chapter };
}

test("ordinary Markdown and PDF rectangles remain unchanged", () => {
  const doc = { defaultView: {} };
  const element = { ownerDocument: doc };
  assert.equal(overlayDocumentFor(element), doc);
  assert.equal(overlayAnchorFor(element), element);
  assert.equal(readerRectInDocument(rect, doc, doc), rect);
});

test("nested reader overlays use their own workspace window instead of the global document", () => {
  const { root, outer, chapter } = nested();
  const element = { ownerDocument: chapter };
  assert.equal(overlayDocumentFor(element), root);
  assert.equal(overlayAnchorFor(element), outer);
});

test("nested frame geometry includes each border and scale", () => {
  const { chapter, root } = nested();
  assert.deepEqual(readerRectInDocument(rect, chapter, root), {
    left: 108.5, top: 64.5, width: 10, height: 5, right: 118.5, bottom: 69.5,
  });
});

test("chapter reachability detects removed parents and navigated-away documents", () => {
  const { root, outer, inner } = nested();
  assert.equal(frameBelongsToDocument(inner, root), true);
  outer.isConnected = false;
  assert.equal(frameBelongsToDocument(inner, root), false);
  outer.isConnected = true;
  outer.contentDocument = {};
  assert.equal(frameBelongsToDocument(inner, root), false);
});
