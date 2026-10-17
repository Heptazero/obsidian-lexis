import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build, transform } from "esbuild";
import { fixtureReport, withChromeFixture } from "./helpers/chrome-fixture.mjs";

const css = await Promise.all(["styles.css", "pkg/browser-extension/content.css"].map((path) => readFile(path, "utf8")));
for (const source of css) assert.deepEqual((await transform(source, { loader: "css" })).warnings, []);
const bundle = await build({ entryPoints: ["tests/fixtures/alias-options-checks.ts"], bundle: true, write: false, format: "iife" });
const scripts = await Promise.all([
  "pkg/browser-extension/alias-search.js",
  "pkg/browser-extension/pill-position.js",
  "tests/fixtures/alias-options-browser-setup.js",
  "pkg/browser-extension/content.js",
].map((path) => readFile(path, "utf8")));
scripts.push(bundle.outputFiles[0].text);
const base = `:root{--background-primary:#fff;--background-modifier-border:#ddd;--background-modifier-hover:rgba(0,0,0,.06);--text-normal:#242424;--text-muted:#666;--interactive-accent:#7c5cff;--text-on-accent:#fff;--radius-m:8px;--shadow-s:none}
@media(prefers-color-scheme:dark){:root{--background-primary:#2a2a30;--background-modifier-border:#666;--background-modifier-hover:rgba(255,255,255,.12);--text-normal:#e6e6e6;--text-muted:#b9b9c4}}
body{font:16px system-ui;margin:20px;background:var(--background-primary);color:var(--text-normal)}button{border-radius:15px;background:orange;box-shadow:0 2px 5px black}input{font:inherit}#anchor{position:absolute;top:350px}`;
const html = `<html><head><style>${base}</style>${css.map((source) => `<style>${source}</style>`).join("")}</head><body><p id="source">novel</p><button id="anchor">Obsidian</button>${scripts.map((source) => `<script>${source.replaceAll("</script", "<\\/script")}</script>`).join("")}</body></html>`;
const artifacts = process.env.LEXIS_ALIAS_ARTIFACTS;
if (artifacts) await mkdir(artifacts, { recursive: true });
await withChromeFixture(html, async (cdp, url) => {
  for (const width of [380, 800]) for (const mode of ["light", "dark"]) {
    const result = await fixtureReport(cdp, url, { width, mode, id: "alias-result" });
    assert.equal(result.ok, true, `${width}px ${mode}: ${result.error}\nPassed: ${result.checks.join(", ")}`);
    if (artifacts) {
      const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
      await writeFile(join(artifacts, `alias-${width}-${mode}.png`), Buffer.from(screenshot.data, "base64"));
    }
    console.log(JSON.stringify({ width, mode, ok: result.ok, checks: result.checks.length }));
  }
});
