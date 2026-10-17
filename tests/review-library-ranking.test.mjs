import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/review-library-model.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { libraryMetrics, normalizeLibraryState, normalizeCompactLibraryState, selectLibraryCards } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const today = "2026-10-13";
const cards = ["a", "b", "c", "missing", "zero"].map((key) => ({ key, label: key, type: "note", file: { path: `${key}.md` }, headingPath: ["Math"] }));
const states = {
  a: { reps: 5, s: 7, last: "2026-10-06" }, b: { reps: 10, s: 14, last: "2026-10-06" },
  c: { reps: 2, s: 7, last: "2026-10-12" }, missing: {}, zero: { reps: 0 },
};
const settings = { reviewEvents: [], reviewCardMeta: {}, suspendedReviewItems: {} };
const host = { settings, readLifecycle: () => ({ archived: false, retired: false }), readCard: (file) => states[file.path.slice(0, -3)] };
const keys = (sort, direction = "desc", options = {}) => selectLibraryCards(cards, host, { ...normalizeLibraryState(), sort, direction, ...options }, today).map((card) => card.key);

test("ranking counts, retention and stability use separate fields and keep unknown values last in both directions", () => {
  assert.deepEqual(keys("reps"), ["b", "a", "c", "zero", "missing"]);
  assert.deepEqual(keys("reps", "asc"), ["zero", "c", "a", "b", "missing"]);
  assert.deepEqual(keys("stability"), ["b", "a", "c", "missing", "zero"]);
  assert.deepEqual(keys("retention"), ["c", "b", "a", "missing", "zero"]);
  assert.deepEqual(keys("retention", "asc"), ["a", "b", "c", "missing", "zero"]);
});

test("estimated retention changes with elapsed time, not raw review count", () => {
  const before = libraryMetrics(states.a, "2026-10-06"), after = libraryMetrics(states.a, today);
  assert.equal(before.retention, 1);
  assert.ok(Math.abs(after.retention - .9) < 1e-10);
  assert.equal(after.reps, 5);
  assert.equal(after.stability, 7);
  assert.ok(libraryMetrics(states.c, today).retention > libraryMetrics(states.b, today).retention);
});

test("curve filter requires a valid recorded date and positive stability, and composes with other filters", () => {
  assert.deepEqual(keys("reps", "desc", { hasCurve: true }), ["b", "a", "c"]);
  assert.deepEqual(keys("reps", "desc", { hasCurve: true, query: "a.md", category: "Math", status: "reviewed" }), ["a"]);
  assert.equal(libraryMetrics({ reps: 4, s: 7 }, today).hasCurve, false);
  assert.equal(libraryMetrics({ s: 7, history: [{ date: "2026-10-12", s: 7 }] }, today).hasCurve, true);
});

test("unknown and malformed states never become fake zero-percent familiarity", () => {
  for (const state of [{}, { s: NaN, reps: -1 }, { s: Infinity, reps: Infinity }, { s: 7, last: "2026-02-30" }, { s: 7, last: "2026-10-14" }, { s: 7, history: [null, { date: 4, s: 2 }] }]) {
    assert.equal(libraryMetrics(state, today).retention, null);
    assert.equal(libraryMetrics(state, today).hasCurve, false);
  }
  assert.equal(libraryMetrics({}).reps, null);
  assert.equal(libraryMetrics({ reps: 0 }).reps, 0);
});

test("state restoration separates sort field and direction, migrates old labels once and retains panel filters", () => {
  const saved = { sort: "newest", view: "cards", hasCurve: true, query: "word", category: "Math" };
  const next = normalizeLibraryState(saved);
  assert.equal(next.sort, "discovered"); assert.equal(next.direction, "desc");
  assert.equal(next.view, "cards"); assert.equal(next.hasCurve, true);
  assert.equal(next.query, "word"); assert.equal(next.category, "Math");
  assert.equal(normalizeLibraryState({ sort: "oldest" }).direction, "asc");
  assert.deepEqual(normalizeLibraryState(next), next);
  assert.equal(saved.sort, "newest");
});

test("sorting snapshots metrics outside the comparator and does not mutate learning data or input card order", () => {
  const before = JSON.stringify({ settings, states, cards });
  let reads = 0;
  const measured = { ...host, readCard(file) { reads++; return host.readCard(file); } };
  selectLibraryCards(cards, measured, { ...normalizeLibraryState(), sort: "retention" }, today);
  assert.equal(reads, cards.length);
  assert.equal(JSON.stringify({ settings, states, cards }), before);
});

test("reviewed-only presentation keeps every filter within the reviewed subset", () => {
  const state = { ...normalizeLibraryState(), sort: "reps", direction: "desc" };
  assert.deepEqual(selectLibraryCards(cards, host, state, today, true).map((card) => card.key), ["b", "a", "c"]);
  assert.deepEqual(selectLibraryCards(cards, host, { ...state, status: "unreviewed" }, today, true), []);
  const withHistory = { ...host, settings: { ...settings, reviewEvents: [{ memberKeys: ["missing"], timestamp: "2026-10-01" }] } };
  assert.ok(selectLibraryCards(cards, withHistory, state, today, true).some((card) => card.key === "missing"));
  assert.deepEqual(selectLibraryCards(cards, host, { ...state, status: "unreviewed" }, today).map((card) => card.key), ["zero", "missing"]);
  const inactive = { ...host, settings: { ...settings, suspendedReviewItems: { "note:a": true } }, readLifecycle: (file) => ({ archived: file.path === "b.md", retired: false }) };
  assert.deepEqual(selectLibraryCards(cards, inactive, state, today, true).map((card) => card.key), ["c"]);
  assert.deepEqual(selectLibraryCards(cards, inactive, { ...state, status: "suspended" }, today).map((card) => card.key), ["a"]);
});

test("compact panel state removes invisible and retired filters without touching search, direction or display", () => {
  const before = { status: "suspended", sort: "firstReview", hasCurve: true, category: "Math", source: "folder:Words", view: "cards", query: "question", direction: "desc" };
  const after = normalizeCompactLibraryState(before);
  assert.equal(after.status, "all"); assert.equal(after.hasCurve, false); assert.equal(after.category, ""); assert.equal(after.sort, "reps");
  assert.equal(after.source, undefined); assert.equal(after.query, before.query); assert.equal(after.view, before.view); assert.equal(after.direction, before.direction);
  assert.equal(before.hasCurve, true);
});

test("legacy Hub grouping becomes source-note grouping instead of an unclassified bucket", () => {
  assert.equal(normalizeCompactLibraryState({ groupBy: "hub" }).groupBy, "file");
});
