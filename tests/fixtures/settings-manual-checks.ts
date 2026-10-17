import { Component, TFile, Notice } from "obsidian";
import { renderSettingsManual } from "../../src/settings-manual";
import { createReaderUi } from "../../src/reader-ui";
import { LexisPluginDictionary } from "../../src/plugin-dictionary";
import { buildCurveSVG, recentReviewDates } from "../../src/curve";
import { FSRS } from "../../src/fsrs";
import { boundedSource, escapeRe, formatDate, todayString, addDaysString, daysBetween, renderLexisMarkdown } from "../../src/shared-utils";
import { DEFAULT_SETTINGS } from "../../src/default-settings";
import { createI18n } from "../../src/i18n";
import { createSettingsSection } from "../../src/settings-section";
import type { ManualRuntime } from "../../src/settings-manual";

export async function checkSettingsManual(root: HTMLElement, check: (value: unknown, message: string) => void): Promise<void> {
  let renderingError = "";
  window.addEventListener("unhandledrejection", (event) => { renderingError = String(event.reason); });
  (HTMLElement.prototype as any).setCssProps = function(values: Record<string, string>) { for (const [key, value] of Object.entries(values)) this.style.setProperty(key, value); };
  (globalThis as any).createFragment = () => document.createDocumentFragment();
  const component = new Component(); component.load();
  const host = { settings: { ...DEFAULT_SETTINGS }, t: createI18n(() => "zh").t, occurrenceLabel: (occurrence: { file: TFile }) => occurrence.file.basename } as unknown as ManualRuntime;
  const original = JSON.stringify((host as any).settings);
  for (const name of ["findTypedRelations", "renderTypedRelations", "renderReverseRelations", "renderDerivedWords", "relLink"] as const) Object.defineProperty(host, name, Object.getOwnPropertyDescriptor(LexisPluginDictionary.prototype, name)!);
  Object.defineProperties(host, createReaderUi({ buildCurveSVG, recentReviewDates, FSRS, addDaysStr: addDaysString, daysBetween, todayStr: todayString,
    fmtDate: formatDate, TFile, Notice, boundedSource, escapeRe, Component, renderLexisMarkdown, openRestoreModal: () => {} }));
  const section = createSettingsSection(root, "语法手册", { level: "section" });
  renderSettingsManual(section.body, host, component);
  check(!section.body.querySelector(".lexis-manual-example"), "manual rendering is lazy until expanded");
  (section.element as HTMLDetailsElement).open = true;
  for (let index = 0; index < 100 && section.body.querySelectorAll(".lexis-manual-example").length < 8; index++) await new Promise((resolve) => setTimeout(resolve, 10));
  await new Promise((resolve) => setTimeout(resolve, 50));
  check(section.body.querySelectorAll(".lexis-manual-example").length === 8, `all eight syntax examples render (${section.body.querySelectorAll(".lexis-manual-example").length}; ${renderingError})`);
  check(!section.body.querySelector(".lexis-manual-reference"), "manual starts with concrete examples instead of prose reference paragraphs");
  const complete = section.body.querySelector<HTMLElement>('[data-manual-example="manual.complete"]')!;
  check(!!complete.querySelector("svg") && !!complete.querySelector(".lexis-occ") && complete.querySelector(".lexis-manual-output")?.textContent?.includes("cold"), "empty lexis block has a complete entry example, not a written description");
  const relation = section.body.querySelector<HTMLElement>('[data-manual-example="manual.relations"]')!;
  const from = relation.querySelector<HTMLElement>('[data-manual-file="cold.md"]')!;
  const to = relation.querySelector<HTMLElement>('[data-manual-file="warm.md"]')!;
  check(from.querySelector("code")?.textContent?.includes("## 反义词\n[[warm]]") && to.querySelector("code")?.textContent === "```rel\n反义词\n```", "heading-based references show the actual source for both notes");
  check(from.querySelector(".lexis-manual-output a")?.textContent === "warm" && to.querySelector(".lexis-manual-output a")?.textContent === "cold", "both notes show each other using production heading parsing, without a reciprocal source link");
  check(relation.querySelector("h4")?.textContent === "标题下的反向引用" && relation.textContent?.includes("{{标题}} = 反义词"), "the section name is generic and the heading is shown as a replaceable variable");
  check(!to.querySelector("code")?.textContent?.includes("{{"), "the runnable example does not contain placeholder braces");
  let copied = "";
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copied = value; } } });
  try {
    relation.querySelector<HTMLButtonElement>(".lexis-manual-heading button")!.dispatchEvent(new MouseEvent("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    check(copied === "```rel\n反义词\n```", "copy includes the usable code block, never sample file labels");
  } finally {
    if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
    else delete (navigator as any).clipboard;
  }
  for (const pair of section.body.querySelectorAll<HTMLElement>(".lexis-manual-pair")) {
    const input = pair.querySelector<HTMLElement>(".lexis-manual-input")!, result = pair.querySelector<HTMLElement>(".lexis-manual-result")!;
    const above = input.getBoundingClientRect(), below = result.getBoundingClientRect();
    check(below.top >= above.bottom && Math.abs(below.left - above.left) < 1, "every example places its real output below the code at every viewport width");
  }
  check(section.body.scrollWidth <= section.body.clientWidth + 1, "manual examples do not overflow the settings page horizontally");
  check(!!section.body.querySelector(".lexis-curve svg"), "curve preview uses the production FSRS renderer");
  check(!!section.body.querySelector(".lexis-rel-reverse a") && section.body.textContent?.includes("cold"), "relation preview uses real reverse relation rendering");
  check(!!section.body.querySelector(".lexis-occ b") && section.body.textContent?.includes("warm light"), "occurrences use the production sentence rendering and matching");
  const backlinks = section.body.querySelector<HTMLElement>('[data-manual-example="manual.derived"]')!;
  check(backlinks.querySelector('[data-manual-file="warm.md"] .lexis-manual-output a')?.textContent === "cold" && !backlinks.textContent?.includes("派生词"), "legacy derived renders actual backlinks and is no longer mislabeled as word derivation");
  check(section.body.querySelectorAll(".lexis-dashboard").length === 2 && !!section.body.querySelector(".lexis-progress-track"), "home and named plan previews use the real dashboard");
  check(section.body.querySelectorAll(".lexis-hm-cell").length === 133, "heatmap uses the complete production grid");
  check(section.body.querySelectorAll(".lexis-manual-output[inert]").length === 10, "all ten note outputs remain read-only and cannot navigate");
  check(JSON.stringify((host as any).settings) === original, "rendering examples leaves original settings and learning records untouched");
  check([...section.body.querySelectorAll<HTMLDetailsElement>("details")].every((details) => details.open), "read-only preview details are visible without needing blocked actions");
  component.unload(); section.element.remove();
  const failedSection = createSettingsSection(root, "手册初始化失败", { level: "section" });
  const failedComponent = new Component(); failedComponent.load();
  const warning = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    renderSettingsManual(failedSection.body, { ...host, renderSentence: undefined } as unknown as ManualRuntime, failedComponent);
    (failedSection.element as HTMLDetailsElement).open = true;
    await new Promise((resolve) => setTimeout(resolve, 30));
    check(warnings === 1 && failedSection.body.textContent?.includes("示例无法加载"), "initialization failures show an error instead of a description-only blank manual");
    check(!renderingError, "manual initialization does not leak an unhandled rejection");
  } finally {
    console.warn = warning;
    failedComponent.unload(); failedSection.element.remove();
  }
}
