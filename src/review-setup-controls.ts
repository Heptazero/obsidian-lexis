import * as obsidian from "obsidian";
import { Setting, type App } from "obsidian";
import { addCurrentChoice } from "./settings-choice";
import { createPathSuggest } from "./settings-suggest";
import { mountDictionaryPicker } from "./dictionary-picker";
import type { LexisSettings, ReviewOptions } from "./types";

export interface ReviewSetupHost { settings: LexisSettings; t(key: string): string }

export function mountReviewSetup(parent: HTMLElement, app: App, host: ReviewSetupHost, options: ReviewOptions, changed: () => void, lockedFile?: string, plan = false): () => void {
  const root = parent.createDiv({cls:"lexis-review-setup"}), t = (key: string) => host.t(key);
  const Suggest = createPathSuggest(obsidian);
  let cleanup: (() => void) | undefined;
  const clearBatch = () => {delete options.targetKeys;delete options.dailyCardLimit;delete options.planId;delete options.excludedKeys;};
  const render = () => {
    cleanup?.(); root.empty();
    const range = new Setting(root).setName(t("setup.range"));
    if (lockedFile) range.setDesc(lockedFile);
    else {
      const kind = options.scope || "dictionary";
      addCurrentChoice(range, (["dictionary","folder","tag","current","links"] as const).map(value=>({value,label:t(`setup.${value}`)})), kind, value => {
        clearBatch();
        delete options.dictionaryIds; delete options.scope; delete options.sources;
        delete options.file; delete options.folder; delete options.tag; delete options.linkSource;
        if (value === "dictionary") options.dictionaryIds = null; else options.scope = value;
        render(); changed();
      });
      if (kind === "dictionary") cleanup = mountDictionaryPicker(root, app, host.settings.dicts, options.dictionaryIds ?? null, ids=>{clearBatch();options.dictionaryIds=ids;changed();}, t);
      else {
        const property = kind === "current" ? "file" : kind === "links" ? "linkSource" : kind === "folder" ? "folder" : "tag";
        range.addText(input => {
          const apply = (value: string) => {clearBatch();options[property]=value;input.setValue(value);changed(); };
          input.setPlaceholder(t("dashboard.chooseSource")).setValue(options[property] || "").onChange(apply);
          const suggest = new Suggest(app,input.inputEl,()=> {
            if (kind === "folder") return app.vault.getAllLoadedFiles().filter(file=>"children" in file).map(file=>file.path);
            if (kind === "tag") {
              const tags = new Set<string>();
              for (const file of app.vault.getMarkdownFiles()) {
                const cache = app.metadataCache.getFileCache(file);
                for (const tag of cache?.tags || []) tags.add(tag.tag);
                const raw: unknown = cache?.frontmatter?.tags;
                for (const tag of Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;\s]+/) : []) if (typeof tag === "string") tags.add(`#${tag.replace(/^#/,"")}`);
              }
              return [...tags];
            }
            return app.vault.getMarkdownFiles().map(file=>file.path);
          },apply,{fuzzy:true});
          cleanup = () => suggest.close();
        });
      }
    }
    addCurrentChoice(new Setting(root).setName(t("home.reviewContent")), (["notes","context","syntax","both"] as const).map(value=>({value,label:t(`home.content${value === "notes" ? "Notes" : value === "context" ? "Context" : value === "syntax" ? "Syntax" : "Both"}`)})), options.content || "syntax", value=>{clearBatch();options.content=value;changed();});
    addCurrentChoice(new Setting(root).setName(t("setup.mode")).setDesc(t(options.mode === "cram" ? "setup.cramHint" : "setup.scheduledHint")), (["scheduled","cram"] as const).map(value=>({value,label:t(`setup.${value}`)})), options.mode || "scheduled",value=>{options.mode=value;render();changed();});
    new Setting(root).setName(t(plan ? "setup.dailyCount" : "setup.count")).addText(input=>{
      input.inputEl.type="number";input.inputEl.min="1";input.inputEl.step="1";
      input.setPlaceholder(t(plan && options.mode !== "cram" ? "setup.defaultGoal" : "setup.all")).setValue(options.batchSize == null ? "" : String(options.batchSize)).onChange(value=>{options.batchSize=value.trim() ? Number(value) : plan && options.mode !== "cram" ? undefined : null;changed();});
    });
    if (options.mode === "cram") new Setting(root).setName(t("setup.rounds")).addText(input=>{
      input.inputEl.type="number";input.inputEl.min="1";input.inputEl.step="1";
      input.setValue(String(options.rounds ?? 1)).onChange(value=>{options.rounds=Number(value);changed();});
    });
    const sort = root.createEl("details");sort.createEl("summary",{text:t("setup.sort")});
    addCurrentChoice(new Setting(sort).setName(t("home.sortBy")), ([["due","home.sortDue"],["wordCount","home.sortWordCount"],["modified","home.sortModified"],["created","home.sortCreated"],["frequency","home.frequency"],["random","home.random"]] as const).map(([value,label])=>({value,label:t(label)})),options.sortBy || "due",value=>{options.sortBy=value;changed();});
    addCurrentChoice(new Setting(sort).setName(t("home.sortDirection")), (["asc","desc"] as const).map(value=>({value,label:t(value === "asc" ? "home.ascending" : "home.descending")})),options.sortDirection || "asc",value=>{options.sortDirection=value;changed();});
  };
  render(); return () => {cleanup?.();root.remove();};
}
