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
    async append(path, data) { files.set(path, files.get(path) + data); },
    async read(path) { if (!files.has(path)) throw new Error("missing"); return files.get(path); },
    async copy(from, to) { files.set(to, files.get(from)); },
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
  for (const invalid of ["/tmp/Lexis", "../Lexis", "C:\\Lexis", "Lexis/data.json"]) {
    assert.throws(() => encounterFolder(invalid, ".obsidian", "lexis"));
  }
});

test("combines a one-time baseline with per-device daily events without double-counting retries", async () => {
  const io = adapter();
  const folder = ".obsidian/plugins/lexis/encounters";
  await io.mkdir(folder);
  await io.write(`${folder}/baseline.json`, JSON.stringify({ schema: 1, entries: {
    "10_atom/词.md": { encounterCount: 7, hoverCount: 2, lastEncounter: "2026-09-25" },
  } }));
  const macId = "a".repeat(32);
  const windowsId = "b".repeat(32);
  const mac = new EncounterStore(io, folder, macId);
  const windows = new EncounterStore(io, folder, windowsId);
  const event = (id, kind, day) => ({ id, path: "10_atom/词.md", kind, day, at: 1 });
  await mac.append([event("m1", "hover", "2026-09-29")]);
  await windows.append([event("w1", "passive", "2026-09-28")]);
  await mac.append([event("m1", "hover", "2026-09-29")]);
  assert.deepEqual({ ...await mac.load() }, {
    "10_atom/词.md": { encounterCount: 9, hoverCount: 3, lastEncounter: "2026-09-29" },
  });
  assert.equal(io.files.has(`${folder}/${macId}/2026-09-29.jsonl`), true);
  assert.equal(io.files.has(`${folder}/${windowsId}/2026-09-28.jsonl`), true);

  await mac.copyTo("99_assets/Lexis");
  assert.deepEqual({ ...await new EncounterStore(io, "99_assets/Lexis", macId).load() }, { ...await mac.load() });
  assert.equal(io.files.has(`${folder}/baseline.json`), true);
});

test("folder switch copies only encounter data and merges an older daily log", async () => {
  const io = adapter();
  const source = ".obsidian/plugins/lexis/encounters";
  const target = "99_assets/plugin-data/lexis";
  const device = "a".repeat(32);
  await io.mkdir(source);
  await io.mkdir(`${source}/${device}`);
  await io.write(`${source}/baseline.json`, JSON.stringify({ schema: 1, entries: {} }));
  await io.write(`${source}/other-plugin.json`, "not Lexis data");
  await io.mkdir(`${source}/legacy-backup`);
  await io.write(`${source}/legacy-backup/encounters.json`, "old backup");
  const first = { id: "one", path: "10_atom/词.md", kind: "hover", day: "2026-09-29", at: 1 };
  const second = { ...first, id: "two", at: 2 };
  await io.write(`${source}/${device}/2026-09-29.jsonl`, `${JSON.stringify(first)}\n${JSON.stringify(second)}\n`);
  await io.mkdir("99_assets");
  await io.mkdir("99_assets/plugin-data");
  await io.mkdir(target);
  await io.mkdir(`${target}/${device}`);
  await io.write(`${target}/${device}/2026-09-29.jsonl`, `${JSON.stringify(first)}\n`);
  const store = new EncounterStore(io, source, device);
  await store.copyTo(target);
  assert.equal(io.files.has(`${target}/other-plugin.json`), false);
  assert.equal(io.files.has(`${target}/legacy-backup/encounters.json`), false);
  assert.deepEqual((await io.read(`${target}/${device}/2026-09-29.jsonl`)).trim().split("\n").map((line) => JSON.parse(line).id), ["one", "two"]);
  await store.copyTo(target);
  assert.equal((await io.read(`${target}/${device}/2026-09-29.jsonl`)).trim().split("\n").length, 2);

  const nested = `${source}/new-location`;
  await store.copyTo(nested);
  assert.equal(io.files.has(`${nested}/baseline.json`), true);
  assert.equal(io.files.has(`${nested}/other-plugin.json`), false);
});

test("folder switch rejects a destination shared with other files", async () => {
  const io = adapter();
  const source = ".obsidian/plugins/lexis/encounters";
  await io.mkdir(source);
  await io.write(`${source}/baseline.json`, JSON.stringify({ schema: 1, entries: {} }));
  await io.mkdir("99_assets");
  await io.mkdir("99_assets/plugin-data");
  await io.write("99_assets/plugin-data/other-plugin.json", "keep me");
  await assert.rejects(new EncounterStore(io, source, "a".repeat(32)).copyTo("99_assets/plugin-data"), /dedicated/);
  assert.equal(io.files.has("99_assets/plugin-data/baseline.json"), false);
});
