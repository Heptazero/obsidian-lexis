import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

class TFile {
  constructor(path) { this.path = path; this.basename = path.slice(0, -3); this.extension = "md"; }
}
const built = await build({
  stdin: { contents: 'export * from "./src/review-catalog"; export { parseSyntaxCards } from "./src/flashcard-syntax";', resolveDir: process.cwd(), loader: "ts" },
  bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"],
});
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(entries = { "Cards.md": "Q::A", "Words/Term.md": "Just a definition" }, overrides = {}) {
  const handlers = {}, cleanup = [], timers = new Map(), reads = [], failures = new Set();
  const files = new Map(Object.keys(entries).map(path => [path, new TFile(path)]));
  const settings = {
    reviewCardMeta: {}, reviewPriorities: {}, reviewCatalogInitialized: true,
    flashcardInlineTemplate: "{{question}}::{{answer}}", flashcardBidirectionalTemplate: "{{sideA}}:::{{sideB}}",
    flashcardBlockTemplate: "{{question}}??\n{{answer}}", flashcardClozeTemplate: "=={{answer}}==",
    reviewEvents: [{ id: "retained-event", memberKeys: ["syntax:old"] }],
    reviewHistory: { "syntax:old": [{ date: "2026-10-01", s: 5 }] },
    syntaxCardStates: { old: { s: 5, d: 4, reps: 3 } }, suspendedReviewItems: {}, ...overrides,
  };
  const stats = { enumerations: 0, saves: 0, activeReads: 0, maxReads: 0 };
  let timerId = 0;
  const clock = {
    setTimeout(callback, delay) {
      if (delay === 0) return setTimeout(callback, 0);
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  const host = {
    settings, isVocabFile: file => file.path.startsWith("Words/"),
    registerEvent() {}, register: callback => cleanup.push(callback),
    saveSettings: async () => { stats.saves++; if (host.beforeSave) await host.beforeSave(); },
    app: {
      metadataCache: { on: (name, callback) => { handlers[`cache:${name}`] = callback; } },
      vault: {
        on: (name, callback) => { handlers[name] = callback; },
        getMarkdownFiles: () => { stats.enumerations++; return [...files.values()]; },
        getFileByPath: path => files.get(path) || null,
        cachedRead: async file => {
          const path = file.path, markdown = entries[path];
          reads.push(path); stats.activeReads++; stats.maxReads = Math.max(stats.maxReads, stats.activeReads);
          try {
            if (host.beforeRead) await host.beforeRead(path);
            if (failures.has(path)) throw new Error("fixture read failure");
            return markdown;
          } finally { stats.activeReads--; }
        },
      },
    },
  };
  const context = { module: { exports: {} }, require: () => ({ TFile }), console: { warn() {} }, window: clock };
  context.exports = context.module.exports;
  vm.runInNewContext(built.outputFiles[0].text, context);
  const catalog = new context.module.exports.ReviewCatalog(host);
  return {
    catalog, host, settings, files, entries, handlers, cleanup, timers, reads, failures, stats,
    rename(oldPath, newPath) {
      const file = files.get(oldPath);
      files.delete(oldPath); file.path = newPath; file.basename = newPath.slice(0, -3); files.set(newPath, file);
      entries[newPath] = entries[oldPath]; delete entries[oldPath];
      handlers.rename(file, oldPath);
    },
    dispose: () => cleanup.forEach(callback => callback()),
  };
}

test("watching a 9k-file vault, startup metadata changes, flush and unload do no catalog IO", async () => {
  const f = fixture(Object.fromEntries(Array.from({ length: 8919 }, (_, i) => [`Words/${i}.md`, "A definition"])));
  const original = plain(f.settings);
  f.catalog.start(); f.catalog.start();
  for (const file of f.files.values()) f.handlers["cache:changed"](file);
  await tick(); await f.catalog.flush(); f.dispose();
  assert.equal(f.stats.enumerations, 0);
  assert.equal(f.reads.length, 0);
  assert.equal(f.stats.saves, 0);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(plain(f.settings), original);
  assert.equal(f.cleanup.length, 1);
});

test("concurrent first requests share one bounded full-vault scan, including non-dictionary cards", async () => {
  const entries = Object.fromEntries(Array.from({ length: 49 }, (_, i) => [`Outside/${i}.md`, `Q${i}::A`]));
  const f = fixture(entries);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  f.host.beforeRead = () => gate;
  const first = f.catalog.cards(), second = f.catalog.cards();
  await tick();
  assert.equal(f.stats.activeReads, 16);
  assert.equal(f.stats.enumerations, 1);
  release();
  const lists = await Promise.all([first, second]);
  assert.equal(lists[0].length, 49);
  assert.deepEqual(plain(lists[0]), plain(lists[1]));
  assert.equal(f.reads.length, 49);
  assert.ok(f.stats.maxReads <= 16);
  await f.catalog.cards();
  assert.equal(f.reads.length, 49, "opening the library again reuses parsed cards");
  await f.catalog.flush();
  assert.equal(f.stats.saves, 1);
  f.dispose();
});

test("first scan batches discovery writes and preserves learning history", async () => {
  const f = fixture({ "Cards.md": "Q::A" }, { reviewCatalogInitialized: false });
  const history = plain({ events: f.settings.reviewEvents, history: f.settings.reviewHistory, states: f.settings.syntaxCardStates });
  const cards = await f.catalog.cards();
  assert.equal(f.settings.reviewCardMeta[cards[0].key].discoveredAt, null);
  assert.equal(f.stats.saves, 0);
  assert.equal(f.timers.size, 1);
  await f.catalog.flush();
  await f.catalog.flush();
  assert.equal(f.stats.saves, 1, "unchanged flushes must not rewrite large settings");
  assert.deepEqual(plain({ events: f.settings.reviewEvents, history: f.settings.reviewHistory, states: f.settings.syntaxCardStates }), history);
  f.dispose();
});

test("metadata bursts re-read only the changed file and unchanged content does not save", async () => {
  const f = fixture();
  await f.catalog.cards(); await f.catalog.flush();
  const reads = f.reads.length;
  for (let i = 0; i < 100; i++) f.handlers["cache:changed"](f.files.get("Cards.md"));
  await f.catalog.cards(); await f.catalog.flush();
  assert.equal(f.reads.length, reads + 1);
  assert.equal(f.stats.saves, 1);
  f.entries["Cards.md"] += "\nNew::Answer";
  f.handlers["cache:changed"](f.files.get("Cards.md"));
  assert.ok((await f.catalog.cards()).some(card => card.label === "New"));
  await f.catalog.flush();
  assert.equal(f.stats.saves, 2);
  f.dispose();
});

test("changing templates invalidates the catalog once without duplicate scans", async () => {
  const f = fixture({ "Cards.md": "Old::A\nNew=>B" });
  await f.catalog.cards();
  f.settings.flashcardInlineTemplate = "{{question}}=>{{answer}}";
  const [first, second] = await Promise.all([f.catalog.cards(), f.catalog.cards()]);
  assert.deepEqual(plain(first.map(card => card.label)), ["New"]);
  assert.deepEqual(plain(second), plain(first));
  assert.equal(f.reads.length, 2);
  f.dispose();
});

test("read failures retry only failed files and do not prune unverified priorities", async () => {
  const f = fixture(undefined, { reviewPriorities: { "syntax:unverified": { at: "2026-10-01", initial: .25 } } });
  f.failures.add("Cards.md");
  await f.catalog.cards();
  assert.ok(f.settings.reviewPriorities["syntax:unverified"]);
  f.failures.clear();
  const before = f.reads.length;
  const cards = await f.catalog.cards();
  assert.equal(f.reads.length, before + 1);
  assert.ok(cards.some(card => card.label === "Q"));
  assert.equal(f.settings.reviewPriorities["syntax:unverified"], undefined);
  f.dispose();
});

test("cold renames preserve persisted discovery, priority and suspension without a vault scan", async () => {
  const seed = fixture({ "Cards.md": "Q::A" });
  const oldKey = (await seed.catalog.cards())[0].key;
  seed.dispose();
  const f = fixture({ "Cards.md": "Q::A", "Unrelated.md": "other" }, {
    reviewCardMeta: { [oldKey]: { filePath: "Cards.md", discoveredAt: "2026-10-01" } },
    reviewPriorities: { [oldKey]: { at: "2026-10-01", initial: .25 } },
    suspendedReviewItems: { [oldKey]: true },
  });
  f.catalog.start(); f.rename("Cards.md", "Renamed.md");
  await f.catalog.flush();
  const newKey = Object.keys(f.settings.reviewCardMeta)[0];
  assert.notEqual(newKey, oldKey);
  assert.equal(f.settings.reviewCardMeta[newKey].discoveredAt, "2026-10-01");
  assert.equal(f.settings.reviewCardMeta[newKey].filePath, "Renamed.md");
  assert.equal(f.settings.reviewPriorities[newKey].initial, .25);
  assert.equal(f.settings.suspendedReviewItems[newKey], true);
  assert.equal(f.stats.enumerations, 0);
  assert.ok(f.reads.every(path => path === "Renamed.md"));
  f.dispose();
});

test("a rename during the first scan is migrated before obsolete keys are pruned", async () => {
  const seed = fixture({ "Cards.md": "Q::A" });
  const oldKey = (await seed.catalog.cards())[0].key;
  seed.dispose();
  const f = fixture({ "Cards.md": "Q::A" }, {
    reviewCardMeta: { [oldKey]: { filePath: "Cards.md", discoveredAt: "2026-10-01" } },
    reviewPriorities: { [oldKey]: { at: "2026-10-01", initial: .25 } },
  });
  let release;
  f.host.beforeRead = () => new Promise(resolve => { release = resolve; });
  const request = f.catalog.cards();
  await tick();
  f.rename("Cards.md", "Renamed.md");
  f.host.beforeRead = null; release();
  const [card] = await request;
  assert.equal(f.settings.reviewCardMeta[card.key].discoveredAt, "2026-10-01");
  assert.equal(f.settings.reviewPriorities[card.key].initial, .25);
  assert.equal(f.settings.reviewCardMeta[oldKey], undefined);
  f.dispose();
});

test("cold deletes remove only catalog records and leave review history intact", async () => {
  const f = fixture(undefined, { reviewCardMeta: { "syntax:old": { filePath: "Cards.md", discoveredAt: null } } });
  const history = plain(f.settings.reviewHistory);
  f.catalog.start();
  const file = f.files.get("Cards.md"); f.files.delete(file.path); f.handlers.delete(file);
  await f.catalog.flush();
  assert.deepEqual(plain(f.settings.reviewCardMeta), {});
  assert.deepEqual(plain(f.settings.reviewHistory), history);
  assert.equal(f.reads.length, 0);
  assert.equal(f.stats.saves, 1);
  f.dispose();
});

test("unload stops in-flight initialization without later batches or settings writes", async () => {
  const f = fixture(Object.fromEntries(Array.from({ length: 49 }, (_, i) => [`${i}.md`, "Q::A"])));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  f.host.beforeRead = () => gate;
  const request = f.catalog.cards();
  await tick(); f.dispose(); release();
  assert.deepEqual(plain(await request), []);
  assert.equal(f.reads.length, 16);
  assert.deepEqual(plain(f.settings.reviewCardMeta), {});
  assert.equal(f.stats.saves, 0);
  assert.equal(f.timers.size, 0);
});

test("a failed catalog save stays dirty and can be retried without a scan", async () => {
  const f = fixture();
  await f.catalog.cards();
  const reads = f.reads.length;
  f.host.beforeSave = async () => { throw new Error("disk unavailable"); };
  await assert.rejects(f.catalog.flush(), /disk unavailable/);
  f.host.beforeSave = null;
  await f.catalog.flush(); await f.catalog.flush();
  assert.equal(f.stats.saves, 2);
  assert.equal(f.reads.length, reads);
  f.dispose();
});

test("a partially completed first scan does not repeatedly write settings", async () => {
  const f = fixture(Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`${i}.md`, "Q::A"])));
  let release, secondBatch;
  const gate = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { secondBatch = resolve; });
  f.host.beforeRead = path => {
    if (parseInt(path) < 16) return;
    secondBatch(); return gate;
  };
  const request = f.catalog.cards();
  await reached;
  assert.equal(Object.keys(f.settings.reviewCardMeta).length, 16);
  assert.equal(f.timers.size, 0);
  assert.equal(f.stats.saves, 0);
  release(); await request; await f.catalog.flush();
  assert.equal(f.stats.saves, 1);
  f.dispose();
});

test("unchanged persisted metadata needs no settings write after reopening the catalog", async () => {
  const seed = fixture();
  await seed.catalog.cards();
  const metadata = plain(seed.settings.reviewCardMeta);
  seed.dispose();
  const f = fixture(undefined, { reviewCardMeta: metadata });
  await f.catalog.cards(); await f.catalog.flush(); f.dispose();
  assert.equal(f.stats.saves, 0);
  assert.deepEqual(plain(f.settings.reviewCardMeta), metadata);
});

test("files deleted while the plugin was stopped are reconciled and persisted only on demand", async () => {
  const f = fixture({}, { reviewCardMeta: { "syntax:gone": { filePath: "Gone.md", discoveredAt: "2026-10-01" } } });
  f.catalog.start();
  assert.ok(f.settings.reviewCardMeta["syntax:gone"]);
  await f.catalog.cards(); await f.catalog.flush();
  assert.deepEqual(plain(f.settings.reviewCardMeta), {});
  assert.equal(f.stats.saves, 1);
  assert.ok(f.settings.reviewHistory["syntax:old"]);
  f.dispose();
});

test("folder renames before first demand migrate persisted paths without scanning unrelated files", async () => {
  const seed = fixture({ "Folder/Cards.md": "Q::A" });
  const oldKey = (await seed.catalog.cards())[0].key;
  seed.dispose();
  const f = fixture({ "Folder/Cards.md": "Q::A", "Outside.md": "other" }, {
    reviewCardMeta: { [oldKey]: { filePath: "Folder/Cards.md", discoveredAt: "2026-10-01" } },
    reviewPriorities: { [oldKey]: { at: "2026-10-01", initial: .25 } },
  });
  f.catalog.start();
  const file = f.files.get("Folder/Cards.md"); f.files.delete(file.path);
  file.path = "Moved/Cards.md"; f.files.set(file.path, file); f.entries[file.path] = "Q::A";
  f.handlers.rename({ path: "Moved" }, "Folder");
  await f.catalog.flush();
  const [key] = Object.keys(f.settings.reviewCardMeta);
  assert.notEqual(key, oldKey);
  assert.equal(f.settings.reviewCardMeta[key].filePath, "Moved/Cards.md");
  assert.equal(f.settings.reviewCardMeta[key].discoveredAt, "2026-10-01");
  assert.equal(f.stats.enumerations, 0);
  assert.ok(f.reads.every(path => path === file.path));
  f.dispose();
});

test("a failed first scan rejects and the next demand can retry", async () => {
  const f = fixture();
  const enumerate = f.host.app.vault.getMarkdownFiles;
  f.host.app.vault.getMarkdownFiles = () => { throw new Error("vault not available"); };
  await assert.rejects(f.catalog.cards(), /vault not available/);
  assert.deepEqual(plain(f.settings.reviewCardMeta), {});
  f.host.app.vault.getMarkdownFiles = enumerate;
  assert.equal((await f.catalog.cards()).length, 2);
  f.dispose();
});

test("flush serializes writes and includes changes received during an in-flight save", async () => {
  const f = fixture({ "Cards.md": "Q::A" });
  await f.catalog.cards();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let active = 0, maxActive = 0;
  f.host.beforeSave = async () => {
    active++; maxActive = Math.max(maxActive, active);
    await gate; active--;
  };
  const first = f.catalog.flush();
  await tick();
  f.entries["Cards.md"] += "\nNew::A";
  f.handlers["cache:changed"](f.files.get("Cards.md"));
  await f.catalog.cards();
  const second = f.catalog.flush();
  release(); await Promise.all([first, second]);
  assert.equal(maxActive, 1);
  assert.equal(f.stats.saves, 2);
  assert.equal(f.timers.size, 0);
  f.dispose();
});
