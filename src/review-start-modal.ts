import { Modal, Notice, Setting, type App } from "obsidian";
import { mountReviewSetup } from "./review-setup-controls";
import { draftReviewPlan, validReviewOptions } from "./review-setup-model";
import { ReviewPlanEditor, type PlanEditorHost } from "./review-plan-editor";
import type { ReviewOptions } from "./types";

export interface ReviewStartHost extends PlanEditorHost { openReview(options: ReviewOptions): Promise<void> }

export class ReviewStartModal extends Modal {
  private cleanup: (()=>void) | undefined;
  private options: ReviewOptions;
  constructor(app: App, private host: ReviewStartHost, options: ReviewOptions = {dictionaryIds:null,content:"syntax",mode:"cram",batchSize:null,rounds:1}, private lockedFile?: string) {
    super(app); this.options = structuredClone(options);
  }
  onOpen(): void {
    this.setTitle(this.host.t("setup.title"));
    let start: import("obsidian").ButtonComponent;
    this.cleanup = mountReviewSetup(this.contentEl,this.app,this.host,this.options,()=>{start?.setDisabled(!validReviewOptions(this.options));},this.lockedFile);
    new Setting(this.contentEl).addButton(button=>button.setButtonText(this.host.t("setup.savePlan")).onClick(()=>{
      if (!validReviewOptions(this.options)) {new Notice(this.host.t("setup.invalid"));return;}
      new ReviewPlanEditor(this.app,this.host,draftReviewPlan(this.options)).open();
    })).addButton(button=>{
      start=button;
      button.setButtonText(this.host.t("home.start")).setCta().setDisabled(!validReviewOptions(this.options)).onClick(async()=>{
        button.setDisabled(true);
        try {await this.host.openReview(this.options);this.close();}
        catch {button.setDisabled(false);new Notice(this.host.t("common.failed"));}
      });
    });
  }
  onClose(): void {this.cleanup?.();this.contentEl.empty();}
}
