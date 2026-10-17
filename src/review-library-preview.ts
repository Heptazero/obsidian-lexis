import type { Component, App, TFile } from "obsidian";
import type { ListedReviewCard } from "./review-catalog";
import type { ReviewCardState } from "./types";
import { renderLexisMarkdown } from "./shared-utils";
import { mountCurveView } from "./curve-view";
import { libraryStateOf, type LibraryMetricsHost } from "./review-library-model";
import { ReviewNavigation, type ReviewNavigationHost } from "./review-navigation";
import { ReviewRenderQueue } from "./review-render-queue";
import { displayedSyntaxFront } from "./review-card-display";
export type LibraryNavigation = Omit<ReviewNavigationHost, "app" | "sourcePath">;

export interface LibraryPreviewHost extends LibraryMetricsHost {
  app: App;
  t(key: string): string;
  renderNoteInto(element: HTMLElement, file: TFile, component: Component): Promise<void>;
  buildCurveSVG(card: ReviewCardState, limit?: number): string | null;
}

/** Card bodies share the same owned rendering queue as their list titles. */
export class LibraryPreviews {
  constructor(root: HTMLElement, private host: LibraryPreviewHost, private navigation?: LibraryNavigation, private queue = new ReviewRenderQueue(root)) {}

  add(element: HTMLElement, card: ListedReviewCard, bodyHandledByRow = false): void {
    element.setText(this.host.t("common.loading"));
    this.queue.add(element, (component, current) => this.render(element, card, component, current, bodyHandledByRow), (error) => {
      element.setText(this.host.t("library.previewFailed"));
      console.warn("[Lexis] Cannot render card library preview", card.key, error);
    });
  }

  dispose(): void {
    this.queue.dispose();
    // In-flight MarkdownRenderer work owns its component until it settles.
    // It never mounts a curve or starts another preview after disposal.
  }

  reset(): void {
    this.queue.reset();
  }

  private async render(element: HTMLElement, card: ListedReviewCard, component: Component, current: () => boolean, bodyHandledByRow: boolean): Promise<void> {
    if (this.navigation) new ReviewNavigation({ ...this.navigation, app: this.host.app, sourcePath: () => card.file.path }, component, element);
    if (!bodyHandledByRow && card.type === "note") await this.host.renderNoteInto(element.createDiv({ cls: "lexis-library-preview-content" }), card.file, component);
    else if (!bodyHandledByRow) {
      const content = element.createDiv({ cls: "lexis-library-preview-content" });
      await renderLexisMarkdown(this.host.app, displayedSyntaxFront(card.syntax?.front || card.label, card.syntax?.kind), content, card.file.path, component);
      if (!current()) return;
      if (card.syntax?.back) {
        const answer = element.createEl("details", { cls: "lexis-library-answer" });
        answer.createEl("summary", { text: this.host.t("library.answer") });
        await renderLexisMarkdown(this.host.app, card.syntax.back, answer.createDiv(), card.file.path, component);
      }
    }
    if (!current()) return;
    const state = libraryStateOf(this.host, card);
    if (this.host.buildCurveSVG(state)) {
      const curve = element.createDiv({ cls: "lexis-curve" });
      mountCurveView(curve, component, () => libraryStateOf(this.host, card), this.host.buildCurveSVG.bind(this.host), this.host.t.bind(this.host));
    }
  }
}
