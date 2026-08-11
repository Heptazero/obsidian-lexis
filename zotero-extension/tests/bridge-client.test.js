const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requests = [];
let online = false;
let saved = null;
const prefs = {
  "extensions.lexis-zotero.host": "127.0.0.1",
  "extensions.lexis-zotero.port": 12345,
  "extensions.lexis-zotero.token": "test-token",
};

const context = vm.createContext({
  LexisZotero: {},
  URL,
  Services: { dirsvc: { get: () => ({ path: "/profile" }) } },
  Components: { interfaces: { nsIFile: {} } },
  PathUtils: { join: (...parts) => parts.join("/") },
  IOUtils: {
    exists: async () => false,
    readJSON: async () => null,
    writeJSON: async (_path, value) => { saved = JSON.parse(JSON.stringify(value)); },
  },
  Zotero: {
    Prefs: { get: (key) => prefs[key] },
    HTTP: {
      request: async (method, url, options) => {
        const parsed = new URL(url);
        requests.push({ method, path: parsed.pathname, body: options.body });
        if (!online) throw new Error("offline");
        if (parsed.pathname === "/add") return { status: 200, responseText: JSON.stringify({ ok: true, created: true, word: "energy gap" }) };
        if (parsed.pathname === "/words") return { status: 200, responseText: JSON.stringify({ ok: true, version: "1.10.4", words: [{ key: "energy gap", word: "energy gap" }], styleConfig: { dicts: ["10_atom"] } }) };
        return { status: 200, responseText: JSON.stringify({ ok: true }) };
      },
    },
  },
});

vm.runInContext(fs.readFileSync(path.join(root, "src/bridge-client.js"), "utf8"), context);

(async () => {
  const snapshots = [];
  const client = new context.LexisZotero.BridgeClient({ onSnapshot: (snapshot, state) => snapshots.push({ snapshot, state }), logger: () => {} });
  await client.init();
  const queued = await client.add({ word: "energy gap", sentence: "The energy gap changed." });
  assert.equal(queued.ok, true);
  assert.equal(queued.queued, true);
  assert.equal(client.snapshot.pending.length, 1);
  assert.equal(saved.pending.length, 1);

  online = true;
  requests.length = 0;
  const synced = await client.sync();
  assert.deepEqual(requests.map((item) => item.path), ["/add", "/words"]);
  assert.equal(synced.ok, true);
  assert.equal(synced.count, 1);
  assert.equal(client.snapshot.pending.length, 0);
  assert.equal(client.snapshot.words[0].key, "energy gap");
  assert.equal(snapshots.at(-1).state.cached, false);

  console.log("bridge-client tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
