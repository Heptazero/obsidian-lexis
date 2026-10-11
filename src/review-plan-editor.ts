import { AbstractInputSuggest, Modal, Notice, prepareFuzzySearch, Setting, type App } from "obsidian";
import { addCurrentChoice } from "./settings-choice";
import type { TranslationVars } from "./i18n";
import type { LexisSettings, ReviewPlan, ReviewSource } from "./types";
import type { ReviewDashboard } from "./review-dashboard";

export interface PlanEditorHost {
  settings: LexisSettings;
  reviewDashboard: ReviewDashboard;
  t(key: string, vars?: TranslationVars): string;
  dictFolders(): string[];
  collectReviewFolders(): string[];
  collectReviewTags(): string[];
  saveSettings(): Promise<void>;
}

const scopeLabel: Record<ReviewSource["scope"], string> = {
  vocab: "home.scopeVocab", folder: "home.scopeFolder", links: "home.scopeLinks", tag: "home.scopeTag",
};

class SourceSuggest extends AbstractInputSuggest<string> {
  constructor(app: App, input: HTMLInputElement, private items: () => string[], private pick: (value: string) => void) { super(app, input); }
  getSuggestions(query: string): string[] {
    const match = prepareFuzzySearch(query.trim());
    return this.items().filter((value) => !query.trim() || match(value)).slice(0, 50);
  }
  renderSuggestion(value: string, element: HTMLElement): void { element.setText(value); }
  selectSuggestion(value: string): void { this.setValue(""); this.close(); this.pick(value); }
}

export class ReviewPlanEditor extends Modal {
  private plan: ReviewPlan;
  private sourceScope: ReviewSource["scope"] = "folder";
  private suggest: SourceSuggest | null = null;

  constructor(app: App, private plugin: PlanEditorHost, plan?: ReviewPlan) {
    super(app);
    this.plan = plan ? { ...plan, sources: plan.sources.map((source) => ({ ...source })) } : { id: crypto.randomUUID(), name: "", sources: [], content: "syntax" };
  }

  onOpen(): void {
    this.setTitle(this.plugin.t(this.plugin.settings.reviewPlans.some((plan) => plan.id === this.plan.id) ? "dashboard.editPlan" : "dashboard.addPlan"));
    this.render();
  }

  private render(): void {
    this.suggest?.close();
    const root = this.contentEl;
    root.empty(); root.addClass("lexis-plan-editor");
    const t = (key: string) => this.plugin.t(key);
    new Setting(root).setName(t("dashboard.planName")).addText((input) => input.setValue(this.plan.name).onChange((value) => { this.plan.name = value; }));
    const source = new Setting(root).setName(t("dashboard.source")).setDesc(t("dashboard.sources"));
    addCurrentChoice(source, Object.entries(scopeLabel).map(([value, label]) => ({ value: value as ReviewSource["scope"], label: t(label) })),
      this.sourceScope, (value) => { this.sourceScope = value; this.render(); });
    const values = () => {
      if (this.sourceScope === "folder") return this.plugin.collectReviewFolders();
      if (this.sourceScope === "vocab") return [t("home.scopeAllDictionaries"), ...this.plugin.dictFolders()];
      if (this.sourceScope === "tag") return this.plugin.collectReviewTags().map((tag) => `#${tag}`);
      return this.app.vault.getMarkdownFiles().map((file) => file.path);
    };
    const add = (input: string) => {
      const text = input.trim();
      if (!values().includes(text)) return;
      const value = this.sourceScope === "vocab" && text === t("home.scopeAllDictionaries") ? "" : this.sourceScope === "tag" ? text.replace(/^#/, "") : text;
      if (!this.plan.sources.some((item) => item.scope === this.sourceScope && item.value === value)) this.plan.sources.push({ scope: this.sourceScope, value });
      this.render();
    };
    const input = root.createEl("input", { cls: "lexis-plan-source-input", attr: { type: "search", placeholder: t("dashboard.chooseSource") } });
    this.suggest = new SourceSuggest(this.app, input, values, add);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter" && values().includes(input.value.trim())) { event.preventDefault(); add(input.value); } });
    const sources = root.createDiv({ cls: "lexis-plan-sources" });
    this.plan.sources.forEach((item, index) => {
      const row = sources.createDiv({ cls: "lexis-plan-source" });
      row.createSpan({ text: `${t(scopeLabel[item.scope])} · ${item.scope === "tag" ? "#" : ""}${item.value || t("home.scopeAllDictionaries")}` });
      const remove = row.createEl("button", { text: "×", attr: { type: "button", "aria-label": t("common.delete") } });
      remove.onclick = () => { this.plan.sources.splice(index, 1); this.render(); };
    });
    const content = new Setting(root).setName(t("home.reviewContent"));
    addCurrentChoice(content, ([ ["notes", "home.contentNotes"], ["context", "home.contentContext"], ["syntax", "home.contentSyntax"], ["both", "home.contentBoth"] ] as const)
      .map(([value, label]) => ({ value, label: t(label) })), this.plan.content, (value) => { this.plan.content = value; });
    new Setting(root).addButton((button) => button.setButtonText(t("dashboard.save")).setCta().setDisabled(!this.plan.sources.length).onClick(async () => {
      const name = this.plan.name.trim() || this.plan.sources[0]?.value || t("home.scopeAllDictionaries");
      const index = this.plugin.settings.reviewPlans.findIndex((plan) => plan.id === this.plan.id);
      const saved = { ...this.plan, name };
      const previous = this.plugin.settings.reviewPlans[index];
      const scopeChanged = !previous || previous.content !== saved.content || JSON.stringify(previous.sources) !== JSON.stringify(saved.sources);
      if (index < 0) this.plugin.settings.reviewPlans.push(saved);
      else this.plugin.settings.reviewPlans[index] = saved;
      if (scopeChanged) {
        delete this.plugin.settings.reviewDailyTargets[this.plan.id];
        for (const id of Object.keys(this.plugin.settings.reviewDailyTargets)) if (id.startsWith("global:")) delete this.plugin.settings.reviewDailyTargets[id];
      }
      try { await this.plugin.saveSettings(); this.plugin.reviewDashboard.refresh(); this.close(); }
      catch { new Notice(t("common.failed")); }
    }));
  }

  onClose(): void { this.suggest?.close(); this.contentEl.empty(); }
}
