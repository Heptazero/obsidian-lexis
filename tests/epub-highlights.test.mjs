import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/epub-highlights.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { createEpubHighlights } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

function chapterDocument() {
  const document = new EventTarget();
  document.body = { querySelectorAll: () => [] };
  return document;
}

function fixture(settings = {}) {
  const ownerDocument = {};
  const frame = Object.assign(new EventTarget(), {
    tagName: "IFRAME", isConnected: true, ownerDocument, contentDocument: chapterDocument(),
    hasAttribute: (name) => name === "enable-annotation", matches: () => false, closest: () => null,
  });
  const host = {
    settings: { enableHighlight: true, highlightMode: "automatic", ...settings },
    _epubHostDocument: ownerDocument, _epubIframeFrames: new Map(), _epubIframeObserver: null,
    selectionCalls: 0, renderCalls: 0,
    maybeShowSelPill(_event, fromEpub) { assert.equal(fromEpub, true); this.selectionCalls++; },
    wrapMatchesInElement() { this.renderCalls++; },
    onMouseOver() {}, onMouseOut() {}, onClick() {},
  };
  Object.defineProperties(host, createEpubHighlights());
  return { host, frame };
}

test("EPUB binds selection before rendering can fail", () => {
  const { host, frame } = fixture();
  host.wrapMatchesInElement = () => { throw new Error("renderer failure"); };
  assert.throws(() => host.observeEpubIframe(frame), /renderer failure/);
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 1);
});

test("EPUB selection is independent of automatic highlighting", () => {
  for (const settings of [{ highlightMode: "manual" }, { enableHighlight: false }]) {
    const { host, frame } = fixture(settings);
    host.observeEpubIframe(frame);
    frame.contentDocument.dispatchEvent(new Event("mouseup"));
    assert.equal(host.selectionCalls, 1);
    assert.equal(host.renderCalls, 0);
    host.teardownEpubIframeHighlight();
  }
});

test("EPUB rescans reuse listeners instead of adding duplicates", () => {
  const { host, frame } = fixture();
  for (let i = 0; i < 5; i++) host.observeEpubIframe(frame);
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 1);
  assert.equal(host._epubIframeFrames.size, 1);
});

test("EPUB navigation releases the old document and binds the new one", () => {
  const { host, frame } = fixture();
  host.observeEpubIframe(frame);
  const oldDocument = frame.contentDocument;
  frame.contentDocument = chapterDocument();
  frame.dispatchEvent(new Event("load"));
  oldDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 0);
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 1);
  assert.equal(host._epubIframeFrames.get(frame).document, frame.contentDocument);
});

test("EPUB removed chapters release load and document listeners", () => {
  const { host, frame } = fixture();
  host.observeEpubIframe(frame);
  const state = host._epubIframeFrames.get(frame);
  frame.isConnected = false;
  host.pruneEpubIframes();
  frame.dispatchEvent(new Event("load"));
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host._epubIframeFrames.size, 0);
  assert.equal(state.document, null);
  assert.equal(host.selectionCalls, 0);
  assert.equal(host.renderCalls, 1);
});

test("EPUB teardown prevents callbacks after maps have been cleared", () => {
  const { host, frame } = fixture();
  host.observeEpubIframe(frame);
  host.teardownEpubIframeHighlight();
  assert.doesNotThrow(() => frame.dispatchEvent(new Event("load")));
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host._epubIframeFrames, null);
  assert.equal(host.selectionCalls, 0);
  assert.equal(host.renderCalls, 1);
});
