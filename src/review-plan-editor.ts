import { Modal, Notice, Setting, type App } from "obsidian";
import { addCurrentChoice } from "./settings-choice";
import { mountDictionaryPicker } from "./dictionary-picker";
import type { TranslationVars } from "./i18n";
import type { LexisSettings, ReviewPlan } from "./types";
import type { ReviewDashboard } from "./review-dashboard";

export interface PlanEditorHost {
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
    this.plan = plan ? structuredClone(plan) : { id: crypto.randomUUID(), name: "", dictionaryIds: [], content: "syntax" };
  }
  onOpen(): void {
    this.setTitle(this.plugin.t(this.plugin.settings.reviewPlans.some(plan => plan.id === this.plan.id) ? "dashboard.editPlan" : "dashboard.addPlan"));
    const root = this.contentEl; root.empty(); root.addClass("lexis-plan-editor");
    const t = (key: string) => this.plugin.t(key);
    new Setting(root).setName(t("dashboard.planName")).addText(input => input.setValue(this.plan.name).onChange(value => { this.plan.name = value; }));
    new Setting(root).setName(t("home.reviewDictionary")).setDesc(t("collection.sourcesHint"));
    let save: import("obsidian").ButtonComponent;
    this.cleanup = mountDictionaryPicker(root, this.app, this.plugin.settings.dicts, this.plan.dictionaryIds ?? null, ids => {
      this.plan.dictionaryIds = ids; save?.setDisabled(ids !== null && !ids.length);
    }, t);
    addCurrentChoice(new Setting(root).setName(t("home.reviewContent")), ([
      ["notes", "home.contentNotes"], ["context", "home.contentContext"], ["syntax", "home.contentSyntax"], ["both", "home.contentBoth"],
    ] as const).map(([value, label]) => ({ value, label: t(label) })), this.plan.content, value => { this.plan.content = value; });
    new Setting(root).addButton(button => {
      save = button;
      button.setButtonText(t("dashboard.save")).setCta().setDisabled(this.plan.dictionaryIds !== null && !this.plan.dictionaryIds?.length).onClick(async () => {
        const index = this.plugin.settings.reviewPlans.findIndex(plan => plan.id === this.plan.id);
        const previous = this.plugin.settings.reviewPlans[index];
        const targets = { ...this.plugin.settings.reviewDailyTargets };
        const saved = { ...this.plan, name: this.plan.name.trim() || t("home.scopeAllDictionaries") };
        delete saved.sources;
        const changed = !previous || previous.content !== saved.content || JSON.stringify(previous.dictionaryIds) !== JSON.stringify(saved.dictionaryIds);
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
