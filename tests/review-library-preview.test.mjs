import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/review-library-preview.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  const components = [], observers = [], warnings = [];
  class Component {
    constructor() { components.push(this); this.loaded = false; }
    load() { this.loaded = true; }
    unload() { this.loaded = false; }
  }
  class Observer {
    targets = new Set();
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
    show(...targets) { this.callback(targets.filter((target) => this.targets.has(target)).map((target) => ({ target, isIntersecting: true }))); }
  }
  const document = { defaultView: { IntersectionObserver: Observer } };
  class Element {
    constructor(parent = null) { this.parent = parent; this.children = []; this.ownerDocument = document; }
    get isConnected() { return this === root || !!this.parent?.isConnected; }
    createDiv() { const element = new Element(this); this.children.push(element); return element; }
    createEl() { return this.createDiv(); }
    empty() { this.children.forEach((child) => { child.parent = null; }); this.children = []; }
    setText(text) { this.empty(); this.text = text; }
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  }
  const root = new Element();
  const context = { module: { exports: {} }, require: () => ({ Component }), console: { warn: (...args) => warnings.push(args) }, Date };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  return { root, components, observers, warnings, LibraryPreviews: context.module.exports.LibraryPreviews };
}

test("preview loading is viewport-driven, stays bounded across filter resets, and disposes every settled component", async () => {
  const { root, components, observers, LibraryPreviews } = fixture();
  const pending = [];
  let calls = 0, active = 0, maxActive = 0;
  const host = { t: (key) => key, renderNoteInto: async () => {
    calls++; active++; maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => pending.push(resolve)); active--;
  }, readCard: () => ({}), buildCurveSVG: () => null };
  const previews = new LibraryPreviews(root, host);
  const add = (index) => {
    const element = root.createDiv(); previews.add(element, { key: `${index}.md`, type: "note", file: { path: `${index}.md` } }); return element;
  };
  const initial = Array.from({ length: 6 }, (_, index) => add(index));
  assert.equal(calls, 0, "adding offscreen cards never renders their Markdown");
  observers[0].show(...initial.slice(0, 4)); await tick();
  assert.equal(calls, 2);
  previews.reset(); root.empty();
  const next = [add(6), add(7), add(8)]; observers[0].show(...next); await tick();
  assert.equal(calls, 2, "replacement cards wait for old in-flight work instead of spawning a second queue");
  pending[0](); await tick(); pending[1](); await tick();
  assert.equal(calls, 4);
  assert.equal(maxActive, 2);
  assert.equal(components[0].loaded, false); assert.equal(components[1].loaded, false);
  previews.dispose();
  pending[2](); pending[3](); await tick();
  assert.equal(calls, 4, "disposing discards queued previews");
  assert.equal(observers[0].targets.size, 0);
  assert.ok(components.every((component) => !component.loaded));
  add(9);
  assert.equal(observers[0].targets.size, 0, "a disposed panel cannot observe new cards");
  assert.equal(calls, 4);
});

test("one failing source does not stall later previews and unloaded work never mounts a curve", async () => {
  const { root, components, observers, warnings, LibraryPreviews } = fixture();
  let calls = 0, curves = 0;
  const host = { t: (key) => key, renderNoteInto: async () => { calls++; throw Error("unreadable source"); }, readCard: () => ({}), buildCurveSVG: () => { curves++; return null; } };
  const previews = new LibraryPreviews(root, host);
  const elements = [0, 1, 2].map((index) => { const element = root.createDiv(); previews.add(element, { key: String(index), type: "note", file: { path: String(index) } }); return element; });
  observers[0].show(...elements); await tick(); await tick();
  assert.equal(calls, 3); assert.equal(warnings.length, 3); assert.equal(curves, 0);
  assert.ok(elements.every((element) => element.text === "library.previewFailed"));
  previews.dispose(); assert.ok(components.every((component) => !component.loaded));
});
