import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

async function settingsFixture() {
  const rows = [];
  const suggestions = [];
  class TFolder { constructor(path) { this.path = path; } }
  class Input {
    inputEl = { value: "", listeners: {}, addEventListener: (name, callback) => { this.inputEl.listeners[name] = callback; } };
    setValue(value) { this.inputEl.value = value; return this; }
    onChange(callback) { this.change = callback; return this; }
  }
  class Control {
    setValue(value) { this.value = value; return this; }
    setIcon(icon) { this.icon = icon; return this; }
    setTooltip() { return this; }
    setButtonText() { return this; }
    onChange(callback) { this.change = callback; return this; }
    onClick(callback) { this.click = callback; return this; }
  }
  class Setting {
    settingEl = { addClass() {} };
    extra = [];
    constructor(container) { this.container = container; rows.push(this); }
    setName(name) { this.name = name; return this; }
    setDesc() { return this; }
    addText(callback) { this.input = new Input(); callback(this.input); return this; }
    addExtraButton(callback) { const button = new Control(); this.extra.push(button); callback(button); return this; }
    addToggle(callback) { this.toggle = new Control(); callback(this.toggle); return this; }
    addButton(callback) { callback(new Control()); return this; }
  }
  class AbstractInputSuggest {
    constructor(_app, inputEl) { this.input = inputEl; suggestions.push(this); }
    setValue(value) { this.input.value = value; }
    close() { this.closed = true; }
  }
  // A subsequence stub verifies that the UI delegates to Obsidian's fuzzy API,
  // rather than accidentally replacing it with a substring-only filter.
  const prepareFuzzySearch = (query) => (text) => {
    let position = 0;
    for (const letter of query.toLowerCase()) {
      const index = text.toLowerCase().indexOf(letter, position);
      if (index < 0) return null;
      position = index + 1;
    }
    return { score: 1, matches: [] };
  };
  const result = await build({ entryPoints: ["src/settings-marginnote.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
  const context = { module: { exports: {} }, exports: {}, require: () => ({ Setting, TFolder, AbstractInputSuggest, prepareFuzzySearch, Notice: class {} }) };
  vm.runInNewContext(result.outputFiles[0].text, context);
  const saved = [];
  let scheduled = 0;
  const plugin = {
    app: { vault: { getAllLoadedFiles: () => [new TFolder("/"), new TFolder("99_assets/lexis-export"), new TFolder("Books/Novel"), { path: "Books/Novel.md" }] } },
    settings: { marginNoteExportFolder: "Lexis-export", marginNoteAutoExport: false,
      dicts: [{ folder: "Words", tag: "vocab" }], marginNoteSources: null, marginNoteFollowVisibility: false },
    index: new Map(),
    t: (key) => key,
    saveSettings: async () => { saved.push(plugin.settings.marginNoteExportFolder); },
    marginNoteExport: { schedule: () => { scheduled++; } },
  };
  const element = (parent = null, tag = "div", options = {}) => ({
    parentElement: parent, tag, className: options.cls || "", children: [], dataset: {},
    createEl(childTag, childOptions = {}) { const child = element(this, childTag, childOptions); this.children.push(child); return child; },
    createDiv(options) { return this.createEl("div", options); },
    createSpan(options) { return this.createEl("span", options); },
    empty() { this.children = []; },
  });
  const root = element();
  context.module.exports.renderMarginNoteSettings(root, plugin);
  return { root, rows, suggest: suggestions[0], plugin, saved, scheduled: () => scheduled };
}

test("MarginNote export input offers existing folders using the shared fuzzy suggestion", async () => {
  const { suggest } = await settingsFixture();
  assert.deepEqual(Array.from(suggest.getSuggestions("")), ["99_assets/lexis-export", "Books/Novel"]);
  assert.deepEqual(Array.from(suggest.getSuggestions("99lex")), ["99_assets/lexis-export"]);
  assert.deepEqual(Array.from(suggest.getSuggestions("bnv")), ["Books/Novel"]);
  assert.deepEqual(Array.from(suggest.getSuggestions("unknown")), []);
});

test("picking a folder only fills the draft; the check button commits it", async () => {
  const { suggest, rows, plugin, saved, scheduled } = await settingsFixture();
  suggest.selectSuggestion("99_assets/lexis-export");
  assert.equal(rows[0].input.inputEl.value, "99_assets/lexis-export");
  assert.equal(plugin.settings.marginNoteExportFolder, "Lexis-export");
  assert.equal(saved.length, 0);
  await rows[0].extra.find((button) => button.icon === "check").click();
  assert.deepEqual(saved, ["99_assets/lexis-export"]);
  assert.equal(scheduled(), 1);
});

test("manual new folders remain valid; undo and Enter never commit a draft", async () => {
  const { rows, suggest, plugin, saved } = await settingsFixture();
  const row = rows[0];
  suggest.selectSuggestion("Books/Novel");
  row.extra.find((button) => button.icon === "undo").click();
  assert.equal(row.input.inputEl.value, "Lexis-export");
  row.input.setValue("New/Dictionary");
  row.input.change("New/Dictionary");
  let prevented = false;
  row.input.inputEl.listeners.keydown({ key: "Enter", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(saved.length, 0);
  assert.equal(plugin.settings.marginNoteExportFolder, "Lexis-export");
  await row.extra.find((button) => button.icon === "check").click();
  assert.deepEqual(saved, ["New/Dictionary"]);
});

test("scope selection persists independently of highlight visibility and can explicitly export nothing", async () => {
  const { rows, plugin, scheduled } = await settingsFixture();
  const all = rows.find((row) => row.name === "mn.scopeAll");
  assert.equal(all.toggle.value, true);
  await all.toggle.change(false);
  assert.deepEqual(Array.from(plugin.settings.marginNoteSources), ["folder:Words", "tag:vocab"]);
  await rows.find((row) => row.name === "Words").toggle.change(false);
  await rows.find((row) => row.name === "#vocab").toggle.change(false);
  assert.deepEqual(Array.from(plugin.settings.marginNoteSources), []);
  assert.equal(plugin.settings.marginNoteFollowVisibility, false);
  assert.equal(rows.some((row) => row.name === "mn.followVisibility"), false);
  assert.deepEqual(Array.from(plugin.settings.marginNoteSources), []);
  await rows.filter((row) => row.name === "mn.scopeAll").at(-1).toggle.change(true);
  assert.equal(plugin.settings.marginNoteSources, null);
  assert.ok(scheduled() >= 4);
});

test("all export controls belong to one parent without a nested scope disclosure", async () => {
  const { root, rows } = await settingsFixture();
  assert.equal(root.children.some((node) => node.tag === "details"), false);
  assert.equal(rows.find((row) => row.name === "mn.scopeAll").container.parentElement, root);
  assert.equal(rows.some((row) => row.name === "mn.followVisibility"), false);
  assert.equal(rows.find((row) => row.name === "mn.auto").container, root);
});
