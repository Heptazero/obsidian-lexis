import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundle = await build({entryPoints:["src/bridge-math-css.ts"],bundle:true,write:false,format:"cjs"});
const context = {module:{exports:{}}, URL};
vm.runInNewContext(bundle.outputFiles[0].text, context);
const {createMathCssExporter} = context.module.exports;
const document = (...rules) => ({baseURI:"app://obsidian.md/index.html",getElementById:()=>({sheet:{cssRules:rules.map(cssText=>({cssText}))}})});

test("exports app-local MathJax font bytes once, including concurrent detail requests", async () => {
  const calls = [];
  const exportCss = createMathCssExporter(async (url) => {calls.push(url); return "data:font/woff2;base64,AQID";});
  const doc = document('@font-face {font-family:MJX-TEX-N;src:url("/lib/mathjax/tex-font/chtml/woff2/mjx-tex-n.woff2") format("woff2")}',
    'mjx-math {font-family:MJX-TEX-N;line-height:0}');
  const [first, second] = await Promise.all([exportCss(doc), exportCss(doc)]);
  assert.equal(first, second); assert.equal(calls.length,1);
  assert.match(first,/url\("data:font\/woff2;base64,AQID"\)/);
  assert.match(first,/format\("woff2"\)/);
  assert.match(first,/line-height:0/);
  await exportCss(doc); assert.equal(calls.length,1);
});

test("does not fetch remote, vault or non-font URLs and leaves existing data fonts intact", async () => {
  const exportCss = createMathCssExporter(() => {throw Error("must not fetch");});
  const sources=['https://example.org/font.woff2','app://other/lib/mathjax/test.woff2','/vault/private.woff2','/lib/mathjax/script.js','data:font/woff2;base64,AQID'];
  for (const source of sources) {
    const css=`@font-face {src:url('${source}')}`;
    assert.equal(await exportCss(document(css)),css);
  }
  assert.equal(await exportCss({baseURI:"app://obsidian.md/index.html",getElementById:()=>null}),"");
});

test("retries failed font loads without failing a whole detail response and supports legacy woff", async () => {
  let calls = 0;
  const exportCss = createMathCssExporter(async () => {
    if (++calls === 1) throw Error("temporary failure");
    return "data:font/woff;base64,AQID";
  });
  const doc = document('@font-face {font-family:MJXZERO;src:url(/lib/mathjax/output/chtml/fonts/woff-v2/MathJax_Zero.woff)}');
  assert.match(await exportCss(doc),/MathJax_Zero.woff/);
  assert.match(await exportCss(doc),/data:font\/woff;base64/);
  assert.equal(calls,2);
});
