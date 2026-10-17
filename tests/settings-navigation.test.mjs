import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/settings-navigation-model.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { SETTINGS_TABS, reorderVisibleSections, settingsTabForSection, settingsTabGroups } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("every actual top-level settings section belongs to exactly one tab", async () => {
  const files = ["settings-tab", "settings-storage-section", "settings-highlight-section", "settings-inline-section", "settings-reader-section"];
  const sources = await Promise.all(files.map((name) => readFile(`src/${name}.ts`, "utf8")));
  const actual = sources.flatMap((source) => [...source.matchAll(/topSection\("([^"]+)"/g)].map((match) => match[1]));
  const grouped = SETTINGS_TABS.flatMap((tab) => [...tab.sections]);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual([...actual].sort(), [...grouped].sort());
});

test("six default groups and custom names retain stable identities and reject duplicate custom ids", () => {
  const groups = settingsTabGroups([{ id: "custom-one", name: " Mine " }, { id: "custom-one", name: "Duplicate" }, { id: "general", name: "Invalid" }], { reading: "Style" }, (key) => key);
  assert.equal(SETTINGS_TABS.length, 6);
  assert.equal(groups.length, 7);
  assert.equal(groups.find((group) => group.id === "reading").name, "Style");
  assert.equal(groups.at(-1).name, "Mine");
  assert.equal(settingsTabForSection("data", { data: "custom-one" }, groups), "custom-one");
  assert.equal(settingsTabForSection("mobile", {}), "other");
});

test("moving sections changes their tab without duplicating or losing default ownership", () => {
  assert.equal(settingsTabForSection("data", {}), "general");
  assert.equal(settingsTabForSection("data", { data: "reading" }), "reading");
  assert.equal(settingsTabForSection("data", { data: "unknown-tab" }), "general");
  assert.equal(settingsTabForSection("marginnote", { data: "reading" }), "integrations");
});

test("reordering one tab preserves other tabs and the existing global order", () => {
  const order = ["dictionary", "data", "inline", "review", "general", "highlight", "mobile"];
  assert.deepEqual(reorderVisibleSections(order, ["inline", "dictionary"]),
    ["inline", "data", "dictionary", "review", "general", "highlight", "mobile"]);
  assert.deepEqual(reorderVisibleSections(order, ["mobile", "general", "data"]),
    ["dictionary", "mobile", "inline", "review", "general", "highlight", "data"]);
  assert.deepEqual(reorderVisibleSections(order, []), order);
});
