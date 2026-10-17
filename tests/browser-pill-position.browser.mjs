import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { withChromeFixture, delay } from "./helpers/chrome-fixture.mjs";

const root = "pkg/browser-extension";
let html = await readFile(`${root}/popup.html`,"utf8");
const setup = `
const fixtureStore = {cfg:{host:'127.0.0.1',port:12345,token:'',highlight:true},selectionPillOffset:{x:20,y:-30},styleConfig:{dicts:['words'],selectionPillOffsetX:900,selectionPillOffsetY:900}};
const fixtureWrites=[];
globalThis.chrome={
  tabs:{async query(){return []}}, runtime:{async sendMessage(){return {ok:false}}},
  storage:{local:{
    async get(){return structuredClone(fixtureStore)},
    async set(update){fixtureWrites.push(structuredClone(update));Object.assign(fixtureStore,structuredClone(update))},
  }},
};`;
html = html.replace('<h1>',`<script>${setup}</script><h1>`);
for (const match of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]) {
  const source = await readFile(`${root}/${match[1]}`,"utf8");
  html=html.replace(match[0],`<script>${source.replaceAll('</script','<\\/script')}</script>`);
}
await withChromeFixture(html, async(cdp,url)=>{
  await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:1200,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url});
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    assert.ok(!result.exceptionDetails,result.exceptionDetails?.exception?.description);
    return result.result.value;
  };
  for(let n=0;n<100;n++){
    if(await evaluate(`document.querySelector('[data-axis=x]')?.value==='20'`))break;
    await delay(30);
  }
  await evaluate(`(async()=>{document.getElementById('pillPosition').open=true;await new Promise(requestAnimationFrame);})()`);
  const checks = await evaluate(`(async()=>{
    const checks=[],check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name)};
    const box=document.getElementById('pillPosition'),x=box.querySelector('[data-axis=x]'),y=box.querySelector('[data-axis=y]');
    check(x.value==='20'&&y.value==='-30','browser-local offsets restored, not Obsidian offsets');
    check(fixtureWrites.length===0,'opening the panel does not save or migrate settings');
    x.value='-35';x.dispatchEvent(new Event('change'));y.value='40';y.dispatchEvent(new Event('change'));
    check(fixtureStore.selectionPillOffset.x===-35&&fixtureStore.selectionPillOffset.y===40,'numeric changes save only browser-local offsets');
    x.value='';x.dispatchEvent(new Event('change'));check(x.value==='-35','empty input restores the last valid offset');
    const count=fixtureWrites.length,copy=box.cloneNode(true);box.replaceWith(copy);
    LexisPillPositionEditor.mount(copy,fixtureStore.selectionPillOffset,selectionPillOffset=>chrome.storage.local.set({selectionPillOffset}));
    check(copy.querySelector('[data-axis=x]').value==='-35'&&fixtureWrites.length===count,'a fresh panel restores persisted offsets without rewriting them');
    copy.querySelector('.pill-position-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));
    check(fixtureStore.selectionPillOffset.x===-25,'keyboard fine adjustment supports Shift for ten pixels');
    copy.querySelector('.pill-position-reset').click();
    check(fixtureStore.selectionPillOffset.x===0&&fixtureStore.selectionPillOffset.y===0,'reset restores automatic placement');
    check(fixtureWrites.every(update=>Object.keys(update).join()==='selectionPillOffset'),'position editing never writes connection, color or Obsidian data');
    check(fixtureStore.styleConfig.selectionPillOffsetX===900&&fixtureStore.cfg.port===12345,'existing style and connection settings remain unchanged');
    await new Promise(requestAnimationFrame);
    return checks;
  })()`);
  const center = await evaluate(`(()=>{const r=document.querySelector('.pill-position-handle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,writes:fixtureWrites.length,target:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.className}})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:center.x,y:center.y});
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:center.x,y:center.y,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:center.x-30,y:center.y-45,button:'left',buttons:1});
  assert.equal(await evaluate('fixtureWrites.length'),center.writes,'dragging previews without saving every movement');
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:center.x-30,y:center.y-45,button:'left',clickCount:1});
  assert.deepEqual(await evaluate('fixtureStore.selectionPillOffset'),{x:-30,y:-45});
  checks.push('drag follows the pointer and persists once on release');
  const drag = await evaluate(`(()=>{const r=document.querySelector('.pill-position-handle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,writes:fixtureWrites.length}})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:drag.x,y:drag.y,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:drag.x+10,y:drag.y+10,button:'left',buttons:1});
  await evaluate(`document.querySelector('.pill-position-handle').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}))`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:drag.x+10,y:drag.y+10,button:'left',clickCount:1});
  assert.deepEqual(await evaluate('fixtureStore.selectionPillOffset'),{x:-30,y:-45});
  assert.equal(await evaluate('fixtureWrites.length'),drag.writes);
  checks.push('cancelled drag restores the prior position without saving');
  for(const mode of ['light','dark']){
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:mode}]});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'popup fits a narrow viewport');
    const shot=await cdp('Page.captureScreenshot',{format:'png'});
    await writeFile(`/tmp/lexis-pill-position-${mode}.png`,Buffer.from(shot.data,'base64'));
  }
  console.log(JSON.stringify({ok:true,checks},null,2));
});
