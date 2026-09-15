import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadScheduler() {
  const result = await build({
    entryPoints: ["src/review-scheduler.ts"], bundle: true, write: false, format: "esm", platform: "node",
    plugins: [{
      name: "obsidian-stub",
      setup(buildApi) {
        buildApi.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "stub" }));
        buildApi.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export class Component {}; export const MarkdownRenderer = {};" }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("initializes invalid FSRS states instead of propagating NaN", async () => {
  const { scheduleReviewCard } = await loadScheduler();
  for (const card of [
    { s: 0, d: 0, last: "2026-09-10" },
    { s: 2, d: null, last: "2026-09-10" },
    { s: Number.NaN, d: 5, last: "2026-09-10" },
    { s: 2, d: 11, last: "2026-09-10" },
  ]) {
    const schedule = scheduleReviewCard(card, 3, 0.9, "2026-09-15");
    assert.equal(Number.isFinite(schedule.s), true);
    assert.equal(Number.isFinite(schedule.d), true);
    assert.ok(schedule.s > 0);
    assert.ok(schedule.d >= 1 && schedule.d <= 10);
    assert.match(schedule.due, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("repairs null history stability from each event grade", async () => {
  const { repairReviewHistory } = await loadScheduler();
  const history = {
    a: [{ date: "2026-09-10", s: null, grade: 1, retention: 0 }],
    b: [{ date: "2026-09-11", s: null, grade: 3, retention: 0 }],
    c: [{ date: "2026-09-12", s: 2.5, grade: 4, retention: 80 }],
  };
  assert.equal(repairReviewHistory(history), true);
  assert.equal(history.a[0].s, 0.4);
  assert.equal(history.b[0].s, 3.17);
  assert.equal(history.c[0].s, 2.5);
  assert.equal(repairReviewHistory(history), false);
});
