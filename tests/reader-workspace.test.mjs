import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/reader-workspace.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { createReaderWorkspace } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

function readerDocument() {
  const document = new EventTarget();
  document.defaultView = new EventTarget();
  document.nodeType = 9;
  return document;
}

function fixture() {
  const document = readerDocument();
  const subscriptions = new Set(), cleanups = [], calls = [];
  const workspace = {
    containerEl: { ownerDocument: document },
    getMostRecentLeaf: () => null,
    on(event, callback) { const ref = { event, callback }; subscriptions.add(ref); return ref; },
    offref(ref) { subscriptions.delete(ref); },
    emit(event, ...args) { for (const ref of [...subscriptions]) if (ref.event === event) ref.callback(...args); },
  };
  const host = {
    app: { workspace }, register: (cleanup) => cleanups.push(cleanup),
    _popover: null, _selPill: null,
    _canvasEdgeHighlights: { activate: (doc) => calls.push(["canvas", doc]), close: (doc) => calls.push(["close", doc]) },
    epubHighlights: { start: (doc) => calls.push(["epub", doc]) },
    onMouseMove: () => calls.push(["move"]), onMouseOver() {}, onMouseOut() {},
    onClick: () => calls.push(["click"]), onPointerDown() {}, onPointerMove() {}, onPointerUp() {},
    onPointerCancel: () => calls.push(["cancel-touch"]), maybeShowSelPill: () => calls.push(["selection"]),
    removePopover: () => calls.push(["remove-card"]), removeSelPill: () => calls.push(["remove-pill"]),
    setupPdfHighlight: (doc) => calls.push(["pdf", doc]),
    applyReviewMetadataVisibility() {}, syncActivePageHighlightState() {},
  };
  const readers = createReaderWorkspace(host);
  return { document, workspace, cleanups, calls, host, readers, subscriptions };
}

test("workspace starts once and only restarts adapters when the document changes", () => {
  const { document, workspace, calls, readers, subscriptions } = fixture();
  readers.start(); readers.start();
  document.dispatchEvent(new Event("click"));
  workspace.emit("active-leaf-change", { view: { containerEl: { ownerDocument: document } } });
  assert.equal(calls.filter(([kind]) => kind === "click").length, 1);
  assert.equal(calls.filter(([kind]) => kind === "epub").length, 1);
  assert.equal(calls.filter(([kind]) => kind === "pdf").length, 1);
  assert.equal(subscriptions.size, 3);
  readers.dispose();
});

test("closing a pop-out releases its DOM listeners and routes back to the main window", () => {
  const { document, workspace, calls, readers } = fixture();
  readers.start();
  const popout = readerDocument();
  workspace.emit("window-open", {}, { document: popout });
  popout.dispatchEvent(new Event("click"));
  assert.equal(readers.current(), popout);
  workspace.emit("window-close", {}, { document: popout });
  const count = calls.length;
  popout.dispatchEvent(new Event("click"));
  popout.defaultView.dispatchEvent(new Event("scroll"));
  assert.equal(calls.length, count);
  assert.equal(readers.current(), document);
  assert.ok(calls.some(([kind, doc]) => kind === "close" && doc === popout));
  readers.dispose();
});

test("plugin cleanup releases all workspace subscriptions and document listeners", () => {
  const { document, workspace, readers, cleanups, subscriptions, calls } = fixture();
  readers.start();
  for (const cleanup of cleanups) cleanup();
  readers.dispose();
  const count = calls.length;
  document.dispatchEvent(new Event("click"));
  document.defaultView.dispatchEvent(new Event("scroll"));
  workspace.emit("window-open", {}, { document: readerDocument() });
  readers.activateLeaf(null);
  assert.equal(calls.length, count);
  assert.equal(subscriptions.size, 0);
  readers.start();
  const clicks = calls.filter(([kind]) => kind === "click").length;
  document.dispatchEvent(new Event("click"));
  assert.equal(calls.filter(([kind]) => kind === "click").length, clicks + 1);
  assert.equal(subscriptions.size, 3);
  readers.dispose();
});

test("scrolling the card preserves it while page scrolling cancels touch and closes overlays", () => {
  const { document, readers, calls, host } = fixture();
  readers.start();
  const content = { nodeType: 1 };
  host._popover = { contains: (node) => node === content };
  const inside = new Event("scroll");
  Object.defineProperty(inside, "target", { value: content });
  document.defaultView.dispatchEvent(inside);
  assert.equal(calls.at(-1)[0], "cancel-touch");
  assert.ok(!calls.some(([kind]) => kind === "remove-card"));
  document.defaultView.dispatchEvent(new Event("scroll"));
  assert.deepEqual(calls.slice(-3).map(([kind]) => kind), ["cancel-touch", "remove-card", "remove-pill"]);
  readers.dispose();
});
