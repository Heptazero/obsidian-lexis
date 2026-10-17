import type { App } from "obsidian";
import type { ListedReviewCard } from "./review-catalog";
import { renderLexisMarkdown } from "./shared-utils";
import { ReviewRenderQueue } from "./review-render-queue";
import { ReviewNavigation } from "./review-navigation";
import type { LibraryNavigation } from "./review-library-preview";
import { displayedSyntaxFront } from "./review-card-display";

/** Rows are content, not fixed-height theme buttons. Mouse and keyboard share one action. */
export function createReviewRow(parent: HTMLElement, activate: () => void, selected = false): HTMLElement {
  const row = parent.createDiv({ cls: `lexis-log-row${selected ? " is-active" : ""}`, attr: { role: "button", tabindex: "0" } });
  row.onclick = (event) => {
    if ((event.target as Element).closest("a,button,input,textarea,summary")) return;
    const selection = row.ownerDocument.getSelection();
    if (selection && !selection.isCollapsed && row.contains(selection.anchorNode)) return;
    activate();
  };
  row.onkeydown = (event) => {
    if (event.target === row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); activate(); }
  };
  return row;
}

export function renderReviewTitle(
  row: HTMLElement, card: Pick<ListedReviewCard, "label" | "type"> & Partial<ListedReviewCard>,
  host: { app: App; t(key: string): string }, queue: ReviewRenderQueue, navigation?: LibraryNavigation, rank = "",
): void {
  const title = row.createDiv({ cls: "lexis-log-row-title" });
  if (rank) title.createSpan({ cls: "lexis-log-row-rank", text: rank });
  const content = title.createDiv({ cls: "lexis-log-row-content" });
  if (card.type === "note") { content.setText(card.label); return; }
  const front = displayedSyntaxFront(card.syntax?.front || card.label, card.syntax?.kind);
  renderReviewMarkdown(content, front, card, host, queue, navigation);
}

export function renderReviewMarkdown(
  content: HTMLElement, markdown: string, card: Partial<ListedReviewCard>,
  host: { app: App; t(key: string): string }, queue: ReviewRenderQueue, navigation?: LibraryNavigation,
): void {
  content.addClass("markdown-rendered");
  content.setText(host.t("common.loading"));
  queue.add(content, async (component) => {
    if (navigation) new ReviewNavigation({ ...navigation, app: host.app, sourcePath: () => card.file?.path || "" }, component, content);
    await renderLexisMarkdown(host.app, markdown, content, card.file?.path || "", component);
  }, (error) => {
    content.setText(host.t("library.previewFailed"));
    console.warn("[Lexis] Cannot render review title", card.key, error);
  });
}
