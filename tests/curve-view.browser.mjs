import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { fixtureReport, withChromeFixture } from "./helpers/chrome-fixture.mjs";

const bundle = await build({ entryPoints: ["tests/fixtures/curve-view-checks.ts"], bundle: true, write: false, format: "iife" });
const nativeCss = await readFile("styles.css", "utf8"), curveCss = await readFile("pkg/browser-extension/popover.css", "utf8");
const controls = await readFile("pkg/browser-extension/curve-controls.js", "utf8");
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{--interactive-accent:#8668db;--text-accent:#8668db;--text-muted:#777;--text-faint:#aaa;--background-primary:#fff;--background-modifier-border:#ddd;--font-ui-small:13px}
@media(prefers-color-scheme:dark){:root{--background-primary:#222;--text-muted:#bbb;--background-modifier-border:#555}body{background:#222;color:#eee}}
body{margin:12px;font:14px system-ui}*{box-sizing:border-box}${nativeCss}</style></head><body><div id="fixture" class="lexis-curve"></div>
<script>const curveCss=${JSON.stringify(curveCss)};</script><script>${controls}</script><script>${bundle.outputFiles[0].text}</script></body></html>`;
await withChromeFixture(html, async (cdp, url) => {
  for (const width of [260, 380, 720]) for (const mode of ["light", "dark"]) {
    const result = await fixtureReport(cdp, url, { width, mode });
    assert.equal(result.ok, true, `${width}px ${mode}: ${result.error}\n${result.checks?.join("\n")}`);
    console.log(JSON.stringify({ width, mode, ok: result.ok, checks: result.checks.length }));
  }
});
