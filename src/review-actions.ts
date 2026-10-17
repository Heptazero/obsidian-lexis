import { Menu, Notice, setIcon } from "obsidian";
import { reviewItemKeys } from "./review-item";
import { changeReviewPriority } from "./review-priority";
import type { LexisSettings, ReviewItem } from "./types";
const errorText = (error: unknown) => error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

interface ActionsHost {
  settings: LexisSettings;
  t(key: string, vars?: Record<string, string | number>): string;
  saveSettings(): Promise<void>;
}
interface ActionsView {
  skip(): void;
  suspend(): Promise<void>;
  queue: ReviewItem[];
  pos: number;
  render(): void;
}

export function renderReviewActions(container: HTMLElement, host: ActionsHost, view: ActionsView): void {
  const skip = container.createEl("button", { cls: "lexis-rv-undo", text: host.t("review.skip") });
  skip.onclick = () => view.skip();
  const more = container.createEl("button", { cls: "lexis-rv-undo", attr: { "aria-label": host.t("review.more") } });
  setIcon(more, "ellipsis");
  more.onclick = (event) => {
    const item = view.queue[view.pos];
    if (!item) return;
    const keys = reviewItemKeys(item);
    const position = view.pos;
    const menu = new Menu();
    menu.addItem((entry) => entry.setTitle(host.t("review.lowerPriority")).setIcon("arrow-down").onClick(async () => {
      more.disabled = true;
      try {
        await changeReviewPriority(host.settings, keys, true, () => host.saveSettings());
        if (view.pos === position && view.queue[position] === item) { view.pos++; view.render(); }
      }
      catch (error) {
        new Notice(host.t("review.priorityFailed", { error: errorText(error) }));
      }
      finally { more.disabled = false; }
    }));
    if (keys.some((key) => host.settings.reviewPriorities?.[key])) {
      menu.addItem((entry) => entry.setTitle(host.t("review.resetPriority")).setIcon("rotate-ccw").onClick(async () => {
        try { await changeReviewPriority(host.settings, keys, false, () => host.saveSettings()); }
        catch (error) {
          new Notice(host.t("review.priorityFailed", { error: errorText(error) }));
        }
      }));
    }
    menu.addItem((entry) => entry.setTitle(host.t("review.suspend")).setIcon("pause").onClick(() => view.suspend()));
    menu.showAtMouseEvent(event);
  };
}
