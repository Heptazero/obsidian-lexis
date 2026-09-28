import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

const built = await build({ entryPoints: ["src/review-log-data.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { migrateReviewEvents, weekStart, addDays, firstAttemptSuccess, neverReviewed } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);

test("weeks start on Monday across year boundaries", () => {
  assert.equal(weekStart("2026-01-01"), "2025-12-29");
  assert.equal(addDays("2025-12-29", 6), "2026-01-04");
});

test("legacy review history remains date-only and preserves separate cards", () => {
  const events = migrateReviewEvents({
    "terms/A.md": [{ date: "2026-09-28", s: 1.2, grade: 3, retention: 82 }],
    "syntax:abc": [{ date: "2026-09-28", s: 1.4, grade: 1, retention: 46 }],
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].precision, "day");
  assert.equal(events[0].filePath, "terms/A.md");
  assert.deepEqual(events[1].memberKeys, ["syntax:abc"]);
});

test("first attempt success ignores same-day requeues and counts a cloze group once", () => {
  const base = { date: "2026-09-28", precision: "time", type: "syntax", filePath: "note.md", label: "Q", retention: 70 };
  const events = [
    { ...base, id: "1", timestamp: "2026-09-28T09:00:00+08:00", memberKeys: ["syntax:a", "syntax:b"], grade: 1 },
    { ...base, id: "2", timestamp: "2026-09-28T09:03:00+08:00", memberKeys: ["syntax:a", "syntax:b"], grade: 3 },
    { ...base, id: "3", timestamp: "2026-09-28T09:05:00+08:00", memberKeys: ["syntax:c"], grade: 4 },
  ];
  assert.deepEqual(firstAttemptSuccess(events), { correct: 1, total: 2 });
  assert.equal(neverReviewed(false, false), true);
  assert.equal(neverReviewed(false, true), false);
  assert.equal(neverReviewed(true, false), false);
});
