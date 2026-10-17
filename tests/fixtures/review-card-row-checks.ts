import { renderReviewCardRow } from "../../src/review-card-row";
import { ReviewRenderQueue } from "../../src/review-render-queue";
import { createI18n } from "../../src/i18n";
import { DEFAULT_SETTINGS } from "../../src/default-settings";
import type { LibraryHost } from "../../src/review-library";

/** Exercise shared note rows independently of catalog sorting and real app interaction. */
export async function checkReviewCardRows(check: (value: unknown, message: string) => void): Promise<void> {
  const root = document.body.createDiv({ cls: "lexis-log" });
  const queue = new ReviewRenderQueue(root);
  const entry = root.createDiv({ cls: "lexis-library-entry" });
  const card = { key: "Words/literal.md", type: "note" as const, label: "literal ** name", file: { path: "Words/literal.md", basename: "literal ** name" } as any };
  let reads = 0, released = 0, opened = 0;
  const pending: Array<() => void> = [];
  const leaf = { view: {}, openFile: async () => { opened++; } };
  const host = {
    app: { workspace: { revealLeaf: async () => {} } }, settings: structuredClone(DEFAULT_SETTINGS),
    t: createI18n(() => "zh").t, readCard: () => ({}), readSyntaxCardState: () => ({}), readLifecycle: () => ({ archived: false, retired: false }),
    renderNoteInto: async (target, _file, component) => {
      const index = ++reads; component.register(() => { released++; });
      await new Promise<void>((resolve) => pending.push(resolve));
      target.createEl("p", { text: `note body ${index}` });
    }, buildCurveSVG: () => null,
  } as unknown as LibraryHost;
  const snapshot = JSON.stringify(host.settings);
  const row = renderReviewCardRow(entry, card, host, queue, { leaf: leaf as any, mode: () => "current", saveSession() {}, failed: (error) => { throw error; } });
  root.scrollIntoView({ block: "start" });
  const until = async (condition: () => boolean) => { for (let attempt = 0; attempt < 100 && !condition(); attempt++) await new Promise((resolve) => setTimeout(resolve, 10)); };
  check(reads === 0 && row.textContent?.includes("literal ** name") && !row.textContent?.includes("Words/"), "note rows remain literal and never read their body or show a repeated path while collapsed");
  row.querySelector<HTMLButtonElement>(".lexis-library-open")!.click(); await until(() => opened === 1);
  check(opened === 1 && reads === 0 && row.getAttribute("aria-expanded") === "false", "a collapsed note's arrow opens only the source, never its body");
  row.querySelector<HTMLButtonElement>(".lexis-library-more")!.click();
  const menu = (globalThis as any).__lexisMenus.at(-1);
  check(menu.items.length === 1 && menu.items[0].title === card.file.path && reads === 0, "note source menu has only the path and never offers metadata details");
  row.click(); await until(() => reads === 1);
  check(reads === 1 && row.getAttribute("aria-expanded") === "true", "only revealing a whole-note row starts its note read");
  row.click();
  check(!entry.querySelector(".lexis-library-row-answer") && row.getAttribute("aria-expanded") === "false", "retracting a pending note removes its answer without waiting for the read");
  row.click(); await until(() => reads === 2);
  pending[0](); await until(() => released === 1);
  check(released === 1 && !entry.textContent?.includes("note body 1"), "late work from a retracted note releases its component and cannot replace a reopened answer");
  pending[1](); await until(() => !!entry.textContent?.includes("note body 2"));
  check(entry.textContent?.includes("note body 2"), "reopened notes display the current body rather than the removed render");
  row.click(); check(released === 2 && !entry.querySelector(".lexis-library-row-answer"), "retracting settled content immediately unloads its Markdown component");
  check(JSON.stringify(host.settings) === snapshot, "answer reveal, metadata and source navigation never grade or modify learning settings");
  queue.dispose(); root.remove();
}
