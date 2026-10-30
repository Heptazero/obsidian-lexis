import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("current-file command is available for any Markdown file and captures its path before opening review", async () => {
  const { currentFileReviewCommand } = await load("src/review-current-file-command.ts");
  let active = { path: "outside-dictionaries/chapter.md", extension: "md" };
  const calls = [];
  const host = {
    app: { workspace: { getActiveFile: () => active } },
    t: key => key,
    configureReview: options => { calls.push(options); active = null; },
  };
  const command = currentFileReviewCommand(host);
  assert.equal(command.id, "review-current-file");
  assert.equal(command.name, "command.reviewCurrentFile");
  assert.equal(command.checkCallback(true), true);
  assert.equal(calls.length, 0, "checking availability must not open or write anything");
  assert.equal(command.checkCallback(false), true);
  assert.deepEqual(calls, [{ scope: "current", file: "outside-dictionaries/chapter.md", content: "syntax", mode:"cram",batchSize:null,rounds:1 }]);
  assert.equal(command.checkCallback(true), false);
  active = { path: "book.pdf", extension: "pdf" };
  assert.equal(command.checkCallback(false), false);
  assert.equal(calls.length, 1);
});

test("current-file review reads only that file and shares card states, suspension and today's completion", async () => {
  const { createReviewQueue } = await load("src/review-queue.ts");
  const { parseSyntaxCards } = await load("src/flashcard-syntax.ts");
  const templates = { inline: "{{question}}::{{answer}}", bidirectional: "{{sideA}}:::{{sideB}}", block: "{{question}}??\n{{answer}}", cloze: "=={{answer}}==" };
  const current = { path: "outside/chapter.md", extension: "md" };
  const other = { path: "vocab/other.md", extension: "md" };
  const markdown = "Fresh::answer\n\nDue::answer\n\nLater::answer\n\nDone::answer\n\nSuspended::answer\n\nAlso ==cloze==.\n\n```cpp\nstd::deque<int> values;\n```";
  const cards = parseSyntaxCards(markdown, current.path, templates);
  const id = front => cards.find(card => card.front === front).id;
  const states = {
    [id("Due")]: { s: 2, due: "2026-10-20", reps: 2 },
    [id("Later")]: { s: 20, due: "2026-10-25", reps: 5 },
    [id("Done")]: { s: 2, due: "2026-10-20", history: [{date:"2026-10-20",grade:3}] },
  };
  const settings = {
    flashcardInlineTemplate: templates.inline, flashcardBidirectionalTemplate: templates.bidirectional,
    flashcardBlockTemplate: templates.block, flashcardClozeTemplate: templates.cloze,
    suspendedReviewItems: { [`syntax:${id("Suspended")}`]: true },
    syntaxCardStates: states, reviewHistory: {}, newPerDay: 20, maxReviewsPerSession: 200,
  };
  const before = JSON.stringify(settings), reads = [];
  const host = {
    app: { vault: {
      getMarkdownFiles: () => { throw Error("single-file review must not enumerate the vault"); },
      getFileByPath: path => [current, other].find(file => file.path === path) || null,
      cachedRead: async file => { reads.push(file.path); return markdown; },
    } },
    settings, inVocabFolder: () => false, readLifecycle: () => ({ archived: false, retired: false }),
    readCard: () => { throw Error("must not create a whole-note card"); },
    readSyntaxCardState: key => states[key] || {}, freqVal: () => 0,
    saveSettings: async () => { throw Error("opening a session must not write settings"); },
  };
  Object.defineProperties(host, createReviewQueue({ todayStr: () => "2026-10-20" }));
  const options = { scope: "current", file: current.path, content: "syntax" };
  const queue = await host.buildQueue(options);
  assert.deepEqual(reads, [current.path]);
  assert.equal(queue.length, 3);
  assert.ok(queue.every(item => item.file === current && item.type === "syntax"));
  assert.equal(queue.find(item => item.syntax.front === "Due").card, states[id("Due")]);
  assert.ok(queue.some(item => item.syntax.kind === "cloze"));
  assert.ok(!queue.some(item => ["Later", "Done", "Suspended"].includes(item.syntax.front)));
  assert.equal(JSON.stringify(settings), before);
  settings.newPerDay=1;settings.maxReviewsPerSession=1;
  const practice = await host.buildQueue({...options,mode:"cram",batchSize:null});
  assert.equal(practice.length,5,"all practice includes future-due and completed-today cards and bypasses normal session limits");
  assert.ok(practice.some(item=>item.syntax.front === "Later") && practice.some(item=>item.syntax.front === "Done"));
  assert.ok(!practice.some(item=>item.syntax.front === "Suspended"));
  assert.equal((await host.buildQueue({...options,mode:"cram",batchSize:2})).length,2);
  assert.deepEqual(await host.buildQueue({ ...options, file: "missing.md" }), []);
});
