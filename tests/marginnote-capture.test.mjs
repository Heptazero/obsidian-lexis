import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

async function fixture() {
  const modals = [];
  const rows = [];
  const calls = [];
  const notices = [];
  const handlers = new Map();
  const aliasChoices = [];
  const element = () => ({ ownerDocument: {}, createDiv() { return element(); }, empty() {}, setText() {} });
  class Modal {
    contentEl = element(); titleEl = element();
    constructor() { modals.push(this); }
    open() { this.onOpen(); }
    close() { this.closed = true; this.onClose(); }
  }
  class Control {
    inputEl = {}; extraSettingsEl = {};
    setValue(value) { this.value = value; return this; }
    onChange(callback) { this.change = callback; return this; }
    setIcon() { return this; } setTooltip() { return this; }
    setButtonText(value) { this.text = value; return this; }
    setCta() { return this; } setDisabled(value) { this.disabled = value; return this; }
    onClick(callback) { this.click = callback; return this; }
  }
  class Setting {
    buttons = [];
    constructor() { rows.push(this); }
    setName(value) { this.name = value; return this; }
    addText(callback) { this.input = new Control(); callback(this.input); return this; }
    addExtraButton(callback) { this.extra = new Control(); callback(this.extra); return this; }
    addButton(callback) { const control = new Control(); this.buttons.push(control); callback(control); return this; }
  }
  const result = await build({ entryPoints: ["src/marginnote-capture.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"],
    plugins: [{ name: "mock-combobox", setup(build) {
      build.onLoad({ filter: /alias-combobox\.ts$/ }, () => ({ contents: "export function openAliasCombobox(options) { globalThis.__aliasChoices.push(options); return {close(){}}; }", loader: "ts" }));
    } }] });
  const context = { module: { exports: {} }, exports: {}, __aliasChoices: aliasChoices, require: () => ({ Modal, Setting,
    Notice: class { constructor(text) { notices.push(text); } }, AbstractInputSuggest: class {}, prepareFuzzySearch: () => () => null }) };
  vm.runInNewContext(result.outputFiles[0].text, context);
  const host = {
    app: { workspace: { onLayoutReady(callback) { callback(); } } },
    settings: { lastSelectionFolder: "Words" }, index: new Map(),
    t: (key) => key, dictFolders: () => ["Words", "Other"], rebuildIndex: async () => {},
    registerObsidianProtocolHandler: (name, callback) => handlers.set(name, callback),
    rememberSelectionFolder: async (folder) => calls.push(["remember", folder]),
    addWordFromSelection: async (...args) => calls.push(["add", ...args]),
    attachAlias: async (alias, file) => calls.push(["alias", alias, file]),
  };
  context.module.exports.registerMarginNoteCapture(host);
  return { handlers, modals, rows, calls, notices, aliasChoices };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("external URI opens a prefilled draft without writes; cancel is read-only", async () => {
  const f = await fixture();
  f.handlers.get("lexis-add")({ word: "QL 分解", sentence: "Context", source: "MarginNote · Book p.22" });
  await tick();
  assert.equal(f.modals.length, 1);
  assert.equal(f.rows.find((row) => row.name === "mn.captureWord").input.value, "QL 分解");
  assert.equal(f.calls.length, 0);
  await f.rows.flatMap((row) => row.buttons).find((button) => button.text === "mn.cancel").click();
  assert.equal(f.modals[0].closed, true);
  assert.equal(f.calls.length, 0);
});

test("explicit confirmation writes once to the selected dictionary with external source context", async () => {
  const f = await fixture();
  f.handlers.get("lexis-add")({ word: "QL 分解", sentence: "Context", source: "MarginNote · Book p.22" });
  await tick();
  f.rows.find((row) => row.name === "selection.chooseDictionary").input.change("Other");
  const save = f.rows.flatMap((row) => row.buttons).find((button) => button.text === "selection.add");
  const first = save.click();
  await save.click();
  await first;
  const additions = f.calls.filter(([kind]) => kind === "add");
  assert.equal(additions.length, 1);
  assert.equal(additions[0][1], "QL 分解");
  assert.equal(additions[0][4], "Other");
  const options = additions[0][5];
  assert.equal(options.sourceFile, null);
  assert.equal(options.source, "MarginNote · Book p.22");
  assert.equal(options.sentence, "Context");
});

test("invalid URI or unknown destination never writes", async () => {
  const f = await fixture();
  f.handlers.get("lexis-add")({ word: "" });
  await tick();
  assert.equal(f.modals.length, 0);
  f.handlers.get("lexis-add")({ word: "Word" });
  await tick();
  f.rows.find((row) => row.name === "selection.chooseDictionary").input.change("Not a configured folder");
  await f.rows.flatMap((row) => row.buttons).find((button) => button.text === "selection.add").click();
  assert.equal(f.calls.length, 0);
  assert.equal(f.notices.length, 2);
});

test("alias choice preserves the exact target file when basenames are duplicated", async () => {
  const f = await fixture();
  f.handlers.get("lexis-add")({ word: "Captain" });
  await tick();
  f.rows.find((row) => row.name === "mn.captureWord").extra.click();
  const target = { path: "Other/A.md", basename: "A" };
  f.aliasChoices[0].onPick({ title: "A", file: target });
  assert.equal(f.rows.find((row) => row.name === "selection.chooseDictionary").input.disabled, true);
  assert.equal(f.calls.length, 0);
  await f.rows.flatMap((row) => row.buttons).find((button) => button.text === "selection.add").click();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], "alias");
  assert.equal(f.calls[0][1], "Captain");
  assert.equal(f.calls[0][2], target);
});
