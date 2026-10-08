import type { TranslationVars } from "./i18n";
import type { ReviewProgress } from "./review-progress";

type Translate = (key: string, vars?: TranslationVars) => string;

export function renderReviewProgressBar(parent: HTMLElement, progress: ReviewProgress, t: Translate): void {
  const label = t("review.progressBar", { done: progress.completed, total: progress.total, retry: progress.retry, left: progress.remaining });
  const wrapper = parent.createDiv({ cls: "lexis-review-progress" });
  wrapper.createDiv({ cls: "lexis-review-progress-caption", text: label, attr: { "aria-live": "polite" } });
  const track = wrapper.createDiv({ cls: "lexis-progress-track", attr: {
    role: "progressbar", "aria-label": label, "aria-valuemin": "0", "aria-valuemax": String(Math.max(1, progress.total)), "aria-valuenow": String(progress.completed),
  } });
  for (const [kind, count] of [["complete", progress.completed], ["retry", progress.retry]] as const) {
    const segment = track.createSpan({ cls: `lexis-progress-segment is-${kind}` });
    segment.setCssProps({ "--lexis-progress-width": `${progress.total ? count / progress.total * 100 : 0}%` });
  }
}
