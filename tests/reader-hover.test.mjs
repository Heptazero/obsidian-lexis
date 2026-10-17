import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/reader-hover.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { ReaderHover } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

function timerClock() {
  let time = 0, id = 0;
  const pending = new Map();
  return {
    setTimeout(callback, delay) { pending.set(++id, { callback, at: time + delay }); return id; },
    clearTimeout(timer) { pending.delete(timer); },
    advance(delay) {
      time += delay;
      for (const [timer, task] of [...pending]) if (task.at <= time && pending.delete(timer)) task.callback();
    },
    count: () => pending.size,
  };
}

function fixture() {
  const clock = timerClock();
  const document = { defaultView: clock };
  const target = (key) => ({ dataset: { lexisKey: key }, ownerDocument: document, isConnected: true });
  const host = {
    _popover: null, opened: [], closed: 0,
    async showPopover(element) { this.opened.push(element.dataset.lexisKey); this._popover = target(element.dataset.lexisKey); },
    removePopover() { this.closed++; this._popover = null; },
  };
  return { clock, document, target, host, hover: new ReaderHover(host, clock) };
}

test("hover opens only the latest connected target after its delay", () => {
  const { hover, clock, target, host } = fixture();
  hover.enter(target("old"), 100);
  clock.advance(50);
  const current = target("new");
  hover.enter(current, 100);
  clock.advance(50);
  assert.deepEqual(host.opened, []);
  clock.advance(50);
  assert.deepEqual(host.opened, ["new"]);
  hover.enter(target("new"), 100);
  assert.equal(clock.count(), 0);
  const detached = target("detached");
  hover.enter(detached, 100); detached.isConnected = false;
  clock.advance(100);
  assert.deepEqual(host.opened, ["new"]);
});

test("leaving cancels a pending open and preserves the 220ms closing grace", () => {
  const { hover, clock, target, host } = fixture();
  const word = target("word");
  hover.enter(word, 100); hover.leave(word); clock.advance(100);
  assert.deepEqual(host.opened, []);
  hover.enter(word, 0); hover.leave(word);
  clock.advance(219); assert.equal(host.closed, 0);
  clock.advance(1); assert.equal(host.closed, 1);
});

test("entering the card cancels hiding without postponing a pending open", () => {
  const { hover, clock, target, host } = fixture();
  const word = target("word");
  hover.enter(word, 100); clock.advance(50); hover.enter(word, 100);
  clock.advance(50); assert.deepEqual(host.opened, ["word"]);
  hover.scheduleHide(); hover.keepOpen(); clock.advance(220);
  assert.equal(host.closed, 0);
});

test("editing and resizing prevent automatic closing", () => {
  for (const key of ["lexisEditing", "lexisResizing"]) {
    const { hover, clock, target, host } = fixture();
    hover.enter(target("word"), 0);
    host._popover.dataset[key] = "1";
    hover.scheduleHide(); clock.advance(220);
    assert.equal(host.closed, 0);
    delete host._popover.dataset[key];
    hover.scheduleHide(); clock.advance(220);
    assert.equal(host.closed, 1);
  }
});

test("moving between PDF/Canvas targets cancels the old pending opening", () => {
  const { hover, clock, target, host } = fixture();
  const first = target("first"), second = target("second");
  assert.equal(hover.move(first, false), true);
  hover.enter(first, 100);
  assert.equal(hover.move(first, false), false);
  assert.equal(hover.move(second, false), true);
  hover.enter(second, 100); clock.advance(100);
  assert.deepEqual(host.opened, ["second"]);
});

test("disposal cancels both clocks without mutating host state", () => {
  const { hover, clock, target, host } = fixture();
  const keys = Object.keys(host);
  hover.enter(target("pending"), 100); hover.scheduleHide();
  hover.dispose(); hover.dispose(); clock.advance(1000);
  assert.deepEqual(host.opened, []); assert.equal(host.closed, 0);
  assert.equal(clock.count(), 0);
  assert.deepEqual(Object.keys(host), keys);
});

test("EPUB and pop-out timers use and cancel their own workspace window", () => {
  const { hover, clock: fallback, target, host } = fixture();
  const popout = timerClock();
  const root = { defaultView: popout };
  const chapter = { defaultView: { frameElement: { ownerDocument: root } } };
  const word = target("popout"); word.ownerDocument = chapter;
  hover.enter(word, 100);
  assert.equal(popout.count(), 1); assert.equal(fallback.count(), 0);
  hover.cancelOpen(); assert.equal(popout.count(), 0);
  hover.enter(word, 100); popout.advance(100);
  host._popover.ownerDocument = root;
  hover.scheduleHide(); assert.equal(popout.count(), 1);
  hover.keepOpen(); assert.equal(popout.count(), 0);
});

test("separate hover sessions do not cancel one another", () => {
  const first = fixture(), second = fixture();
  first.hover.enter(first.target("first"), 100);
  second.hover.enter(second.target("second"), 100);
  first.hover.dispose(); first.clock.advance(100); second.clock.advance(100);
  assert.deepEqual(first.host.opened, []);
  assert.deepEqual(second.host.opened, ["second"]);
});
