import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const vault = args.includes("--vault") ? path.resolve(option("--vault")) : "";
const folder = args.includes("--folder") ? option("--folder") : ".obsidian/plugins/lexis/encounters";
const apply = args.includes("--apply");
if (!vault || !folder || path.isAbsolute(folder) || folder.split(/[\\/]/).some((part) => !part || part === ".." || part === ".")) {
  throw new Error("Usage: node scripts/migrate-encounters.mjs --vault /absolute/vault [--folder vault/relative/folder] [--apply]");
}

const pluginDir = path.join(vault, ".obsidian/plugins/lexis");
const settings = JSON.parse(await readFile(path.join(pluginDir, "data.json"), "utf8"));
const dictionaries = (settings.dicts || []).map((item) => String(item.folder || "").replace(/\/+$/, "")).filter(Boolean);
const output = path.join(vault, folder, "baseline.json");
const backupDir = path.join(vault, folder, "legacy-backup");
const sources = (await readdir(pluginDir))
  .filter((name) => name === "encounters.json" || /^encounters\.sync-conflict-.*\.json$/.test(name))
  .map((name) => path.join(pluginDir, name));
if (!sources.some((source) => path.basename(source) === "encounters.json")) throw new Error("Current encounters.json not found");

const files = new Map();
const ignored = new Set([".obsidian", ".git", ".trash", "node_modules", ".venv"]);
async function walk(relative) {
  for (const item of await readdir(path.join(vault, relative), { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (!ignored.has(item.name)) await walk(path.join(relative, item.name));
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".md")) {
      const key = item.name.slice(0, -3).normalize("NFC").toLowerCase();
      const paths = files.get(key) || [];
      paths.push(path.join(relative, item.name).split(path.sep).join("/"));
      files.set(key, paths);
    }
  }
}
await walk("");

const merged = new Map();
for (const source of sources) {
  const snapshot = JSON.parse(await readFile(source, "utf8"));
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error(`Invalid snapshot: ${source}`);
  for (const [name, raw] of Object.entries(snapshot)) {
    if (!raw || typeof raw !== "object") continue;
    const encounters = Number(raw.encounterCount);
    const hovers = Number(raw.hoverCount);
    const day = String(raw.lastEncounter || "");
    if (!Number.isSafeInteger(encounters) || encounters < 0 || !Number.isSafeInteger(hovers) || hovers < 0 || hovers > encounters || (day && !/^\d{4}-\d{2}-\d{2}$/.test(day))) continue;
    const key = name.normalize("NFC").toLowerCase();
    const prior = merged.get(key) || { encounterCount: 0, hoverCount: 0, lastEncounter: "" };
    merged.set(key, {
      encounterCount: Math.max(prior.encounterCount, encounters),
      hoverCount: Math.max(prior.hoverCount, hovers),
      lastEncounter: day > prior.lastEncounter ? day : prior.lastEncounter,
    });
  }
}

const entries = Object.create(null);
let ambiguous = 0, unmatched = 0;
for (const [name, summary] of merged) {
  const paths = files.get(name) || [];
  const dictionaryPaths = paths.filter((candidate) => dictionaries.some((folderPath) => candidate.startsWith(`${folderPath}/`)));
  if (paths.length === 1) entries[paths[0]] = summary;
  else if (dictionaryPaths.length === 1) entries[dictionaryPaths[0]] = summary;
  else if (paths.length > 1) ambiguous++;
  else unmatched++;
}
const report = { sources: sources.length, oldKeys: merged.size, mapped: Object.keys(entries).length, ambiguous, unmatched, output, backupDir, applied: apply };
if (apply) {
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(backupDir, { recursive: true });
  for (const source of sources) {
    const name = path.basename(source).replace("sync-conflict", "conflict");
    const backup = path.join(backupDir, name);
    const original = await readFile(source);
    try { await writeFile(backup, original, { flag: "wx" }); }
    catch (error) {
      if (error?.code !== "EEXIST" || !(await readFile(backup)).equals(original)) throw error;
    }
  }
  await writeFile(output, JSON.stringify({ schema: 1, createdAt: new Date().toISOString(), entries }), { flag: "wx" });
}
process.stdout.write(JSON.stringify(report) + "\n");
