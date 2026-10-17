import { renderCardLibrary, type LibraryHost, type LibraryState } from "../../src/review-library";
import { renderReviewActions } from "../../src/review-actions";
import { createI18n } from "../../src/i18n";
import { DEFAULT_SETTINGS } from "../../src/default-settings";
import { buildCurveSVG } from "../../src/curve";
import { FSRS } from "../../src/fsrs";
import { todayString, addDaysString, daysBetween } from "../../src/shared-utils";

export async function checkReviewLibrary(check: (value: unknown, message: string) => void): Promise<void> {
  const root = document.body.createDiv({ cls: "lexis-log" });
  const header = root.createDiv({ cls: "lexis-log-header" });
  header.createEl("h2", { text: "复习记录" });
  const tabs = header.createDiv({ cls: "lexis-segments" });
  for (const label of ["记录", "未背过", "已背过"]) tabs.createEl("button", { cls: "lexis-segment", text: label });
  const i18n = createI18n(() => "zh");
  const host = {
    app: {}, settings: { ...DEFAULT_SETTINGS, dicts: [{ folder: "Books", template: "" }, { folder: "Other", template: "" }, { folder: "", tag: "novel", template: "" }], reviewEvents: [], reviewCardMeta: {}, reviewPriorities: {}, suspendedReviewItems: {} },
    t: i18n.t, saveSettings: async () => {}, readLifecycle: () => ({ archived: false, retired: false }),
    readCard: () => ({}), readSyntaxCardState: (id: string) => Number(id) < 110 ? { reps: 120 - Number(id), s: 7, last: todayString() } : {},
    renderNoteInto: async () => {},
    getTags: (file) => new Set(file.path.startsWith("Books/") ? ["novel"] : []),
    buildCurveSVG: (card, limit = 8) => buildCurveSVG(card, { requestRetention: .9, nextInterval: FSRS.nextInterval, retrievability: FSRS.retrievability, todayStr: todayString, addDaysStr: addDaysString, daysBetween }, { limit }),
  } as unknown as LibraryHost;
  const cards = Array.from({ length: 120 }, (_, index) => ({ key: `syntax:${index}`, type: "syntax" as const,
    label: `问题 ${index}`, file: { path: (index < 100 ? "Books/" : "Other/") + "LongFileName".repeat(12) + ".md" } as any,
    headingPath: ["小说", "人物", index < 100 ? "甲" : "乙"], line: index,
    syntax: { id: String(index), groupId: String(index), kind: "inline" as const, front: `问题 ${index}`, back: `答案 ${index}`, line: index },
  }));
  const state: LibraryState = { status: "all", sort: "name", query: "", category: "" };
  const cleanup = renderCardLibrary(root, cards, host, state, "all");
  check(root.querySelectorAll(".lexis-log-row").length === 100, "card library paginates instead of rendering the entire inventory");
  const input = root.querySelector<HTMLInputElement>("input")!;
  check(root.querySelectorAll("input").length === 1 && !root.querySelector("[data-library-curves]") && !root.textContent?.includes("全部状态"), "one search replaces heading input and redundant curve/status controls");
  input.value = "乙"; input.dispatchEvent(new Event("input"));
  check(root.querySelectorAll(".lexis-log-row").length === 20, "one search still matches nested Markdown headings");
  input.value = "问题 119"; input.dispatchEvent(new Event("input"));
  check(root.querySelectorAll(".lexis-log-row").length === 1, "text search replaces heading search without losing card matching");
  check(root.scrollWidth <= root.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth,
    "library tabs, filters and long file names stay within the narrow viewport");
  const snapshot = JSON.stringify(host.settings);
  root.querySelector<HTMLButtonElement>("[data-library-sort]")!.click();
  const menus = () => (globalThis as any).__lexisMenus.at(-1);
  check(menus().items.map((item: any) => item.title).join(",") === "名称,背诵次数,预计保留率,下次到期", "sort menu contains only four distinct commonly useful fields");
  input.value = ""; input.dispatchEvent(new Event("input"));
  root.querySelector<HTMLButtonElement>("[data-library-group]")!.click();
  menus().items.find((item: any) => item.title === "词典").click();
  const grouped = () => [...root.querySelectorAll<HTMLDetailsElement>(".lexis-library-group")];
  check(state.groupBy === "dictionary" && !root.querySelector("[data-library-source]") && grouped().length === 3,
    "one classification control replaces the separate dictionary-range filter and exposes configured dictionaries as groups");
  check(grouped().every((section) => !section.open), "dictionary groups are collapsed by default");
  root.querySelector<HTMLButtonElement>('[data-library-groups-toggle="expand"]')!.click();
  check(grouped().every((section) => section.open) && !!root.querySelector('[data-library-groups-toggle="collapse"]'), "one icon expands every visible group and changes to the collapse action");
  root.querySelector<HTMLButtonElement>('[data-library-groups-toggle="collapse"]')!.click();
  check(grouped().every((section) => !section.open), "the same icon collapses every visible group");
  root.querySelector<HTMLButtonElement>("[data-library-group]")!.click();
  menus().items.find((item: any) => item.title === "单篇笔记").click();
  check(state.groupBy === "file" && grouped().every((section) => !section.open), "changing classification resets groups to the collapsed default and never produces a fake Hub bucket");
  root.querySelector<HTMLButtonElement>("[data-library-group]")!.click();
  menus().items.find((item: any) => item.title === "不分类").click();
  check(!root.querySelector("[data-library-groups-toggle]") && !root.querySelector(".lexis-library-group"), "ungrouped mode removes the irrelevant expand control");
  input.value = "问题 101"; input.dispatchEvent(new Event("input"));
  check(root.querySelectorAll("[data-library-view]").length === 1 && root.querySelector("[data-library-view]")?.textContent === "列表", "display mode exposes only its current choice");
  root.querySelector<HTMLButtonElement>('[data-library-view="list"]')!.click();
  root.scrollIntoView({ block: "start" });
  for (let attempt = 0; attempt < 100 && !root.querySelector(".lexis-library-preview svg"); attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
  check(root.querySelector(".lexis-library-question")?.textContent?.includes("问题 101") && !!root.querySelector(".lexis-library-preview svg"), "card view retains rendered questions and the existing curve renderer");
  check(!root.querySelector(".lexis-library-row-answer") && !root.querySelector(".lexis-library-preview-content"), "card mode initially shows the question and curve, never a second copy or a revealed answer");
  check(root.querySelector(".lexis-library-metrics")?.textContent?.includes("19 次") && root.querySelector(".lexis-library-metrics")?.textContent?.includes("100%"), "cards and list share review-count and estimated-retention metrics");
  root.querySelector<HTMLButtonElement>("[data-library-direction]")!.click();
  check(state.direction === "desc" && state.view === "cards" && state.query === "问题 101" && state.category === "", "sort direction changes without losing display mode or search");
  check(root.querySelector("[data-library-direction]")?.textContent === "", "sort direction uses an icon rather than visible explanatory text");
  root.querySelector<HTMLButtonElement>('[data-library-view="cards"]')!.click();
  check(root.querySelectorAll(".lexis-library-preview").length === 0 && root.querySelectorAll(".lexis-log-row").length === 1, "returning to list view removes preview bodies without changing the result set");
  root.scrollIntoView({ block: "start" });
  root.querySelector<HTMLElement>(".lexis-library-row")!.click();
  for (let attempt = 0; attempt < 100 && !root.querySelector(".lexis-library-row-answer")?.textContent?.includes("答案 101"); attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
  const row = root.querySelector<HTMLElement>(".lexis-library-row")!, answer = root.querySelector<HTMLElement>(".lexis-library-row-answer")!, side = row.querySelector<HTMLElement>(".lexis-library-row-side")!;
  check(!row.textContent?.includes("LongFileName") && side.contains(row.querySelector(".lexis-library-metrics")), "file paths leave the main row and metrics move to its right-hand group");
  check(answer.getBoundingClientRect().top >= row.getBoundingClientRect().bottom && answer.textContent?.includes("答案 101"), "clicking reveals only this card's rendered answer below the existing question");
  row.querySelector<HTMLButtonElement>(".lexis-library-more")!.click();
  check(menus().items.length === 1 && menus().items[0].title === cards[101].file.path && !root.querySelector(".lexis-log-detail") && row.getAttribute("aria-expanded") === "true", "source menu contains only the path, no metadata detail action or answer toggle");
  row.click(); check(!root.querySelector(".lexis-library-row-answer") && row.getAttribute("aria-expanded") === "false", "a second click retracts the answer without replacing the question row");
  check(root.scrollWidth <= root.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth, "compact scope and right-aligned controls do not overflow the phone viewport");
  check(JSON.stringify(host.settings) === snapshot, "ranking and presentation never change learning or settings data");
  const actions = root.createDiv({ cls: "lexis-rv-topbtns" });
  let skipped = 0;
  const view = { queue: [{ type: "syntax", file: cards[0].file, card: {}, syntax: { memberIds: ["a", "b"] } }], pos: 0, skip: () => {}, suspend: async () => {}, render: () => { skipped++; } } as any;
  renderReviewActions(actions, host, view);
  actions.querySelectorAll<HTMLButtonElement>("button")[1].dispatchEvent(new MouseEvent("click"));
  const menu = (globalThis as any).__lexisMenus.at(-1);
  await menu.items.find((item: any) => item.title === "暂时降低优先级").click();
  check(host.settings.reviewPriorities["syntax:a"].initial === .25 && host.settings.reviewPriorities["syntax:b"].initial === .25 && skipped === 1,
    "temporary priority action covers all grouped clozes and advances without grading");
  cleanup(); root.remove();
}
