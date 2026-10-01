"use strict";

import { Notice, TFile } from "obsidian";
import type { HighlightStyle, LexisEntry, TagRule } from "./types";
import type { Occurrence } from "./occurrence-search";
import { parseSectionLinks, relationHeading, relationTypes } from "./relation-sections";
import { cssColorToHex, escapeRe, todayString as todayStr } from "./shared-utils";
import { LexisPluginBase, errorMessage, type RelationBag, type TranslationVars } from "./plugin-base";

export abstract class LexisPluginDictionary extends LexisPluginBase {
  abstract recordEncounter(file: TFile, type: "hover" | "add" | "open"): void;
  t(key: string, vars?: TranslationVars): string { return this.i18n ? this.i18n.t(key, vars) : key; }
  async saveSettings() { await this.saveData(this.settings); }
  applyReviewMetadataVisibility() {
    if (this._workspaceDocuments) {
      this._workspaceDocuments.forEach((document) => document.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata));
      return;
    }
    this.app.workspace.containerEl.ownerDocument.body?.classList.toggle("lexis-show-review-metadata", !!this.settings.showReviewMetadata);
  }
  parseTagRulesText(text: string): TagRule[] {
    const rules: TagRule[] = [];
    for (const line of (text || "").split("\n")) {
      const m = /^\s*#?([^:：]+)[:：]\s*(\S+)(?:\s+(wavy|underline|background))?\s*$/.exec(line);
      if (m) rules.push({ tag: m[1].trim(), color: m[2].trim(), style: (m[3] || "") as HighlightStyle | "" });
    }
    return rules;
  }

  // ---------- 出处 & 相关词 ----------
  parseFolders(text: string): string[] { return (text || "").split(/[,，\n]/).map((s) => this.normalizeFolder(s)).filter(Boolean); }
  parseTags(text: string): string[] { return (text || "").split(/[,，;；\s]+/).map((s) => s.trim().replace(/^#/, "").toLowerCase()).filter(Boolean); }
  vocabTagSet() {
    const tags = new Set(this.parseTags(this.settings.vocabTags));
    for (const item of this.settings.dicts || []) for (const tag of this.parseTags(item?.tag || "")) tags.add(tag);
    return tags;
  }
  excludeTagSet() { return new Set(this.parseTags(this.settings.excludeTags)); }
  // 词典表的文件夹列表 = 文件夹来源的单一真相
  dictFolders() { return (this.settings.dicts || []).map((d) => this.normalizeFolder(d && d.folder)).filter(Boolean); }
  // 一条词的最终高亮色(优先级:标签规则 > 词典色 > 全局兜底),返回解析后的真实 hex —— 网页和 ob 同一套优先级
  colorForEntry(e: LexisEntry): string {
    let color = this.effectiveHighlightColor();           // 全局兜底(留空=主题色,已解析)
    const dc = this.dictColorForFile(e && e.file);         // 词典映射
    if (dc) color = dc;
    if (e && e.tags && this.settings.tagRules && this.settings.tagRules.length) { // 标签映射(最高)
      const rule = this.settings.tagRules.find((r) => r.tag && e.tags.has(r.tag.toLowerCase()));
      if (rule && rule.color) color = rule.color;
    }
    const inlineColor = this.inlineCategoryColor(e);
    if (inlineColor) color = inlineColor;
    return color;
  }
  // 一条词的最终线型(标签规则可覆盖全局)
  styleKindForEntry(e: LexisEntry): HighlightStyle {
    let s = this.settings.highlightStyle || "wavy";
    if (e && e.tags && this.settings.tagRules && this.settings.tagRules.length) {
      const rule = this.settings.tagRules.find((r) => r.tag && e.tags.has(r.tag.toLowerCase()));
      if (rule && rule.style) s = rule.style;
    }
    return s;
  }
  // 全局高亮色的"实际值":留空(=主题强调色)时解析成真实 hex 发给网页,否则网页只能看到 var(--text-accent) 这种 ob 专用变量、读不到
  effectiveHighlightColor() {
    const c = (this.settings.highlightColor || "").trim();
    if (c) return c;
    const document = this._workspaceDocuments?.current() || this.app.workspace.containerEl.ownerDocument;
    try { return cssColorToHex(document.defaultView?.getComputedStyle(document.body).getPropertyValue("--text-accent") || "", document); }
    catch { return "#7c5cff"; }
  }
  // { 规范化文件夹: 颜色 },只含设了专属色的词典;供网页按所属词典着色
  dictColorMap(): Record<string, string> {
    const m: Record<string, string> = {};
    for (const d of this.settings.dicts || []) {
      const f = this.normalizeFolder(d && d.folder);
      const c = (d && d.color || "").trim();
      if (f && c) m[f] = c;
    }
    return m;
  }
  primaryVocabFolder() { return this.dictFolders()[0] || ""; } // 新建单词时落地的文件夹(取第一个)
  inFolderScope(path: string): boolean { const fs = this.dictFolders(); return fs.length ? this.inScope(path, fs) : false; }
  // 某文件夹对应的模板:命中某词典行 → 完全按它的 template(留空=空白笔记,不再回退全局);
  // 没有对应词典行(极少见)→ 才用全局默认 newWordTemplate。这样"没给这个词典选模板"= 空白,符合直觉。
  templateForFolder(folder: string): Promise<string | null> {
    return this.templateProvider.readLexis(folder);
  }
  isVocabFile(file: TFile | null | undefined): boolean {
    if (!file || !file.path) return false;
    if (this.inFolderScope(file.path)) return true;
    const ts = this.vocabTagSet();
    if (ts.size) { for (const t of this.getTags(file)) if (ts.has(t)) return true; }
    return false;
  }
  inScope(path: string, scope: string[]): boolean { if (!scope.length) return true; return scope.some((f) => path === f || path.startsWith(f + "/")); }
  extractSentence(content: string, idx: number): string {
    const bound = /[.!?。！？\n]/;
    let s = idx; while (s > 0 && !bound.test(content[s - 1])) s--;
    let e = idx; while (e < content.length && !bound.test(content[e])) e++;
    let sent = content.slice(s, e + 1).replace(/\s+/g, " ").trim();
    if (sent.length > 220) sent = sent.slice(0, 220) + "…";
    return sent;
  }
  async findOccurrences(word: string): Promise<Occurrence[]> {
    const key = word.toLowerCase();
    if (this._occCache.has(key)) return this._occCache.get(key);
    const limit = this.settings.occurrenceLimit || 6;
    const scope = this.parseFolders(this.settings.occurrenceFolders);
    const results = await this.occurrenceSearch.find(word, { limit, scope, includePdf: this.settings.includePdfOccurrences !== false });
    this._occCache.set(key, results);
    return results;
  }
  findRelated(file: TFile): TFile[] {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const set = new Set<string>();
    for (const src in resolved) { if (resolved[src][file.path] && this.inVocabFolder(src) && src !== file.path) set.add(src); }
    const out = resolved[file.path] || {};
    for (const dest in out) { if (this.inVocabFolder(dest) && dest !== file.path) set.add(dest); }
    return [...set].map((p) => this.app.vault.getAbstractFileByPath(p)).filter((file): file is TFile => file instanceof TFile);
  }
  async findTypedRelations(file: TFile): Promise<{ out: RelationBag; inc: RelationBag }> {
    const out: Record<string, Map<string, string>> = {}, inc: Record<string, Map<string, string>> = {};
    const put = (bag: Record<string, Map<string, string>>, type: string, tf: TFile | null) => { if (!tf || tf.path === file.path) return; (bag[type] = bag[type] || new Map<string, string>()).set(tf.path, tf.basename); };
    // 出链:本词笔记里每个 [[link]] 在哪个段下
    try {
      const raw = await this.app.vault.cachedRead(file);
      for (const { type, target } of parseSectionLinks(raw)) {
        const tf = this.app.metadataCache.getFirstLinkpathDest(target, file.path);
        if (tf && this.inVocabFolder(tf.path)) put(out, type, tf);
      }
    } catch { /* A relation panel can render from the remaining links. */ }
    // 入链:其它词在哪个段下链了本词(实现双向)
    const resolved = this.app.metadataCache.resolvedLinks || {};
    for (const src in resolved) {
      if (!this.inVocabFolder(src) || src === file.path || !resolved[src][file.path]) continue;
      const srcFile = this.app.vault.getAbstractFileByPath(src);
      if (!(srcFile instanceof TFile)) continue;
      try {
        const raw = await this.app.vault.cachedRead(srcFile);
        let matched = false;
        for (const { type, target } of parseSectionLinks(raw)) {
          const tf = this.app.metadataCache.getFirstLinkpathDest(target, src);
          if (tf && tf.path === file.path) { put(inc, type, srcFile); matched = true; }
        }
        if (!matched) put(inc, "相关", srcFile);
      } catch { /* Skip unreadable related notes. */ }
    }
    const toArr = (bag: Record<string, Map<string, string>>): RelationBag => { const result: RelationBag = {}; for (const type in bag) result[type] = [...bag[type].entries()].map(([path, basename]) => ({ path, basename })); return result; };
    return { out: toArr(out), inc: toArr(inc) };
  }
  async renderDerivedWords(container: HTMLElement, file: TFile): Promise<void> {
    const resolved = this.app.metadataCache.resolvedLinks || {};
    const map = new Map<string, string>();
    for (const src in resolved) {
      if (this.inVocabFolder(src) && resolved[src] && resolved[src][file.path]) {
        const sf = this.app.vault.getAbstractFileByPath(src);
        if (sf instanceof TFile) map.set(src, sf.basename);
      }
    }
    if (!map.size) return;
    container.createDiv({ cls: "lexis-section-title", text: `🌱 派生词 (${map.size})` });
    const w = container.createDiv({ cls: "lexis-related" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
  }
  relLink(w: HTMLElement, path: string, basename: string): void {
    const a = w.createEl("a", { text: basename, href: "#" });
    a.addEventListener("click", (e) => { e.preventDefault(); const f = this.app.vault.getAbstractFileByPath(path); if (f instanceof TFile) { void this.app.workspace.getLeaf(false).openFile(f); this.removePopover(); } });
  }
  async renderTypedRelations(container: HTMLElement, file: TFile): Promise<number> {
    const { out, inc } = await this.findTypedRelations(file);
    const order = relationTypes(out, inc);
    let n = 0;
    for (const t of order) {
      const map = new Map<string, string>();
      for (const r of (out[t] || [])) map.set(r.path, r.basename);
      for (const r of (inc[t] || [])) map.set(r.path, r.basename);
      if (!map.size) continue;
      container.createDiv({ cls: "lexis-section-title", text: "🔗 " + t });
      const w = container.createDiv({ cls: "lexis-related" });
      for (const [path, basename] of map) { this.relLink(w, path, basename); n++; }
    }
    return n;
  }
  async renderReverseRelations(container: HTMLElement, file: TFile, type: string): Promise<number> {
    const { out, inc } = await this.findTypedRelations(file);
    const name = relationHeading(type);
    const types = name === "辨析" ? ["辨析", "相关"] : [name];
    const outPaths = new Set<string>();
    for (const t of types) for (const r of (out[t] || [])) outPaths.add(r.path);
    const map = new Map<string, string>();
    for (const t of types) for (const r of (inc[t] || [])) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
    if (!map.size) return 0;
    const w = container.createDiv({ cls: "lexis-related lexis-rel-reverse" });
    for (const [path, basename] of map) this.relLink(w, path, basename);
    return map.size;
  }
  async getCuratedSourcePaths(wordFile: TFile): Promise<Set<string>> {
    try {
      const raw = await this.app.vault.cachedRead(wordFile);
      const names = [this.occurrenceHeadingText(), "例句", "出处"].filter(Boolean).map(escapeRe).join("|");
      const m = new RegExp("#{1,6}\\s*(?:" + names + ")([^\\n]*\\n[\\s\\S]*?)(?=\\n#{1,6}\\s|\\n```|$)").exec(raw);
      if (!m) return new Set();
      const set = new Set<string>();
      const re = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
      let mm;
      while ((mm = re.exec(m[1]))) {
        const base = mm[1].trim().split("/").pop().replace(/\.(?:md|pdf)$/i, "");
        set.add(base.toLowerCase());
      }
      return set;
    } catch { return new Set(); }
  }
  sourceLinkTarget(file: TFile | null | undefined): string { return file?.extension === "md" ? file.basename : file?.name || ""; }
  async addExampleToWord(wordFile: TFile, sentence: string, sourceFile?: TFile | null, page?: number): Promise<boolean> {
    if (sourceFile) {
      const curated = await this.getCuratedSourcePaths(wordFile);
      if (curated.has(sourceFile.basename.toLowerCase())) { new Notice(this.t("notice.occurrenceExists")); return true; }
    }
    const occurrence = {
      word: wordFile.basename,
      sentence: (sentence || "").trim(),
      source: sourceFile ? (page ? `[[${this.sourceLinkTarget(sourceFile)}#page=${page}|${sourceFile.basename} p.${page}]]` : `[[${this.sourceLinkTarget(sourceFile)}]]`) : "",
      date: todayStr(),
    };
    const apply = (data: string) => this.insertOccurrence(data, occurrence);
    try {
      if (this.app.vault.process) await this.app.vault.process(wordFile, apply);
      else { const d = await this.app.vault.read(wordFile); await this.app.vault.modify(wordFile, apply(d)); }
      this.recordEncounter(wordFile, "add");
      new Notice(this.t("notice.occurrenceSaved"));
      return true;
    } catch (err) { new Notice(this.t("notice.occurrenceFailed", { error: errorMessage(err) })); return false; }
  }

}

export function pluginDictionaryDescriptors(): PropertyDescriptorMap {
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(LexisPluginDictionary.prototype);
  return descriptors;
}
