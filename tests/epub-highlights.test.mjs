import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/epub-highlights.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { EpubHighlights } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

function chapterDocument() {
  const document = new EventTarget();
  document.body = { querySelectorAll: () => [] };
  return document;
}

function fixture(settings = {}) {
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const document = { defaultView: { MutationObserver: Observer } };
  const frame = Object.assign(new EventTarget(), {
    tagName: "IFRAME", isConnected: true, ownerDocument: document, contentDocument: chapterDocument(),
    hasAttribute: (name) => name === "enable-annotation", matches: () => true,
  });
  document.body = { matches: () => false, querySelectorAll: () => frame.isConnected ? [frame] : [] };
  const host = {
    settings: { enableHighlight: true, highlightMode: "automatic", ...settings },
    selectionCalls: 0, renderCalls: 0,
    maybeShowSelPill(_event, fromEpub) { assert.equal(fromEpub, true); this.selectionCalls++; },
    wrapMatchesInElement() { this.renderCalls++; },
    onMouseOver() {}, onMouseOut() {}, onClick() {},
  };
  const reader = new EpubHighlights(host);
  return { host, frame, document, reader, observers };
}

test("EPUB binds selection before rendering can fail", () => {
  const { host, frame, document, reader } = fixture();
  host.wrapMatchesInElement = () => { throw new Error("renderer failure"); };
  assert.throws(() => reader.start(document), /renderer failure/);
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 1);
  reader.dispose();
});

test("EPUB selection is independent of automatic highlighting", () => {
  for (const settings of [{ highlightMode: "manual" }, { enableHighlight: false }]) {
    const { host, frame, document, reader } = fixture(settings);
    reader.start(document);
    frame.contentDocument.dispatchEvent(new Event("mouseup"));
    assert.equal(host.selectionCalls, 1);
    assert.equal(host.renderCalls, 0);
    reader.dispose();
  }
});

test("EPUB rescans reuse listeners instead of adding duplicates", () => {
  const { host, frame, document, reader } = fixture();
  reader.start(document);
  for (let i = 0; i < 5; i++) reader.rescan();
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 1);
  reader.dispose();
});

test("EPUB navigation releases the old document and binds the new one", () => {
  const { host, frame, document, reader } = fixture();
  reader.start(document);
  const oldDocument = frame.contentDocument;
  frame.contentDocument = chapterDocument();
  frame.dispatchEvent(new Event("load"));
  oldDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 0);
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 1);
  reader.dispose();
});

test("EPUB removed chapters release load and document listeners", () => {
  const { host, frame, document, reader } = fixture();
  reader.start(document);
  frame.isConnected = false;
  reader.rescan();
  frame.dispatchEvent(new Event("load"));
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 0);
  assert.equal(host.renderCalls, 1);
  reader.dispose();
});

test("EPUB disposal releases observers and prevents late callbacks", () => {
  const { host, frame, document, reader, observers } = fixture();
  reader.start(document);
  reader.dispose(); reader.dispose(); reader.rescan();
  assert.doesNotThrow(() => frame.dispatchEvent(new Event("load")));
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.ok(observers.every((observer) => observer.disconnected));
  assert.equal(host.selectionCalls, 0);
  assert.equal(host.renderCalls, 1);
});

test("EPUB restart does not duplicate callbacks and observes replaced settings", () => {
  const { host, frame, document, reader, observers } = fixture();
  reader.start(document);
  host.settings = { enableHighlight: false, highlightMode: "automatic" };
  reader.start(document);
  frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(host.selectionCalls, 1);
  assert.equal(host.renderCalls, 1);
  assert.equal(observers.filter((observer) => !observer.disconnected).length, 1);
  reader.dispose();
});

test("EPUB services do not write listener state onto their hosts", () => {
  const first = fixture();
  const second = fixture();
  const hostKeys = Object.keys(first.host);
  first.reader.start(first.document); second.reader.start(second.document);
  first.reader.dispose();
  second.frame.contentDocument.dispatchEvent(new Event("mouseup"));
  assert.equal(first.host.selectionCalls, 0);
  assert.equal(second.host.selectionCalls, 1);
  assert.deepEqual(Object.keys(first.host), hostKeys);
  second.reader.dispose();
});
