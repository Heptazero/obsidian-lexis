import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import vm from "node:vm";

async function load(contents, globals = {}) {
  const result = await build({
    stdin: { contents, resolveDir: process.cwd(), sourcefile: "mn-link-test.ts", loader: "ts" },
    bundle: true, write: false, format: "cjs", platform: "node",
  });
  const context = { exports: {}, module: { exports: {} }, ...globals };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return context.module.exports;
}

const pure = await load('export * from "./pkg/marginnote-extension/src/links"; export * from "./src/marginnote-protocol";');
const originalUri = "obsidian://open?vault=my-obsidian&file=10_atom%2F%E8%AF%8D%20A.md%23%E4%BA%BA%E7%89%A9&other=keep";
const entry = (id = "A") => ({ id, title: id, aliases: [], markdown: "# Original\n[Other link](obsidian://open?vault=other&file=B.md)", uri: originalUri });
const snapshot = (entries = [entry()]) => ({
  format: "lexis-marginnote", version: 1, source: { id: "obsidian:my-obsidian", vault: "my-obsidian" },
  revision: "same revision", entries,
});
const owner = snapshot().source.id;
const card = (id = "A", source = owner) => ({
  noteId: id, notebookId: "topic", noteTitle: id, excerptText: pure.managedEntryBody(source, entry(id)),
  excerptTextMarkdown: 1, comments: ["Personal comment"],
});

function native(initial = [], initialPrefs = {}) {
  const notes = initial;
  const prefs = new Map(Object.entries(initialPrefs).map(([field, value]) => [`lexis.mn.topic.${field}`, value]));
  const attach = (parent, note) => { note.parentNote = parent; if (!notes.includes(note)) notes.push(note); };
  const parent = { noteId: "parent", notebookId: "topic", noteTitle: "Lexis", excerptText: "", addChild(note) { attach(this, note); } };
  const state = { saves: 0, dirty: 0, refreshes: 0, yields: 0, dialogs: [], urls: [], errors: [] };
  const app = {
    studyController: () => ({ notebookController: { notebookId: "topic", focusNote: notes[0] || parent } }),
    refreshAfterDBChanged: () => state.refreshes++, showHUD: () => {}, alert: (value) => state.errors.push(value),
    openURL: (value) => state.urls.push(value),
  };
  const globals = {
    NSUserDefaults: { standardUserDefaults: () => ({ objectForKey: (key) => prefs.get(key), setObjectForKey: (value, key) => prefs.set(key, value) }) },
    Database: { sharedInstance: () => ({
      getNotebookById: () => ({ notes }), getNoteById: () => parent,
      createNoteWithTitleTopicid: (title, topic) => ({ noteId: `n${notes.length}`, notebookId: topic, noteTitle: title, excerptText: "", excerptTextMarkdown: 0, addChild(note) { attach(this, note); } }),
      savedb: () => state.saves++, setNotebookSyncDirty: () => state.dirty++,
    }) },
    Application: { sharedInstance: () => app },
    NSTimer: { scheduledTimerWithTimeInterval: (_seconds, _repeat, callback) => { state.yields++; callback(); return { invalidate() {} }; } },
    NSURL: { URLWithString: (uri) => uri },
    UIAlertView: { showWithTitleMessageStyleCancelButtonTitleOtherButtonTitlesTapBlock: (title, message, style, cancel, buttons, callback) => {
      const field = { text: "", placeholder: "" };
      const view = { textFieldAtIndex: () => field };
      state.dialogs.push({ title, message, style, cancel, buttons, callback, field, view });
      return view;
    } },
  };
  return { notes, prefs, state, globals, pref: (field) => prefs.get(`lexis.mn.topic.${field}`) };
}

const modules = 'export * from "./pkg/marginnote-extension/src/target-vault"; export * from "./pkg/marginnote-extension/src/importer";';

test("vault replacement preserves encoded paths, headings, query parameters and safely encodes names", () => {
  const uri = pure.uriForVault(originalUri, " 我的库 & study ");
  assert.equal(uri, originalUri.replace("vault=my-obsidian", `vault=${encodeURIComponent("我的库 & study")}`));
  assert.equal(pure.vaultFromUri(uri), "我的库 & study");
  assert.equal(pure.uriForVault(originalUri, ""), originalUri);
  assert.equal(pure.uriForVault("obsidian://open?file=A.md", "myob"), "obsidian://open?file=A.md&vault=myob");
  assert.equal(pure.vaultFromUri("obsidian://open?vault=%wrong&file=A.md"), "");
});

test("dictionary projection leaves source identities and original snapshot unchanged", () => {
  const data = snapshot();
  const before = JSON.stringify(data);
  const projected = pure.dictionaryForVault(data, "myob");
  assert.equal(JSON.stringify(data), before);
  assert.equal(projected.source, data.source);
  assert.equal(projected.entries[0].id, "A");
  assert.equal(projected.entries[0].uri, pure.uriForVault(originalUri, "myob"));
  assert.notEqual(projected.revision, data.revision);
  assert.notEqual(projected.revision, pure.dictionaryForVault(data, "another").revision);
  assert.equal(pure.dictionaryForVault(data, " "), data);
});

test("only the generated first link is repaired; embedded links and ownership remain intact", () => {
  const body = pure.managedEntryBody(owner, entry());
  const updated = pure.retargetReturnLink(body, "myob");
  assert.equal(updated, body.replace(originalUri, pure.uriForVault(originalUri, "myob")));
  assert.equal(pure.managedEntryIdentity(updated).entryId, "A");
  assert.equal(pure.retargetReturnLink("My own [link](obsidian://open?vault=old&file=A.md)", "myob"), "My own [link](obsidian://open?vault=old&file=A.md)");
  assert.equal(pure.returnUri("My own [link](obsidian://open?vault=old&file=A.md)"), "");
});

test("existing and inactive cards repair in place, preserve comments, and reset to the source vault", async () => {
  const a = card();
  const inactive = { ...card("B"), noteTitle: "" };
  const foreign = card("C", "foreign");
  const unmanaged = { ...card("D"), excerptText: "My own content" };
  const env = native([a, inactive, foreign, unmanaged], { source: owner });
  const api = await load(modules, env.globals);
  const before = env.notes.map((note) => ({ ...note }));
  assert.equal(api.effectiveTargetVault("topic"), "my-obsidian");
  assert.equal(await api.setTargetVault("topic", {}, " myob "), 2);
  assert.equal(env.pref("targetVault"), "myob");
  assert.equal(env.pref("sourceVault"), "my-obsidian");
  assert.equal(api.effectiveTargetVault("topic"), "myob");
  assert.equal(a.noteTitle, "A");
  assert.equal(inactive.noteTitle, "");
  assert.deepEqual(a.comments, ["Personal comment"]);
  assert.equal(foreign.excerptText, before[2].excerptText);
  assert.equal(unmanaged.excerptText, before[3].excerptText);
  assert.equal(env.state.saves, 1);
  assert.equal(env.state.refreshes, 1);
  assert.equal(await api.setTargetVault("topic", {}, "myob"), 0);
  assert.equal(env.state.saves, 1);
  assert.equal(await api.setTargetVault("topic", {}, ""), 2);
  assert.equal(a.excerptText, before[0].excerptText);
  assert.equal(env.notes.length, 4);
});

test("repair yields in batches, persists real changes, and cannot interleave with import", async () => {
  const env = native(Array.from({ length: 85 }, (_, index) => card(`${index}`)), { source: owner });
  let resume;
  env.globals.NSTimer.scheduledTimerWithTimeInterval = (_seconds, _repeat, callback) => { env.state.yields++; resume = callback; };
  const api = await load(modules, env.globals);
  const repair = api.setTargetVault("topic", {}, "myob");
  assert.equal(env.state.saves, 1);
  assert.equal(await api.importDictionary("topic", {}, snapshot(), true), null);
  await assert.rejects(api.importDictionary("topic", {}, snapshot()), /Import in progress/);
  await assert.rejects(api.setTargetVault("topic", {}, "other"), /Dictionary update in progress/);
  resume();
  await Promise.resolve();
  resume();
  assert.equal(await repair, 85);
  assert.equal(env.state.saves, 3);
  assert.equal(env.state.yields, 2);
});

test("future imports and automatic checks use target vault; a changed target invalidates revision cache", async () => {
  const env = native([], { targetVault: "myob", grouped: false });
  const api = await load(modules, env.globals);
  const data = snapshot();
  await api.importDictionary("topic", {}, data);
  assert.equal(pure.vaultFromUri(pure.returnUri(env.notes[0].excerptText)), "myob");
  assert.equal(env.pref("sourceVault"), "my-obsidian");
  assert.equal(await api.importDictionary("topic", {}, data, true), null);
  await api.setTargetVault("topic", {}, "second vault");
  const update = await api.importDictionary("topic", {}, data, true);
  assert.equal(update.updated, 0);
  assert.equal(pure.vaultFromUri(pure.returnUri(env.notes[0].excerptText)), "second vault");
  await api.importDictionary("topic", {}, snapshot([{ ...entry(), markdown: "Changed source" }]));
  assert.equal(pure.vaultFromUri(pure.returnUri(env.notes[0].excerptText)), "second vault");
  assert.equal(env.notes.length, 1);
  await api.setTargetVault("topic", {}, "");
  assert.notEqual(await api.importDictionary("topic", {}, data, true), null);
  assert.equal(pure.vaultFromUri(pure.returnUri(env.notes[0].excerptText)), "my-obsidian");
});

test("dialog requires explicit save; cancel never changes preferences or cards", async () => {
  const env = native([card()], { source: owner });
  const api = await load(modules, env.globals);
  api.editTargetVault("topic", {}, (error) => env.state.errors.push(error));
  let dialog = env.state.dialogs.at(-1);
  assert.equal(dialog.style, 2);
  assert.equal(dialog.field.placeholder, "my-obsidian");
  dialog.field.text = "myob";
  dialog.callback(dialog.view, 0);
  assert.equal(env.pref("targetVault"), undefined);
  assert.equal(env.state.saves, 0);
  api.editTargetVault("topic", {}, (error) => env.state.errors.push(error));
  dialog = env.state.dialogs.at(-1);
  dialog.field.text = "myob";
  dialog.callback(dialog.view, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(env.pref("targetVault"), "myob");
  api.editTargetVault("topic", {}, (error) => env.state.errors.push(error));
  dialog = env.state.dialogs.at(-1);
  assert.equal(dialog.field.text, "myob");
  dialog.field.text = "";
  dialog.callback(1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(env.pref("targetVault"), "");
  assert.equal(env.state.errors.length, 0);
});

test("menu opens a synced old link using this device's target vault", async () => {
  const env = native([card()], { source: owner, targetVault: "myob" });
  const bridge = {};
  let methods;
  bridge.defineClass = (_name, members) => { methods = members; return {}; };
  await load('import "./pkg/marginnote-extension/src/main";', { ...env.globals, JSB: bridge, self: { window: {} } });
  bridge.newAddon();
  methods.openLexis();
  const menu = env.state.dialogs.at(-1);
  assert.ok(menu.buttons.some((title) => title.includes("Target vault: myob")));
  const button = menu.buttons.findIndex((title) => title.includes("Open selected card"));
  menu.callback(menu.view, button + 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(env.state.urls, [pure.uriForVault(originalUri, "myob")]);
  assert.equal(env.state.errors.length, 0);
});
