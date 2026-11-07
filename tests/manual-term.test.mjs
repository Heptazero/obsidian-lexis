import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundle = await build({
  stdin: { contents: `export { LexisPluginEntry } from "./src/plugin-entry";
    export * from "./src/manual-term-data";
    export { openManualTerm } from "./src/manual-term-modal";`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"],
});

class Element {
  children = [];
  value = "";
  checked = false;
  events = new Map();
  createEl(tag, options = {}) {
    const el = Object.assign(new Element(), { tag, ...options });
    this.children.push(el);
    return el;
  }
  createSpan(options) { return this.createEl("span", options); }
  createDiv(options) { return this.createEl("div", options); }
  addEventListener(name, action) { this.events.set(name, action); }
  focus() {}
  setText(text) { this.text = text; }
  empty() { this.children.length = 0; }
}

function fixture() {
  const notices = [], opened = [], writes = [], occurrences = [];
  class TFile {}
  class Modal {
    contentEl = new Element();
    setTitle() {}
    open() { this.onOpen(); opened.push(this); }
    close() { this.closed = true; this.onClose(); }
  }
  const context = { module: { exports: {} }, URL,
    require: () => ({
      Plugin: class {}, ItemView: class {}, TFile, Modal, AbstractInputSuggest: class {},
      Notice: class { constructor(text) { notices.push(text); } },
      getFrontMatterInfo(text) {
        const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
        return { exists: !!match, frontmatter: match?.[1], contentStart: match?.[0].length ?? 0 };
      },
      parseYaml: JSON.parse, stringifyYaml: JSON.stringify,
    }),
  };
  vm.runInNewContext(bundle.outputFiles[0].text, context);
  const api = context.module.exports;
  const host = Object.create(api.LexisPluginEntry.prototype);
  Object.assign(host, {
    app: { vault: { getAbstractFileByPath: () => null }, workspace: { getMostRecentLeaf: () => null } },
    settings: { lastSelectionFolder: "Science" },
    t: (key) => key,
    dictFolders: () => ["Words", "Science"],
    index: new Map(),
    resolveIndexKey: (word) => word.toLowerCase(),
    ensureFolder: async () => {},
    templateForFolder: async () => "---\n{\"aliases\":[\"kernel\"],\"tags\":[\"science\"]}\n---\nTemplate: {{word}}",
    renderTemplate: (text, vars) => text.replace("{{word}}", vars.word),
    createEntryFile: async (path, folder, template, transform) => {
      writes.push({ path, folder, content: transform(template) });
      return { basename: path.split("/").pop().replace(/\.md$/, "") };
    },
    insertOccurrence: (content, data) => { occurrences.push(data); return content + "\n\n" + data.source; },
    rebuildIndex: async () => { host.rebuilds = (host.rebuilds ?? 0) + 1; },
  });
  return { api, host, notices, opened, writes, occurrences };
}

const draft = (patch = {}) => ({
  term: "核", aliases: "", definition: "", folder: "Science", sourceUrl: "", ...patch,
});

test("a term alone uses the dictionary template and rebuilds the index without adding an occurrence", async () => {
  const f = fixture();
  await f.host.saveManualTerm(draft());
  assert.equal(f.writes[0].path, "Science/核.md");
  assert.match(f.writes[0].content, /Template: 核$/);
  assert.equal(f.occurrences.length, 0);
  assert.equal(f.host.rebuilds, 1);
});

test("definition, merged aliases and explicit webpage source are stored with no invented excerpt", async () => {
  const f = fixture();
  await f.host.saveManualTerm(draft({ aliases: "Kernel, null space, 核", definition: "**线性映射的核**", sourceUrl: "https://example.test/a(b)?p=1#definition" }));
  const { content } = f.writes[0];
  assert.match(content, /"aliases":\["kernel","null space"\]/);
  assert.match(content, /"tags":\["science"\]/);
  assert.ok(content.includes("**线性映射的核**"));
  assert.equal(f.occurrences[0].sentence, "");
  assert.equal(f.occurrences[0].source, "[example.test](<https://example.test/a(b)?p=1#definition>)");
});

test("an explicitly selected source is not lost if the occurrence template omits the URL", async () => {
  const f = fixture();
  f.host.insertOccurrence = (content) => content;
  await f.host.saveManualTerm(draft({ sourceUrl: "https://example.test/" }));
  assert.match(f.writes[0].content, /\[example.test\]\(<https:\/\/example.test\/>\)/);
});

test("invalid term, removed destination, duplicate and unsafe URL fail before writing", async () => {
  const f = fixture();
  await assert.rejects(f.host.saveManualTerm(draft({ term: "???" })), /invalidWord/);
  await assert.rejects(f.host.saveManualTerm(draft({ folder: "Missing" })), /noDictionary/);
  await assert.rejects(f.host.saveManualTerm(draft({ sourceUrl: "file:///tmp/private" })), /invalidUrl/);
  await assert.rejects(f.host.saveManualTerm(draft({ sourceUrl: "https://user:secret@example.test/" })), /invalidUrl/);
  f.host.index.set("核", { file: { name: "核.md" } });
  await assert.rejects(f.host.saveManualTerm(draft()), /existsNoOpen/);
  assert.deepEqual(f.writes, []);
});

test("prefill only trusts a Web Viewer page and only persists when the checkbox is checked", async () => {
  const f = fixture();
  const url = "https://example.test/current";
  const leaf = (type) => ({ getViewState: () => ({ type, state: { url } }) });
  assert.equal(f.api.currentWebSource(leaf("markdown")), "");
  assert.equal(f.api.currentWebSource(null), "");
  f.host.app.workspace.getMostRecentLeaf = () => leaf("webviewer");
  f.host.dictFolders = () => ["Science"];
  for (const include of [false, true]) {
    f.api.openManualTerm(f.host);
    const modal = f.opened.at(-1);
    const [form] = modal.contentEl.children;
    const [term, , , checkbox, urlLabel] = form.children;
    assert.equal(form.children.some(row => row.children.some(control => control.tag === "select")), false);
    assert.equal(urlLabel.children[0].value, url);
    assert.equal(urlLabel.hidden, true);
    term.children[0].value = "核";
    checkbox.children[0].checked = include;
    checkbox.children[0].onchange();
    assert.equal(urlLabel.hidden, !include);
    form.events.get("submit")({ preventDefault() {} });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(modal.closed, true);
  }
  assert.equal(f.occurrences.length, 1);
  assert.match(f.writes[1].content, /example.test\/current/);
});
