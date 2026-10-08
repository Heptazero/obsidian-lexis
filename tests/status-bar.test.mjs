import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/status-bar.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { statusBarSummary } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

const t = (key, vars = {}) => {
  if (key === "status.aliases") return ` +${vars.count} aliases`;
  if (key === "status.inline") return ` +${vars.count} inline`;
  if (key === "status.summary") return `${vars.words} entries${vars.aliases}${vars.inline}${vars.due}${vars.bridge}`;
  return key;
};

test("builds the expanded status summary from current index state", () => {
  assert.equal(statusBarSummary({
    settings: { includeAliases: true },
    stats: { words: 12, aliases: 3, inlineEntries: 4, due: 2 },
    bridge: { running: true },
    t,
  }), "12 entries +3 aliases +4 inline · ⏰2 · 🌐");
});

test("omits inactive optional status segments", () => {
  assert.equal(statusBarSummary({
    settings: { includeAliases: false },
    stats: { words: 5, aliases: 3, inlineEntries: 0, due: 0 },
    bridge: null,
    t,
  }), "5 entries");
});
