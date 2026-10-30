import { Modal, Notice, Setting, type App } from "obsidian";
import { mountReviewSetup } from "./review-setup-controls";
import { planSelectionChanged, reviewRange, validReviewOptions } from "./review-setup-model";
import type { TranslationVars } from "./i18n";
import type { LexisSettings, ReviewPlan } from "./types";
import type { ReviewDashboard } from "./review-dashboard";
import { DEFAULT_DATA_FOLDER } from "./data-folder";

export interface PlanEditorHost {
  manifest?: {dir?: string;id: string};
  settings: LexisSettings;
  reviewDashboard: ReviewDashboard;
  t(key: string, vars?: TranslationVars): string;
  saveSettings(): Promise<void>;
}

export class ReviewPlanEditor extends Modal {
  private plan: ReviewPlan;
  private cleanup: (() => void) | null = null;
  constructor(app: App, private plugin: PlanEditorHost, plan?: ReviewPlan) {
    super(app);
    this.plan = plan ? structuredClone(plan) : { id: crypto.randomUUID(), name: "", dictionaryIds: null, content: "syntax", mode:"scheduled", rounds:1 };
  }
  onOpen(): void {
    this.setTitle(this.plugin.t(this.plugin.settings.reviewPlans.some(plan => plan.id === this.plan.id) ? "dashboard.editPlan" : "dashboard.addPlan"));
    const root = this.contentEl; root.empty(); root.addClass("lexis-plan-editor");
    const t = (key: string) => this.plugin.t(key);
    new Setting(root).setName(t("dashboard.planName")).addText(input => input.setValue(this.plan.name).onChange(value => { this.plan.name = value; }));
    let save: import("obsidian").ButtonComponent;
    this.cleanup = mountReviewSetup(root,this.app,this.plugin,this.plan,()=>{save?.setDisabled(!validReviewOptions(this.plan));},undefined,true);
    new Setting(root).setName(t("setup.deadline")).setDesc(t("setup.deadlineHint")).addText(input=>{
      input.inputEl.type="date";input.setValue(this.plan.deadline || "").onChange(value=>{this.plan.deadline=value || undefined;});
    });
    const directory=this.plugin.settings.dataFolder || DEFAULT_DATA_FOLDER;
    root.createDiv({cls:"lexis-dim",text:this.plugin.t("setup.storage",{path:`${directory}/reviews`})});
    new Setting(root).addButton(button => {
      save = button;
      button.setButtonText(t("dashboard.save")).setCta().setDisabled(!validReviewOptions(this.plan)).onClick(async () => {
        if (!validReviewOptions(this.plan)) {new Notice(t("setup.invalid"));return;}
        const index = this.plugin.settings.reviewPlans.findIndex(plan => plan.id === this.plan.id);
        const previous = this.plugin.settings.reviewPlans[index];
        const targets = { ...this.plugin.settings.reviewDailyTargets };
        const {id,name,content,mode,batchSize,rounds,deadline,sortBy,sortDirection} = this.plan;
        const saved: ReviewPlan = {id,name:name.trim() || this.plan.file || this.plan.folder || this.plan.tag || this.plan.linkSource || t("home.scopeAllDictionaries"),content,mode,batchSize,rounds,deadline,sortBy,sortDirection,...reviewRange(this.plan)};
        const changed = planSelectionChanged(previous,saved);
        if (index < 0) this.plugin.settings.reviewPlans.push(saved); else this.plugin.settings.reviewPlans[index] = saved;
        if (changed) {
          delete this.plugin.settings.reviewDailyTargets[this.plan.id];
          for (const id of Object.keys(this.plugin.settings.reviewDailyTargets)) if (id.startsWith("global:")) delete this.plugin.settings.reviewDailyTargets[id];
        }
        try { await this.plugin.saveSettings(); this.plugin.reviewDashboard.refresh(); this.close(); }
        catch { if (previous) this.plugin.settings.reviewPlans[index] = previous; else this.plugin.settings.reviewPlans.pop(); this.plugin.settings.reviewDailyTargets = targets; new Notice(t("common.failed")); }
      });
    });
  }
  onClose(): void { this.cleanup?.(); this.contentEl.empty(); }
}
