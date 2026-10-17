import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

async function load(contents, globals = {}) {
  const result = await build({ stdin: { contents, resolveDir: process.cwd(), sourcefile: "mn-shortcut.ts", loader: "ts" },
    bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
  const context = { exports: {}, module: { exports: {} }, ...globals };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return context.module.exports;
}

const layout = await load('export * from "./pkg/marginnote-extension/src/selection-layout";');
const notification = (window, rect = "{{240, 260}, {300, 40}}") => ({ window, userInfo: { winRect: rect } });

function environment() {
  const window = {};
  const document = { isSelectionText: true, selectionText: "QL 分解", currPageNo: 22, document: { docTitle: "Geometry" } };
  const state = { buttons: [], observers: [], removed: [], timers: [], urls: [], prefs: new Map([["lexis.mn.topic.targetVault", "myob"]]) };
  const view = {
    frame: { x: 20, y: 60, width: 800, height: 650 }, bounds: { x: 0, y: 0, width: 800, height: 650 }, children: [],
    convertRectFromView: (rect) => ({ ...rect, x: rect.x - view.frame.x, y: rect.y - view.frame.y }),
    addSubview(button) { button.parent = this; this.children.push(button); },
  };
  const study = { view, notebookController: { notebookId: "topic" }, readerController: { currentDocumentController: document } };
  const instance = { window, active: true };
  const app = { studyController: () => study, checkNotifySenderInWindow: (sender, target) => sender.window === target,
    openURL: (url) => state.urls.push(url), showHUD() {}, alert() {} };
  const globals = {
    Application: { sharedInstance: () => app }, NSURL: { URLWithString: (uri) => uri },
    NSUserDefaults: { standardUserDefaults: () => ({ objectForKey: (key) => state.prefs.get(key) }) },
    NSNotificationCenter: { defaultCenter: () => ({ addObserverSelectorName: (target, selector, name) => state.observers.push({ target, selector, name }),
      removeObserverName: (target, name) => state.removed.push({ target, name }) }) },
    NSTimer: { scheduledTimerWithTimeInterval: (_seconds, _repeat, callback) => {
      const timer = { callback, cancelled: false, invalidate() { this.cancelled = true; } };
      state.timers.push(timer); return timer;
    } },
    UIButton: { buttonWithType: () => {
      const button = { tracking: false, layer: {}, titleLabel: {}, actions: [],
        setTitleForState(title) { this.title = title; }, setTitleColorForState() {},
        addTargetActionForControlEvents(target, selector, events) { this.actions.push({ target, selector, events }); },
        removeFromSuperview() { if (this.parent) this.parent.children = this.parent.children.filter((item) => item !== this); this.parent = null; },
      };
      state.buttons.push(button); return button;
    } },
    UIColor: { whiteColor: () => "white", colorWithRedGreenBlueAlpha: () => "purple" },
    UIFont: { systemFontOfSize: (size) => size },
  };
  const flush = () => { for (const timer of state.timers.splice(0)) if (!timer.cancelled) timer.callback(); };
  return { globals, state, instance, window, view, document, study, flush };
}

test("selection shortcut fits narrow, split and edge menus without overlapping native controls", () => {
  assert.equal(layout.selectionMenuRect("bad"), null);
  assert.equal(layout.selectionMenuRect("{{1,2}, {NaN,44}}"), null);
  const bounds = { x: 0, y: 0, width: 320, height: 500 };
  for (const menu of [
    { x: 20, y: 20, width: 270, height: 40 },
    { x: 20, y: 440, width: 270, height: 40 },
    { x: 20, y: 200, width: 270, height: 40 },
    { x: 20, y: 150, width: 40, height: 44 },
  ]) {
    const frame = layout.selectionButtonRect(menu, bounds);
    assert.ok(frame);
    assert.ok(frame.x >= 12 && frame.y >= 12 && frame.x + frame.width <= 308 && frame.y + frame.height <= 488);
    assert.ok(frame.x >= menu.x + menu.width + 8 || frame.x + frame.width <= menu.x - 8 ||
      frame.y >= menu.y + menu.height + 8 || frame.y + frame.height <= menu.y - 8);
  }
  assert.equal(layout.selectionButtonRect(bounds, bounds), null);
  assert.equal(layout.selectionButtonRect(bounds, { ...bounds, width: 160 }), null);
});

test("menu event snapshots text and presents one native button; explicit click sends once without import or clipboard", async () => {
  const env = environment();
  const { SelectionShortcut } = await load('export * from "./pkg/marginnote-extension/src/selection-shortcut";', env.globals);
  const shortcut = new SelectionShortcut(env.instance);
  shortcut.start();
  assert.deepEqual(env.state.observers.map((event) => event.name), ["PopupMenuOnSelection", "ClosePopupMenuOnSelection"]);
  shortcut.show(notification(env.window));
  assert.equal(env.view.children.length, 1);
  const button = env.view.children[0];
  assert.equal(button.title, "添加到 Obsidian");
  assert.equal(button.actions[0].selector, "addLexisSelection:");
  assert.equal(button.actions[0].events, 1 << 6);
  assert.equal(env.state.urls.length, 0);
  assert.equal(button.frame.x, 528); // Window menu x=240 converted to study x=220.
  env.document.selectionText = ""; env.document.isSelectionText = false;
  shortcut.send(); shortcut.send();
  assert.equal(env.state.urls.length, 1);
  const uri = new URL(env.state.urls[0]);
  assert.equal(uri.searchParams.get("vault"), "myob");
  assert.equal(uri.searchParams.get("word"), "QL 分解");
  assert.equal(uri.searchParams.get("source"), "MarginNote · Geometry · p.22");
  assert.equal(env.view.children.length, 0);
});

test("cancel and invalid selections remove the button and never send; foreign windows cannot replace it", async () => {
  const env = environment();
  const { SelectionShortcut } = await load('export * from "./pkg/marginnote-extension/src/selection-shortcut";', env.globals);
  const shortcut = new SelectionShortcut(env.instance);
  shortcut.show(notification(env.window));
  shortcut.show(notification({})); shortcut.close(notification({})); env.flush();
  assert.equal(env.view.children.length, 1);
  shortcut.close(notification(env.window)); env.flush(); shortcut.send();
  assert.equal(env.view.children.length, 0);
  assert.equal(env.state.urls.length, 0);
  for (const text of ["", "x".repeat(201)]) {
    env.document.selectionText = text;
    shortcut.show(notification(env.window));
    assert.equal(env.view.children.length, 0);
  }
  env.document.selectionText = "Valid";
  env.document.isSelectionText = false;
  shortcut.show(notification(env.window));
  assert.equal(env.view.children.length, 0);
});

test("MN closing its own menu during a button touch does not erase the saved selection; cancelled touch does not send", async () => {
  const env = environment();
  const { SelectionShortcut } = await load('export * from "./pkg/marginnote-extension/src/selection-shortcut";', env.globals);
  const shortcut = new SelectionShortcut(env.instance);
  shortcut.show(notification(env.window));
  env.view.children[0].tracking = true;
  shortcut.close(notification(env.window)); env.flush();
  assert.equal(env.view.children.length, 1);
  env.document.isSelectionText = false; env.document.selectionText = "";
  shortcut.send();
  assert.equal(env.state.urls.length, 1);
  env.document.isSelectionText = true; env.document.selectionText = "Next";
  shortcut.show(notification(env.window));
  assert.equal(env.view.children[0].actions[1].selector, "cancelLexisSelection:");
  shortcut.hide(); shortcut.send();
  assert.equal(env.state.urls.length, 1);
});

test("new selections replace pending closes; rotation, notebook and document switches cannot send stale drafts", async () => {
  const env = environment();
  const { SelectionShortcut } = await load('export * from "./pkg/marginnote-extension/src/selection-shortcut";', env.globals);
  const shortcut = new SelectionShortcut(env.instance);
  shortcut.show(notification(env.window)); shortcut.close(notification(env.window));
  env.document.selectionText = "Next";
  shortcut.show(notification(env.window)); env.flush();
  assert.equal(env.view.children.length, 1);
  shortcut.layout(); assert.equal(env.view.children.length, 1);
  env.view.bounds.width = 600; shortcut.layout(); shortcut.send();
  assert.equal(env.view.children.length, 0);
  shortcut.show(notification(env.window));
  env.study.notebookController.notebookId = "another"; shortcut.send();
  assert.equal(env.view.children.length, 0);
  env.study.notebookController.notebookId = "topic"; shortcut.show(notification(env.window));
  env.study.readerController.currentDocumentController = { ...env.document }; shortcut.send();
  assert.equal(env.state.urls.length, 0);
});

test("background and unload release views, delayed closes and exactly the owned observers", async () => {
  const env = environment();
  const { SelectionShortcut } = await load('export * from "./pkg/marginnote-extension/src/selection-shortcut";', env.globals);
  const shortcut = new SelectionShortcut(env.instance);
  shortcut.start(); shortcut.show(notification(env.window)); shortcut.close(notification(env.window));
  env.instance.active = false; shortcut.stop(); env.flush();
  shortcut.show(notification(env.window)); shortcut.send();
  assert.equal(env.view.children.length, 0);
  assert.equal(env.state.urls.length, 0);
  assert.deepEqual(env.state.removed.map((event) => event.name), ["PopupMenuOnSelection", "ClosePopupMenuOnSelection"]);
});

test("addon lifecycle registers once, reconnects safely and exposes native show, close and touch handlers", async () => {
  const env = environment();
  env.globals.Database = { sharedInstance: () => ({ getNotebookById: () => ({ notes: [] }) }) };
  let members, statics;
  const bridge = { defineClass(_name, methods, classMethods) { members = methods; statics = classMethods; return {}; } };
  await load('import "./pkg/marginnote-extension/src/main";', { ...env.globals, JSB: bridge, self: env.instance });
  bridge.newAddon(); members.sceneWillConnect(); members.sceneDidBecomeActive();
  assert.equal(env.state.observers.length, 2);
  members.showLexisSelection(notification(env.window)); assert.equal(env.view.children.length, 1);
  members.notebookWillClose(); assert.equal(env.view.children.length, 0);
  members.showLexisSelection(notification(env.window)); members.documentWillClose(); assert.equal(env.view.children.length, 0);
  members.sceneWillResignActive(); assert.equal(env.state.removed.length, 2);
  members.sceneDidBecomeActive(); assert.equal(env.state.observers.length, 4);
  members.showLexisSelection(notification(env.window)); members.addLexisSelection();
  assert.equal(env.state.urls.length, 1);
  members.showLexisSelection(notification(env.window)); members.cancelLexisSelection();
  assert.equal(env.view.children.length, 0);
  statics.addonWillDisconnect(); assert.equal(env.state.removed.length, 4);
  assert.equal(env.instance.selectionShortcut, undefined);
});
