import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { withChromeFixture, delay } from "./helpers/chrome-fixture.mjs";

const math = await readFile("pkg/browser-extension/content-math.js", "utf8");
const page = await readFile("pkg/browser-extension/math-source-page.js", "utf8");
const html = '<!doctype html><html><body><div id="fixture"></div></body></html>';
await withChromeFixture(html, async (cdp, url) => {
  // Deliberately separate worlds: the reader cannot see window.MathJax.
  await cdp("Page.enable");
  await cdp("Page.navigate", { url });
  for (let attempt = 0; attempt < 50; attempt++) {
    const ready = await cdp("Runtime.evaluate", { expression: "!!document.getElementById('fixture')", returnByValue: true });
    if (ready.result.value) break;
    await delay(50);
  }
  await cdp("Runtime.evaluate", { expression: page });
  let context;
  for (let attempt = 0; attempt < 50 && !context; attempt++) {
    const frame = (await cdp("Page.getFrameTree")).frameTree.frame.id;
    context = (await cdp("Page.createIsolatedWorld", { frameId: frame, worldName: "lexis-test-isolated" })).executionContextId;
  }
  await cdp("Runtime.evaluate", { expression: math, contextId: context });
  const setup = await cdp("Runtime.evaluate", { expression: `(() => {
    const root = document.getElementById("fixture");
    root.innerHTML = '<p id="katex">First sentence. A term <span class="katex"><span class="katex-html">duplicate x x x</span><span class="katex-mathml"><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^{2}+1.5</annotation></semantics></math></span></span> works.</p><p id="block">Before <span class="katex-display"><span class="katex"><span class="katex-html">display duplicate</span><annotation encoding="application/x-tex">a=1</annotation></span></span> after.</p><p id="mjx">A vector <mjx-container display="true"><svg></svg></mjx-container> is useful.</p><p id="legacy">A legacy <span class="MathJax">duplicate text</span><script type="math/tex">z^{3}</script> formula.</p><p id="repeat">Same. Same with <span data-latex="t=3.14">duplicate</span> works.</p>';
    const item = { typesetRoot: root.querySelector('mjx-container'), inputJax: { name: 'TeX' }, math: String.raw\`\\vec{v}=(1,2)\`, display: true };
    window.MathJax = { startup: { document: { getMathItemsWithin(elements) { window.mathCalls = (window.mathCalls || 0) + 1; return elements[0].contains(item.typesetRoot) ? [item] : []; } } }, typesetPromise() { throw Error('must not typeset'); } };
    const host = document.createElement('div'); root.appendChild(host); window.shadow = host.attachShadow({mode:'open'});
    window.shadow.innerHTML = '<p>Shadow word <span data-tex="x_1">rendered</span> is here.</p>';
    return true;
  })()`, returnByValue: true });
  assert.equal(setup.result.value, true);
  const report = await cdp("Runtime.evaluate", { contextId: context, returnByValue: true, expression: `(() => {
    const checks = [];
    const check = (value, name) => { if (!value) throw Error(name); checks.push(name); };
    try {
      const root = document.getElementById('fixture');
      const original = root.innerHTML;
      const sel = window.getSelection();
      const p = root.querySelector('#katex'), node = p.firstChild;
      const start = node.nodeValue.indexOf('term'); sel.setBaseAndExtent(node,start,node,start+4);
      const savedRange = sel.getRangeAt(0).cloneRange();
      check(LexisWebMath.sentence(p,node,start) === 'A term $x^{2}+1.5$ works.', 'KaTeX TeX source occurs once, punctuation inside TeX does not cut the sentence');
      check(LexisWebMath.sentence(root.querySelector('#block'),root.querySelector('#block').firstChild).includes('\\n\\n$$\\na=1\\n$$\\n\\n'), 'display formulas retain block delimiters and newlines');
      check(typeof window.MathJax === 'undefined', 'isolated reader cannot directly read page MathJax');
      const mjx = root.querySelector('#mjx');
      check(LexisWebMath.sentence(mjx,mjx.firstChild).includes(String.raw\`\\vec{v}=(1,2)\`), 'narrow page-world bridge recovers already-rendered MathJax TeX');
      check(LexisWebMath.sentence(root.querySelector('#legacy'),root.querySelector('#legacy').firstChild) === 'A legacy $z^{3}$ formula.', 'MathJax v2 script is copied once without duplicate output');
      const repeat = root.querySelector('#repeat');
      check(LexisWebMath.sentence(repeat,repeat.firstChild,6) === 'Same with $t=3.14$ works.', 'anchor offset resolves repeated text in the correct sentence');
      const shadow = root.lastChild.shadowRoot.querySelector('p');
      check(LexisWebMath.sentence(shadow,shadow.firstChild,7) === 'Shadow word $x_1$ is here.', 'same serializer handles selectable open-shadow text');
      check(root.innerHTML === original && sel.toString() === 'term' && sel.getRangeAt(0).startContainer === savedRange.startContainer, 'source capture does not rewrite DOM or alter selection');
      const adjacent = document.createElement('p');
      adjacent.innerHTML = '<span data-tex="x">x</span><script type="math/tex">y</script>';
      check(LexisWebMath.sentence(adjacent,adjacent.firstChild) === '$x$ $y$', 'an independent adjacent TeX script is not swallowed as a duplicate');
      const unavailable = document.createElement('p');
      unavailable.innerHTML = '<mjx-container><svg></svg></mjx-container>';
      check(LexisWebMath.sentence(unavailable,unavailable.firstChild).includes('公式源码不可用'), 'unavailable source remains explicit instead of silently dropping an SVG formula');
      return {ok:true, checks};
    } catch(error) { return {ok:false, error:error.message, checks}; }
  })()` });
  assert.ok(!report.exceptionDetails, report.exceptionDetails?.text);
  assert.equal(report.result.value.ok, true, JSON.stringify(report.result.value));
  console.log(JSON.stringify(report.result.value, null, 2));
});
