import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/plugin-maintenance.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
const directory = ".obsidian/plugins/lexis";
const oldManifest = { id: "lexis", version: "1.17.23", minAppVersion: "1.8.7", isDesktopOnly: false, dir: directory };
const target = { ...oldManifest, version: "1.17.24" };
const assets = ["main.js", "styles.css", "manifest.json"];
const metadata = { tag_name: target.version, draft: false, prerelease: false, assets: assets.map((name) => ({ name })) };

function fixture(options = {}) {
  const calls = [], writes = [], requests = [], removed = [];
  const files = new Map(assets.map((name) => [`${directory}/${name}`, name === "manifest.json" ? JSON.stringify(oldManifest) : `old ${name}`]));
  files.set(`${directory}/data.json`, "personal settings and token"); files.set("Learning/device.json", "learning data");
  let loadedManifest = oldManifest, failedWrite = false;
  const host = { manifest: { ...oldManifest, ...options.local }, prepareReload: async () => { calls.push("save"); if (options.pendingData) throw Error("pending data"); }, app: {
    vault: { configDir: ".obsidian", adapter: {
      exists: async (path) => files.has(path), read: async (path) => files.get(path),
      write: async (path, text) => { writes.push(path); if (options.writeFailure && path.endsWith("styles.css") && (!failedWrite || options.restoreFailure)) { failedWrite = true; throw Error("disk error"); } files.set(path, text); },
      remove: async (path) => { removed.push(path); files.delete(path); },
    } },
    plugins: {
      unloadPlugin: async (id) => { assert.equal(id, "lexis"); calls.push("unload"); },
      loadManifest: async (path) => { assert.equal(path, directory); calls.push("manifest"); loadedManifest = JSON.parse(files.get(`${path}/manifest.json`)); },
      loadPlugin: async (id) => { assert.equal(id, "lexis"); calls.push(`load:${loadedManifest.version}`); if (options.loadFailure && loadedManifest.version === target.version) throw Error("new plugin failed"); return { manifest: loadedManifest }; },
    },
    setting: { openTabById: (id) => { assert.equal(id, "lexis"); calls.push("reopen"); } },
  } };
  const readText = async (url) => {
    requests.push(url);
    if (url.endsWith("/latest")) return JSON.stringify(options.metadata || metadata);
    if (url.endsWith("/manifest.json")) return JSON.stringify(options.manifest || target);
    if (options.downloadFailure && url.endsWith("main.js")) throw Error("offline");
    return url.endsWith("main.js") ? "module.exports = class NewPlugin {};" : ".lexis {}";
  };
  const context = { module: { exports: {} }, require: () => ({ Platform: { isMobileApp: !!options.mobile }, requireApiVersion: (version) => version !== "99.0.0", requestUrl: options.requestUrl }), window: options.window || { setTimeout, clearTimeout } };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  const { PluginMaintenance, comparePluginVersions } = context.module.exports;
  return { host, files, calls, writes, removed, requests, comparePluginVersions, service: new PluginMaintenance(host, readText), PluginMaintenance };
}

test("reload uses the existing loader without networking, installation or enabled-list writes", async () => {
  const f = fixture();
  assert.equal(f.requests.length, 0);
  await f.service.reload();
  assert.deepEqual(f.calls, ["save", "unload", "load:1.17.23", "reopen"]);
  assert.deepEqual(f.writes, []); assert.deepEqual(f.requests, []);
  assert.ok(f.comparePluginVersions("1.17.24", "1.17.9") > 0);
  assert.ok(f.comparePluginVersions("1.18.0", "1.17.99") > 0);
});

test("same or older published versions never download code or offer a downgrade", async () => {
  for (const tag of ["1.17.23", "1.17.9"]) {
    const f = fixture({ metadata: { ...metadata, tag_name: tag } });
    assert.equal(await f.service.check(), null);
    assert.equal(f.requests.length, 1); assert.deepEqual(f.calls, []); assert.deepEqual(f.writes, []);
  }
});

test("new-release checking reads metadata only and rejects incomplete, mismatched or incompatible releases", async () => {
  const valid = fixture();
  const update = await valid.service.check();
  assert.equal(update.version, target.version); assert.equal(valid.requests.length, 2);
  assert.deepEqual(valid.calls, []); assert.deepEqual(valid.writes, []);
  for (const options of [
    { metadata: { ...metadata, assets: [] } }, { metadata: { ...metadata, prerelease: true } },
    { manifest: { ...target, id: "another-plugin" } }, { manifest: { ...target, version: "2.0.0" } },
    { manifest: { ...target, minAppVersion: "99.0.0" } }, { mobile: true, manifest: { ...target, isDesktopOnly: true } },
  ]) {
    const f = fixture(options);
    await assert.rejects(f.service.check()); assert.deepEqual(f.writes, []); assert.deepEqual(f.calls, []);
  }
});

test("approved update replaces only the three managed code assets after downloading all of them", async () => {
  const f = fixture(), beforeData = f.files.get(`${directory}/data.json`);
  const update = await f.service.check();
  await f.service.install(update);
  assert.deepEqual(f.writes, assets.map((name) => `${directory}/${name}`));
  assert.deepEqual(f.calls, ["save", "unload", "manifest", "load:1.17.24", "reopen"]);
  assert.equal(f.files.get(`${directory}/data.json`), beforeData); assert.equal(f.files.get("Learning/device.json"), "learning data");
  assert.equal(JSON.parse(f.files.get(`${directory}/manifest.json`)).version, target.version);
  assert.deepEqual(f.removed, []);
});

test("a failed download leaves all local files and the running plugin untouched", async () => {
  const f = fixture({ downloadFailure: true }), before = [...f.files];
  const update = await f.service.check();
  await assert.rejects(f.service.install(update), /offline/);
  assert.deepEqual([...f.files], before); assert.deepEqual(f.writes, []); assert.deepEqual(f.calls, []);
});

test("write or load failures restore the previous code and loader without persistent backup files", async () => {
  for (const failure of [{ writeFailure: true }, { loadFailure: true }]) {
    const f = fixture(failure), before = [...f.files];
    const update = await f.service.check();
    await assert.rejects(f.service.install(update));
    assert.deepEqual([...f.files], before);
    assert.ok(f.calls.includes("load:1.17.23"));
    assert.ok(f.writes.every((path) => assets.some((name) => path === `${directory}/${name}`)));
  }
});

test("rollback removes only newly-created styles when the original plugin had no stylesheet", async () => {
  const f = fixture({ loadFailure: true }); f.files.delete(`${directory}/styles.css`);
  const before = [...f.files], update = await f.service.check();
  await assert.rejects(f.service.install(update));
  assert.deepEqual([...f.files], before); assert.deepEqual(f.removed, [`${directory}/styles.css`]);
});

test("development folders are protected from self-updates but can still reload", async () => {
  const f = fixture({ local: { dir: ".obsidian/plugins/lexis-local" } });
  const update = await f.service.check(), count = f.requests.length;
  await assert.rejects(f.service.install(update), (error) => error.key === "maintenance.development");
  assert.equal(f.requests.length, count); assert.deepEqual(f.writes, []); assert.deepEqual(f.calls, []);
  await f.service.reload(); assert.ok(f.calls.includes("load:1.17.23"));
});

test("failed restoration is reported instead of claiming success or deleting learning data", async () => {
  const f = fixture({ writeFailure: true, restoreFailure: true });
  const update = await f.service.check();
  await assert.rejects(f.service.install(update), (error) => error.key === "maintenance.restoreFailed");
  assert.equal(f.files.get(`${directory}/data.json`), "personal settings and token");
  assert.equal(f.files.get("Learning/device.json"), "learning data");
});

test("a stalled native request times out and clears its timer", async () => {
  const cleared = [];
  const f = fixture({ requestUrl: () => new Promise(() => {}), window: { setTimeout(callback, delay) { assert.equal(delay, 15000); setImmediate(callback); return 1; }, clearTimeout(id) { cleared.push(id); } } });
  const service = new f.PluginMaintenance(f.host);
  await assert.rejects(service.check(), (error) => error.key === "maintenance.timeout");
  assert.deepEqual(cleared, [1]); assert.deepEqual(f.writes, []);
});

test("pending learning writes cancel reload and installation before unloading or asset writes", async () => {
  const f = fixture({ pendingData: true }), before = [...f.files];
  await assert.rejects(f.service.reload(), /pending data/);
  const update = await f.service.check();
  await assert.rejects(f.service.install(update), /pending data/);
  assert.deepEqual(f.calls, ["save", "save"]); assert.deepEqual([...f.files], before); assert.deepEqual(f.writes, []);
});
