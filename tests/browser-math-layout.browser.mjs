import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { withChromeFixture } from "./helpers/chrome-fixture.mjs";
import { obsidianMathJax } from "./helpers/obsidian-mathjax.mjs";
import { build } from "esbuild";

const { script, fonts } = await obsidianMathJax();
const css = await readFile("pkg/browser-extension/popover.css", "utf8");
const core = await readFile("pkg/browser-extension/content-core.js", "utf8");
const installer = core.slice(core.indexOf('let mathCssInstalled'), core.indexOf('const esc ='));
const exporter = (await build({entryPoints:['src/bridge-math-css.ts'], bundle:true,write:false,format:'iife',globalName:'MathCss'})).outputFiles[0].text;
const html = '<!doctype html><html><head></head><body></body></html>';
await withChromeFixture(html, async (cdp, url) => {
  await cdp('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
  await cdp("Page.navigate", { url });
  await cdp("Runtime.evaluate", { expression: 'window.MathJax = {loader:{paths:{"mathjax-tex":"/lib/mathjax/tex-font","mathjax-mhchem-extension":"/lib/mathjax/mhchem-font-extension"}},output:{font:"mathjax-tex",fontExtensions:["mathjax-mhchem"]},tex:{packages:["base","ams","newcommand","noundefined"]},startup:{typeset:false},options:{enableMenu:false,enableEnrichment:false,enableExplorer:false}}' });
  const load = await cdp("Runtime.evaluate", { expression: script });
  assert.ok(!load.exceptionDetails, load.exceptionDetails?.text);
  await cdp("Runtime.evaluate", {expression: installer + '\n' + exporter});
  const setup = await cdp("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
    await MathJax.startup.promise;
    const sources = [String.raw\`\\text{logit}(p)=\\ln(\\text{odds})=\\ln\\frac{p}{1-p}\`, String.raw\`\\sum_{i=1}^n x_i^2+\\sqrt{\\frac{1}{x}}\`, String.raw\`\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\`];
    const formulas = [];
    // Match Obsidian's synchronous conversion, followed by chtmlStylesheet().
    for (const source of sources) formulas.push(MathJax.tex2chtml(source, {display:true}).outerHTML);
    const fonts = ${JSON.stringify(fonts)};
    const generated = MathJax.chtmlStylesheet(); document.head.append(generated);
    const rawCss = [...generated.sheet.cssRules].map(rule=>rule.cssText).join('\\n');
    const exportCss = MathCss.createMathCssExporter(async (url) => {
      const font = fonts[url.split('/').pop()]; if (!font) throw Error('missing offline font'); return font;
    });
    const mathDocument = {baseURI:'app://obsidian.md/index.html', getElementById:() => generated};
    const mathCss = await exportCss(mathDocument);
    // Native reference fonts have separate names: they cannot accidentally make
    // the shadow fixture pass by registering the browser's missing MJX fonts.
    const nativeCss = mathCss.replace(/font-family:([^;}]+)/g, (_, family) => 'font-family:' + family.replace(/MJX[\\w-]+/g, 'Native-$&'));
    const style = document.createElement('style'); style.textContent = nativeCss; document.head.append(style);
    generated.remove();
    window.mathCss = mathCss;
    const host = document.createElement('lexis-web-popover'); document.body.append(host);
    window.root = host.attachShadow({mode:'open'});
    const cardSheet = new CSSStyleSheet(); cardSheet.replaceSync(${JSON.stringify(css)});
    root.adoptedStyleSheets = [cardSheet];
    await installMathCss(root, mathCss);
    const markup = '<div class="lexis-web-pop-content">' + formulas.map((formula) => '<p><span class="math math-block is-loaded">' + formula + '</span></p>').join('') + '</div>';
    root.innerHTML = '<div class="lexis-web-pop"><div class="lexis-web-pop-scroll">' + markup + '</div><div class="lexis-web-resize"></div></div>';
    const reference = document.createElement('div'); reference.id='reference'; reference.style.cssText='position:absolute;left:650px;top:0;font:14px/1.5 sans-serif;width:400px'; reference.innerHTML=markup;document.body.append(reference);
    const oldHost = document.createElement('lexis-old-popover'); document.body.append(oldHost); oldHost.style.cssText='left:650px;top:400px';
    window.oldRoot = oldHost.attachShadow({mode:'open'});
    const oldSheet = new CSSStyleSheet(); oldSheet.replaceSync(rawCss);
    oldRoot.adoptedStyleSheets = [cardSheet,oldSheet]; oldRoot.innerHTML = root.innerHTML;
    await document.fonts.ready;
    return {ok:true, version:MathJax.version};
  })()` });
  assert.ok(!setup.exceptionDetails, setup.exceptionDetails?.exception?.description);
  for (const size of [12, 20, 32]) {
    const result = await cdp("Runtime.evaluate", { awaitPromise:true, returnByValue: true, expression: `(async () => {
      const size = ${size};
      root.querySelector('.lexis-web-pop').style.setProperty('--lexis-popover-font-size', size+'px');
      oldRoot.querySelector('.lexis-web-pop').style.setProperty('--lexis-popover-font-size', size+'px');
      const reference = document.getElementById('reference'); reference.style.fontSize=size+'px';
      await document.fonts.ready;
      const geometry = (parent) => [...parent.querySelectorAll('mjx-container')].map((container) => {
        const origin=container.querySelector('mjx-math').getBoundingClientRect();
        return [...container.querySelectorAll('mjx-math, mjx-c, mjx-num, mjx-den')].map((node) => {
          const rect=node.getBoundingClientRect(); return {tag:node.tagName,x:rect.x-origin.x,y:rect.y-origin.y,width:rect.width,height:rect.height};
        });
      });
      const faces=[...document.fonts].filter(face=>face.family.startsWith('Lexis-'));
      const first = mathFonts.size; await installMathCss(root, mathCss);
      const used = [...new Set([...root.querySelectorAll('mjx-container, mjx-container *')].flatMap(node=>getComputedStyle(node).fontFamily.split(',').map(name=>name.trim().replace(/["']/g,''))).filter(name=>name.startsWith('Lexis-')))];
      return {browser:geometry(root), old:geometry(oldRoot), native:geometry(reference), fonts:faces.filter(face=>used.includes(face.family)).map(face=>({family:face.family,status:face.status})), reused:first === mathFonts.size, family:getComputedStyle(root.querySelector('mjx-math')).fontFamily};
    })()` });
    assert.ok(!result.exceptionDetails, result.exceptionDetails?.exception?.description);
    const report=result.result.value;
    assert.ok(report.fonts.length > 0 && report.fonts.every(face=>face.status === 'loaded'), 'embedded math fonts must actually load in a shadow root');
    assert.ok(report.family.includes('Lexis-') && report.reused, 'private fonts are reused, independent of page MathJax');
    assert.ok(report.native.some((nodes,i)=>nodes.some((node,j)=>Math.abs(node.width-report.old[i][j].width)>1 || Math.abs(node.y-report.old[i][j].y)>1)), 'legacy app-only font URLs reproduce incorrect glyph geometry');
    for (let i=0;i<report.native.length;i++) {
      assert.equal(report.browser[i].length,report.native[i].length);
      report.native[i].forEach((node,index) => {
        for (const key of ['x','y','width','height']) assert.ok(Math.abs(node[key]-report.browser[i][index][key]) < 1, size+'px formula '+i+' '+node.tag+' '+key+' differs from native');
      });
    }
  }
  const screenshot = await cdp("Page.captureScreenshot", {format:"png"});
  await writeFile("/tmp/lexis-browser-math-layout.png", Buffer.from(screenshot.data,"base64"));
  console.log('MathJax '+setup.result.value.version+': fractions, indices, roots and matrices match native geometry at 12/20/32px; embedded private fonts load and are reused.');
});
