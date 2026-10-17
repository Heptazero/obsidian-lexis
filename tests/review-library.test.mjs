import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

async function load(entry, obsidian = {}) {
  const built = await build({ entryPoints: [entry], bundle: true, write: false, format: "cjs", platform: "node", external: ["obsidian"] });
  const context = { module: { exports: {} }, require: () => obsidian, console, Date, window: { setTimeout: (callback, delay) => delay === 0 ? setTimeout(callback, 0) : 1, clearTimeout() {} } };
  context.exports = context.module.exports;
  vm.runInNewContext(built.outputFiles[0].text, context);
  return context.module.exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const templates = { inline: "{{question}}::{{answer}}", bidirectional: "{{sideA}}:::{{sideB}}", block: "{{question}}??\n{{answer}}", cloze: "=={{answer}}==" };

test("priority penalty halves every seven days and never changes review schedules", async () => {
  const { effectivePriority, lowerReviewPriority, orderByReviewPriority } = await load("src/review-priority.ts");
  const settings = { reviewPriorities: {}, syntaxCardStates: { a: { s: 5, d: 6, due: "2026-10-13" } } };
  const original = plain(settings.syntaxCardStates);
  lowerReviewPriority(settings, ["syntax:a", "syntax:b"], "2026-10-13T00:00:00Z");
  assert.equal(effectivePriority(settings.reviewPriorities["syntax:a"], Date.parse("2026-10-13T00:00:00Z")), .25);
  assert.equal(effectivePriority(settings.reviewPriorities["syntax:a"], Date.parse("2026-10-20T00:00:00Z")), .625);
  assert.equal(effectivePriority(settings.reviewPriorities["syntax:a"], Date.parse("2026-10-27T00:00:00Z")), .8125);
  const cards = ["a", "c", "d", "e"].map((id) => ({ type: "syntax", file: { path: "file.md" }, card: {}, syntax: { memberIds: [id] } }));
  assert.deepEqual(plain(orderByReviewPriority(cards, settings.reviewPriorities, Date.parse("2026-10-13T00:00:00Z"))).map((item) => item.syntax.memberIds[0]), ["c", "d", "a", "e"]);
  assert.deepEqual(plain(orderByReviewPriority(cards, settings.reviewPriorities, Date.parse("2026-10-27T00:00:00Z"))).map((item) => item.syntax.memberIds[0]), ["a", "c", "d", "e"]);
  assert.deepEqual(plain(settings.syntaxCardStates), original);
  for (const priority of [undefined, { at: "bad", initial: .25 }, { at: "2026-10-13", initial: NaN }]) assert.equal(effectivePriority(priority), 1);
});

test("a failed priority write restores only its own keys, not unrelated or newer changes", async () => {
  const { changeReviewPriority } = await load("src/review-priority.ts");
  const settings = { reviewPriorities: {} };
  await assert.rejects(changeReviewPriority(settings, ["a"], true, async () => {
    settings.reviewPriorities.b = { at: "2026-10-13", initial: .5 };
    throw Error("write failed");
  }));
  assert.equal(settings.reviewPriorities.a, undefined);
  assert.equal(settings.reviewPriorities.b.initial, .5);
  await assert.rejects(changeReviewPriority(settings, ["a"], true, async () => {
    settings.reviewPriorities.a = { at: "2026-10-14", initial: .6 };
    throw Error("write failed");
  }));
  assert.equal(settings.reviewPriorities.a.initial, .6);
});

test("card heading paths ignore code/frontmatter/comments and do not change card IDs", async () => {
  const { parseSyntaxCards } = await load("src/flashcard-syntax.ts");
  const source = "---\ntitle: a\n---\n# 数学\n## 线性代数\n### 特征值\nQ::A\n```md\n# 假标题\n```\n<!--\n# 假标题2\n-->\nB::C\n## 概率\nD::E";
  const cards = parseSyntaxCards(source, "math.md", templates);
  assert.deepEqual(plain(cards.map((card) => card.headingPath)), [["数学", "线性代数", "特征值"], ["数学", "线性代数", "特征值"], ["数学", "概率"]]);
  assert.equal(cards[0].id, parseSyntaxCards("Q::A", "math.md", templates)[0].id);
  assert.deepEqual(plain(parseSyntaxCards("数学\n====\n线代\n----\nQ::A", "math.md", templates)[0].headingPath), ["数学", "线代"]);
  assert.deepEqual(plain(parseSyntaxCards("# C#\n---\nQ::A", "math.md", templates)[0].headingPath), ["C#"]);
});

test("baseline discoveries remain unknown; later cards retain exact first-observed time", async () => {
  const { rememberReviewCards } = await load("src/review-catalog.ts");
  const settings = { reviewCardMeta: {} };
  const a = { key: "syntax:a", file: { path: "note.md" } }, b = { key: "syntax:b", file: { path: "note.md" } };
  rememberReviewCards(settings, [a], true, "2026-10-13T00:00:00Z");
  rememberReviewCards(settings, [a, b], false, "2026-10-14T00:00:00Z");
  rememberReviewCards(settings, [b], false, "2026-10-15T00:00:00Z");
  assert.equal(settings.reviewCardMeta["syntax:a"].discoveredAt, null);
  assert.equal(settings.reviewCardMeta["syntax:b"].discoveredAt, "2026-10-14T00:00:00Z");
});

test("catalog incrementally indexes all markdown, migrates renames and removes deleted metadata", async () => {
  class TFile { constructor(path) { this.path = path; this.basename = path.slice(0, -3); this.extension = "md"; } }
  const { ReviewCatalog } = await load("src/review-catalog.ts", { TFile });
  const handlers = {}, cleanup = [];
  const files = [new TFile("old.md")], markdown = { "old.md": "# 原分类\nQ::A" };
  const settings = { reviewCardMeta: {}, reviewPriorities: {}, reviewCatalogInitialized: false,
    flashcardInlineTemplate: templates.inline, flashcardBidirectionalTemplate: templates.bidirectional,
    flashcardBlockTemplate: templates.block, flashcardClozeTemplate: templates.cloze };
  const host = { settings, isVocabFile: () => true, saveSettings: async () => {}, registerEvent() {}, register: (cb) => cleanup.push(cb),
    app: { metadataCache: { on: (name, cb) => { handlers[`cache:${name}`] = cb; } }, vault: {
      on: (name, cb) => { handlers[name] = cb; }, getMarkdownFiles: () => files, getFileByPath: (path) => files.find((file) => file.path === path), cachedRead: async (file) => markdown[file.path],
    } } };
  const catalog = new ReviewCatalog(host);
  const baseline = await catalog.cards();
  const oldKey = baseline.find((card) => card.type === "syntax").key;
  assert.equal(settings.reviewCardMeta[oldKey].discoveredAt, null);
  markdown["old.md"] += "\nnew::answer";
  handlers["cache:changed"](files[0]);
  const added = (await catalog.cards()).find((card) => card.label === "new");
  const discovered = settings.reviewCardMeta[added.key].discoveredAt;
  assert.ok(discovered);
  settings.reviewPriorities[added.key] = { at: discovered, initial: .25 };
  files[0].path = "new.md"; files[0].basename = "new"; markdown["new.md"] = markdown["old.md"];
  handlers.rename(files[0], "old.md");
  const renamed = (await catalog.cards()).find((card) => card.label === "new" && card.type === "syntax");
  assert.equal(settings.reviewCardMeta[renamed.key].discoveredAt, discovered);
  assert.equal(settings.reviewPriorities[renamed.key].initial, .25);
  assert.equal(settings.reviewCardMeta[oldKey], undefined);
  const removed = files.pop(); handlers.delete(removed); await catalog.cards();
  assert.deepEqual(plain(settings.reviewCardMeta), {});
  assert.deepEqual(plain(settings.reviewPriorities), {});
  cleanup.forEach((cb) => cb());
});

test("library filters state/category and sorts known dates before unknown legacy dates", async () => {
  const { selectLibraryCards } = await load("src/review-library.ts", { AbstractInputSuggest: class {} });
  const cards = ["a", "b", "c", "d"].map((key) => ({ key, file: { path: `${key}.md` }, label: key, type: "note", headingPath: key === "c" ? ["物理"] : ["数学", "线代"] }));
  const settings = { reviewEvents: [{ memberKeys: ["a"], timestamp: "2026-10-10" }], suspendedReviewItems: { "note:b": true }, reviewCardMeta: { a: { discoveredAt: null }, b: { discoveredAt: "2026-10-12" }, c: { discoveredAt: "2026-10-11" } } };
  const host = { settings, readLifecycle: (file) => ({ archived: file.path === "d.md" }), readCard: () => ({}) };
  const state = { status: "all", sort: "newest", query: "", category: "" };
  const keys = (state) => plain(selectLibraryCards(cards, host, state)).map((card) => card.key);
  assert.deepEqual(keys(state), ["b", "c", "a", "d"]);
  assert.deepEqual(keys({ ...state, status: "unreviewed" }), ["c"]);
  assert.deepEqual(keys({ ...state, status: "reviewed" }), ["a"]);
  assert.deepEqual(keys({ ...state, status: "suspended" }), ["b"]);
  assert.deepEqual(keys({ ...state, category: "数学" }), ["b", "a", "d"]);
  assert.deepEqual(keys({ ...state, query: "物理" }), ["c"]);
});

test("block formula occurrence templates continue every quote line and separate the source", async () => {
  const { renderOccurrenceContent } = await load("src/occurrence-render.ts");
  assert.equal(renderOccurrenceContent("> {{sentence}}{{sourceSuffix}}", { sentence: "矩阵\n\n$$\nx=1\n$$", sourceSuffix: " —— [[source]]" }), "> 矩阵\n> \n> $$\n> x=1\n> $$\n> \n> —— [[source]]");
  assert.equal(renderOccurrenceContent("{{sentence}}\n{{source}}", { sentence: "$x$ means x", source: "[[source]]" }), "$x$ means x\n[[source]]");
  assert.equal(renderOccurrenceContent("{{sentence}} {{notConfigured}}", { sentence: "word" }), "word {{notConfigured}}");
});

test("native log navigation serializes and restores the library tab and search filters", async () => {
  class ItemView { constructor(leaf) { this.leaf = leaf; } async setState() {} }
  const { LexisLogView } = await load("src/review-log-view.ts", { ItemView, AbstractInputSuggest: class {} });
  const view = new LexisLogView({}, {});
  view.tab = "reviewed"; view.filter = "syntax";
  view.library = { status: "all", sort: "retention", direction: "desc", view: "cards", hasCurve: false, query: "问题", category: "", groupBy:"dictionary" };
  const state = plain(view.getState());
  const restored = new LexisLogView({}, {});
  restored.refresh = async () => {};
  await restored.setState(state, {});
  assert.equal(restored.navigation, true);
  assert.deepEqual(plain(restored.getState()), state);
  await restored.setState({ ...state, tab: "library", library: { ...state.library, status: "unreviewed" } }, {});
  assert.equal(restored.getState().tab, "reviewed");
  assert.equal(restored.getState().library.status, "all");
});
