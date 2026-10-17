import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build, transform } from "esbuild";
import { fixtureReport, withChromeFixture } from "./helpers/chrome-fixture.mjs";

const artifacts = process.env.LEXIS_LAYOUT_ARTIFACTS;
const bundle = await build({ entryPoints: ["tests/fixtures/settings-layout-checks.ts"], bundle: true, write: false, format: "iife",
  plugins: [{ name: "settings-fixture", setup(api) {
    api.onResolve({ filter: /^obsidian$/ }, () => ({ path: resolve("tests/fixtures/settings-layout-obsidian.js") }));
  } }],
});
const css = await readFile("styles.css", "utf8");
assert.deepEqual((await transform(css, { loader: "css" })).warnings, []);
const base = `:root{--text-normal:#333;--text-muted:#777;--text-faint:#aaa;--background-primary:#fff;--background-secondary:#f2f2f2;--background-modifier-border:#ddd;--background-modifier-border-hover:#ddd;--background-modifier-hover:rgba(0,0,0,.06);--font-ui-small:14px;--font-semibold:600;--text-accent:#8668db;--text-on-accent:#fff;--interactive-accent:#8668db;--radius-s:4px}
  @media(prefers-color-scheme:dark){:root{--text-normal:#e6e6e6;--text-muted:#bbb;--text-faint:#999;--background-primary:#202022;--background-secondary:#2a2a30;--background-modifier-border:#555;--background-modifier-border-hover:#555;--background-modifier-hover:rgba(255,255,255,.1)}}
  *{box-sizing:border-box}body{margin:0;padding:18px;font:16px/1.4 system-ui;background:var(--background-primary);color:var(--text-normal)}
  .mod-settings details{padding:11px;margin-left:11px}summary{font-size:28px;border-bottom:3px solid #ddd}
  .setting-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #ddd}
  .setting-item-info{flex:1;min-width:0}.setting-item-description{font-size:13px;color:var(--text-muted)}
  .setting-item-control{display:flex;align-items:center;justify-content:flex-end;gap:8px}.checkbox-container{width:36px;height:24px;flex:none}`;
const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${base}</style><style>${css}</style></head><body class="mod-settings"><script>globalThis.__lexisKeepLayout = ${!!artifacts};</script><script>${bundle.outputFiles[0].text}</script></body></html>`;
if (artifacts) await mkdir(artifacts, { recursive: true });
await withChromeFixture(html, async (cdp, url) => {
  for (const width of [380, 720, 1100]) for (const mode of ["light", "dark"]) {
    const result = await fixtureReport(cdp, url, { width, mode });
    assert.equal(result.ok, true, `${width}px ${mode}: ${result.error}\nPassed: ${result.checks?.join(", ")}`);
    if (artifacts) {
      const image = await cdp("Page.captureScreenshot", { format: "png" });
      await writeFile(join(artifacts, `layout-${width}-${mode}.png`), Buffer.from(image.data, "base64"));
    }
    console.log(JSON.stringify({ ...result, screenshot: artifacts ? join(artifacts, `layout-${width}-${mode}.png`) : undefined }));
  }
});
