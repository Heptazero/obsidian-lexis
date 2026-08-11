const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() {
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.dataset = {};
    this.listeners = {};
    this.textContent = "";
    this.className = "";
    this.children = [];
  }

  addEventListener(type, listener) { this.listeners[type] = listener; }
  dispatch(type) { return this.listeners[type]?.(); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren() { this.children = []; }
}

const ids = ["enabled", "host", "port", "token", "sync", "status", "test", "sync-now", "dicts"];
const elements = Object.fromEntries(ids.map((id) => [`lexis-zotero-${id}`, new Element()]));
const preferences = new Map();
const documentListeners = {};
let dictsList = [];
const root = {
  dataset: {},
  classList: { contains: (name) => name === "lexis-pref-root" },
  querySelector: (selector) => elements[selector.slice(1)],
};
const context = {
  document: {
    addEventListener: (type, listener) => { documentListeners[type] = listener; },
    createElement: () => new Element(),
  },
  Zotero: {
    LexisZotero: {
      testConnection: async () => ({ ok: true, vault: "Test Vault", count: 7 }),
      syncNow: async () => ({ ok: true, count: 7 }),
      listDictionaries: () => dictsList,
    },
    Prefs: {
      get: (key) => preferences.get(key),
      set: (key, value) => preferences.set(key, value),
    },
    logError: (error) => { throw error; },
  },
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, "..", "preferences.js"), "utf8");
vm.runInContext(source, context);

(async () => {
  documentListeners.load({ target: root });
  assert.equal(elements["lexis-zotero-port"].value, "12345");

  assert.equal(elements["lexis-zotero-dicts"].children.length, 1);
  assert.equal(elements["lexis-zotero-dicts"].children[0].className, "lexis-pref-files-empty");

  elements["lexis-zotero-token"].value = "secret";
  dictsList = ["10_atom", "60_english"];
  await elements["lexis-zotero-test"].dispatch("click");

  assert.equal(preferences.get("extensions.lexis-zotero.token"), "secret");
  assert.equal(elements["lexis-zotero-status"].textContent, "连接正常 · Test Vault · 7 个词");
  assert.equal(elements["lexis-zotero-status"].dataset.state, "ok");
  assert.equal(elements["lexis-zotero-test"].disabled, false);

  const rows = elements["lexis-zotero-dicts"].children;
  assert.equal(rows.length, 2);
  const [checkbox1] = rows[0].children;
  assert.equal(checkbox1.checked, true);
  checkbox1.checked = false;
  checkbox1.dispatch("change");
  assert.deepEqual(JSON.parse(preferences.get("extensions.lexis-zotero.disabledDicts")), ["10_atom"]);

  console.log("preferences tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
