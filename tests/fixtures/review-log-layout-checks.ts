import { LexisLogView } from "../../src/review-log-view";
import { createI18n } from "../../src/i18n";
import { DEFAULT_SETTINGS } from "../../src/default-settings";
import { todayString } from "../../src/shared-utils";

export async function checkReviewLogLayout(check: (value: unknown, message: string) => void): Promise<void> {
  const root = document.body.createDiv({ cls: "lexis-log" });
  const theme = document.body.createEl("style", { text: "p { text-indent: 2em; } .markdown-rendered { margin-left: 26px; padding-left: 32px; } .markdown-preview-sizer { margin-left: 24px; padding-left: 12px; max-width: 80%; } .el-p { padding-left: 14px; } .lexis-log-row-title .markdown-rendered p { margin-left: 26px; padding-left: 12px; } .lexis-log button { height: 28px; display: inline-flex; align-items: center; background: var(--background-secondary); line-height: 1; }" });
  const front = "- **面积** 与 `code`，公式 $x^2$";
  const displayedFront = "**面积** 与 `code`，公式 $x^2$";
  const answer = "[[答案笔记|答案]] 与 `code`";
  const file = { path: "Test/" + "VeryLongFileName".repeat(8) + ".md", basename: "来源", stat: { ctime: Date.now() } };
  const cards = ["example", "unseen"].map((id, line) => ({ key: `syntax:${id}`, label: front, type: "syntax", file, line, syntax: { id, front, back: answer, kind: "inline", line } }));
  const requests: string[] = [];
  const opened: string[] = [], positionsInSource: number[] = [];
  const app = { vault: { getFileByPath: () => file }, workspace: { requestSaveLayout() {}, revealLeaf: async () => {} },
    fixtureMarkdownRender: async (markdown: string, target: HTMLElement) => {
      requests.push(markdown);
      // SDK boundary fixture, not a substitute for native MathJax acceptance.
      if (markdown === displayedFront) {
        const wrapper = target.createDiv({ cls: "markdown-preview-sizer markdown-preview-section" }).createDiv({ cls: "el-p" });
        const paragraph = wrapper.createEl("p");
        paragraph.createEl("strong", { text: "面积" }); paragraph.append(" 与 ");
        paragraph.createEl("code", { text: "code" }); paragraph.append("，公式 ");
        paragraph.createEl("span", { cls: "math", text: "x²" });
      } else target.createEl("p", { text: markdown });
    },
  };
  const settings = { ...structuredClone(DEFAULT_SETTINGS), reviewEvents: [{ id: "sample", type: "syntax", memberKeys: ["syntax:example"], label: front,
    filePath: file.path, line: 0, date: todayString(), timestamp: new Date().toISOString(), precision: "time", grade: 3 }], reviewLog: { [todayString()]: 1 } };
  const host = { app, settings, t: createI18n(() => "zh").t, reviewCatalog: { cards: async () => cards }, readLifecycle: () => ({ archived: false, retired: false }),
    readCard: () => ({}), readSyntaxCardState: () => ({}), getTags: () => new Set(), buildCurveSVG: () => null, renderNoteInto: async () => {}, saveSettings: async () => {} };
  const snapshot = JSON.stringify(settings);
  const leaf = { app, contentEl: root, openFile: async (source) => { opened.push(source.path); }, view: { editor: { setCursor: (position) => positionsInSource.push(position.line), scrollIntoView() {} } } };
  const view = new LexisLogView(leaf as any, host as any);
  const positions: Array<{ left: number; top: number }> = [];
  for (const tab of ["history", "unreviewed", "reviewed"]) {
    await view.setState({ tab, filter: "all" }, {});
    root.scrollIntoView({ block: "start" });
    for (let attempt = 0; attempt < 100 && !root.querySelector(".lexis-log-row-content strong"); attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
    const filter = root.querySelector<HTMLElement>(".lexis-log-types")!;
    const frame = root.getBoundingClientRect(), box = filter.getBoundingClientRect();
    positions.push({ left: box.left - frame.left, top: box.top - frame.top });
    check(root.querySelectorAll(".lexis-log-types").length === 1 && filter.parentElement?.classList.contains("lexis-log-filters"), `${tab}: type filters use the shared toolbar, not page-specific headers`);
    const row = root.querySelector<HTMLElement>(".lexis-log-row")!;
    if (tab === "reviewed") check(root.querySelectorAll(".lexis-log-row").length === 1 && !root.textContent?.includes("卡片库"), "reviewed tab contains only reviewed cards, not the entire catalog");
    if (tab === "unreviewed") check(!root.querySelector("[data-library-sort]") && !root.querySelector("[data-library-direction]") && !root.querySelector(".lexis-library-metrics") && !!root.querySelector(".lexis-log-row-rank"), "unreviewed cards omit review-only ordering and metrics but keep ordinary list numbering");
    check(row.tagName === "DIV" && row.getAttribute("role") === "button" && row.tabIndex === 0, `${tab}: theme button height cannot squeeze a content row`);
    const title = row.querySelector<HTMLElement>(".lexis-log-row-title")!, meta = row.querySelector<HTMLElement>(".lexis-log-row-meta");
    check(!!title.querySelector("strong") && !!title.querySelector("code") && !!title.querySelector(".math") && !title.textContent?.includes("**"), `${tab}: complete question Markdown is passed to the native renderer`);
    const paragraph = title.querySelector<HTMLElement>("p")!, content = title.querySelector<HTMLElement>(".lexis-log-row-content")!;
    check(getComputedStyle(paragraph).textIndent === "0px" && Math.abs(paragraph.getBoundingClientRect().left - content.getBoundingClientRect().left) < 1, `${tab}: theme paragraph indent and left padding never add blank space before the question`);
    const rank = title.querySelector<HTMLElement>(".lexis-log-row-rank");
    const startsAtRow = tab === "history" || Math.abs(title.getBoundingClientRect().left - row.getBoundingClientRect().left) < 1;
    const plannedRankGap = rank
      ? content.getBoundingClientRect().left >= rank.getBoundingClientRect().right
        && content.getBoundingClientRect().left - rank.getBoundingClientRect().right <= 8
      : Math.abs(content.getBoundingClientRect().left - title.getBoundingClientRect().left) < 1;
    check(getComputedStyle(content).marginLeft === "0px" && getComputedStyle(content).paddingLeft === "0px" && plannedRankGap && startsAtRow, `${tab}: only the visible sequence number may precede the card title`);
    if (meta) check(title.getBoundingClientRect().bottom <= meta.getBoundingClientRect().top + 1, `${tab}: rendered titles do not overlap metadata`);
    check(getComputedStyle(row).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(row).boxShadow === "none", `${tab}: rows stay flat instead of grey rounded buttons`);
    const metrics = row.querySelector<HTMLElement>(".lexis-library-metrics");
    if (metrics) check(row.getBoundingClientRect().bottom >= metrics.getBoundingClientRect().bottom && !!metrics.closest(".lexis-library-row-side"), "reviewed metrics fit inside the row's secondary column");
    row.classList.add("is-active");
    const sample = root.createDiv(); sample.style.background = "var(--background-modifier-hover)";
    check(getComputedStyle(row).backgroundColor === getComputedStyle(sample).backgroundColor, `${tab}: hover/selected surface uses the theme hover variable`);
    root.style.setProperty("--background-modifier-hover", "rgba(223, 126, 176, .24)");
    check(getComputedStyle(row).backgroundColor === "rgba(223, 126, 176, 0.24)", `${tab}: custom theme hover colors apply without rebuilding the view`);
    root.style.removeProperty("--background-modifier-hover");
    sample.remove(); row.classList.remove("is-active");
    check(root.scrollWidth <= root.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth, `${tab}: long sources and rendered titles fit the viewport`);
    if (tab !== "history") {
      check(!meta && !row.textContent?.includes("VeryLongFileName") && !root.querySelector(".lexis-library-row-answer"), `${tab}: paths and answers are absent from the collapsed main row`);
      row.click();
      for (let attempt = 0; attempt < 100 && !root.querySelector(".lexis-library-row-answer")?.textContent?.includes("答案"); attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
      check(row.getAttribute("aria-expanded") === "true" && root.querySelector(".lexis-library-row-answer")?.textContent?.includes("答案") && !root.querySelector(".lexis-log-detail"), `${tab}: click reveals the actual answer, not statistics or the file path`);
      row.querySelector<HTMLButtonElement>(".lexis-library-open")!.click();
      for (let attempt = 0; attempt < 100 && positionsInSource.length < opened.length; attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
      check(opened.at(-1) === file.path && positionsInSource.at(-1) === (tab === "unreviewed" ? 1 : 0) && row.getAttribute("aria-expanded") === "true", `${tab}: arrow opens the native source line without retracting the answer`);
      row.click(); check(row.getAttribute("aria-expanded") === "false" && !root.querySelector(".lexis-library-row-answer"), `${tab}: repeated click retracts the answer in the same row`);
    }
  }
  check(positions.every((position) => Math.abs(position.left - positions[0].left) < 1 && Math.abs(position.top - positions[0].top) < 1), "all three pages keep the type filter at the same position");
  check(requests.filter((request) => request === displayedFront).length >= 3 && requests.includes(answer) && JSON.stringify(settings) === snapshot, "titles and answers preserve native Markdown, including formulas, code, and wikilinks, without writing learning data");
  root.querySelector<HTMLElement>(".lexis-log-row")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  check(!!root.querySelector(".lexis-library-row-answer"), "content rows keep keyboard answer reveal without opening statistics");
  root.querySelector<HTMLButtonElement>(".lexis-library-more")!.click();
  const menu = (globalThis as any).__lexisMenus.at(-1);
  check(menu.items.length === 1 && menu.items[0].title === file.path && !root.querySelector(".lexis-log-detail"), "reviewed source menu contains only the path and cannot open a detail panel");
  const outside = document.body.createEl("p", { text: "outside Lexis" });
  check(getComputedStyle(outside).textIndent !== "0px", "fixing list indentation never changes global note typography"); outside.remove();
  await view.onClose();
  if (!(globalThis as any).__lexisKeepLayout) root.remove();
  theme.remove();
}
