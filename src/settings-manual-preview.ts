import { TFile, type App, type Component, type MarkdownPostProcessorContext } from "obsidian";
import { DEFAULT_SETTINGS } from "./default-settings";
import { addDays, localDate } from "./review-log-data";
import type { LexisSettings, ReviewCardState } from "./types";
import type { DashboardViewHost } from "./review-dashboard-view";
import type { Occurrence } from "./occurrence-search";
import type { DashboardData } from "./review-dashboard";

type Relations = { out: Record<string, Array<{ path: string; basename: string }>>; inc: Record<string, Array<{ path: string; basename: string }>> };
export interface ManualRuntime {
  settings?: Pick<LexisSettings, "language">;
  t(key: string, vars?: Record<string, string | number | boolean>): string;
  renderLexisBlock(el: HTMLElement, ctx: MarkdownPostProcessorContext, source: string): Promise<void>;
  renderHomeBlock(el: HTMLElement, source: string, ctx: MarkdownPostProcessorContext): void;
  renderHeatmap(el: HTMLElement): void;
  buildCurveSVG(card: ReviewCardState): string | null;
  renderTypedRelations(el: HTMLElement, file: TFile): Promise<number>;
  renderReverseRelations(el: HTMLElement, file: TFile, type: string): Promise<number>;
  renderDerivedWords(el: HTMLElement, file: TFile): Promise<void>;
  findTypedRelations(file: TFile): Promise<Relations>;
  relLink(el: HTMLElement, path: string, basename: string): void;
  renderSentence(el: HTMLElement, sentence: string, word: string, component?: Component | null): Promise<void>;
  occurrenceLabel(occurrence: Occurrence): string;
}

/** Explicit read-only adapter, not an inherited live plugin. No real vault or dashboard is reachable. */
export function createManualPreview(host: ManualRuntime) {
  const today = localDate(new Date());
  // TFile's native constructor requires a vault and path despite its public declaration.
  // These read-only demo records need its identity, not a live vault or constructor side effects.
  const file = (basename: string): TFile => {
    const record: unknown = Object.create(TFile.prototype);
    if (!(record instanceof TFile)) throw new Error("Cannot create syntax demo file");
    return Object.assign(record, { basename, name: `${basename}.md`, path: `Lexis-demo/${basename}.md`, extension: "md" });
  };
  const word = file("warm"), source = file("Example"), cold = file("cold");
  const files = new Map([word, source, cold].map((item) => [item.path, item]));
  const relation = { type: host.t("manual.relationType"), sourceFile: cold, targetFile: word };
  const relationMarkdown = `## ${relation.type}\n[[${word.basename}]]`;
  const documents = new Map([[cold.path, relationMarkdown], [word.path, ""]]);
  const reviewLog = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [addDays(today, -index), [6, 12, 0, 9, 18, 4, 15][index % 7]]));
  const settings: LexisSettings = {
    ...structuredClone(DEFAULT_SETTINGS), language: host.settings?.language || "zh", dicts: [], vocabFolders: "", excludeTags: "", reviewLog,
    reviewEvents: [], reviewGoalHistory: Object.fromEntries(Object.keys(reviewLog).map((date) => [date, { goal: 15, minimum: 5 }])),
  };
  const card: ReviewCardState = { s: 12, d: 4, last: addDays(today, -1), due: addDays(today, 5), reps: 3, lapses: 0,
    history: [12, 5, 1].map((days, index) => ({ date: addDays(today, -days), s: [3, 7, 12][index], grade: 3, retention: [0, 75, 84][index] })) };
  const summary = { date: today, goal: 15, minimum: 5, completed: 6, remaining: 9, retry: 1, due: 8, fresh: 4, total: 32, options: {} };
  const dashboard: DashboardData = { today: summary, plans: [{ plan: { id: "demo", name: host.t("manual.examplePlan"), sources: [], content: "notes" }, summary, items: [] }] };
  for (const [date, count] of Object.entries(reviewLog)) for (let index = 0; index < count; index++) settings.reviewEvents.push({
    id: `${date}-${index}`, date, timestamp: `${date}T12:00:00`, precision: "day", type: "note", filePath: word.path,
    label: `Example ${index}`, memberKeys: [`demo-${index}`], grade: 3, retention: 85,
  });
  const preview = {
    settings, t: host.t.bind(host),
    app: {
      vault: { getAbstractFileByPath: (path: string) => files.get(path) || null, cachedRead: async (file: TFile) => documents.get(file.path) || "" },
      metadataCache: {
        resolvedLinks: { [cold.path]: { [word.path]: 1 } },
        getFirstLinkpathDest: (target: string) => files.get(`Lexis-demo/${target}.md`) || null,
      },
      workspace: { getLeaf: () => ({ openFile: async () => {} }), onLayoutReady: (callback: () => void) => callback() },
    } as unknown as App,
    renderLexisBlock(el: HTMLElement, ctx: MarkdownPostProcessorContext, source: string): Promise<void> { return host.renderLexisBlock.call(preview, el, ctx, source); },
    renderHomeBlock(el: HTMLElement, source: string, ctx: MarkdownPostProcessorContext): void { host.renderHomeBlock.call(preview, el, source, ctx); },
    renderHeatmap(el: HTMLElement): void { host.renderHeatmap.call(preview, el); },
    buildCurveSVG: host.buildCurveSVG.bind(host),
    renderTypedRelations(el: HTMLElement, file: TFile): Promise<number> { return host.renderTypedRelations.call(preview, el, file); },
    renderReverseRelations(el: HTMLElement, file: TFile, type: string): Promise<number> { return host.renderReverseRelations.call(preview, el, file, type); },
    renderDerivedWords(el: HTMLElement, file: TFile): Promise<void> { return host.renderDerivedWords.call(preview, el, file); },
    relLink(el: HTMLElement, path: string, basename: string): void { host.relLink.call(preview, el, path, basename); },
    renderSentence: host.renderSentence.bind(host), occurrenceLabel: host.occurrenceLabel.bind(host),
    readCard: () => card,
    findTypedRelations(file: TFile): Promise<Relations> { return host.findTypedRelations.call(preview, file); },
    getCuratedSourcePaths: async () => new Set<string>(),
    findOccurrences: async (): Promise<Occurrence[]> => [{ file: source, sentence: "A warm light filled the room." }],
    inVocabFolder: () => true, addExampleToWord: async () => false, openOccurrence: async () => {}, removePopover: () => {},
    openReviewLog: async () => {}, openReview: async () => {}, openHome: async () => {},
    reviewDashboard: { load: async () => dashboard, subscribe: () => () => {}, refresh: () => {} } as unknown as DashboardViewHost["reviewDashboard"],
  };
  return { preview, sourcePath: word.path, relation, relationMarkdown };
}
