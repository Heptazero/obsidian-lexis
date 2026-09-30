import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const compiled = await build({ entryPoints: ["src/encounter-store.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { EncounterStore, encounterFolder } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

function adapter() {
  const dirs = new Set([".obsidian", ".obsidian/plugins", ".obsidian/plugins/lexis"]);
  const files = new Map();
  return {
    files,
    async exists(path) { return dirs.has(path) || files.has(path); },
    async mkdir(path) { dirs.add(path); },
    async write(path, data) { files.set(path, data); },
    async remove(path) { files.delete(path); },
    async rmdir(path) { dirs.delete(path); },
    async read(path) { if (!files.has(path)) throw new Error("missing"); return files.get(path); },
    async list(path) {
      const prefix = `${path}/`;
      return {
        files: [...files.keys()].filter((name) => name.startsWith(prefix) && !name.slice(prefix.length).includes("/")),
        folders: [...dirs].filter((name) => name.startsWith(prefix) && !name.slice(prefix.length).includes("/")),
      };
    },
  };
}

test("uses vault-relative folders, never a file or an outside path", () => {
  assert.equal(encounterFolder("", ".obsidian", "lexis"), ".obsidian/plugins/lexis/encounters");
  assert.equal(encounterFolder("99_assets/Lexis/", ".obsidian", "lexis"), "99_assets/Lexis");
  for (const invalid of ["/tmp/Lexis", "../Lexis", "C:\\Lexis", "Lexis/data.json"]) assert.throws(() => encounterFolder(invalid, ".obsidian", "lexis"));
});

test("merges device-owned snapshots by latest change and honors deletion", async () => {
  const io = adapter();
  const folder = ".obsidian/plugins/lexis/encounters";
  const macId = "a".repeat(32);
  const windowsId = "b".repeat(32);
  const mac = new EncounterStore(io, folder, macId, "macos");
  const windows = new EncounterStore(io, folder, windowsId, "windows");
  await mac.apply([{ path: "10_atom/词.md", changedAt: 100, encounteredAt: 100, day: "2026-09-28" }]);
  await windows.apply([{ path: "10_atom/词.md", changedAt: 200, encounteredAt: 200, day: "2026-09-29" }]);
  assert.deepEqual({ ...await mac.load() }, { "10_atom/词.md": { encounteredAt: 200, lastEncounter: "2026-09-29" } });
  await mac.apply([{ path: "10_atom/词.md", changedAt: 300, deleted: true }]);
  assert.deepEqual({ ...await windows.load() }, {});
  assert.equal(io.files.has(`${folder}/macos--aaaaaaaa.json`), true);
  assert.equal(io.files.has(`${folder}/windows--bbbbbbbb.json`), true);
});

test("migrates the local plain device ID filename to a readable device filename", async () => {
  const io = adapter();
  const folder = "99_assets/plugin-data/lexis";
  const device = "a".repeat(32);
  await io.mkdir("99_assets");
  await io.mkdir("99_assets/plugin-data");
  await io.mkdir(folder);
  await io.write(`${folder}/${device}.json`, JSON.stringify({ schema: 2, deviceId: device, entries: {
    "10_atom/词.md": { path: "10_atom/词.md", changedAt: 100, encounteredAt: 100, day: "2026-09-30" },
  } }));
  const store = new EncounterStore(io, folder, device, "macos");
  assert.deepEqual({ ...await store.load() }, { "10_atom/词.md": { encounteredAt: 100, lastEncounter: "2026-09-30" } });
  assert.equal(io.files.has(`${folder}/${device}.json`), false);
  assert.equal(io.files.has(`${folder}/macos--aaaaaaaa.json`), true);
});

test("a later active encounter can recreate a previously deleted path", async () => {
  const io = adapter();
  const folder = "99_assets/plugin-data/lexis";
  const mac = new EncounterStore(io, folder, "a".repeat(32));
  const windows = new EncounterStore(io, folder, "b".repeat(32));
  await mac.apply([{ path: "10_atom/词.md", changedAt: 300, deleted: true }]);
  await windows.apply([{ path: "10_atom/词.md", changedAt: 400, encounteredAt: 400, day: "2026-09-30" }]);
  assert.deepEqual({ ...await mac.load() }, { "10_atom/词.md": { encounteredAt: 400, lastEncounter: "2026-09-30" } });
});

test("folder switch copies and merges only device snapshots", async () => {
  const io = adapter();
  const source = ".obsidian/plugins/lexis/encounters";
  const target = "99_assets/plugin-data/lexis";
  const device = "a".repeat(32);
  const store = new EncounterStore(io, source, device);
  await store.apply([{ path: "10_atom/词.md", changedAt: 100, encounteredAt: 100, day: "2026-09-28" }]);
  await io.mkdir("99_assets");
  await io.mkdir("99_assets/plugin-data");
  await io.mkdir(target);
  await io.write(`${target}/${device}.json`, JSON.stringify({ schema: 2, deviceId: device, entries: {
    "10_atom/词.md": { path: "10_atom/词.md", changedAt: 200, encounteredAt: 200, day: "2026-09-29" },
  } }));
  await store.copyTo(target);
  assert.deepEqual({ ...await new EncounterStore(io, target, device).load() }, { "10_atom/词.md": { encounteredAt: 200, lastEncounter: "2026-09-29" } });
  assert.equal(io.files.has(`${target}/${device}.json`), false);
  assert.equal(io.files.has(`${target}/device--aaaaaaaa.json`), true);
  await store.clear();
  assert.equal(await io.exists(source), false);
});

test("folder switch rejects a destination shared with other files", async () => {
  const io = adapter();
  const source = ".obsidian/plugins/lexis/encounters";
  const store = new EncounterStore(io, source, "a".repeat(32));
  await store.apply([{ path: "10_atom/词.md", changedAt: 100, encounteredAt: 100, day: "2026-09-28" }]);
  await io.mkdir("99_assets");
  await io.mkdir("99_assets/plugin-data");
  await io.write("99_assets/plugin-data/other-plugin.json", "keep me");
  await assert.rejects(store.copyTo("99_assets/plugin-data"), /dedicated/);
});
