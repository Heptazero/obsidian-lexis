import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

async function load(path, globals = {}) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
  const context = { exports: {}, module: { exports: {} }, TextEncoder, crypto: webcrypto, ...globals };
  vm.runInNewContext(result.outputFiles[0].text, context);
  return context.module.exports;
}
const protocol = await load("src/marginnote-protocol.ts");
const exporter = await load("src/marginnote-export-data.ts");
const { syncDictionary } = await load("pkg/marginnote-extension/src/sync.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const entry = (id, title = id) => ({ id, title, aliases: [], markdown: `About ${title}`, uri: protocol.obsidianEntryUri("My vault", `${id}.md`) });
const snapshot = (entries, sourceId = "vault:test") => ({ format: "lexis-marginnote", version: 1, source: { id: sourceId, vault: "Test" }, revision: "revision", entries });

function store(initial = [], createHook = () => {}) {
  const notes = initial;
  let saved = 0;
  let yields = 0;
  return {
    notes: () => notes,
    create: (title) => {
      createHook(title);
      const note = { noteId: `n${notes.length}`, noteTitle: title, excerptText: "", excerptTextMarkdown: 0, comments: ["User comment"] };
      notes.push(note);
      return note;
    },
    save: () => { saved++; },
    yield: async () => { yields++; },
    counts: () => ({ saved, yields }),
  };
}

test("dictionary validates completely, rejects duplicate identities and unsafe links", () => {
  const data = snapshot([entry("word")]);
  assert.equal(protocol.parseMarginNoteDictionary(JSON.stringify(data)).entries.length, 1);
  for (const bad of [null, { ...data, version: 2 }, snapshot([entry("word"), entry("word")]), snapshot([{ ...entry("word"), uri: "javascript:alert(1)" }]), snapshot([{ ...entry("word"), aliases: [1] }])]) {
    assert.throws(() => protocol.parseMarginNoteDictionary(JSON.stringify(bad)));
  }
});

test("ownership marker round trips unicode and titles deduplicate aliases", () => {
  const e = { ...entry("中文/{}"), aliases: [" 中文/{} ", "Word", "word", " "] };
  assert.equal(protocol.marginNoteKeywords(e), "中文/{}; Word");
  const body = protocol.managedEntryBody("source/中文", e);
  assert.deepEqual(plain(protocol.managedEntryIdentity(body)), { sourceId: "source/中文", entryId: e.id });
  assert.equal(protocol.managedEntryIdentity("ordinary comment"), null);
  assert.equal(protocol.managedEntryIdentity("<!-- lexis-marginnote:%wrong -->"), null);
});

test("export groups ordinary aliases and inline terms; excludes archived entries", async () => {
  const file = { path: "words/Test.md", basename: "Test" };
  const inlineFile = { path: "novel/人物.md", basename: "人物" };
  const index = new Map([
    ["test", { file, display: "Test", aliases: ["Trial"] }],
    ["trial", { file, display: "Trial", isAlias: true }],
    ["alice", { file: inlineFile, display: "Alice", canonical: "Alice", inline: true, annotation: "The captain", headingPath: [{ name: "船员" }] }],
    ["captain", { file: inlineFile, display: "Captain", canonical: "Alice", inline: true, annotation: "The captain" }],
    ["bob", { file: inlineFile, display: "Bob", canonical: "Bob", inline: true, annotation: "Engineer" }],
    ["archived", { file: { path: "Old.md", basename: "Old" }, display: "Old", archived: true }],
    ["retired", { file: { path: "Done.md", basename: "Done" }, display: "Done", retired: true }],
  ]);
  const readPaths = [];
  const read = async (e) => { readPaths.push(e.file.path); return "---\ntags: [vocab]\n---\n# Body\nDefinition\n```lexis\nocc\n```"; };
  const first = await exporter.buildMarginNoteDictionary("My vault", index, read);
  assert.equal(first.entries.length, 3);
  assert.deepEqual(readPaths, [file.path]);
  const ordinary = first.entries.find((e) => e.title === "Test");
  assert.deepEqual(plain(ordinary.aliases), ["Trial"]);
  assert.equal(ordinary.markdown, "# Body\nDefinition");
  const alice = first.entries.find((e) => e.title === "Alice");
  assert.deepEqual(plain(alice.aliases), ["Captain"]);
  assert.equal(alice.markdown, "The captain");
  assert.equal(alice.uri, "obsidian://open?vault=My%20vault&file=novel%2F%E4%BA%BA%E7%89%A9.md%23%E8%88%B9%E5%91%98");
  const second = await exporter.buildMarginNoteDictionary("My vault", new Map([...index].reverse()), read);
  // Canonical entry metadata, not alias iteration order, decides the return heading.
  assert.equal(first.revision, second.revision);
  const changed = await exporter.buildMarginNoteDictionary("My vault", index, async () => "Changed");
  assert.notEqual(changed.revision, first.revision);
});

test("export folder is vault-relative and never names a data migration destination", () => {
  assert.equal(exporter.marginNoteExportPath(" Export\\MN/ "), "Export/MN/lexis-marginnote.json");
  for (const bad of ["", "/tmp", "../outside", "A/../B", "C:\\secret", "A//B"]) assert.throws(() => exporter.marginNoteExportPath(bad));
  assert.equal(exporter.dictionaryMarkdown("---\n---\nText"), "Text");
});

test("reimport updates in place and leaves user comments and unmanaged notes intact", async () => {
  const ordinary = { noteId: "user", noteTitle: "My card", excerptText: "My text", excerptTextMarkdown: 0 };
  const s = store([ordinary]);
  let result = await syncDictionary(snapshot([entry("A"), entry("B")]), s);
  assert.deepEqual(plain(result), { created: 2, updated: 0, disabled: 0, total: 2 });
  const ids = s.notes().map((n) => n.noteId);
  result = await syncDictionary(snapshot([entry("A"), entry("B")]), s);
  assert.equal(result.created + result.updated + result.disabled, 0);
  assert.deepEqual(s.notes().map((n) => n.noteId), ids);
  const a = s.notes()[1];
  result = await syncDictionary(snapshot([{ ...entry("A", "New A"), aliases: ["A"] }, entry("B")]), s);
  assert.equal(result.updated, 1);
  assert.equal(a.noteTitle, "New A; A");
  assert.deepEqual(a.comments, ["User comment"]);
  assert.equal(ordinary.excerptText, "My text");
});

test("removed entry becomes inactive without deletion, then restores its original card", async () => {
  const s = store();
  await syncDictionary(snapshot([entry("A")]), s);
  const original = s.notes()[0];
  const result = await syncDictionary(snapshot([]), s);
  assert.equal(result.disabled, 1);
  assert.equal(original.noteTitle, "");
  assert.equal(s.notes().length, 1);
  await syncDictionary(snapshot([entry("A")]), s);
  assert.equal(s.notes()[0], original);
  assert.equal(original.noteTitle, "A");
});

test("another source is untouched; synced ownership works without a local identity map", async () => {
  const unrelated = { noteId: "foreign", noteTitle: "Foreign", excerptText: protocol.managedEntryBody("other", entry("A")), excerptTextMarkdown: 1 };
  const synced = { noteId: "cloud", noteTitle: "A", excerptText: protocol.managedEntryBody("vault:test", entry("A")), excerptTextMarkdown: 1 };
  const s = store([unrelated, synced]);
  const result = await syncDictionary(snapshot([entry("A")]), s);
  assert.equal(result.created, 0);
  assert.equal(unrelated.noteTitle, "Foreign");
  assert.equal(s.notes().length, 2);
});

test("imports yield to the UI, report exact counts, and persist partial work for retry", async () => {
  const progress = [];
  const s = store();
  await syncDictionary(snapshot(Array.from({ length: 85 }, (_, i) => entry(`${i}`))), s, (done, total) => progress.push([done, total]));
  assert.equal(s.counts().yields, 2);
  assert.deepEqual(progress, [[40, 85], [80, 85], [85, 85]]);
  let fail = true;
  const partial = store([], (title) => { if (title === "B" && fail) throw new Error("Native failure"); });
  await assert.rejects(syncDictionary(snapshot([entry("A"), entry("B")]), partial), /Native failure/);
  assert.equal(partial.counts().saved, 1);
  assert.equal(partial.notes().length, 1);
  fail = false;
  await syncDictionary(snapshot([entry("A"), entry("B")]), partial);
  assert.equal(partial.notes().length, 2);
});

test("duplicate managed cards fail before mutation instead of silently choosing one", async () => {
  const s = store();
  await syncDictionary(snapshot([entry("A")]), s);
  s.notes().push({ ...s.notes()[0], noteId: "duplicate" });
  await assert.rejects(syncDictionary(snapshot([entry("A", "Changed")]), s), /Duplicate managed/);
  assert.equal(s.notes()[0].noteTitle, "A");
});

test("native file access balances permission lifetime even when parsing fails", async () => {
  let started = 0;
  let stopped = 0;
  const url = { path: "dictionary", startAccessingSecurityScopedResource: () => { started++; return true; }, stopAccessingSecurityScopedResource: () => { stopped++; } };
  const source = await load("pkg/marginnote-extension/src/source.ts", {
    NSString: { stringWithContentsOfURL: () => "invalid" },
    NSURL: { fileURLWithPath: () => url },
  });
  assert.throws(() => source.readDictionary(url));
  assert.equal(started, 1);
  assert.equal(stopped, 1);
  assert.equal(source.pickedURL([url]), url);
  assert.equal(source.pickedURL({ count: () => 1, objectAtIndex: () => url }), url);
  assert.equal(source.pickedURL(null), null);
});

test("Obsidian export writes only its snapshot, skips unchanged content and guards unrelated files", async () => {
  const listeners = new Map();
  const disposers = [];
  const files = new Map();
  const writes = [];
  const timers = [];
  const file = { path: "words/A.md", basename: "A" };
  const { MarginNoteExport } = await load("src/marginnote-export.ts", {
    require: () => ({ Notice: class {} }),
    window: { setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {} },
  });
  const host = {
    index: new Map([["a", { file, display: "A" }]]),
    settings: { marginNoteExportFolder: "Export", marginNoteAutoExport: false },
    t: (key) => key,
    addCommand: () => {}, register: (fn) => disposers.push(fn), registerEvent: () => {},
    app: { vault: {
      getName: () => "Test", cachedRead: async () => "Definition",
      on: (event, fn) => { listeners.set(event, fn); return {}; },
      adapter: {
        exists: async (path) => files.has(path), read: async (path) => files.get(path),
        mkdir: async (path) => { files.set(path, "folder"); },
        write: async (path, text) => { files.set(path, text); writes.push(path); },
      },
    } },
  };
  const exporter = new MarginNoteExport(host);
  await Promise.all([exporter.export(), exporter.export()]);
  assert.deepEqual(writes, ["Export/lexis-marginnote.json"]);
  assert.equal(protocol.parseMarginNoteDictionary(files.get(writes[0])).entries.length, 1);
  listeners.get("modify")(file);
  assert.equal(timers.length, 0);
  host.settings.marginNoteAutoExport = true;
  listeners.get("modify")(file);
  assert.equal(timers.length, 1);
  host.settings.marginNoteExportFolder = "Other";
  files.set("Other/lexis-marginnote.json", "Personal data");
  await assert.rejects(exporter.export());
  assert.equal(files.get("Other/lexis-marginnote.json"), "Personal data");
  host.settings.marginNoteExportFolder = "Export";
  disposers[0]();
  assert.equal(await exporter.export(), 0);
  assert.equal(writes.length, 1);
});

test("native importer attaches cards to the chosen parent and rejects source switches before writes", async () => {
  const prefs = new Map();
  const notes = [];
  const children = [];
  const parent = { noteId: "parent", notebookId: "topic", excerptText: "", addChild: (note) => children.push(note) };
  const globals = {
    NSUserDefaults: { standardUserDefaults: () => ({ objectForKey: (key) => prefs.get(key), setObjectForKey: (value, key) => prefs.set(key, value) }) },
    Database: { sharedInstance: () => ({
      getNotebookById: () => ({ notes }), getNoteById: (id) => id === "parent" ? parent : null,
      createNoteWithTitleTopicid: (title, topic) => { const n = { noteId: `n${notes.length}`, notebookId: topic, noteTitle: title }; notes.push(n); return n; },
      savedb: () => {}, setNotebookSyncDirty: () => {},
    }) },
    Application: { sharedInstance: () => ({ studyController: () => ({ notebookController: { focusNote: parent } }), showHUD: () => {}, refreshAfterDBChanged: () => {} }) },
    NSTimer: { scheduledTimerWithTimeInterval: (_s, _repeat, callback) => callback() },
  };
  const importer = await load("pkg/marginnote-extension/src/importer.ts", globals);
  await importer.importDictionary("topic", {}, snapshot([entry("A")]));
  assert.equal(children.length, 1);
  assert.equal(children[0].noteTitle, "A");
  await importer.importDictionary("topic", {}, snapshot([entry("A")]));
  assert.equal(notes.length, 1);
  await assert.rejects(importer.importDictionary("topic", {}, snapshot([entry("B")], "other")), /another dictionary/);
  assert.equal(notes.length, 1);
  assert.equal(await importer.importDictionary("topic", {}, snapshot([entry("A")]), true), null);
});

test("addon foreground polling stops on inactive windows and plugin unload", async () => {
  const bridge = {};
  const timers = [];
  const instance = { window: {} };
  let methods;
  let statics;
  bridge.defineClass = (_name, members, classMembers) => { methods = members; statics = classMembers; return {}; };
  await load("pkg/marginnote-extension/src/main.ts", {
    JSB: bridge, self: instance,
    NSNotificationCenter: { defaultCenter: () => ({ addObserverSelectorName() {}, removeObserverName() {} }) },
    Application: { sharedInstance: () => ({ studyController: () => ({ notebookController: { notebookId: "topic" } }) }) },
    NSUserDefaults: { standardUserDefaults: () => ({ objectForKey: () => false }) },
    NSTimer: { scheduledTimerWithTimeInterval: (_seconds, repeat) => { const timer = { repeat, invalidated: false, invalidate() { this.invalidated = true; } }; timers.push(timer); return timer; } },
  });
  bridge.newAddon("/addon");
  methods.sceneWillConnect();
  assert.equal(timers[0].repeat, true);
  methods.sceneWillResignActive();
  assert.equal(timers[0].invalidated, true);
  methods.sceneDidBecomeActive();
  assert.equal(timers.length, 2);
  statics.addonWillDisconnect();
  assert.equal(timers[1].invalidated, true);
});
