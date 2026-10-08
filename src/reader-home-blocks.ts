"use strict";

import type { LexisSettings } from "./types";
import { MarkdownRenderChild, type MarkdownPostProcessorContext } from "obsidian";
import { mountReviewDashboard, type DashboardViewHost } from "./review-dashboard-view";

type StatsSummary = { due: number; fresh: number; total: number };
type TranslationVars = Record<string, string | number | boolean>;

function createReaderHomeBlocks(fmtDate: (date: Date) => string): PropertyDescriptorMap {
  class ReaderHomeBlocks {
    declare settings: LexisSettings;
    declare t: (key: string, vars?: TranslationVars) => string;
    declare computeStats: () => StatsSummary;
    declare openReviewLog: (date?: string) => Promise<void>;
    declare openReview: () => Promise<void>;
    declare openHome: () => Promise<void>;

    renderHeatmap(el: HTMLElement): void {
      const log = this.settings.reviewLog || {};
      const weeks = 18;
      const today = new Date();
      const max = Math.max(1, ...Object.values(log).map(Number));
      const grid = el.createDiv({ cls: "lexis-hm-grid" });
      const current = new Date(today);
      current.setDate(current.getDate() - (weeks * 7 - 1));
      current.setDate(current.getDate() - current.getDay());
      let total = 0;
      for (let week = 0; week <= weeks; week++) {
        const column = grid.createDiv({ cls: "lexis-hm-col" });
        for (let day = 0; day < 7; day++) {
          const date = fmtDate(current);
          const cell = column.createDiv({ cls: "lexis-hm-cell" });
          if (current > today) cell.addClass("lexis-hm-future");
          else {
            const count = Number(log[date]) || 0;
            total += count;
            if (count > 0) cell.addClass("lexis-hm-l" + Math.min(4, Math.ceil((count / max) * 4)));
            cell.setAttribute("title", this.t("home.heatmapDay", { date, count }));
            cell.setAttribute("role", "button");
            cell.tabIndex = 0;
            cell.addEventListener("click", (event) => { event.stopPropagation(); void this.openReviewLog(date); });
            cell.addEventListener("keydown", (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              void this.openReviewLog(date);
            });
          }
          current.setDate(current.getDate() + 1);
        }
      }
      el.createDiv({ cls: "lexis-hm-caption", text: this.t("home.heatmapCaption", { weeks, count: total }) });
    }

    renderHomeBlock(el: HTMLElement, source = "", context?: MarkdownPostProcessorContext): void {
      el.addClass("lexis-home-block");
      if (!context) return;
      const component = new MarkdownRenderChild(el);
      context.addChild(component);
      const planName = /^plan:\s*(.+)$/m.exec(source)?.[1].trim();
      mountReviewDashboard(el, this as unknown as DashboardViewHost, component, { compact: true, planName });
    }
  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(ReaderHomeBlocks.prototype);
  return descriptors;
}

export { createReaderHomeBlocks };
