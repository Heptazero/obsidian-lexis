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

const deps = (today = "2026-10-13") => ({
  requestRetention: .9, nextInterval: () => 7,
  retrievability: (elapsed) => Math.pow(.9, elapsed / 7),
  addDaysStr: (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10),
  daysBetween: (start, end) => (Date.parse(end) - Date.parse(start)) / 86400000,
  todayStr: () => today,
});

test("fixed total width preserves actual time ratios instead of giving each day or node a fixed width", async () => {
  const { buildCurveSVG } = await loadCurve();
  const dates = ["2026-09-01", "2026-09-04", "2026-09-14", "2026-09-29"];
  const svg = buildCurveSVG({ s: 7, last: dates.at(-1), history: dates.map((date) => ({ date, s: 7, retention: 80 })) }, deps("2026-10-01"));
  assert.match(svg, /viewBox="0 0 420 150"/);
  const points = [...svg.matchAll(/data-review-date="[^"]+"[^]*?<circle cx="([\d.]+)"/g)].map((match) => Number(match[1]));
  assert.equal(points.length, 4);
  const gaps = points.slice(1).map((point, index) => point - points[index]);
  assert.ok(Math.abs(gaps[1] / gaps[0] - 10 / 3) < .04);
  assert.ok(Math.abs(gaps[2] / gaps[0] - 15 / 3) < .04);
  const long = buildCurveSVG({ s: 7, last: "2025-01-01" }, deps());
  assert.match(long, /viewBox="0 0 420 150"/);
});

test("history ends exactly at Today and forecast starts there with a dashed line and hollow prediction", async () => {
  const { buildCurveSVG } = await loadCurve();
  const card = { s: 7, last: "2026-10-10", due: "2026-10-17" };
  const svg = buildCurveSVG(card, deps());
  assert.match(svg, /data-curve-today="2026-10-13"/);
  assert.match(svg, />Today<\/text>/);
  const history = /class="lexis-curve-history-line" d="([^"]+)"/.exec(svg)[1];
  const forecast = /class="lexis-curve-forecast" d="([^"]+)"[^>]*stroke-dasharray="4 4"/.exec(svg)[1];
  const end = /L([\d.]+ [\d.]+)$/.exec(history)[1];
  assert.ok(forecast.startsWith(`M${end}`));
  assert.match(svg, /class="lexis-curve-prediction"[^>]+fill="var\(--background-primary\)"/);
  assert.match(buildCurveSVG(card, deps("2026-10-14")), /data-curve-today="2026-10-14"/);
});

test("defaults to the last eight recorded dates; show-all keeps every existing record unchanged", async () => {
  const { buildCurveSVG } = await loadCurve();
  const history = Array.from({ length: 12 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, s: 7, retention: 80 }));
  const card = { s: 7, last: history.at(-1).date, history };
  const original = JSON.stringify(card);
  const recent = buildCurveSVG(card, deps()), all = buildCurveSVG(card, deps(), { limit: 0 });
  assert.equal([...recent.matchAll(/data-review-date=/g)].length, 8);
  assert.equal([...all.matchAll(/data-review-date=/g)].length, 12);
  assert.doesNotMatch(recent, /data-review-date="2026-10-01"/);
  assert.equal(JSON.stringify(card), original);
});

test("single-date curves never invent earlier review dates, and invalid or future states do not draw fake history", async () => {
  const { buildCurveSVG } = await loadCurve();
  const svg = buildCurveSVG({ s: 7, last: "2026-10-13" }, deps());
  assert.equal([...svg.matchAll(/data-review-date=/g)].length, 1);
  assert.match(svg, /data-review-date="2026-10-13"/);
  assert.equal(buildCurveSVG({ s: Infinity, last: "2026-10-13" }, deps()), null);
  assert.equal(buildCurveSVG({ s: 7, last: "2026-10-14" }, deps()), null);
});
