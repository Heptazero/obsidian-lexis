import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/settings-search.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { matchesSettingsSearch } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("global settings search supports Chinese, case-insensitive fuzzy terms and multiple keywords", () => {
  assert.equal(matchesSettingsSearch("联动 MarginNote 词库导出文件夹", "导出"), true);
  assert.equal(matchesSettingsSearch("Integrations MarginNote export folder", "mrgn export"), true);
  assert.equal(matchesSettingsSearch("Review FSRS retention", "fsrs retention"), true);
  assert.equal(matchesSettingsSearch("数据存储 文件夹路径", "数据 路径"), true);
  assert.equal(matchesSettingsSearch("Highlight opacity", "unknown-value"), false);
  assert.equal(matchesSettingsSearch("Highlight opacity", "highlight unknown-value"), false);
  assert.equal(matchesSettingsSearch("Any setting", " "), true);
});
