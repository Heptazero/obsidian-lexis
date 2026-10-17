import { Menu, setIcon } from "obsidian";
import type { ListedReviewCard } from "./review-catalog";
import type { LibraryPreviewHost, LibraryNavigation } from "./review-library-preview";
import { openReviewCardSource, ReviewNavigation } from "./review-navigation";
import { createReviewRow, renderReviewMarkdown, renderReviewTitle } from "./review-log-rows";
import type { ReviewRenderQueue } from "./review-render-queue";

interface RowOptions {
  rank?: string;
  metrics?(container: HTMLElement): void;
}
let answerId = 0;

/** Shared reviewed/unreviewed row. Revealing content never grades or opens a note. */
export function renderReviewCardRow(entry: HTMLElement, card: ListedReviewCard, host: LibraryPreviewHost, queue: ReviewRenderQueue, navigation?: LibraryNavigation, options: RowOptions = {}): HTMLElement {
  const id = `lexis-row-answer-${++answerId}`;
  let answer: HTMLElement | null = null;
  const toggle = () => {
    if (answer) {
      answer.remove(); queue.remove(answer); answer = null;
      row.setAttribute("aria-expanded", "false"); row.classList.remove("is-active");
      return;
    }
    answer = entry.createDiv({ cls: "lexis-log-row-content lexis-library-row-answer", attr: { id, role: "region", "aria-label": host.t(card.type === "note" ? "library.noteContent" : "library.answer") } });
    entry.insertBefore(answer, row.nextSibling);
    row.setAttribute("aria-expanded", "true"); row.classList.add("is-active");
    if (card.type === "syntax") renderReviewMarkdown(answer, card.syntax?.back || host.t("library.noAnswer"), card, host, queue, navigation);
    else {
      const target = answer;
      target.setText(host.t("common.loading"));
      queue.add(target, async (component) => {
        if (navigation) new ReviewNavigation({ ...navigation, app: host.app, sourcePath: () => card.file.path }, component, target);
        await host.renderNoteInto(target, card.file, component);
      }, () => target.setText(host.t("library.previewFailed")));
    }
  };
  const row = createReviewRow(entry, toggle);
  row.addClass("lexis-library-row");
  row.setAttribute("aria-expanded", "false"); row.setAttribute("aria-controls", id);
  renderReviewTitle(row.createDiv({ cls: "lexis-library-question" }), card, host, queue, navigation, options.rank);
  const side = row.createDiv({ cls: "lexis-library-row-side" });
  options.metrics?.(side);
  const actions = side.createDiv({ cls: "lexis-library-row-actions" });
  const more = actions.createEl("button", { cls: "clickable-icon lexis-library-more", attr: { title: host.t("library.sourcePath"), "aria-label": host.t("library.sourcePath") } });
  setIcon(more, "ellipsis");
  more.onclick = (event) => {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle(card.file.path).setDisabled(true));
    menu.showAtMouseEvent(event);
  };
  const open = actions.createEl("button", { cls: "clickable-icon lexis-library-open", attr: { title: host.t("log.openSource"), "aria-label": host.t("log.openSource") } });
  setIcon(open, "arrow-right"); open.disabled = !navigation;
  open.onclick = (event) => {
    if (!navigation) return;
    void openReviewCardSource({ ...navigation, app: host.app, sourcePath: () => card.file.path }, card, event.metaKey || event.ctrlKey).catch((error: unknown) => navigation.failed(error));
  };
  return row;
}
