import { Component, ItemView, Setting, TFile, type WorkspaceLeaf } from "obsidian";
import { LEXIS_HOME_VIEW } from "./constants";
import type { TranslationVars } from "./i18n";
import { mountReviewDashboard, type DashboardViewHost } from "./review-dashboard-view";
import { renderCollectionReview } from "./review-collection-controls";
import type { LexisSettings, ReviewOptions, SuspendedReviewEntry } from "./types";

export interface RetireCandidate {
  file: TFile;
  display: string;
  created: string;
  lastEncounter: string;
  occCount: number;
  sinceLast: number;
}

interface HomeViewHost extends DashboardViewHost {
  app: ItemView["app"];
  settings: LexisSettings;
  t(key: string, variables?: TranslationVars): string;
  computeStats(): { due: number; fresh: number; total: number };
  renderHeatmap(element: HTMLElement): void;
  dictFolders(): string[];
  collectReviewFolders(): string[];
  collectReviewTags(): string[];
  collectSuspendedReviewItems(): Promise<SuspendedReviewEntry[]>;
  restoreSuspendedReviewItem(key: string): Promise<void>;
  collectArchivedFiles(): TFile[];
  openReview(options: ReviewOptions): Promise<void>;
  openReviewLog(date?: string): Promise<void>;
  saveSettings(): Promise<void>;
  buildRetireCandidates(): Promise<RetireCandidate[]>;
  setRetired(file: TFile, retired: boolean): Promise<void>;
  setPinned(file: TFile, pinned: boolean): Promise<void>;
  setArchived(file: TFile, archived: boolean): Promise<void>;
}

export class LexisHomeView extends ItemView {
  private dashboardCleanup: (() => void) | null = null;
  private dashboardComponent: Component | null = null;
  private retireRenderTimer: number | undefined;
  sourceFilePath = "";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: HomeViewHost) {
    super(leaf);
  }

  getViewType(): string { return LEXIS_HOME_VIEW; }
  getDisplayText(): string { return "Lexis"; }
  getIcon(): string { return "graduation-cap"; }
  async onOpen(): Promise<void> { this.render(); }

  render(): void {
    this.dashboardCleanup?.();
    if (this.dashboardComponent) this.removeChild(this.dashboardComponent);
    this.dashboardComponent = this.addChild(new Component());
    const container = this.contentEl;
    container.empty();
    container.addClass("lexis-home");
    container.createEl("h3", { text: "📕 Lexis" });
    const dashboard = container.createDiv();
    this.dashboardCleanup = mountReviewDashboard(dashboard, this.plugin, this.dashboardComponent);
    const history = container.createEl("details", { cls: "lexis-home-section" });
    history.createEl("summary", { text: this.plugin.t("dashboard.history") });
    let historyRendered = false;
    history.addEventListener("toggle", () => {
      if (history.open && !historyRendered) { historyRendered = true; this.plugin.renderHeatmap(history.createDiv({ cls: "lexis-hm-wrap" })); }
    });
    const custom = container.createEl("details", { cls: "lexis-home-section" });
    custom.createEl("summary", { text: this.plugin.t("dashboard.custom") });

    renderCollectionReview(custom, this.app, this.plugin, this.dashboardComponent);

    void this.renderSuspendedItems(container);
    this.renderArchivedItems(container);
    void this.renderRetireCandidates(container);
  }

  private renderArchivedItems(container: HTMLElement): void {
    const files = this.plugin.collectArchivedFiles();
    const section = container.createEl("details", { cls: "lexis-home-section lexis-archived-section" });
    section.open = !this.plugin.settings.homeArchivedCollapsed;
    const summary = section.createEl("summary", { cls: "lexis-home-section-summary" });
    const summaryLabel = summary.createSpan({ text: `📦 ${this.plugin.t("home.archived")} (${files.length})` });
    const body = section.createDiv({ cls: "lexis-home-section-body" });
    section.addEventListener("toggle", () => {
      this.plugin.settings.homeArchivedCollapsed = !section.open;
      void this.plugin.saveSettings();
    });
    if (!files.length) {
      body.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noArchived") });
      return;
    }

    const rows = new Map<string, HTMLElement>();
    for (const file of files) {
      const row = body.createDiv({ cls: "lexis-archive-row" });
      rows.set(file.path, row);
      const info = row.createDiv({ cls: "lexis-suspended-info" });
      const name = info.createEl("a", { text: file.basename, href: "#", cls: "lexis-suspended-name" });
      name.addEventListener("click", (event) => {
        event.preventDefault();
        void this.plugin.app.workspace.getLeaf(false).openFile(file);
      });
      info.createDiv({ cls: "lexis-suspended-meta", text: this.plugin.t("home.archivedMeta") });
      const restore = row.createEl("button", { text: this.plugin.t("home.restoreArchived") });
      restore.addEventListener("click", () => {
        void (async () => {
          restore.disabled = true;
          try {
            await this.plugin.setArchived(file, false);
            rows.delete(file.path);
            row.remove();
            summaryLabel.setText(`📦 ${this.plugin.t("home.archived")} (${rows.size})`);
            if (!rows.size) body.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noArchived") });
          } catch {
            restore.disabled = false;
          }
        })();
      });
    }
  }

  private async renderSuspendedItems(container: HTMLElement): Promise<void> {
    const section = container.createEl("details", { cls: "lexis-home-section lexis-suspended-section" });
    section.open = !this.plugin.settings.homeSuspendedCollapsed;
    const summary = section.createEl("summary", { cls: "lexis-home-section-summary" });
    const summaryLabel = summary.createSpan({ text: `⏸️ ${this.plugin.t("home.suspended")}` });
    const body = section.createDiv({ cls: "lexis-home-section-body" });
    section.addEventListener("toggle", () => {
      this.plugin.settings.homeSuspendedCollapsed = !section.open;
      void this.plugin.saveSettings();
    });
    body.setText(this.plugin.t("common.loading"));

    let entries: SuspendedReviewEntry[] = [];
    try { entries = await this.plugin.collectSuspendedReviewItems(); } catch { entries = []; }
    if (!body.isConnected) return;
    body.empty();
    summaryLabel.setText(`⏸️ ${this.plugin.t("home.suspended")} (${entries.length})`);
    if (!entries.length) {
      body.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noSuspended") });
      return;
    }

    const rows = new Map<string, HTMLElement>();
    const renderEmpty = () => {
      if (rows.size === 0 && body.isConnected) body.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noSuspended") });
    };
    for (const entry of entries) {
      const row = body.createDiv({ cls: "lexis-suspended-row" });
      rows.set(entry.key, row);
      const info = row.createDiv({ cls: "lexis-suspended-info" });
      const name = info.createEl("a", { text: entry.label, href: "#", cls: "lexis-suspended-name" });
      name.addEventListener("click", (event) => {
        event.preventDefault();
        void this.plugin.app.workspace.getLeaf(false).openFile(entry.file);
      });
      info.createDiv({
        cls: "lexis-suspended-meta",
        text: entry.type === "syntax" && entry.line != null
          ? `${this.plugin.t("home.suspendedSyntax")} · ${this.plugin.t("home.line", { line: entry.line + 1 })}`
          : this.plugin.t("home.suspendedNote"),
      });
      const restore = row.createEl("button", { text: this.plugin.t("home.restoreSuspendedOne") });
      restore.addEventListener("click", () => {
        void (async () => {
          restore.disabled = true;
          try {
            await this.plugin.restoreSuspendedReviewItem(entry.key);
            rows.delete(entry.key);
            row.remove();
            summaryLabel.setText(`⏸️ ${this.plugin.t("home.suspended")} (${rows.size})`);
            renderEmpty();
          } catch {
            restore.disabled = false;
          }
        })();
      });
    }
  }

  private async renderRetireCandidates(container: HTMLElement): Promise<void> {
    const days = this.plugin.settings.retireCandidateDays ?? 90;
    const section = container.createEl("details", { cls: "lexis-home-section lexis-retire-section" });
    section.open = !this.plugin.settings.homeRetireCollapsed;
    const summary = section.createEl("summary", { cls: "lexis-home-section-summary", text: `🗑️ ${this.plugin.t("home.retire")}` });
    const wrapper = section.createDiv({ cls: "lexis-retire-wrap lexis-home-section-body" });
    section.addEventListener("toggle", () => {
      this.plugin.settings.homeRetireCollapsed = !section.open;
      void this.plugin.saveSettings();
    });
    new Setting(wrapper)
      .setName(this.plugin.t("home.retireThreshold"))
      .setDesc(this.plugin.t("home.retireThresholdDesc"))
      .addSlider((slider) => slider.setLimits(14, 365, 1).setValue(days).onChange((value) => {
        this.plugin.settings.retireCandidateDays = value;
        void this.plugin.saveSettings();
        if (this.retireRenderTimer) window.clearTimeout(this.retireRenderTimer);
        this.retireRenderTimer = window.setTimeout(() => this.render(), 400);
      }));
    const list = wrapper.createDiv();
    list.setText(this.plugin.t("home.calculating"));
    let candidates: RetireCandidate[];
    try {
      candidates = await this.plugin.buildRetireCandidates();
    } catch (error) {
      console.warn("[Lexis] Cannot calculate retirement candidates", error);
      if (list.isConnected) list.setText(this.plugin.t("home.encounterDataError"));
      return;
    }
    if (!list.isConnected) return;
    list.empty();
    if (!candidates.length) {
      list.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noCandidates") });
      return;
    }
    summary.setText(`🗑️ ${this.plugin.t("home.retire")} (${candidates.length})`);

    const selected = new Set<string>();
    const rows = new Map<string, HTMLElement>();
    const removeRows = (paths: string[]) => {
      for (const path of paths) {
        rows.get(path)?.remove();
        rows.delete(path);
        selected.delete(path);
      }
    };
    for (const candidate of candidates) {
      const row = list.createDiv({ cls: "lexis-retire-row" });
      rows.set(candidate.file.path, row);
      const checkbox = row.createEl("input", { type: "checkbox", cls: "lexis-retire-cb" });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selected.add(candidate.file.path);
        else selected.delete(candidate.file.path);
      });
      const info = row.createDiv({ cls: "lexis-retire-info" });
      const name = info.createEl("a", { text: candidate.display, href: "#", cls: "lexis-retire-name" });
      name.addEventListener("click", (event) => {
        event.preventDefault();
        void this.plugin.app.workspace.getLeaf(false).openFile(candidate.file);
      });
      info.createDiv({
        cls: "lexis-retire-meta",
        text: this.plugin.t("home.candidateMeta", {
          created: candidate.created,
          last: candidate.lastEncounter,
          occurrences: candidate.occCount,
          days: candidate.sinceLast,
        }),
      });
      const buttons = row.createDiv({ cls: "lexis-retire-btns" });
      buttons.createEl("button", { text: `🗑️ ${this.plugin.t("home.evict")}` }).addEventListener("click", () => {
        void this.plugin.setRetired(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
      buttons.createEl("button", { text: `📌 ${this.plugin.t("home.keep")}` }).addEventListener("click", () => {
        void this.plugin.setPinned(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
      buttons.createEl("button", { text: `📦 ${this.plugin.t("home.mastered")}` }).addEventListener("click", () => {
        void this.plugin.setArchived(candidate.file, true).then(() => removeRows([candidate.file.path]));
      });
    }

    const bulk = wrapper.createDiv({ cls: "lexis-retire-bulk" });
    const runBulk = async (operation: (file: TFile) => Promise<void>) => {
      const paths = [...selected];
      for (const path of paths) {
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) await operation(file);
      }
      removeRows(paths);
    };
    bulk.createEl("button", { text: this.plugin.t("home.bulkEvict") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setRetired(file, true));
    });
    bulk.createEl("button", { text: this.plugin.t("home.bulkKeep") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setPinned(file, true));
    });
    bulk.createEl("button", { text: this.plugin.t("home.bulkMastered") }).addEventListener("click", () => {
      void runBulk((file) => this.plugin.setArchived(file, true));
    });
  }

  async onClose(): Promise<void> { this.dashboardCleanup?.(); }
}
