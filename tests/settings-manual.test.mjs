import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/settings-manual-preview.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
// Obsidian calls setPath from this constructor and fails when its path is absent.
class NativeTFile {
  constructor(vault, path) {
    this.vault = vault;
    this.path = path;
    this.name = path.slice(path.lastIndexOf("/") + 1);
  }
}
const context = { module: { exports: {} }, require: () => ({ TFile: NativeTFile }), structuredClone, Date, Map, Set };
vm.runInNewContext(bundle.outputFiles[0].text, context);
const { createManualPreview } = context.module.exports;

test("syntax examples rebind production views to an explicit isolated data source", async () => {
  let actualReads = 0, renderingHost;
  const host = {
    settings: { bridgeToken: "must-not-copy", reviewEvents: [{ id: "real" }] },
    app: { vault: { getAbstractFileByPath() { actualReads++; } } },
    t: (key) => key, buildCurveSVG: () => "svg", occurrenceLabel: (item) => item.file.basename, renderSentence() {},
    renderLexisBlock() { renderingHost = this; }, renderHomeBlock() {}, renderHeatmap() {},
    findTypedRelations() { renderingHost = this; return { out: {}, inc: {} }; },
    renderTypedRelations() {}, renderReverseRelations() {}, renderDerivedWords() {}, relLink() {},
  };
  const original = JSON.stringify(host.settings);
  const { preview, sourcePath, relation, relationMarkdown } = createManualPreview(host);
  await preview.renderLexisBlock(null, null, "curve");
  assert.equal(renderingHost, preview);
  assert.notEqual(preview.settings, host.settings);
  assert.equal(preview.settings.bridgeToken, "");
  assert.equal(preview.app.vault.getAbstractFileByPath(sourcePath).basename, "warm");
  assert.ok(preview.app.vault.getAbstractFileByPath(sourcePath) instanceof NativeTFile);
  assert.equal(preview.app.vault.getAbstractFileByPath(sourcePath).extension, "md");
  assert.equal(preview.app.vault.modify, undefined);
  assert.equal(await preview.app.vault.cachedRead(relation.sourceFile), relationMarkdown);
  assert.equal(await preview.app.vault.cachedRead(relation.targetFile), "");
  assert.equal(preview.app.metadataCache.getFirstLinkpathDest("warm"), relation.targetFile);
  assert.equal(preview.app.metadataCache.resolvedLinks[relation.sourceFile.path][relation.targetFile.path], 1);
  await preview.findTypedRelations(relation.targetFile);
  assert.equal(renderingHost, preview);
  assert.equal(preview.saveSettings, undefined);
  assert.equal(actualReads, 0);
  assert.equal(JSON.stringify(host.settings), original);
  assert.equal(await preview.addExampleToWord(), false);
  assert.equal((await preview.reviewDashboard.load()).today.remaining, 9);
});

test("heading placeholders remain variables in both languages, not literal runnable syntax", async () => {
  const result = await build({ entryPoints: ["src/i18n.ts"], bundle: true, write: false, format: "cjs", platform: "node" });
  const env = { module: { exports: {} } };
  vm.runInNewContext(result.outputFiles[0].text, env);
  for (const [language, placeholder, example] of [["zh", "{{标题}}", "反义词"], ["en", "{{heading}}", "Antonyms"]]) {
    const { t } = env.module.exports.createI18n(() => language);
    assert.ok(t("manual.relationVariable", { example }).includes(`${placeholder} = ${example}`));
    assert.equal(t("manual.relationPlaceholder"), placeholder);
    assert.ok(!t("manual.relations").includes(example));
  }
});

test("syntax demos do not invoke TFile's undocumented vault/path constructor", () => {
  assert.throws(() => new NativeTFile(), TypeError);
  const noop = () => {};
  const host = { t: (key) => key, buildCurveSVG: noop, occurrenceLabel: noop, renderSentence: noop,
    renderLexisBlock: noop, renderHomeBlock: noop, renderHeatmap: noop, renderTypedRelations: noop,
    renderReverseRelations: noop, renderDerivedWords: noop, relLink: noop };
  const { preview, sourcePath } = createManualPreview(host);
  assert.equal(preview.app.vault.getAbstractFileByPath(sourcePath).path, "Lexis-demo/warm.md");
});

test("annotation images follow Obsidian attachment rules even with retired custom settings", async () => {
  const result = await build({ entryPoints: ["src/annotation-images.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
  const env = { module: { exports: {} }, require: () => ({ TFile: class {} }) };
  vm.runInNewContext(result.outputFiles[0].text, env);
  let requested;
  const app = { fileManager: { getAvailablePathForAttachment: async (...args) => { requested = args; return "Attachments/photo.png"; } }, vault: { createBinary: async (path) => path } };
  const path = await env.module.exports.saveAnnotationImage(app, { annotationImageLocation: "custom", annotationImageFolder: "Old" }, { path: "Words/A.md" }, { name: "photo.png", type: "image/png", arrayBuffer: async () => new ArrayBuffer(0) });
  assert.deepEqual(requested, ["photo.png", "Words/A.md"]);
  assert.equal(path, "Attachments/photo.png");
});
