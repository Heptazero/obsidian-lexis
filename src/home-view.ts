import { ItemView, Setting, TFile, type WorkspaceLeaf } from "obsidian";
import { LEXIS_HOME_VIEW } from "./constants";
import type { TranslationVars } from "./i18n";
import type { LexisSettings } from "./types";

export interface RetireCandidate {
  file: TFile;
  display: string;
  created: string;
  lastEncounter: string;
  encounterCount: number;
  hoverCount: number;
  occCount: number;
  sinceLast: number;
}

interface HomeViewHost {
  app: ItemView["app"];
  settings: LexisSettings;
  t(key: string, variables?: TranslationVars): string;
  computeStats(): { due: number; fresh: number; total: number };
  renderHeatmap(element: HTMLElement): void;
  dictFolders(): string[];
  openReview(options: { folder?: string; order?: "due" | "frequency" | "random" }): Promise<void>;
  saveSettings(): Promise<void>;
  buildRetireCandidates(): Promise<RetireCandidate[]>;
  setRetired(file: TFile, retired: boolean): Promise<void>;
  setPinned(file: TFile, pinned: boolean): Promise<void>;
  setArchived(file: TFile, archived: boolean): Promise<void>;
}

export class LexisHomeView extends ItemView {
  private retireRenderTimer: number | undefined;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: HomeViewHost) {
    super(leaf);
  }

  getViewType(): string { return LEXIS_HOME_VIEW; }
  getDisplayText(): string { return "Lexis"; }
  getIcon(): string { return "graduation-cap"; }
  async onOpen(): Promise<void> { this.render(); }

  render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("lexis-home");
    container.createEl("h3", { text: "📕 Lexis" });
    const current = this.plugin.computeStats();
    const stats = container.createDiv({ cls: "lexis-home-stats" });
    stats.createDiv({ cls: "lexis-stat", text: `⏰ ${this.plugin.t("home.due", { count: current.due })}` });
    stats.createDiv({ cls: "lexis-stat", text: `✨ ${this.plugin.t("home.new", { count: current.fresh })}` });
    stats.createDiv({ cls: "lexis-stat", text: `📚 ${this.plugin.t("home.total", { count: current.total })}` });
    this.plugin.renderHeatmap(container.createDiv({ cls: "lexis-hm-wrap" }));

    container.createEl("h4", { text: this.plugin.t("home.start") });
    const folders = this.plugin.dictFolders();
    let selectedFolder = "";
    let selectedOrder: "due" | "frequency" | "random" = "due";
    new Setting(container).setName(this.plugin.t("home.reviewFolder")).addDropdown((dropdown) => {
      dropdown.addOption("", this.plugin.t("common.all"));
      for (const folder of folders) dropdown.addOption(folder, folder);
      dropdown.setValue(selectedFolder);
      dropdown.onChange((value) => { selectedFolder = value; });
    });
    new Setting(container).setName(this.plugin.t("home.order")).addDropdown((dropdown) => {
      dropdown
        .addOption("due", this.plugin.t("home.dueFirst"))
        .addOption("frequency", this.plugin.t("home.frequency"))
        .addOption("random", this.plugin.t("home.random"))
        .setValue(selectedOrder);
      dropdown.onChange((value) => {
        if (value === "due" || value === "frequency" || value === "random") selectedOrder = value;
      });
    });
    new Setting(container)
      .addButton((button) => button
        .setButtonText(`▶ ${this.plugin.t("home.start")}`)
        .setCta()
        .onClick(() => this.plugin.openReview({ folder: selectedFolder, order: selectedOrder })))
      .addExtraButton((button) => button
        .setIcon("refresh-cw")
        .setTooltip(this.plugin.t("common.refresh"))
        .onClick(() => this.render()));

    void this.renderRetireCandidates(container);
  }

  private async renderRetireCandidates(container: HTMLElement): Promise<void> {
    const days = this.plugin.settings.retireCandidateDays ?? 90;
    const wrapper = container.createDiv({ cls: "lexis-retire-wrap" });
    wrapper.createEl("h4", { text: `🗑️ ${this.plugin.t("home.retire")}` });
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
    } catch {
      candidates = [];
    }
    if (!list.isConnected) return;
    list.empty();
    if (!candidates.length) {
      list.createDiv({ cls: "lexis-dim", text: this.plugin.t("home.noCandidates") });
      return;
    }

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
          encounters: candidate.encounterCount,
          hovers: candidate.hoverCount,
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

  async onClose(): Promise<void> {}
}
