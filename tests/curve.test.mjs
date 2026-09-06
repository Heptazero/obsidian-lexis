import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { build } from "esbuild";

async function loadCurve() {
  const result = await build({ entryPoints: ["src/curve.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

test("uses a fixed 0-100 percent scale and exposes recent review dates", async () => {
  const { buildCurveSVG, recentReviewDates } = await loadCurve();
  const card = {
    s: 8,
    last: "2026-09-05",
    due: "2026-09-12",
    history: [
      { date: "2026-08-20", s: 2, grade: 3, retention: 72 },
      { date: "2026-08-28", s: 4, grade: 3, retention: 65 },
      { date: "2026-09-02", s: 6, grade: 4, retention: 81 },
      { date: "2026-09-05", s: 8, grade: 3, retention: 74 },
    ],
  };
  assert.deepEqual(recentReviewDates(card, 3), ["2026-09-05", "2026-09-02", "2026-08-28"]);
  const svg = buildCurveSVG(card, {
    requestRetention: 0.9,
    nextInterval: () => 7,
    retrievability: (elapsed) => Math.max(0, 1 - elapsed / 10),
    addDaysStr: () => "2026-09-12",
    daysBetween: (start, end) => (Date.parse(end) - Date.parse(start)) / 86400000,
    todayStr: () => "2026-09-06",
  });
  for (const label of ["100%", "75%", "50%", "25%", "0%"]) assert.match(svg, new RegExp(`>${label}<`));
});
