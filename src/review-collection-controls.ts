import { Setting, type App, type Component } from "obsidian";
import { mountReviewSetup } from "./review-setup-controls";
import { draftReviewPlan, validReviewOptions } from "./review-setup-model";
import { ReviewPlanEditor } from "./review-plan-editor";
import type { ReviewStartHost } from "./review-start-modal";
import type { ReviewOptions } from "./types";
export function renderCollectionReview(parent: HTMLElement, app: App, host: ReviewStartHost, component: Component): void {
    const options: ReviewOptions = {dictionaryIds:null,content:"syntax",mode:"cram",batchSize:null,rounds:1};
    const t = (key: string) => host.t(key);
    let start: import("obsidian").ButtonComponent;
    component.register(mountReviewSetup(parent,app,host,options,()=>{start?.setDisabled(!validReviewOptions(options));}));
    const setting = new Setting(parent);
    setting.settingEl.addClass("lexis-review-start");
    setting.addButton(button=>button.setButtonText(t("setup.savePlan")).onClick(()=>{if(validReviewOptions(options))new ReviewPlanEditor(app,host,draftReviewPlan(options)).open();}));
    setting.addButton(button => { start = button; button.setButtonText(t("home.start")).setCta().onClick(() => host.openReview(options)); });
}
