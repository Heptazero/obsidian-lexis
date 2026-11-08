import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { build } from "esbuild";

const popup = await readFile("pkg/browser-extension/popup-manual-term.js", "utf8");

function fixture(pageUrl) {
  const context = { URL };
  vm.runInNewContext(popup, context);
  const field = () => {
    const label = {};
    return { value: "", closest: () => label };
  };
  const folder = field();
  folder.options = [];
  Object.defineProperty(folder, "textContent", { set() { this.options = []; this.value = ""; } });
  folder.appendChild = (option) => { folder.options.push(option); folder.value ||= option.value; };
  const fields = { term: field(), aliases: field(), definition: field(), folder, includeSource: field() };
  const calls = [], button = {}, status = {};
  let submitForm;
  const form = {
    elements: { namedItem: key => fields[key] },
    querySelector: selector => selector === "button" ? button : status,
    addEventListener: (_, listener) => { submitForm = listener; },
  };
  const root = { querySelector: () => form, addEventListener() {}, ownerDocument: { createElement: () => ({}) } };
  const control = context.LexisPopupManualTerm.mount(root, {
    pageUrl, lastFolder: "Science", submit: async value => { calls.push(value); return { ok: true }; }, onSaved() {},
  });
  return { control, fields, calls, button, status, submit: () => submitForm({ preventDefault() {} }) };
}

test("manual add uses writable dictionaries and attaches the active page only by opt-in", async () => {
  const f = fixture("https://example.test/article#methods");
  f.control.update({ collections: [{ name: "Read only", folder: "" }, { name: "Vocabulary", folder: "Words" }, { name: "Science", folder: "Science" }] });
  assert.equal(f.fields.folder.options.length, 2);
  assert.equal(f.fields.folder.value, "Science");
  assert.equal(f.fields.includeSource.checked, false);
  f.fields.term.value = "  field  ";
  await f.submit();
  assert.equal(f.calls[0].term, "field");
  assert.equal(f.calls[0].sourceUrl, "");
  f.fields.term.value = "kernel";
  f.fields.includeSource.checked = true;
  await f.submit();
  assert.equal(f.calls[1].sourceUrl, "https://example.test/article#methods");
  assert.equal(f.fields.includeSource.checked, false);
});

test("on restricted pages the source is unavailable but adding a term still works", async () => {
  const f = fixture("chrome://extensions");
  assert.equal(f.fields.includeSource.disabled, true);
  f.control.update(null);
  assert.equal(f.button.disabled, true);
  f.control.update({ dicts: ["Words"] });
  assert.equal(f.fields.folder.closest("label").hidden, true);
  f.fields.term.value = "term";
  await f.submit();
  assert.equal(f.calls[0].sourceUrl, "");
});

test("manual add bridge rejects unauthorized requests and shares the Obsidian save path", async () => {
  const bundle = await build({ entryPoints: ["src/bridge-server.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  const { createBridgeServer } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
  const calls = [];
  const Bridge = createBridgeServer({ Notice: class {}, Platform: {} });
  const bridge = new Bridge({
    settings: { bridgeToken: "fixture" },
    saveManualTerm: async (draft) => { calls.push(draft); },
    bridgeAddWord: async () => ({ ok: true, legacy: true }),
  });
  bridge.readBody = async () => ({ term: "field", folder: "Words", aliases: "domain", definition: "description", sourceUrl: "https://example.test/" });
  const request = async (url, token) => {
    const result = {};
    await bridge.handle({ method: "POST", url, headers: { "x-lexis-token": token } }, {
      writeHead: status => { result.status = status; },
      end: body => { result.body = JSON.parse(body); },
    });
    return result;
  };
  assert.equal((await request("/manual-add", "wrong")).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await request("/manual-add", "fixture")).body.ok, true);
  assert.deepEqual(calls[0], await bridge.readBody());
  assert.equal((await request("/add", "fixture")).body.legacy, true);
});
