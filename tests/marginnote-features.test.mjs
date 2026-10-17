import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";
import { webcrypto } from "node:crypto";

async function load(contents, globals = {}) {
  const result = await build({ stdin: { contents, resolveDir: process.cwd(), sourcefile: "mn-features.ts", loader: "ts" },
    bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
  const context = { exports: {}, module: { exports: {} }, TextEncoder, crypto: webcrypto, ...globals };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return context.module.exports;
}
const api = await load(`export * from "./src/marginnote-protocol";
  export * from "./src/marginnote-export-data"; export * from "./src/marginnote-scope";
  export * from "./src/marginnote-capture-data"; export * from "./pkg/marginnote-extension/src/grouping";`);
const source = { id: "obsidian:desktop", vault: "desktop" };
const entry = (path, inline = false, extra = {}) => ({
  id: JSON.stringify([path, inline ? "Captain" : ""]), title: inline ? "Captain" : path.split("/").pop(),
  aliases: ["Alias"], markdown: "Definition", uri: api.obsidianEntryUri("desktop", path), path, inline, ...extra,
});
const snapshot = (entries) => ({ format: "lexis-marginnote", version: 1, source, revision: JSON.stringify(entries), entries });

function native(initial = [], fields = {}) {
  const notes = initial;
  const prefs = new Map(Object.entries({ parent: "parent", source: source.id, ...fields }).map(([key, value]) => [`lexis.mn.topic.${key}`, value]));
  const state = { saves: 0, yields: 0, refreshes: 0, urls: [], dialogs: [], errors: [] };
  let next = 1;
  function makeNote(title = "", id = `n${next++}`) {
    return {
      noteId: id, notebookId: "topic", noteTitle: title, excerptText: "", excerptTextMarkdown: 0, parentNote: null,
      children: [], comments: ["User comment"], colorIndex: 0,
      addChild(note) { note.parentNote = this; if (!this.children.includes(note)) this.children.push(note); },
      removeFromParent() {
        if (this.parentNote) this.parentNote.children = this.parentNote.children.filter((note) => note !== this);
        this.parentNote = null;
      },
    };
  }
  const parent = makeNote("Lexis", "parent");
  const document = { isSelectionText: true, selectionText: "QL 分解", currPageNo: 22, document: { docTitle: "Textbook" } };
  const study = { notebookController: { notebookId: "topic", focusNote: parent }, readerController: { currentDocumentController: document } };
  const app = { studyController: () => study, showHUD() {}, refreshAfterDBChanged: () => state.refreshes++,
    openURL: (uri) => state.urls.push(uri), alert: (message) => state.errors.push(message) };
  const globals = {
    NSUserDefaults: { standardUserDefaults: () => ({ objectForKey: (key) => prefs.get(key), setObjectForKey: (value, key) => prefs.set(key, value) }) },
    Application: { sharedInstance: () => app },
    Database: { sharedInstance: () => ({ getNotebookById: () => ({ notes }), getNoteById: (id) => id === "parent" ? parent : notes.find((note) => note.noteId === id),
      createNoteWithTitleTopicid(title) { const note = makeNote(title); notes.push(note); return note; },
      setNotebookSyncDirty() {}, savedb: () => state.saves++ }) },
    NSTimer: { scheduledTimerWithTimeInterval: (_s, _repeat, callback) => { state.yields++; callback(); return { invalidate() {} }; } },
    NSURL: { URLWithString: (uri) => uri },
    UIAlertView: { showWithTitleMessageStyleCancelButtonTitleOtherButtonTitlesTapBlock: (_title, _message, _style, _cancel, buttons, callback) => {
      const view = { textFieldAtIndex: () => ({ text: "", placeholder: "" }) };
      state.dialogs.push({ buttons, callback, view }); return view;
    } },
  };
  return { notes, parent, state, globals, study, document, prefs, pref: (key) => prefs.get(`lexis.mn.topic.${key}`) };
}
const modules = `export * from "./pkg/marginnote-extension/src/importer";
  export * from "./pkg/marginnote-extension/src/manage"; export * from "./pkg/marginnote-extension/src/colors";`;
const owned = (notes) => notes.filter((note) => api.managedEntryIdentity(note.excerptText));

test("export scopes combine folders, tags and individual inline files, with Unicode path normalization", () => {
  const e = { file: { path: "Books/Novel/A.md" }, tags: new Set(["vocab"]) };
  assert.equal(api.inMarginNoteScope(e, null), true);
  assert.equal(api.inMarginNoteScope(e, []), false);
  assert.equal(api.inMarginNoteScope(e, ["folder:Books"]), true);
  assert.equal(api.inMarginNoteScope(e, ["folder:Book"]), false);
  assert.equal(api.inMarginNoteScope(e, ["tag:vocab"]), true);
  assert.equal(api.inMarginNoteScope(e, ["file:Books/Novel/A.md"]), true);
  assert.equal(api.inMarginNoteScope({ ...e, file: { path: "Café/A.md".normalize("NFD") } }, ["folder:Café"]), true);
  const sources = api.marginNoteSources({ dicts: [{ folder: "Words", tag: "#vocab" }], vocabTags: "vocab term" },
    new Map([["a", { ...e, inline: true }], ["alias", { ...e, inline: true }]]));
  assert.deepEqual(Array.from(sources, ({ id }) => id), ["folder:Words", "tag:vocab", "tag:term", "file:Books/Novel/A.md"]);
});

test("export includes source paths and original colors, and filters before reading note bodies", async () => {
  const file = (path) => ({ path, basename: path.split("/").pop().replace(/\.md$/, "") });
  const index = new Map([
    ["a", { file: file("Words/A.md"), display: "A", tags: new Set() }],
    ["b", { file: file("Words/B.md"), display: "B", tags: new Set(["ignore"]) }],
    ["c", { file: file("Books/C.md"), display: "Captain", canonical: "Captain", inline: true, annotation: "Text", colorToken: "INTJ", tags: new Set() }],
  ]);
  const read = [];
  const data = await api.buildMarginNoteDictionary("desktop", index, async (e) => { read.push(e.file.path); return "Definition"; },
    { include: (e) => !e.tags.has("ignore"), color: () => "#ab12ef" });
  assert.equal(data.entries.length, 2);
  assert.deepEqual(read, ["Words/A.md"]);
  const inline = data.entries.find((e) => e.inline);
  assert.equal(inline.path, "Books/C.md");
  assert.equal(inline.color, "#ab12ef");
  assert.equal(inline.colorLabel, "INTJ");
  const body = api.managedEntryBody(source.id, inline);
  assert.ok(body.includes("INTJ · #ab12ef"));
  assert.equal(api.managedEntryIdentity(body).color, "#ab12ef");
  assert.equal(api.parseMarginNoteDictionary(JSON.stringify(data)).entries.length, 2);
  for (const bad of [{ color: "javascript:" }, { path: "../outside" }, { inline: "true" }]) {
    assert.throws(() => api.parseMarginNoteDictionary(JSON.stringify(snapshot([{ ...entry("Words/A.md"), ...bad }]))));
  }
});

test("grouping uses real folders and adds a source-file branch for inline entries", () => {
  assert.deepEqual(Array.from(api.entryGroups(entry("Books/Novel/Characters.md"))), ["Books", "Books/Novel"]);
  assert.deepEqual(Array.from(api.entryGroups(entry("Books/Novel/Characters.md", true))), ["Books", "Books/Novel", "Books/Novel/Characters.md"]);
  assert.deepEqual(Array.from(api.entryGroups({ ...entry("Books/A.md"), path: undefined })), ["Books"]);
  assert.deepEqual(Array.from(api.entryGroups(entry("A.md"))), []);
  assert.equal(api.groupIdentity(api.groupBody(source.id, "Books")).path, "Books");
  assert.equal(api.managedEntryIdentity(api.groupBody(source.id, "Books")), null);
});

test("native grouping is idempotent, reparents old cards, and preserves comments when flattening", async () => {
  const env = native();
  const mn = await load(modules, env.globals);
  const data = snapshot([entry("Books/Novel/A.md"), entry("Books/Novel/Characters.md", true)]);
  await mn.importDictionary("topic", {}, data);
  const cards = owned(env.notes);
  assert.equal(cards.length, 2);
  assert.equal(api.groupIdentity(cards[0].parentNote.excerptText).path, "Books/Novel");
  assert.equal(api.groupIdentity(cards[1].parentNote.excerptText).path, "Books/Novel/Characters.md");
  assert.ok(env.notes.filter((n) => api.groupIdentity(n.excerptText)).every((n) => n.noteTitle === ""));
  const ids = env.notes.map((n) => n.noteId);
  const repeat = await mn.importDictionary("topic", {}, data);
  assert.equal(repeat.updated + repeat.created, 0);
  assert.deepEqual(env.notes.map((n) => n.noteId), ids);
  await mn.manageDictionary("topic", {}, "group");
  assert.equal(env.pref("grouped"), false);
  assert.ok(cards.every((n) => n.parentNote === env.parent));
  await mn.manageDictionary("topic", {}, "group");
  assert.ok(cards.every((n) => n.parentNote !== env.parent));
  assert.deepEqual(env.notes.map((n) => n.noteId), ids);
  assert.ok(cards.every((n) => n.comments[0] === "User comment"));
  await mn.importDictionary("topic", {}, snapshot([]));
  assert.ok(cards.every((n) => n.noteTitle === ""));
  await mn.importDictionary("topic", {}, data);
  assert.equal(owned(env.notes)[0].noteId, cards[0].noteId);
});

test("an existing flat import upgrades to groups without recreating cards", async () => {
  const env = native([], { grouped: false });
  const mn = await load(modules, env.globals);
  const data = snapshot([entry("Books/A.md")]);
  await mn.importDictionary("topic", {}, data);
  const note = owned(env.notes)[0];
  const body = note.excerptText;
  assert.equal(note.parentNote, env.parent);
  await mn.manageDictionary("topic", {}, "group");
  assert.equal(note.excerptText, body);
  assert.equal(owned(env.notes).length, 1);
  assert.equal(api.groupIdentity(note.parentNote.excerptText).path, "Books");
});

test("native color binding updates matching cards only, survives imports, and ignores invalid indexes", async () => {
  const env = native();
  const mn = await load(modules, env.globals);
  const data = snapshot([entry("Words/A.md", false, { color: "#ab12ef" }), entry("Words/B.md", false, { color: "#AB12EF" }), entry("Words/C.md", false, { color: "#ffffff" })]);
  await mn.importDictionary("topic", {}, data);
  const [a, b, c] = owned(env.notes);
  a.colorIndex = 7;
  env.study.notebookController.focusNote = a;
  await mn.manageDictionary("topic", {}, "color");
  assert.equal(b.colorIndex, 7);
  assert.equal(c.colorIndex, 0);
  assert.equal(mn.boundColor("#AB12EF", mn.colorBindings("topic")), 7);
  b.colorIndex = 1;
  await mn.importDictionary("topic", {}, data);
  assert.equal(b.colorIndex, 7);
  assert.equal(mn.boundColor("#ab12ef", { "#ab12ef": -1 }), undefined);
  assert.equal(mn.boundColor("#ab12ef", { "#ab12ef": "7" }), undefined);
});

test("selection URI safely encodes Unicode and delimiters, rejects oversized or missing drafts", () => {
  const uri = api.marginNoteCaptureUri("myob", { word: "QL 分解", sentence: "A & B? # %", source: "MarginNote · Book p.22" });
  const url = new URL(uri);
  assert.equal(url.hostname, "lexis-add");
  assert.equal(url.searchParams.get("vault"), "myob");
  assert.equal(url.searchParams.get("word"), "QL 分解");
  assert.equal(url.searchParams.get("sentence"), "A & B? # %");
  for (const word of ["", "A\nB", "A".repeat(201)]) assert.throws(() => api.parseMarginNoteCapture({ word }));
  assert.throws(() => api.marginNoteCaptureUri("", { word: "A", sentence: "", source: "" }));
});

test("selection is captured before the native menu clears it, with no background clipboard reads", async () => {
  const env = native([], { targetVault: "myob" });
  const bridge = {};
  let methods;
  bridge.defineClass = (_name, members) => { methods = members; return {}; };
  env.globals.UIAlertView.showWithTitleMessageStyleCancelButtonTitleOtherButtonTitlesTapBlock = (_t, _m, _s, _c, buttons, callback) => {
    env.document.selectionText = ""; env.document.isSelectionText = false;
    const view = {};
    env.state.dialogs.push({ buttons, callback, view }); return view;
  };
  await load('import "./pkg/marginnote-extension/src/main";', { ...env.globals, JSB: bridge, self: { window: {} },
    UIPasteboard: { generalPasteboard() { throw new Error("Unexpected clipboard access"); } } });
  bridge.newAddon(); methods.openLexis();
  const dialog = env.state.dialogs.at(-1);
  const button = dialog.buttons.findIndex((title) => title.includes("Add selection in Obsidian"));
  dialog.callback(dialog.view, button + 1);
  await new Promise((resolve) => setImmediate(resolve));
  const url = new URL(env.state.urls[0]);
  assert.equal(url.searchParams.get("word"), "QL 分解");
  assert.equal(url.searchParams.get("source"), "MarginNote · Textbook · p.22");
  assert.equal(env.state.errors.length, 0);
});

test("export excludes ignored and archived entries, honors scope, and is independent of visibility", async () => {
  const files = new Map();
  const e = (path, tag = "", inline = false) => ({ file: { path, basename: path.split("/").pop() }, display: path,
    inline, annotation: "Annotation", tags: new Set(tag ? [tag] : []) });
  const host = {
    settings: { marginNoteExportFolder: "Export", marginNoteAutoExport: false, excludeTags: "#ignore", marginNoteSources: null,
      marginNoteFollowVisibility: false, enableHighlight: false },
    index: new Map([["a", e("Words/A.md")], ["b", e("Words/B.md", "ignore")], ["c", e("Books/C.md", "", true)]]),
    addCommand() {}, registerEvent() {}, register() {}, t: (key) => key,
    highlightVisibleForEntry: (entry) => !entry.inline, colorForEntry: () => "#ab12ef",
    app: { vault: { getName: () => "desktop", on() {}, cachedRead: async (entry) => {
      assert.notEqual(entry.path, "Words/B.md"); return "Definition";
    }, adapter: { exists: async (path) => files.has(path), read: async (path) => files.get(path), mkdir: async (path) => files.set(path, ""),
      write: async (path, text) => files.set(path, text) } } },
  };
  const { MarginNoteExport } = await load('export * from "./src/marginnote-export";', {
    require: () => ({ Notice: class {} }), window: { clearTimeout() {} },
  });
  const exporter = new MarginNoteExport(host);
  assert.equal(await exporter.export(), 2);
  host.settings.marginNoteFollowVisibility = true;
  assert.equal(await exporter.export(), 2);
  host.index.get("a").archived = true;
  assert.equal(await exporter.export(), 1);
  host.index.get("a").archived = false;
  host.settings.marginNoteFollowVisibility = false;
  host.settings.marginNoteSources = ["file:Books/C.md"];
  assert.equal(await exporter.export(), 1);
  const data = JSON.parse(files.get("Export/lexis-marginnote.json"));
  assert.equal(data.entries[0].path, "Books/C.md");
  assert.equal(data.entries[0].color, "#ab12ef");
  host.settings.marginNoteSources = [];
  assert.equal(await exporter.export(), 0);
});
