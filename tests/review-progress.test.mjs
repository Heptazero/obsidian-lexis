import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function load(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

const progress = await load("src/review-progress.ts");
const data = await load("src/review-dashboard-data.ts");
const { ReviewDashboard } = await load("src/review-dashboard.ts");
const { localDate, addDays } = await load("src/review-log-data.ts");
const { restrictReviewItem, chooseClozeRevealMode } = await load("src/review-item.ts");
const date = "2026-10-08";
const file = (path) => ({ path, basename: path.split("/").pop().replace(/\.md$/, ""), extension: "md", stat: { mtime: 0, ctime: 0 } });
const note = (path, card = {}) => ({ type: "note", file: file(path), card });
const event = (keys, grade, timestamp, day = date) => ({ date: day, timestamp, memberKeys: keys, grade });
const settings = (overrides = {}) => ({ reviewEvents: [], reviewDailyGoal: 10, reviewMinimumGoal: 3, newPerDay: 20, reviewDailyTargets: {}, reviewGoalHistory: {}, reviewPlans: [], ...overrides });
const cloze = (states = [{}, {}]) => ({
  type: "syntax", file: file("A/cloze.md"), card: {},
  syntax: {
    id: "group", kind: "cloze", line: 0, front: "[…] and ==B==", combinedFront: "[…] and […]", back: "==A== and ==B==",
    memberIds: states.map((_, index) => `c${index}`),
    members: states.map((card, index) => ({ id: `c${index}`, front: index === 0 ? "[…] and ==B==" : "==A== and […]", answer: index === 0 ? "A" : "B", clozeIndex: index, card })),
  },
});

test("daily completions use each card's latest grade and never count retries twice", () => {
  const events = [
    event(["a"], 3, "10:00"), event(["a"], 1, "09:00"), event(["b"], 1, "11:00"),
    event(["a"], 4, "12:00"), event(["old"], 4, "12:00", "2026-10-07"),
  ];
  assert.deepEqual(progress.progressForKeys(["a", "a", "b", "c"], progress.latestReviewGrades(events, date)), { completed: 1, retry: 1, remaining: 1, total: 3 });
  assert.equal(progress.completedOnDate(events, date), 1);
  events.push(event(["b"], 3, "13:00"));
  assert.equal(progress.completedOnDate(events, date), 2);
  events.pop(); // Undo the successful retry.
  assert.equal(progress.completedOnDate(events, date), 1);
});

test("session progress keeps a fixed denominator across skips, retries, and cloze expansion", () => {
  const a = note("a.md"), b = note("b.md");
  assert.deepEqual(progress.sessionReviewProgress([a, b, a], 1, [], date), { completed: 0, retry: 0, remaining: 2, total: 2 });
  const events = [event(["a.md"], 1, "10:00")];
  assert.deepEqual(progress.sessionReviewProgress([a, b, a], 1, events, date), { completed: 0, retry: 1, remaining: 1, total: 2 });
  events.push(event(["b.md"], 3, "11:00"));
  assert.deepEqual(progress.sessionReviewProgress([a, b, a], 2, events, date), { completed: 1, retry: 1, remaining: 0, total: 2 });
  events.push(event(["a.md"], 3, "12:00"));
  assert.deepEqual(progress.sessionReviewProgress([a, b, a], 3, events, date), { completed: 2, retry: 0, remaining: 0, total: 2 });
  const group = cloze();
  const split = chooseClozeRevealMode(group, "one");
  assert.equal(progress.sessionReviewProgress([group], 0, [], date).total, 2);
  assert.equal(progress.sessionReviewProgress([split.current, ...split.remaining], 0, [], date).total, 2);
  assert.deepEqual(progress.sessionReviewProgress([a, b], 1, [], date, { "note:a.md": true }), { completed: 0, retry: 0, remaining: 1, total: 1 });
});

test("daily inventory distinguishes fresh, due, and future cloze members", () => {
  const group = cloze([{ s: 2, due: "2026-10-08" }, { s: 3, due: "2026-10-20" }, {}]);
  const config = settings({ newPerDay: 1 });
  const target = data.createDailyTarget([group, group], config, date);
  assert.deepEqual(target.keys, ["syntax:c0", "syntax:c2"]);
  assert.equal(target.goal, 2);
  const summary = data.dashboardSummary([group, group], config, target, {});
  assert.equal(summary.total, 3);
  assert.equal(summary.due, 1);
  assert.equal(summary.fresh, 1);
  const partial = restrictReviewItem(group, new Set(["syntax:c0", "syntax:c1"]));
  assert.equal(partial.card.s, 2);
  assert.deepEqual(partial.syntax.memberIds, ["c0", "c1"]);
});

test("reviewing through another entry point contributes to the same daily goal", () => {
  const items = [note("a.md"), note("b.md"), note("c.md")];
  const config = settings({ newPerDay: 1 });
  const target = data.createDailyTarget(items, config, date);
  assert.deepEqual(target.keys, ["a.md"]);
  config.reviewEvents.push(event(["b.md"], 3, "10:00"));
  const summary = data.dashboardSummary(items, config, target, {});
  assert.equal(summary.completed, 1);
  assert.equal(summary.remaining, 0);
  assert.equal(summary.options.dailyCardLimit, 0);
});

test("daily target survives schedule updates and goal changes, and resets the next day", async () => {
  const today = localDate(new Date());
  let items = [note("a.md"), note("b.md"), note("c.md")];
  const config = settings({ reviewDailyGoal: 2 });
  let saves = 0;
  const controller = new ReviewDashboard({ settings: config, collectReviewItems: async () => items, saveSettings: async () => { saves++; } });
  const initial = await controller.load();
  assert.equal(initial.today.goal, 2);
  const snapshot = config.reviewDailyTargets["global:"];
  config.reviewDailyGoal = 100;
  config.reviewEvents.push(event(["a.md"], 3, new Date().toISOString(), today));
  items = [note("a.md", { s: 3, due: addDays(today, 5) }), ...items.slice(1)];
  const second = await controller.load();
  assert.equal(second.today.goal, 2);
  assert.equal(second.today.completed, 1);
  assert.equal(second.today.remaining, 1);
  assert.equal(config.reviewDailyTargets["global:"], snapshot);
  assert.equal(saves, 1);
  snapshot.date = addDays(today, -1);
  const next = await controller.load();
  assert.equal(next.today.goal, 3);
  assert.equal(saves, 2);
});

test("empty targets do not repeatedly write settings, and recover after the index becomes ready", async () => {
  const today = localDate(new Date());
  let items = [note("future.md", { s: 3, due: addDays(today, 5) })], saves = 0;
  const config = settings();
  const controller = new ReviewDashboard({ settings: config, collectReviewItems: async () => items, saveSettings: async () => { saves++; } });
  assert.equal((await controller.load()).today.goal, 0);
  await controller.load();
  assert.equal(saves, 1);
  items = [note("new.md")];
  assert.equal((await controller.load()).today.goal, 1);
  assert.equal(saves, 2);
  const empty = settings({ newPerDay: 0 });
  const disabled = new ReviewDashboard({ settings: empty, collectReviewItems: async () => items, saveSettings: async () => { saves++; } });
  assert.equal((await disabled.load()).today.goal, 0);
  await disabled.load();
  assert.equal(saves, 3);
});

test("saved overlapping plans are deduplicated and simultaneous dashboard loads share work", async () => {
  const config = settings({ reviewPlans: [
    { id: "one", name: "One", sources: [{ scope: "folder", value: "A" }], content: "notes" },
    { id: "two", name: "Two", sources: [{ scope: "tag", value: "study" }], content: "notes" },
  ] });
  let reads = 0, saves = 0;
  const controller = new ReviewDashboard({ settings: config, collectReviewItems: async () => { reads++; return [note("A/a.md")]; }, saveSettings: async () => { saves++; } });
  const first = controller.load(), second = controller.load();
  assert.equal(first, second);
  const result = await first;
  assert.equal(result.today.total, 1);
  assert.equal(result.today.goal, 1);
  assert.equal(result.plans.length, 2);
  assert.equal(reads, 2);
  assert.equal(saves, 1);
  let changes = 0;
  const unsubscribe = controller.subscribe(() => changes++);
  controller.refresh(); unsubscribe(); controller.refresh();
  assert.equal(changes, 1);
});

test("combined review sources remove overlap, honor target keys, and limit atomic cloze cards", async () => {
  const { createReviewQueue } = await load("src/review-queue.ts");
  const files = [file("A/cloze.md"), file("B/note.md"), file("C/outside.md")];
  const config = settings({ flashcardInlineTemplate: "{{question}}::{{answer}}", flashcardBidirectionalTemplate: "{{sideA}}:::{{sideB}}", flashcardBlockTemplate: "{{question}}??\n{{answer}}", flashcardClozeTemplate: "=={{answer}}==", maxReviewsPerSession: 200 });
  const host = {
    app: { vault: { getMarkdownFiles: () => files, cachedRead: async (source) => source.path === "A/cloze.md" ? "==A== and ==B==" : "Question::Answer" } },
    settings: config,
    inVocabFolder: () => false,
    normalizeFolder: (value) => value,
    inScope: (path, folders) => folders.some((folder) => path.startsWith(`${folder}/`)),
    readLifecycle: () => ({ archived: false, retired: false }),
    getTags: (source) => new Set(source.path === "C/outside.md" ? [] : ["study"]),
    readCard: () => ({}), readSyntaxCardState: () => ({}), freqVal: () => 1,
    saveSettings: async () => {},
  };
  Object.defineProperties(host, createReviewQueue({ todayStr: () => date }));
  const options = { sources: [{ scope: "folder", value: "A" }, { scope: "tag", value: "study" }], content: "syntax" };
  assert.deepEqual(host.reviewScopeFiles(options).map((entry) => entry.path), ["A/cloze.md", "B/note.md"]);
  const items = await host.collectReviewItems(options, true);
  const keys = items.flatMap((entry) => entry.syntax.memberIds.map((id) => `syntax:${id}`));
  const queue = await host.buildQueue({ ...options, targetKeys: keys, dailyCardLimit: 1 });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].syntax.memberIds.length, 1);
  assert.equal((await host.buildQueue({ ...options, targetKeys: [], dailyCardLimit: 1 })).length, 0);
  assert.equal((await host.buildQueue({ ...options, dailyCardLimit: 0 })).length, 0);
});
