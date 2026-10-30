import type { ReviewOptions, ReviewPlan, ReviewRange } from "./types";

export function reviewRange(options: ReviewRange): ReviewRange {
  if (options.scope) {
    const {scope} = options;
    if (scope === "current") return {scope,file:options.file};
    if (scope === "tag") return {scope,tag:options.tag};
    if (scope === "links") return {scope,linkSource:options.linkSource};
    return {scope,folder:options.folder};
  }
  return options.dictionaryIds !== undefined ? {dictionaryIds:options.dictionaryIds} : options.sources ? {sources:options.sources} : {dictionaryIds:null};
}

export function validReviewOptions(options: ReviewOptions): boolean {
  const count = options.batchSize;
  if (count != null && (!Number.isInteger(count) || count < 1)) return false;
  if (options.mode === "cram" && (!Number.isInteger(options.rounds ?? 1) || (options.rounds ?? 1) < 1)) return false;
  if (!options.scope && options.dictionaryIds !== undefined) return options.dictionaryIds === null || options.dictionaryIds.length > 0;
  if (options.scope === "current") return !!options.file?.trim();
  if (options.scope === "folder") return !!options.folder?.trim();
  if (options.scope === "tag") return !!options.tag?.replace(/^#/, "").trim();
  if (options.scope === "links") return !!options.linkSource?.trim();
  return true;
}

export const deadlineDays = (deadline: string | undefined, today: string): number | null => {
  if (!deadline) return null;
  const value = Date.parse(`${deadline}T00:00:00Z`), now = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(value) && Number.isFinite(now) ? Math.round((value-now)/86400000) : null;
};

export function planSelectionChanged(previous: ReviewPlan | undefined, next: ReviewPlan): boolean {
  const selection = (plan: ReviewPlan) => ({...reviewRange(plan),content:plan.content,mode:plan.mode || "scheduled",batchSize:plan.batchSize,rounds:plan.rounds,sortBy:plan.sortBy,sortDirection:plan.sortDirection});
  return !previous || JSON.stringify(selection(previous)) !== JSON.stringify(selection(next));
}

export function renameReviewPlanPaths(plans: ReviewPlan[], before: string, after: string): boolean {
  const oldPath = before.normalize("NFC"), newPath = after.normalize("NFC");
  let changed = false;
  const rename = (path: string) => {
    const value = path.normalize("NFC");
    if (value !== oldPath && !value.startsWith(`${oldPath}/`)) return path;
    changed = true;return newPath+value.slice(oldPath.length);
  };
  for (const plan of plans) {
    for (const key of ["file","folder","linkSource"] as const) if(plan[key])plan[key]=rename(plan[key]);
    for (const source of plan.sources || []) if(source.scope !== "tag") source.value=rename(source.value);
  }
  return changed;
}

export function draftReviewPlan(options: ReviewOptions): ReviewPlan {
  return {id:crypto.randomUUID(),name:"",...reviewRange(options),content:options.content || "syntax",mode:options.mode,batchSize:options.batchSize,rounds:options.rounds,sortBy:options.sortBy,sortDirection:options.sortDirection};
}
