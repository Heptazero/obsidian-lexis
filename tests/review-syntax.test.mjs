import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadTypeScript(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node" });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const templates = {
  inline: "{{question}}::{{answer}}",
  bidirectional: "{{sideA}}:::{{sideB}}",
  block: "{{question}}??\n{{answer}}",
  cloze: "=={{answer}}==",
};

test("parses configurable inline, bidirectional, block and cloze cards", async () => {
  const { parseSyntaxCards } = await loadTypeScript("src/flashcard-syntax.ts");
  const markdown = [
    "术语::解释",
    "A:::B",
    "问题一??",
    "- 答案一",
    "- 答案二",
    "",
    "光合作用发生在 ==叶绿体==，需要 ==光==。",
    "",
    "```js",
    "fake::card",
    "```",
  ].join("\n");
  const cards = parseSyntaxCards(markdown, "note.md", templates);
  assert.deepEqual(cards.map((card) => card.kind), ["block", "inline", "bidirectional", "bidirectional", "cloze", "cloze"]);
  assert.equal(cards[0].back, "- 答案一\n- 答案二");
  assert.equal(cards[4].combinedFront, "光合作用发生在 […]，需要 […]。");
});

test("supports a custom separator on its own line", async () => {
  const { parseSyntaxCards } = await loadTypeScript("src/flashcard-syntax.ts");
  const cards = parseSyntaxCards("多行问题\n?\n- A\n- B", "note.md", { ...templates, block: "{{question}}\n?\n{{answer}}" });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].front, "多行问题");
  assert.equal(cards[0].back, "- A\n- B");
});

test("builds separate or combined cloze review items within any folder", async () => {
  const { createReviewQueue } = await loadTypeScript("src/review-queue.ts");
  const files = [{ path: "A/a.md", extension: "md" }, { path: "B/b.md", extension: "md" }];
  const markdown = {
    "A/a.md": "问题??\n- 答案一\n- 答案二\n\n一共有 ==甲== 和 ==乙==。",
    "B/b.md": "B::answer",
  };
  const host = {
    app: { vault: { getMarkdownFiles: () => files, cachedRead: async (file) => markdown[file.path] } },
    settings: {
      flashcardInlineTemplate: templates.inline,
      flashcardBidirectionalTemplate: templates.bidirectional,
      flashcardBlockTemplate: templates.block,
      flashcardClozeTemplate: templates.cloze,
      syntaxCardStates: {}, reviewHistory: {}, newPerDay: 20, maxReviewsPerSession: 200,
    },
    inVocabFolder: () => false,
    readLifecycle: () => ({ archived: false, retired: false }),
    normalizeFolder: (value) => value,
    inScope: (path, folders) => folders.some((folder) => path === folder || path.startsWith(`${folder}/`)),
    getTags: () => new Set(),
    readCard: () => ({}),
    readSyntaxCardState: () => ({}),
    freqVal: () => 1,
    saveSettings: async () => {},
  };
  Object.defineProperties(host, createReviewQueue({ todayStr: () => "2026-08-31" }));
  const separate = await host.buildQueue({ scope: "folder", folder: "A", content: "syntax", clozeMode: "separate" });
  assert.equal(separate.length, 3);
  const combined = await host.buildQueue({ scope: "folder", folder: "A", content: "syntax", clozeMode: "combined" });
  assert.equal(combined.length, 2);
  const cloze = combined.find((item) => item.syntax.kind === "cloze");
  assert.equal(cloze.syntax.memberIds.length, 2);
  assert.equal(cloze.syntax.front, "一共有 […] 和 […]。");
});

test("builds syntax cards from the Markdown files directly linked by a hub", async () => {
  const { createReviewQueue } = await loadTypeScript("src/review-queue.ts");
  const hub = { path: "00_hub/数学.md", extension: "md" };
  const linkedA = { path: "10_atom/群.md", extension: "md" };
  const linkedB = { path: "10_atom/环.md", extension: "md" };
  const outside = { path: "10_atom/域.md", extension: "md" };
  const pdf = { path: "30_resource/代数.pdf", extension: "pdf" };
  const files = [hub, linkedA, linkedB, outside];
  const byPath = new Map([...files, pdf].map((file) => [file.path, file]));
  const destinations = new Map([["群", linkedA], ["群#定义", linkedA], ["环别名", linkedB], ["代数.pdf", pdf]]);
  const markdown = {
    [hub.path]: "[[群]] [[群#定义]] [[环别名|环]] [[代数.pdf]] [[不存在]]",
    [linkedA.path]: "群的单位元::幺元",
    [linkedB.path]: "环是否要求乘法交换??\n不要求",
    [outside.path]: "域::field",
  };
  const host = {
    app: {
      vault: {
        getMarkdownFiles: () => files,
        getFileByPath: (path) => byPath.get(path) || null,
        cachedRead: async (file) => markdown[file.path] || "",
      },
      metadataCache: {
        getFileCache: (file) => file === hub ? { links: [...destinations.keys(), "不存在"].map((link) => ({ link })) } : null,
        getFirstLinkpathDest: (link) => destinations.get(link) || null,
      },
    },
    settings: {
      flashcardInlineTemplate: templates.inline,
      flashcardBidirectionalTemplate: templates.bidirectional,
      flashcardBlockTemplate: templates.block,
      flashcardClozeTemplate: templates.cloze,
      syntaxCardStates: {}, reviewHistory: {}, newPerDay: 20, maxReviewsPerSession: 200,
    },
    inVocabFolder: () => false,
    readLifecycle: () => ({ archived: false, retired: false }),
    normalizeFolder: (value) => value,
    inScope: () => true,
    getTags: () => new Set(),
    readCard: () => ({}),
    readSyntaxCardState: () => ({}),
    freqVal: () => 1,
    saveSettings: async () => {},
  };
  Object.defineProperties(host, createReviewQueue({ todayStr: () => "2026-09-09" }));
  const queue = await host.buildQueue({ scope: "hub", hub: hub.path, content: "notes" });
  assert.deepEqual(new Set(queue.map((item) => item.file.path)), new Set([linkedA.path, linkedB.path]));
  assert.ok(queue.every((item) => item.type === "syntax"));

  const linkedNotes = await host.buildQueue({ scope: "links", linkSource: hub.path, content: "syntax" });
  assert.deepEqual(new Set(linkedNotes.map((item) => item.file.path)), new Set([linkedA.path, linkedB.path]));
  assert.ok(linkedNotes.every((item) => item.type === "note"));
});

test("counts note text and sorts eligible notes by field and direction", async () => {
  const { countNoteWords, createReviewQueue } = await loadTypeScript("src/review-queue.ts");
  assert.equal(countNoteWords("---\ntitle: ignored words\n---\nQL 分解 is useful"), 5);
  const files = [
    { path: "notes/long.md", extension: "md", stat: { ctime: 10, mtime: 20 } },
    { path: "notes/short.md", extension: "md", stat: { ctime: 30, mtime: 40 } },
  ];
  const markdown = {
    "notes/long.md": "这是更长的笔记 with several words",
    "notes/short.md": "短笔记",
  };
  const host = {
    app: { vault: { getMarkdownFiles: () => files, cachedRead: async (file) => markdown[file.path] } },
    settings: { syntaxCardStates: {}, reviewHistory: {}, newPerDay: 20, maxReviewsPerSession: 200 },
    inVocabFolder: () => true,
    readLifecycle: () => ({ archived: false, retired: false }),
    normalizeFolder: (value) => value,
    inScope: () => true,
    getTags: () => new Set(),
    readCard: () => ({}),
    readSyntaxCardState: () => ({}),
    freqVal: () => 1,
    saveSettings: async () => {},
  };
  Object.defineProperties(host, createReviewQueue({ todayStr: () => "2026-08-31" }));
  const longest = await host.buildQueue({ content: "notes", sortBy: "wordCount", sortDirection: "desc" });
  assert.deepEqual(longest.map((item) => item.file.path), ["notes/long.md", "notes/short.md"]);
  const shortest = await host.buildQueue({ content: "notes", sortBy: "wordCount", sortDirection: "asc" });
  assert.deepEqual(shortest.map((item) => item.file.path), ["notes/short.md", "notes/long.md"]);
  const latest = await host.buildQueue({ content: "notes", sortBy: "modified", sortDirection: "desc" });
  assert.deepEqual(latest.map((item) => item.file.path), ["notes/short.md", "notes/long.md"]);
});

test("applies and undoes one combined grade across member clozes", async () => {
  const { createReviewState } = await loadTypeScript("src/review-state.ts");
  const settings = { syntaxCardStates: {}, reviewHistory: {}, reviewLog: {} };
  const host = {
    app: { fileManager: { processFrontMatter: async () => {} } },
    settings,
    saveSettings: async () => {},
  };
  Object.defineProperties(host, createReviewState({ todayStr: () => "2026-08-31", round2: (value) => Math.round(value * 100) / 100 }));
  const item = { type: "syntax", file: { path: "a.md" }, card: {}, syntax: { memberIds: ["a", "b"] } };
  const snapshot = host.snapshotReviewItem(item);
  const schedule = { s: 1.234, d: 4.567, due: "2026-09-01", reps: 1, lapses: 0 };
  await host.applyReviewItemSchedule(item, schedule);
  await host.logReviewItem(item, schedule, 3, 0.8);
  assert.equal(settings.syntaxCardStates.a.s, 1.23);
  assert.equal(settings.syntaxCardStates.b.d, 4.57);
  assert.equal(settings.reviewLog["2026-08-31"], 1);
  await host.restoreReviewItem(item, snapshot);
  await host.undoReviewItemLog(item);
  assert.equal(settings.syntaxCardStates.a, undefined);
  assert.equal(settings.reviewLog["2026-08-31"], undefined);
});

test("restores an existing whole-note schedule without treating zero as a missing snapshot", async () => {
  const { createReviewState } = await loadTypeScript("src/review-state.ts");
  const frontmatter = {};
  const host = {
    app: { fileManager: { processFrontMatter: async (_file, update) => update(frontmatter) } },
    settings: { syntaxCardStates: {}, reviewHistory: {}, reviewLog: {} },
    saveSettings: async () => {},
  };
  Object.defineProperties(host, createReviewState({ todayStr: () => "2026-08-31", round2: (value) => value }));
  const item = { type: "note", file: { path: "a.md" }, card: {} };
  await host.restoreReviewItem(item, { note: { s: 0, d: 5, due: "2026-09-01", last: "2026-08-31", reps: 1, lapses: 0 } });
  assert.equal(frontmatter["lexis-s"], 0);
  assert.equal(frontmatter["lexis-reps"], 1);
});
