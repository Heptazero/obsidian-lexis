import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { withChromeFixture, fixtureReport } from "./helpers/chrome-fixture.mjs";

const bundle = await build({ stdin: { contents: `
  import { addSelectionPillPosition } from './src/settings-selection-pill';
  import { Setting } from './tests/fixtures/settings-layout-obsidian.js';
  import { DEFAULT_SETTINGS } from './src/default-settings';
  import { createI18n } from './src/i18n';
  Setting.prototype.addExtraButton=Setting.prototype.addButton;
  const proto=HTMLElement.prototype;
  proto.createEl=function(tag,options={}){const n=document.createElement(tag);n.className=options.cls||'';n.textContent=options.text||'';if(options.type)n.type=options.type;this.appendChild(n);return n};
  proto.createSpan=function(options){return this.createEl('span',options)};
  proto.createDiv=function(options){return this.createEl('div',options)};
  const box=document.getElementById('box');let writes=0;
  const settings={...DEFAULT_SETTINGS,selectionPillScale:1.25};
  addSelectionPillPosition(box,{Setting,settings,t:createI18n(()=> 'zh').t,save:async()=>{writes++}});
  const checks=[],check=(v,name)=>{if(!v)throw Error(name);checks.push(name)};
  const input=box.querySelector('input[type=range]'),preview=box.querySelector('.lexis-pill-position-handle');
  check(writes===0&&input.value==='125','opening restores saved size without writing defaults');
  check(preview.offsetWidth===120,'Obsidian preview scales proportionally');
  input.value='150';input.dispatchEvent(new Event('input'));
  check(writes===0&&preview.offsetWidth===144,'Obsidian resizing previews without saving each movement');
  input.dispatchEvent(new Event('change'));
  check(writes===1&&settings.selectionPillScale===1.5,'Obsidian saves the completed size change');
  const pill=document.createElement('div');pill.className='lexis-sel-pill';pill.innerHTML='<span class="lexis-sel-pill-btn">＋</span><span class="lexis-sel-pill-btn">词典</span>';document.body.appendChild(pill);
  const old=pill.getBoundingClientRect();pill.style.setProperty('--lexis-pill-scale','1.5');
  check(getComputedStyle(pill).fontSize==='18px'&&pill.getBoundingClientRect().width>old.width*1.4,'real Obsidian pill font and padding grow together');
  check(document.documentElement.scrollWidth<=innerWidth,'settings stay within a narrow viewport');
  document.getElementById('layout-result').textContent=JSON.stringify({width:innerWidth,mode:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',ok:true,checks});
` , resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, format: "iife" });
const css = await readFile("styles.css", "utf8");
const html = `<html><head><style>body{margin:12px;font:13px system-ui} :root{--interactive-accent:#7c5cff;--text-on-accent:white;--background-modifier-border:#bbb;--radius-m:8px;--text-selection:#ddd}input{max-width:100%;box-sizing:border-box}</style><style>${css}</style></head><body><div id="box"></div><pre id="layout-result" hidden></pre><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`;
await withChromeFixture(html, async (cdp, url) => {
  for (const mode of ["light", "dark"]) {
    const report = await fixtureReport(cdp, url, { width: 320, mode });
    assert.equal(report.ok, true);
    console.log(JSON.stringify(report));
    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(`/tmp/lexis-ob-pill-size-${mode}.png`, Buffer.from(shot.data, "base64"));
  }
});
