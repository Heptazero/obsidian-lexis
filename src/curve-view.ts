import type { Component } from "obsidian";
import { recentReviewDates, type CurveCard } from "./curve";
import { attachCurveControls } from "./curve-controls";

type Build = (card: CurveCard, limit?: number) => string | null;
type Translate = (key: string) => string;
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function buildCurveViewHtml(card: CurveCard, build: Build, t: Translate): string {
  const recent = build(card, 8);
  if (!recent) return "";
  const all = recentReviewDates(card, Number.MAX_SAFE_INTEGER).length > 8 ? build(card, 0) : null;
  const button = all ? `<button type="button" data-curve-toggle aria-expanded="false" data-all-label="${escape(t("curve.showAll"))}" data-recent-label="${escape(t("curve.showRecent"))}">${escape(t("curve.showAll"))}</button>` : "";
  return `<div class="lexis-curve-view">${button}<div class="lexis-curve-panel lexis-curve-recent">${recent}</div>` +
    (all ? `<div class="lexis-curve-panel lexis-curve-all" hidden>${all}</div>` : "") +
    `<div class="lexis-curve-info" aria-live="polite"></div></div>`;
}

export function mountCurveView(container: HTMLElement, component: Component, readCard: () => CurveCard, build: Build, t: Translate): void {
  const view = container.createDiv();
  const draw = () => {
    const expanded = view.querySelector("[data-curve-toggle]")?.getAttribute("aria-expanded") === "true";
    const parsed = new DOMParser().parseFromString(buildCurveViewHtml(readCard(), build, t), "text/html");
    view.replaceChildren(...Array.from(parsed.body.childNodes, (node) => container.ownerDocument.importNode(node, true)));
    if (expanded) view.querySelector<HTMLButtonElement>("[data-curve-toggle]")?.click();
  };
  draw();
  component.register(attachCurveControls(view, draw));
}
