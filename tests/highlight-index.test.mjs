import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundled = await build({
  stdin: { contents: 'export { createHighlightIndex } from "./src/highlight-index"; export { LexisPluginDictionary } from "./src/plugin-dictionary";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"],
});
class TFile {
  constructor(path) { this.path = path; this.basename = path.split("/").pop().replace(/\.md$/, ""); this.extension = path.split(".").pop(); }
}
const dictionary = (sources, folder = "") => ({ id: "dictionary", folder, template: "", sources });
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(paths = ["Words/A.md", "Outside/B.md"], dicts = [dictionary([{ kind: "folder", value: "Words" }], "Words")]) {
  const files = new Map(paths.map(path => [path, new TFile(path)]));
  const metadata = new Map(), contents = new Map(), timers = new Map(), pending = [], invalidatedPdfs = [];
  const stats = { enumerations: 0, metadataReads: 0, textReads: 0, rebuilds: 0, saves: 0, refreshed: 0 };
  let timerId = 0;
  const clock = {
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const context = { module: { exports: {} }, require: () => ({ Plugin: class {}, TFile, Component: class {}, Notice: class {} }), console, window: clock };
  context.exports = context.module.exports;
  vm.runInNewContext(bundled.outputFiles[0].text, context);
  const { createHighlightIndex, LexisPluginDictionary } = context.module.exports;
  const host = {
    settings: { dicts, includeAliases: true, excludeTags: "", vocabTags: "", inlineEntriesEnabled: false, reviewHistory: {}, reviewAddedAt: {}, reviewEvents: [] },
    app: {
      vault: {
        getMarkdownFiles() { stats.enumerations++; return [...files.values()].filter(file => file.extension === "md"); },
        getFileByPath: path => files.get(path) || null,
        cachedRead: async file => { stats.textReads++; return contents.get(file.path) || ""; },
      },
      metadataCache: {
        getFileCache(file) { stats.metadataReads++; return metadata.get(file.path) || {}; },
        getFirstLinkpathDest(link) {
          return [...files.values()].find(file => file.path === link || file.basename === link || metadata.get(file.path)?.frontmatter?.aliases?.includes(link));
        },
      },
    },
    index: new Map(), vocabPaths: new Set(), inlineSourcePaths: new Set(), _occCache: new Map(), stats: {},
    occurrenceSearch: { invalidatePdf: path => invalidatedPdfs.push(path) },
    statusBar: { update() {} }, reviewDashboard: { refresh() {} }, marginNoteExport: { schedule() {} },
    saveData: async () => { stats.saves++; }, refreshAllViews: () => { stats.refreshed++; }, t: key => key,
  };
  const methods = createHighlightIndex({ Notice: class {}, boundedSource: value => value, compactMixedScriptSpacing: value => value, todayStr: () => "2026-10-18" });
  Object.defineProperties(host, methods);
  for (const name of ["dictionaryScopes", "isVocabFile", "saveSettings", "dictFolders", "parseTags", "vocabTagSet", "excludeTagSet", "inScope", "inFolderScope"]) {
    host[name] = LexisPluginDictionary.prototype[name];
  }
  const rebuild = host.rebuildIndex;
  host.rebuildIndex = notify => {
    stats.rebuilds++;
    const task = rebuild.call(host, notify);
    pending.push(task);
    return task;
  };
  return {
    host, files, metadata, contents, stats, timers, invalidatedPdfs,
    async flush() {
      const callbacks = [...timers.values()]; timers.clear();
      for (const callback of callbacks) callback();
      await Promise.all(pending.splice(0));
    },
    change(path) { host.maybeRebuild(files.get(path)); },
  };
}

test("100 startup changes in an 8,919-file vault coalesce into one scope resolution and index build", async () => {
  const f = fixture(Array.from({ length: 8919 }, (_, index) => `Words/${index}.md`));
  for (const file of [...f.files.values()].slice(0, 100)) f.host.maybeRebuild(file);
  assert.equal(f.stats.enumerations, 0, "event handling must not enumerate the vault");
  assert.equal(f.stats.metadataReads, 0, "folder sources need no per-event metadata reads");
  assert.equal(f.timers.size, 1);
  await f.flush();
  assert.equal(f.stats.enumerations, 1, "membership and inline indexing share the same file snapshot");
  assert.equal(f.stats.rebuilds, 1);
  assert.equal(f.host.index.size, 8919);
  assert.equal(f.stats.textReads, 0);
  assert.equal(f.stats.refreshed, 1);
});

test("warm metadata bursts retain the published snapshot until one coalesced refresh", async () => {
  const f = fixture();
  await f.host.rebuildIndex(false);
  const snapshot = f.host.dictionaryScopes();
  f.metadata.set("Words/A.md", { frontmatter: { aliases: ["New alias"], "lexis-pinned": true } });
  for (let index = 0; index < 100; index++) f.change("Words/A.md");
  assert.equal(f.host.dictionaryScopes(), snapshot);
  assert.equal(f.stats.enumerations, 1);
  await f.flush();
  assert.equal(f.stats.enumerations, 2);
  assert.ok(f.host.index.has("new alias"));
  assert.equal(f.host.index.get("a").pinned, true);
});

test("tag additions enter the dictionary and removals leave it after the same batch", async () => {
  const f = fixture(["A.md", "B.md"], [dictionary([{ kind: "tag", value: "study" }])]);
  f.metadata.set("A.md", { frontmatter: { tags: ["study"] } });
  await f.host.rebuildIndex(false);
  assert.deepEqual([...f.host.index.keys()], ["a"]);
  const before = f.stats.metadataReads;
  f.metadata.set("A.md", {});
  f.metadata.set("B.md", { frontmatter: { tags: "#study" } });
  f.change("A.md"); f.change("B.md");
  assert.equal(f.stats.enumerations, 1);
  assert.equal(f.stats.metadataReads - before, 2, "only inspect the two changed files");
  await f.flush();
  assert.deepEqual([...f.host.index.keys()], ["b"]);
  assert.equal(f.host.isVocabFile(f.files.get("A.md")), false);
  assert.equal(f.host.isVocabFile(f.files.get("B.md")), true);
});

test("direct file and normalized folder sources work independently of capture destinations", async () => {
  const folderPath = "Café/Term.md".normalize("NFD");
  const f = fixture([folderPath, "Café2/Other.md", "Else/Exact.md"], [dictionary([
    { kind: "folder", value: "Café" }, { kind: "file", value: "Else/Exact.md" },
  ], "Capture")]);
  f.change("Café2/Other.md");
  assert.equal(f.timers.size, 0);
  f.change(folderPath); f.change("Else/Exact.md");
  await f.flush();
  assert.deepEqual([...f.host.index.keys()].sort(), ["exact", "term"]);
  assert.equal(f.stats.enumerations, 1);
});

test("editing a directory note updates both added and removed linked members", async () => {
  const f = fixture(["Directory.md", "A.md", "B.md"], [dictionary([{ kind: "links", value: "Directory.md" }])]);
  f.metadata.set("Directory.md", { links: [{ link: "A" }] });
  await f.host.rebuildIndex(false);
  assert.deepEqual([...f.host.index.keys()], ["a"]);
  f.metadata.set("Directory.md", { links: [{ link: "B" }] });
  f.change("Directory.md");
  assert.equal(f.stats.enumerations, 1);
  await f.flush();
  assert.deepEqual([...f.host.index.keys()], ["b"]);
});

test("new aliases and created or deleted files can resolve or remove existing directory links", async () => {
  const f = fixture(["Directory.md", "A.md"], [dictionary([{ kind: "links", value: "Directory.md" }])]);
  f.metadata.set("Directory.md", { links: [{ link: "Alias" }] });
  await f.host.rebuildIndex(false);
  assert.equal(f.host.index.size, 0);
  f.metadata.set("A.md", { frontmatter: { aliases: ["Alias"] } });
  f.change("A.md"); await f.flush();
  assert.ok(f.host.index.has("a"));
  f.metadata.set("Directory.md", { links: [{ link: "New" }] });
  f.change("Directory.md"); await f.flush();
  const created = new TFile("New.md"); f.files.set(created.path, created);
  f.host.maybeRebuild(created); await f.flush();
  assert.ok(f.host.index.has("new"));
  f.files.delete(created.path); f.host.maybeRebuild(created); await f.flush();
  assert.equal(f.host.index.size, 0);
});

test("adding and removing an inline marker refreshes only the marked note body", async () => {
  const f = fixture(["Outside/Cast.md"], []);
  f.host.settings.inlineEntriesEnabled = true;
  f.contents.set("Outside/Cast.md", "Pilot=>A captain");
  f.metadata.set("Outside/Cast.md", { frontmatter: { "lexis-inline": true } });
  f.change("Outside/Cast.md"); await f.flush();
  assert.ok(f.host.index.has("pilot"));
  assert.equal(f.stats.textReads, 1);
  f.metadata.set("Outside/Cast.md", {});
  f.change("Outside/Cast.md"); await f.flush();
  assert.equal(f.host.index.size, 0);
  assert.equal(f.stats.textReads, 1);
});

test("unrelated metadata and PDFs do not rebuild ordinary folder dictionaries", async () => {
  const f = fixture(["Words/A.md", "Outside/B.md", "Book.pdf"]);
  await f.host.rebuildIndex(false);
  const snapshot = f.host.dictionaryScopes();
  f.host._occCache.set("term", []);
  f.change("Outside/B.md"); f.change("Book.pdf");
  assert.equal(f.timers.size, 0);
  assert.equal(f.host.dictionaryScopes(), snapshot);
  assert.equal(f.stats.enumerations, 1);
  assert.equal(f.host._occCache.size, 0);
  assert.deepEqual(f.invalidatedPdfs, ["Book.pdf"]);
});

test("renames preserve learning records and refresh the new term without eager scope work", async () => {
  const f = fixture();
  await f.host.rebuildIndex(false);
  const history = [{ date: "2026-10-01", s: 5 }];
  f.host.settings.reviewHistory["Words/A.md"] = history;
  f.host.settings.reviewAddedAt["Words/A.md"] = "2026-10-01";
  f.host.settings.reviewEvents = [{ type: "note", filePath: "Words/A.md", memberKeys: ["Words/A.md"], label: "A" }];
  const file = f.files.get("Words/A.md"); f.files.delete(file.path);
  file.path = "Words/Renamed.md"; file.basename = "Renamed"; f.files.set(file.path, file);
  f.host.maybeRebuild(file, "Words/A.md");
  assert.equal(f.stats.enumerations, 1);
  assert.equal(f.host.settings.reviewHistory[file.path], history);
  assert.deepEqual(plain(f.host.settings.reviewEvents[0]), { type: "note", filePath: file.path, memberKeys: [file.path], label: "Renamed" });
  await f.flush();
  assert.deepEqual([...f.host.index.keys()], ["renamed"]);
  assert.equal(f.stats.saves, 1);
});
