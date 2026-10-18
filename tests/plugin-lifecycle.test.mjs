import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

// Execute the actual composed entry point; native hosts and independent visual services are simulated.
const bundle = await build({ entryPoints: ["src/main.ts"], bundle: true, write: false, format: "cjs", platform: "node",
  external: ["obsidian", "@codemirror/state", "@codemirror/view"],
  plugins: [{ name: "native-reader-surfaces", setup(api) {
    const services = { "status-bar": "LexisStatusBar", "epub-highlights": "EpubHighlights", "excalidraw-highlights": "ExcalidrawHighlights", "canvas-edge-highlights": "CanvasEdgeHighlights" };
    api.onLoad({ filter: /\/(status-bar|epub-highlights|excalidraw-highlights|canvas-edge-highlights)\.ts$/ }, ({ path }) => {
      const key = path.split("/").pop().replace(".ts", "");
      return { contents: `export class ${services[key]} { mount() {} update() {} start() {} dispose() {} destroy() {} activate() {} close() {} }`, loader: "ts" };
    });
  } }],
});

function fixture() {
  const layoutReady = [];
  const handlers = new Map(), views = new Map(), viewRegistrations = [], flushed = [], clock = { clearTimeout() {}, setTimeout() { return 1; }, requestAnimationFrame() {}, cancelAnimationFrame() {}, addEventListener() {}, removeEventListener() {} };
  const document = { body: { classList: { toggle() {}, remove() {} } }, defaultView: clock, addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [] };
  const workspace = {
    containerEl: { ownerDocument: document }, getMostRecentLeaf: () => null,
    on: () => ({}), offref() {}, onLayoutReady(callback) { layoutReady.push(callback); }, getLeavesOfType: () => [],
  };
  class Component {
    events = [];
    register(callback) { this.events.push(callback); }
    registerEvent() {}
    // Obsidian runs registered disposers before onunload; a fresh instance has none.
    unload() { while (this.events.length) this.events.pop()(); this.onunload?.(); }
  }
  class Plugin extends Component {
    constructor() { super(); this.app = { workspace, vault: { adapter: {}, configDir: ".obsidian", on: () => ({}) }, metadataCache: { on: () => ({}) },
      loadLocalStorage: () => "a".repeat(32) }; this.manifest = { id: "lexis", dir: ".obsidian/plugins/lexis", version: "fixture" }; }
    async loadData() { return { legacySettingsImported: true, bridgeEnabled: false, enableHighlight: false, enablePdfHighlight: false }; }
    async saveData() {}
    addCommand() {} addSettingTab() {} addRibbonIcon() {} registerEditorSuggest() {}
    registerView(type, creator) {
      if (views.has(type)) throw new Error(`Attempting to register an existing view type "${type}"`);
      views.set(type, creator);
      viewRegistrations.push(type);
      this.register(() => views.delete(type));
    }
    registerMarkdownPostProcessor() {} registerMarkdownCodeBlockProcessor() {}
    registerObsidianProtocolHandler(name, callback) {
      if (handlers.has(name)) throw new Error(`Action "${name}" is already registered as a handler.`);
      handlers.set(name, callback);
      this.register(() => { if (handlers.get(name) === callback) handlers.delete(name); });
    }
  }
  const native = { Plugin, Component, Platform: { isMobile: true }, Notice: class {}, TFile: class {}, TFolder: class {},
    ItemView: class {}, Modal: class {}, AbstractInputSuggest: class {}, EditorSuggest: class {}, PluginSettingTab: class {}, Setting: class {} };
  const context = { module: { exports: {} }, exports: {}, window: clock, console,
    require: (name) => { if (name === "obsidian") return native; if (name.startsWith("@codemirror/")) return {}; throw new Error(`Unexpected module: ${name}`); } };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  const create = () => {
    const plugin = new context.module.exports.default();
    plugin.loadEncounters = async () => {};
    plugin.saveEncounters = async () => { flushed.push(plugin); };
    plugin.setupLiveExtension = () => {};
    return plugin;
  };
  return { create, handlers, views, viewRegistrations, flushed, layoutReady };
}

test("layout-ready startup and maintenance do not initialize the review catalog", async () => {
  const f = fixture(), plugin = f.create();
  await plugin.onload();
  let enumerations = 0, reads = 0, saves = 0;
  plugin.app.vault.getMarkdownFiles = () => { enumerations++; return []; };
  plugin.app.vault.cachedRead = async () => { reads++; return ""; };
  plugin.saveSettings = async () => { saves++; };
  plugin.rebuildIndex = async () => ({});
  plugin.syncActivePageHighlightState = () => {};
  plugin._workspaceDocuments.activateLeaf = () => {};
  for (const ready of f.layoutReady) ready();
  await plugin.prepareReload();
  plugin.unload();
  assert.equal(enumerations, 0);
  assert.equal(reads, 0);
  assert.equal(saves, 0);
});

test("fresh and settings-failed plugin instances unload without initialized reader or encounter state", async () => {
  const f = fixture();
  const fresh = f.create();
  assert.doesNotThrow(() => fresh.unload());
  const failed = f.create();
  failed.loadSettings = async () => { throw new Error("settings failure"); };
  await assert.rejects(failed.onload(), /settings failure/);
  assert.doesNotThrow(() => failed.unload());
  assert.equal(f.handlers.size, 0);
  assert.equal(f.flushed.length, 0);
});

test("maintenance preparation waits for catalog and encounter persistence before allowing reload", async () => {
  const f = fixture(), plugin = f.create(), calls = [];
  let finishCatalog, finishEncounters, completed = false;
  plugin.reviewCatalog = { flush: async () => { calls.push("catalog"); await new Promise((resolve) => { finishCatalog = resolve; }); } };
  plugin._encPending = [{ path: "note.md" }]; plugin._encSaveTimer = 1;
  plugin.saveEncounters = async () => { calls.push("encounters"); await new Promise((resolve) => { finishEncounters = resolve; }); plugin._encPending = []; };
  const pending = plugin.prepareReload().then(() => { completed = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["catalog"]); assert.equal(completed, false);
  finishCatalog(); await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["catalog", "encounters"]); assert.equal(completed, false);
  finishEncounters(); await pending;
  assert.equal(plugin._encSaveTimer, 0); assert.equal(completed, true);
});

test("maintenance preparation rejects moving or unsaved learning data instead of unloading", async () => {
  const f = fixture(), plugin = f.create();
  let catalogWrites = 0;
  plugin.reviewCatalog = { flush: async () => { catalogWrites++; } };
  plugin._encRelocating = true;
  await assert.rejects(plugin.prepareReload(), /maintenance.pendingData/);
  assert.equal(catalogWrites, 0);
  plugin._encRelocating = false; plugin._encPending = [{ path: "note.md" }];
  await assert.rejects(plugin.prepareReload(), /maintenance.pendingData/);
  assert.equal(plugin._encPending.length, 1);
  plugin._encPending = [];
  plugin.reviewCatalog = { flush: async () => { plugin._encRelocating = true; } };
  await assert.rejects(plugin.prepareReload(), /maintenance.pendingData/);
});

test("failure during reader initialization does not publish the external protocol", async () => {
  const f = fixture(), plugin = f.create();
  plugin.setupLiveExtension = () => { throw new Error("reader failure"); };
  await assert.rejects(plugin.onload(), /reader failure/);
  assert.equal(f.handlers.size, 0);
  assert.doesNotThrow(() => plugin.unload());
});

test("successful enable-disable-enable cycles release their own protocol registration", async () => {
  const f = fixture();
  for (let cycle = 0; cycle < 3; cycle++) {
    const plugin = f.create();
    await plugin.onload();
    assert.equal(f.handlers.size, 1);
    assert.ok(f.handlers.has("lexis-add"));
    assert.deepEqual([...f.views.keys()], ["lexis-review-view", "lexis-home-view", "lexis-log-view"]);
    assert.equal(f.viewRegistrations.length, (cycle + 1) * 3);
    plugin._encPending.push({ path: "words/test.md" });
    assert.doesNotThrow(() => plugin.unload());
    assert.equal(f.handlers.size, 0);
    assert.equal(f.views.size, 0);
    assert.equal(f.flushed.length, cycle + 1);
  }
});

test("a protocol collision remains visible and does not remove another handler", async () => {
  const f = fixture(), owner = () => {};
  f.handlers.set("lexis-add", owner);
  const plugin = f.create();
  await assert.rejects(plugin.onload(), /already registered/);
  assert.doesNotThrow(() => plugin.unload());
  assert.equal(f.handlers.get("lexis-add"), owner);
});

test("an interruption after protocol registration still releases it before a new instance starts", async () => {
  const f = fixture(), plugin = f.create();
  const register = plugin.registerObsidianProtocolHandler.bind(plugin);
  plugin.registerObsidianProtocolHandler = (...args) => { register(...args); throw new Error("late startup failure"); };
  await assert.rejects(plugin.onload(), /late startup failure/);
  assert.equal(f.handlers.size, 1);
  assert.doesNotThrow(() => plugin.unload());
  assert.equal(f.handlers.size, 0);
  assert.equal(f.views.size, 0);
  const retry = f.create();
  await retry.onload();
  assert.doesNotThrow(() => retry.unload());
  assert.equal(f.handlers.size, 0);
  assert.equal(f.views.size, 0);
});

test("a pre-existing view collision is reported without deleting the existing creator", async () => {
  const f = fixture(), owner = () => {};
  f.views.set("lexis-review-view", owner);
  const plugin = f.create();
  await assert.rejects(plugin.onload(), /existing view type "lexis-review-view"/);
  assert.equal(f.viewRegistrations.length, 0);
  assert.doesNotThrow(() => plugin.unload());
  assert.equal(f.views.get("lexis-review-view"), owner);
});

test("failure partway through view registration releases the views already acquired", async () => {
  const f = fixture(), plugin = f.create();
  const register = plugin.registerView.bind(plugin);
  plugin.registerView = (...args) => { register(...args); if (args[0] === "lexis-home-view") throw new Error("view initialization failure"); };
  await assert.rejects(plugin.onload(), /view initialization failure/);
  assert.equal(f.views.size, 2);
  assert.equal(f.handlers.size, 0);
  assert.doesNotThrow(() => plugin.unload());
  assert.equal(f.views.size, 0);
  const retry = f.create();
  await retry.onload();
  assert.equal(f.views.size, 3);
  assert.doesNotThrow(() => retry.unload());
  assert.equal(f.views.size, 0);
});
