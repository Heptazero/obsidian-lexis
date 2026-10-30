import { reviewItemKeys } from "./review-item";
import type { ReviewBatch } from "./review-batch";
import type { ReviewOptions } from "./types";

export function renderBatchContinuation(parent: HTMLElement, options: ReviewOptions, batch: ReviewBatch | null, t: (key: string, vars?: Record<string,number>)=>string, configure: (options: ReviewOptions)=>void): void {
  if (!batch?.items.length) return;
  const keys = [...new Set(batch.items.flatMap(reviewItemKeys))];
  const base: ReviewOptions = {...options,planId:undefined,dailyCardLimit:undefined,targetKeys:undefined};
  const actions = parent.createDiv({cls:"lexis-rv-batch-actions"});
  actions.createEl("button",{text:t("setup.repeat"),attr:{type:"button"}}).onclick = ()=>configure({...base,mode:"cram",batchSize:null,rounds:1,targetKeys:keys,excludedKeys:undefined});
  const remaining = new Set(batch.remaining.flatMap(reviewItemKeys)).size;
  if (remaining) actions.createEl("button",{text:t("setup.remaining",{count:remaining}),attr:{type:"button"}}).onclick = ()=>configure({...base,batchSize:null,targetKeys:[...new Set(batch.remaining.flatMap(reviewItemKeys))],excludedKeys:[...new Set([...(options.excludedKeys || []),...keys])]});
}
