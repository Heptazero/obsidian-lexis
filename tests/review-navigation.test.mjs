import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/review-navigation.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
const context = { module: { exports: {} }, require: () => ({ parseLinktext: (link) => {
  const index = link.indexOf("#"); return { path: index < 0 ? link : link.slice(0, index), subpath: index < 0 ? "" : link.slice(index) };
} }) };
vm.runInNewContext(bundle.outputFiles[0].text, context);
const { ReviewNavigation, internalReviewLink, openReviewCardSource } = context.module.exports;

function fixture(mode = "current", found = true) {
  const calls = [];
  const file = { path: "Words/A.md" };
  const current = { openFile: async (file, state) => calls.push(["current", file, state]) };
  const next = { openFile: async (file, state) => calls.push(["tab", file, state]) };
  const app = { metadataCache: { getFirstLinkpathDest: () => found ? file : null }, workspace: {
    getLeaf: (type) => { calls.push(["getLeaf", type]); return next; }, revealLeaf: async (leaf) => calls.push(["reveal", leaf]),
    setActiveLeaf: (leaf) => calls.push(["active", leaf]), openLinkText: async (...args) => calls.push(["missing", ...args]),
  } };
  let listener;
  const navigation = new ReviewNavigation({ app, leaf: current, mode: () => mode, sourcePath: () => "Cards/Source.md",
    saveSession: () => calls.push(["save"]), failed: (error) => calls.push(["failure", error]),
  }, { registerDomEvent: (_element, _event, callback, options) => { assert.equal(options.capture, true); listener = callback; } }, {});
  const host = { app, leaf: current, mode: () => mode, sourcePath: () => "Cards/Source.md", saveSession: () => calls.push(["save"]) };
  return { navigation, calls, current, file, listener, host };
}

test("review links open on the current leaf and save the session before navigation", async () => {
  const { navigation, calls, file } = fixture();
  await navigation.openLink("A#Heading");
  assert.equal(calls[0][0], "save");
  assert.equal(calls[1][0], "current");
  assert.equal(calls[1][1], file);
  assert.equal(calls[1][2].eState.subpath, "#Heading");
  assert.equal(calls.some(([kind]) => kind === "getLeaf"), false);
});

test("only the explicit new-tab choice creates another leaf", async () => {
  const { navigation, calls } = fixture("tab");
  await navigation.openLink("A");
  assert.deepEqual(calls.slice(0, 2), [["save"], ["getLeaf", "tab"]]);
  assert.equal(calls[2][0], "tab");
});

test("source arrows use the current leaf and position syntax cards even at the first source line", async () => {
  const { host, calls, current, file } = fixture();
  current.view = { editor: { setCursor: (position) => calls.push(["cursor", position]), scrollIntoView: (range, center) => calls.push(["scroll", range, center]) } };
  await openReviewCardSource(host, { file, line: 0 });
  assert.equal(calls[0][0], "save"); assert.equal(calls[1][0], "current");
  assert.equal(calls.find(([kind]) => kind === "cursor")[1].line, 0);
  assert.equal(calls.find(([kind]) => kind === "scroll")[2], true);
  assert.equal(calls.some(([kind]) => kind === "getLeaf"), false);
  const next = fixture("tab");
  next.host.app.workspace.getLeaf = () => ({ openFile: async () => next.calls.push(["tab"]), view: {} });
  await openReviewCardSource(next.host, { file: next.file });
  assert.equal(next.calls[1][0], "tab");
});

test("unknown notes use Obsidian's internal creation path, never an external app", async () => {
  const { navigation, calls, current } = fixture("current", false);
  await navigation.openLink("New note");
  assert.equal(calls[0][0], "save");
  assert.deepEqual(calls[1], ["active", current]);
  assert.deepEqual(calls[2], ["missing", "New note", "Cards/Source.md", false]);
  await assert.rejects(navigation.openLink("remnote://123"), /Invalid internal/);
});

test("data-href wins over a malformed native URL and ordinary external links are untouched", async () => {
  const link = { getAttribute: (name) => ({ "data-href": "A", href: "remnote://bad" })[name] || null };
  assert.equal(internalReviewLink({ closest: () => link }), "A");
  assert.equal(internalReviewLink({ closest: () => null }), null);
  const { listener, calls } = fixture();
  let prevented = false, stopped = false;
  listener({ composedPath: () => [{ nodeType: 1, closest: () => link }], preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => { stopped = true; } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(prevented && stopped, true);
  assert.equal(calls[1][0], "current");
});

test("the actual review view is navigable and snapshots the complete session for native Back", async () => {
  const result = await build({ entryPoints: ["src/review-view.ts"], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
  const native = { ItemView: class { constructor(leaf) { this.leaf = leaf; } } };
  const env = { module: { exports: {} }, require: () => native };
  vm.runInNewContext(result.outputFiles[0].text, env);
  let stored;
  const plugin = { saveReviewSession: (leaf, state) => { stored = { leaf, state }; } };
  const leaf = {};
  const ReviewView = env.module.exports.createReviewView({ reviewViewType: "lexis-review-view", todayStr: () => "2026-10-13", renderLexisMarkdown() {} });
  const view = new ReviewView(leaf, plugin);
  view.queue = [{ file: { path: "A.md" } }]; view.pos = 0; view.reviewed = 3; view.revealed = true;
  view.undoStack = [{ eventId: "event" }]; view.options = { scope: "current" };
  view.saveSession();
  assert.equal(view.navigation, true);
  assert.equal(stored.leaf, leaf);
  assert.equal(stored.state.queue, view.queue);
  assert.equal(stored.state.revealed, true);
  assert.equal(stored.state.reviewed, 3);
  assert.equal(stored.state.undoStack, view.undoStack);
  assert.equal(stored.state.options, view.options);
  view.reviewed = 7;
  await view.onClose();
  assert.equal(stored.state.reviewed, 7, "native Back/Forward transitions also snapshot the latest session");
});
