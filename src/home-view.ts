import { ItemView, Setting, TFile, type WorkspaceLeaf } from "obsidian";
import { LEXIS_HOME_VIEW } from "./constants";
import type { TranslationVars } from "./i18n";
import type { ClozeReviewMode, LexisSettings, ReviewContentMode, ReviewOptions, ReviewScopeMode, ReviewSortDirection, ReviewSortKey } from "./types";

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
  collectReviewFolders(): string[];
  collectReviewTags(): string[];
  openReview(options: ReviewOptions): Promise<void>;
  saveSettings(): Promise<void>;
  buildRetireCandidates(): Promise<RetireCandidate[]>;
  setRetired(file: TFile, retired: boolean): Promise<void>;
  setPinned(file: TFile, pinned: boolean): Promise<void>;
  setArchived(file: TFile, archived: boolean): Promise<void>;
}

export class LexisHomeView extends ItemView {
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
    const folders = this.plugin.collectReviewFolders();
    const tags = this.plugin.collectReviewTags();
    const activeFile = this.app.workspace.getActiveFile();
    const rememberedFile = this.sourceFilePath ? this.app.vault.getAbstractFileByPath(this.sourceFilePath) : null;
    const currentFile = activeFile || (rememberedFile instanceof TFile ? rememberedFile : null);
    let selectedScope: ReviewScopeMode = "vocab";
    let selectedFolder = "";
    let selectedTag = "";
    let selectedContent: ReviewContentMode = "notes";
    let selectedClozeMode: ClozeReviewMode = "separate";
    let selectedSort: ReviewSortKey = "due";
    let selectedDirection: ReviewSortDirection = "asc";
    const controls = container.createDiv({ cls: "lexis-review-controls" });
    let renderControls: () => void;
    const rerenderControls = () => {
      const scrollTop = container.scrollTop;
      renderControls();
      container.scrollTop = scrollTop;
      container.ownerDocument.defaultView?.requestAnimationFrame(() => { container.scrollTop = scrollTop; });
    };
    const addSegments = <T extends string>(setting: Setting, options: Array<[T, string]>, value: T, select: (next: T) => void) => {
      const group = setting.controlEl.createDiv({ cls: "lexis-segments" });
      for (const [key, label] of options) {
        const button = group.createEl("button", { cls: `lexis-segment${key === value ? " is-active" : ""}`, text: label, attr: { type: "button" } });
        button.addEventListener("click", () => select(key));
      }
    };
    renderControls = () => {
      controls.empty();
      new Setting(controls).setName(this.plugin.t("home.reviewScope")).addDropdown((dropdown) => dropdown
        .addOption("vocab", this.plugin.t("home.scopeVocab"))
        .addOption("folder", this.plugin.t("home.scopeFolder"))
        .addOption("tag", this.plugin.t("home.scopeTag"))
        .addOption("current", this.plugin.t("home.scopeCurrent"))
        .setValue(selectedScope)
        .onChange((value) => {
          if (["vocab", "folder", "tag", "current"].includes(value)) selectedScope = value as ReviewScopeMode;
          rerenderControls();
        }));
      if (selectedScope === "folder") {
        new Setting(controls).setName(this.plugin.t("home.reviewFolder")).addDropdown((dropdown) => {
          dropdown.addOption("", this.plugin.t("home.scopeAllFiles"));
          for (const folder of folders) dropdown.addOption(folder, folder);
          dropdown.setValue(selectedFolder).onChange((value) => { selectedFolder = value; });
        });
      }
      if (selectedScope === "tag") {
        new Setting(controls).setName(this.plugin.t("home.reviewTag")).addDropdown((dropdown) => {
          dropdown.addOption("", this.plugin.t("home.chooseTag"));
          for (const tag of tags) dropdown.addOption(tag, `#${tag}`);
          dropdown.setValue(selectedTag).onChange((value) => { selectedTag = value; });
        });
      }
      if (selectedScope === "current") {
        new Setting(controls).setName(this.plugin.t("home.currentNote")).setDesc(currentFile?.path || this.plugin.t("home.noCurrentNote"));
      }
      const contentSetting = new Setting(controls).setName(this.plugin.t("home.reviewContent"));
      addSegments(contentSetting, [
        ["notes", this.plugin.t("home.contentNotes")],
        ["syntax", this.plugin.t("home.contentSyntax")],
        ["both", this.plugin.t("home.contentBoth")],
      ], selectedContent, (value) => { selectedContent = value; rerenderControls(); });
      if (selectedContent !== "notes") {
        const clozeSetting = new Setting(controls).setName(this.plugin.t("home.clozeMode"));
        addSegments(clozeSetting, [
          ["separate", this.plugin.t("home.clozeSeparate")],
          ["combined", this.plugin.t("home.clozeCombined")],
        ], selectedClozeMode, (value) => { selectedClozeMode = value; rerenderControls(); });
      }
      new Setting(controls).setName(this.plugin.t("home.sortBy")).addDropdown((dropdown) => {
        dropdown
          .addOption("due", this.plugin.t("home.sortDue"))
          .addOption("wordCount", this.plugin.t("home.sortWordCount"))
          .addOption("modified", this.plugin.t("home.sortModified"))
          .addOption("created", this.plugin.t("home.sortCreated"))
          .addOption("frequency", this.plugin.t("home.frequency"))
          .addOption("random", this.plugin.t("home.random"))
          .setValue(selectedSort);
        dropdown.onChange((value) => {
          if (["due", "wordCount", "modified", "created", "frequency", "random"].includes(value)) selectedSort = value as ReviewSortKey;
          rerenderControls();
        });
      });
      if (selectedSort !== "random") {
        const directionSetting = new Setting(controls).setName(this.plugin.t("home.sortDirection"));
        addSegments(directionSetting, [
          ["asc", this.plugin.t("home.ascending")],
          ["desc", this.plugin.t("home.descending")],
        ], selectedDirection, (value) => { selectedDirection = value; rerenderControls(); });
      }
      new Setting(controls)
        .addButton((button) => button
          .setButtonText(this.plugin.t("home.start"))
          .setCta()
          .setDisabled((selectedScope === "current" && !currentFile) || (selectedScope === "tag" && !selectedTag))
          .onClick(() => this.plugin.openReview({
            scope: selectedScope,
            folder: selectedFolder,
            tag: selectedTag,
            file: currentFile?.path,
            content: selectedContent,
            clozeMode: selectedClozeMode,
            sortBy: selectedSort,
            sortDirection: selectedDirection,
          })))
        .addExtraButton((button) => button
          .setIcon("refresh-cw")
          .setTooltip(this.plugin.t("common.refresh"))
          .onClick(() => this.render()));
    };
    renderControls();

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
