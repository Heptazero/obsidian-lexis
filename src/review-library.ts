import { Notice, type TFile } from "obsidian";
import type { ListedReviewCard } from "./review-catalog";
import { effectivePriority, changeReviewPriority } from "./review-priority";
import { libraryMetrics, libraryStateOf, normalizeCompactLibraryState, selectLibraryCards, type LibraryMetrics, type LibraryState } from "./review-library-model";
import { LibraryPreviews, type LibraryPreviewHost, type LibraryNavigation } from "./review-library-preview";
import { localDate } from "./review-log-data";
import { ReviewRenderQueue } from "./review-render-queue";
import { renderReviewCardRow } from "./review-card-row";
import { renderLibraryToolbar } from "./review-library-toolbar";
import { groupLibraryCards } from "./review-library-groups";
export { selectLibraryCards } from "./review-library-model";
export type { LibraryStatus, LibrarySort, LibraryState } from "./review-library-model";

export interface LibraryHost extends LibraryPreviewHost {
  t(key: string, vars?: Record<string, string | number>): string;
  saveSettings(): Promise<void>;
  getTags(file: TFile): Set<string>;
}
export function renderLibraryMetrics(container: HTMLElement, host: Pick<LibraryHost, "t">, metrics: LibraryMetrics, compact = false): void {
  const line = container.createDiv({ cls: "lexis-library-metrics" });
  line.createSpan({ text: host.t("library.repsValue", { count: metrics.reps ?? "—" }) });
  line.createSpan({ text: host.t("library.retentionValue", { value: metrics.retention == null ? "—" : `${Math.round(metrics.retention * 100)}%` }), attr: { title: host.t("library.retentionHint") } });
  if (!compact) line.createSpan({ text: host.t("library.stabilityValue", { value: metrics.stability == null ? "—" : String(Math.round(metrics.stability * 10) / 10) }), attr: { title: host.t("library.stabilityHint") } });
}

export function renderCardLibrary(root: HTMLElement, cards: ListedReviewCard[], host: LibraryHost, state: LibraryState, type: "all" | "note" | "syntax", navigation?: LibraryNavigation, sharedRendering?: ReviewRenderQueue, reviewedOnly = false, unreviewedOnly = false): () => void {
  Object.assign(state, normalizeCompactLibraryState(state));
  const rendering = sharedRendering || new ReviewRenderQueue(root);
  const openGroups = new Set<string>();
  let allGroupsExpanded = false;
  const refreshToolbar = renderLibraryToolbar(root, host, state, (groupChanged = false) => {
    if (groupChanged) { openGroups.clear(); allGroupsExpanded = false; }
    count = 100; rows();
  }, {
    reviewed: !unreviewedOnly,
    groupsExpanded: () => allGroupsExpanded,
    toggleGroups: () => {
      allGroupsExpanded = !allGroupsExpanded;
      openGroups.clear();
      list.querySelectorAll<HTMLDetailsElement>(".lexis-library-group").forEach((section) => {
        section.open = allGroupsExpanded;
        if (section.open && section.dataset.groupId) openGroups.add(section.dataset.groupId);
      });
    },
  });
  const list = root.createDiv({ cls: `lexis-log-unreviewed${unreviewedOnly ? " is-unreviewed" : ""}` });
  const previews = new LibraryPreviews(list, host, navigation, rendering);
  let count = 100;
  function rows() {
    previews.reset();
    list.empty();
    const today = localDate(new Date());
    const scoped = cards.filter((card) => type === "all" || card.type === type);
    const selectionState = unreviewedOnly ? { ...state, status: "unreviewed" as const, sort: "name" as const, direction: "asc" as const } : state;
    const matches = selectLibraryCards(scoped, host, selectionState, today, reviewedOnly);
    list.createDiv({ cls: "lexis-log-count", text: host.t("log.count", { count: matches.length }) });
    if (!matches.length) list.createDiv({ cls: "lexis-log-empty", text: host.t("library.empty") });
    const visible=matches.slice(0,count), ranks=new Map(matches.map((card,index)=>[card.key,index]));
    for(const group of groupLibraryCards(visible,state.groupBy||"none",host.settings.dicts,host.app,host.getTags.bind(host),host.t("collection.ungrouped"))){
    let parent=list;
    if(state.groupBy&&state.groupBy!=="none"){
      const section=list.createEl("details",{cls:"lexis-library-group",attr:{"data-group-id":group.id}});
      section.open=allGroupsExpanded||openGroups.has(group.id);
      section.createEl("summary",{text:`${group.label} · ${group.cards.length}`});parent=section.createDiv();
      section.addEventListener("toggle",()=>{
        if(section.open)openGroups.add(group.id);else openGroups.delete(group.id);
        const sections=[...list.querySelectorAll<HTMLDetailsElement>(".lexis-library-group")];
        allGroupsExpanded=sections.length>0&&sections.every(item=>item.open);
        refreshToolbar();
      });
    }
    const entries = parent.createDiv({ cls: `lexis-library-entries${state.view === "cards" ? " is-cards" : ""}` });
    for (const card of group.cards) {
      const index=ranks.get(card.key);
      const metric = libraryMetrics(libraryStateOf(host, card), today);
      const entry = entries.createDiv({ cls: "lexis-library-entry" });
      renderReviewCardRow(entry, card, host, rendering, navigation, {
        rank: index == null ? "" : `${index + 1}. `,
        metrics: unreviewedOnly ? undefined : (side) => renderLibraryMetrics(side, host, metric, true),
      });
      if (state.view === "cards") previews.add(entry.createDiv({ cls: "lexis-library-preview" }), card, true);
    }
    }
    if (matches.length > count) {
      const more = list.createEl("button", { text: host.t("log.more", { count: matches.length - count }) });
      more.onclick = () => { count += 100; rows(); };
    }
  }
  rows();
  return () => { if (sharedRendering) rendering.reset(); else previews.dispose(); };
}

export function renderLibraryPriority(host: LibraryHost, container: HTMLElement, card: ListedReviewCard): void {
  const priority = container.createDiv({ cls: "lexis-library-priority" });
  const value = effectivePriority(host.settings.reviewPriorities?.[card.key]);
  priority.createSpan({ text: `${host.t("review.priority")} · ${Math.round(value * 100)}%` });
  priority.createDiv({ cls: "lexis-log-note", text: host.t("review.priorityHint") });
  const button = priority.createEl("button", { text: host.t(value < 1 ? "review.resetPriority" : "review.lowerPriority") });
  button.onclick = async () => {
    button.disabled = true;
    try {
      await changeReviewPriority(host.settings, [card.key], value >= 1, () => host.saveSettings());
      priority.remove(); renderLibraryPriority(host, container, card);
    }
    catch (error) {
      button.disabled = false;
      new Notice(host.t("review.priorityFailed", { error: error instanceof Error ? error.message : "Unknown error" }));
    }
  };
}
