import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadMigration() {
  const result = await build({ entryPoints: ["src/settings-migration.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("recognizes canonical and legacy plugin directories", async () => {
  const { pluginFolderName } = await loadMigration();
  assert.equal(pluginFolderName(".obsidian/plugins/lexis", "lexis"), "lexis");
  assert.equal(pluginFolderName(".obsidian/plugins/lexis-local/", "lexis"), "lexis-local");
});

test("imports legacy settings once while preserving new review records", async () => {
  const { migrateLegacySettings } = await loadMigration();
  const current = { bridgeToken: "new-token", dicts: [{ folder: "new", template: "" }], reviewHistory: { new: [1] } };
  const legacy = { bridgeToken: "stable-token", dicts: [{ folder: "old", template: "" }], reviewHistory: { old: [2] } };
  const first = migrateLegacySettings(current, legacy);
  assert.equal(first.migrated, true);
  assert.equal(first.settings.bridgeToken, "stable-token");
  assert.deepEqual(first.settings.dicts, legacy.dicts);
  assert.deepEqual(first.settings.reviewHistory, { old: [2], new: [1] });
  assert.equal(first.settings.legacySettingsImported, true);
  assert.equal(migrateLegacySettings(first.settings, legacy).migrated, false);
});
