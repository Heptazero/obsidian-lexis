import { buildCurveSVG } from "../../src/curve";
import { buildCurveViewHtml, mountCurveView } from "../../src/curve-view";
import { FSRS } from "../../src/fsrs";
import type { Component } from "obsidian";

declare const LexisCurveControls: typeof import("../../src/curve-controls");
declare const curveCss: string;

const checks: string[] = [];
const check = (condition: unknown, label: string) => { if (!condition) throw Error(label); checks.push(label); };
function report(result: { ok: boolean; error?: string }) {
  const output = document.createElement("pre"); output.id = "layout-result"; output.hidden = true;
  output.textContent = JSON.stringify({ ...result, checks, width: window.innerWidth, mode: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" });
  document.body.appendChild(output);
}
const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shift = (date: string, days: number) => { const result = new Date(date + "T12:00:00"); result.setDate(result.getDate() + days); return day(result); };

async function run() {
  (HTMLElement.prototype as any).createDiv = function() { const div = this.ownerDocument.createElement("div"); this.appendChild(div); return div; };
  const NativeDate = Date;
  let clock = new NativeDate(2026, 9, 13, 12).getTime();
  (globalThis as any).Date = class extends NativeDate {
    constructor(value?: string | number) { super(value ?? clock); }
    static now() { return clock; }
  };
  const cleanups: Array<() => void> = [];
  try {
    const card = { s: 7, last: "2026-10-12", due: "2026-10-19", history: Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, s: 7, retention: 80 })) };
    const original = JSON.stringify(card);
    const build = (state: typeof card, limit = 8) => buildCurveSVG(state, {
      requestRetention: .9, nextInterval: FSRS.nextInterval, retrievability: FSRS.retrievability,
      addDaysStr: shift, daysBetween: (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000, todayStr: () => day(new Date()),
    }, { limit });
    const t = (key: string) => key === "curve.showAll" ? "查看全部" : "最近 8 次";
    const native = document.getElementById("fixture")!;
    const component = { register(callback: () => void) { cleanups.push(callback); } } as unknown as Component;
    mountCurveView(native, component, () => card, build, t);
    const host = document.createElement("div"); document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${curveCss}</style><div class="lexis-web-pop-content"><div class="lexis-web-curve"></div></div>`;
    const browser = shadow.querySelector<HTMLElement>(".lexis-web-curve")!;
    browser.innerHTML = buildCurveViewHtml(card, build, t);
    cleanups.push(LexisCurveControls.attachCurveControls(browser, () => { browser.innerHTML = buildCurveViewHtml(card, build, t); }));
    for (const [name, root] of [["Obsidian", native], ["browser Shadow DOM", browser]] as const) {
      check(root.querySelectorAll(".lexis-curve-recent [data-review-date]").length === 8, `${name}: default view contains the last eight dates`);
      check(root.querySelectorAll(".lexis-curve-all [data-review-date]").length === 12, `${name}: all existing dates remain available`);
      check(root.querySelector<HTMLElement>(".lexis-curve-all")!.hidden, `${name}: all-history plot is initially hidden`);
      root.querySelector<HTMLButtonElement>("[data-curve-toggle]")!.click();
      check(root.querySelector<HTMLElement>(".lexis-curve-recent")!.hidden && !root.querySelector<HTMLElement>(".lexis-curve-all")!.hidden, `${name}: range switch displays one plot, never two`);
      const points = root.querySelectorAll<SVGElement>(".lexis-curve-all [data-review-date]");
      points[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      check(root.querySelector(".lexis-curve-info")!.textContent === "2026-10-01 · 80%", `${name}: touching a point displays its date and retention`);
      points[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      check(root.querySelector(".lexis-curve-info")!.textContent === "2026-10-02 · 80%", `${name}: points are keyboard accessible`);
      root.querySelector<SVGElement>('.lexis-curve-all [data-curve-detail^="Today"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      check(root.querySelector(".lexis-curve-info")!.textContent?.startsWith("Today · ~"), `${name}: Today inspection labels its value as an estimate`);
      check(root.scrollWidth <= root.clientWidth + 1, `${name}: even full history fits the available width`);
      const svg = root.querySelector<SVGElement>(".lexis-curve-all svg")!;
      check(svg.getBoundingClientRect().width <= root.clientWidth + 1, `${name}: SVG scales with its container, not elapsed days`);
      check(!!svg.querySelector('.lexis-curve-forecast[stroke-dasharray="4 4"]') && svg.textContent?.includes("Today"), `${name}: Today is visible and only the future path is dashed`);
    }
    check(LexisCurveControls.curveDateIsCurrent(native.innerHTML), "browser cache accepts charts from the current local day");
    clock += 86400000;
    check(!LexisCurveControls.curveDateIsCurrent(native.innerHTML), "browser cache rejects yesterday's Today marker");
    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    check(native.querySelector("svg")!.getAttribute("data-curve-today") === "2026-10-14", "open Obsidian curves update Today when returning after midnight");
    check(browser.querySelector("svg")!.getAttribute("data-curve-today") === "2026-10-14", "open browser curves refresh on the same day boundary");
    check(native.querySelector("[data-curve-toggle]")!.getAttribute("aria-expanded") === "true", "Obsidian day refresh preserves the chosen full-history range");
    cleanups.splice(0).forEach((cleanup) => cleanup());
    clock += 86400000; window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    check(native.querySelector("svg")!.getAttribute("data-curve-today") === "2026-10-14", "unloading releases day timers and focus listeners");
    check(JSON.stringify(card) === original, "range, point and day changes never write learning data");
    report({ ok: true });
  } finally {
    cleanups.forEach((cleanup) => cleanup()); (globalThis as any).Date = NativeDate;
  }
}
run().catch((error) => { report({ ok: false, error: error.stack }); });
