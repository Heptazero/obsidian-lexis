"use strict";

import type { App, Component as ObsidianComponent, TFile as ObsidianTFile } from "obsidian";
import { createBridgeRenderApi } from "./bridge-render-api";
import type { Occurrence } from "./occurrence-search";
import type { HighlightStyle, InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats, ReviewHistoryEvent } from "./types";

type TemplateVars = Record<string, unknown>;
type BridgePayload = Record<string, unknown>;
type Relation = { path: string; basename: string };
type RelationBag = Record<string, Relation[]>;
type CurveCard = {
  s?: number | null;
  due?: string | null;
  last?: string | null;
  history?: ReviewHistoryEvent[];
};
type OccurrenceVars = TemplateVars & {
  word?: unknown;
  sentence?: unknown;
  source?: unknown;
  date?: unknown;
};

interface BridgeApiDependencies {
  DEFAULT_SETTINGS: Pick<LexisSettings, "occurrenceTemplate">;
  TFile: typeof ObsidianTFile;
  Component: typeof ObsidianComponent;
  todayStr: () => string;
  recentReviewDates: (card: CurveCard, limit?: number) => string[];
  escapeRe: (value: string) => string;
  renderLexisMarkdown: (app: App, markdown: string, element: HTMLElement, sourcePath: string, component: ObsidianComponent) => Promise<void>;
  finishRenderMath: () => Promise<void>;
  escHtml: (value: string) => string;
  saveAnnotationImage: (app: App, settings: LexisSettings, wordFile: ObsidianTFile, image: File) => Promise<ObsidianTFile>;
  vaultImageDataUrl: (app: App, linkPath: string, sourcePath: string) => Promise<string | null>;
}

interface BridgeApiHost {
  app: App;
  settings: LexisSettings;
  t(key: string, vars?: Record<string, string | number | boolean | null | undefined>): string;
  index: Map<string, LexisEntry>;
  stats: LexisStats;
  inlineCategoryOccurrences: InlineCategoryOccurrence[];
  manifest: { version: string };
  _occCache: Map<string, Occurrence[]>;
  sanitizeName(value: string): string;
  normalizeFolder(value: string): string;
  dictFolders(): string[];
  primaryVocabFolder(): string;
  getTags(file: ObsidianTFile): Set<string>;
  rebuildIndex(notify: boolean): Promise<void>;
  recordEncounter(file: ObsidianTFile, type: string): void;
  scheduleRebuild(): void;
  ensureFolder(folder: string): Promise<void>;
  templateForFolder(folder: string): Promise<string | null>;
  minimalSkeleton(): string;
  createEntryFile(path: string, folder: string, fallbackContent: string, transform: (content: string) => string): Promise<ObsidianTFile>;
  parseTags(value: string): string[];
  colorForEntry(entry: LexisEntry): string;
  highlightAlphaForEntry(entry: LexisEntry): number;
  highlightVisibleForEntry(entry: LexisEntry, includeDictionary?: boolean): boolean;
  styleKindForEntry(entry: LexisEntry): HighlightStyle;
  effectiveHighlightColor(): string;
  dictColorMap(): Record<string, string>;
  compactSections(markdown: string): string;
  hoverFeedback(file: ObsidianTFile): Promise<void>;
  renderInlineEntryInto(element: HTMLElement, entry: LexisEntry, component: ObsidianComponent): Promise<void>;
  inVocabFolder(path: string): boolean;
  readCard(file: ObsidianTFile): CurveCard;
  buildCurveSVG(card: CurveCard): string | null;
  findTypedRelations(file: ObsidianTFile): Promise<{ out: RelationBag; inc: RelationBag }>;
  findOccurrences(word: string): Promise<Occurrence[]>;
  getCuratedSourcePaths(file: ObsidianTFile): Promise<Set<string>>;
  boldMatchesInPlace(element: HTMLElement, word: string): void;
  resolveIndexKey(value: string): string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown error";
}

function textValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

function createBridgeApi({ DEFAULT_SETTINGS, TFile, Component, todayStr, recentReviewDates, escapeRe, renderLexisMarkdown, finishRenderMath, escHtml, saveAnnotationImage, vaultImageDataUrl }: BridgeApiDependencies): PropertyDescriptorMap {
  class BridgeApi {
  declare app: BridgeApiHost["app"];
  declare settings: BridgeApiHost["settings"];
  declare t: BridgeApiHost["t"];
  declare index: BridgeApiHost["index"];
  declare stats: BridgeApiHost["stats"];
  declare inlineCategoryOccurrences: BridgeApiHost["inlineCategoryOccurrences"];
  declare manifest: BridgeApiHost["manifest"];
  declare _occCache: BridgeApiHost["_occCache"];
  declare sanitizeName: BridgeApiHost["sanitizeName"];
  declare normalizeFolder: BridgeApiHost["normalizeFolder"];
  declare dictFolders: BridgeApiHost["dictFolders"];
  declare primaryVocabFolder: BridgeApiHost["primaryVocabFolder"];
  declare getTags: BridgeApiHost["getTags"];
  declare rebuildIndex: BridgeApiHost["rebuildIndex"];
  declare recordEncounter: BridgeApiHost["recordEncounter"];
  declare scheduleRebuild: BridgeApiHost["scheduleRebuild"];
  declare ensureFolder: BridgeApiHost["ensureFolder"];
  declare templateForFolder: BridgeApiHost["templateForFolder"];
  declare minimalSkeleton: BridgeApiHost["minimalSkeleton"];
  declare createEntryFile: BridgeApiHost["createEntryFile"];
  declare parseTags: BridgeApiHost["parseTags"];
  declare colorForEntry: BridgeApiHost["colorForEntry"];
  declare highlightAlphaForEntry: BridgeApiHost["highlightAlphaForEntry"];
  declare highlightVisibleForEntry: BridgeApiHost["highlightVisibleForEntry"];
  declare styleKindForEntry: BridgeApiHost["styleKindForEntry"];
  declare effectiveHighlightColor: BridgeApiHost["effectiveHighlightColor"];
  declare dictColorMap: BridgeApiHost["dictColorMap"];
  declare compactSections: BridgeApiHost["compactSections"];
  declare hoverFeedback: BridgeApiHost["hoverFeedback"];
  declare renderInlineEntryInto: BridgeApiHost["renderInlineEntryInto"];
  declare inVocabFolder: BridgeApiHost["inVocabFolder"];
  declare readCard: BridgeApiHost["readCard"];
  declare buildCurveSVG: BridgeApiHost["buildCurveSVG"];
  declare findTypedRelations: BridgeApiHost["findTypedRelations"];
  declare findOccurrences: BridgeApiHost["findOccurrences"];
  declare getCuratedSourcePaths: BridgeApiHost["getCuratedSourcePaths"];
  declare boldMatchesInPlace: BridgeApiHost["boldMatchesInPlace"];
  declare resolveIndexKey: BridgeApiHost["resolveIndexKey"];
  declare extractSection: (markdown: string, name: string | string[]) => string;
  // ---------- 词典桥接动作（由 Obsidian 卡片与外部阅读端共同调用） ----------
  // 网页划词/加出处:词不在库→新建,在库→加出处。来源是网址链接 [标题](url),不是 [[内链]]
  async bridgeAddWord(payload: BridgePayload) {
    const word = textValue(payload.word).trim();
    if (!word) return { ok: false, error: "empty-word" };
    const name = this.sanitizeName(word);
    if (!name) return { ok: false, error: "bad-name" };
    const alias = textValue(payload.alias).trim();
    const sentence = textValue(payload.sentence).trim();
    const url = textValue(payload.url).trim();
    const title = (textValue(payload.title) || url).trim().replaceAll("[", "").replaceAll("]", "");
    const source = url ? `[${title || url}](${url})` : "";
    const occurrence = (sentence || source) ? { word, sentence, source, date: todayStr() } : null;
    const dupKey = sentence || url;
    // 目标词典文件夹:payload.folder 命中词典表则用它,否则回退第一个
    const reqFolder = this.normalizeFolder(textValue(payload.folder));
    const folder = (reqFolder && this.dictFolders().includes(reqFolder)) ? reqFolder : this.primaryVocabFolder();
    const targetPath = (folder ? folder + "/" : "") + name + ".md";
    let existing = this.app.vault.getAbstractFileByPath(targetPath);
    // 按路径没找到,不代表这个词不存在——它可能落在别的词典文件夹里(网页端加出处不带 folder 参数,
    // 拼出来的 targetPath 只会落在 primaryVocabFolder)。所以不管是不是在加别名,都按索引(标题或别名)兜底查一遍,
    // 找到就并入那个文件,而不是在错误的文件夹里新建重复笔记。(和 ob 内"设为别名"一致)
    if (!(existing instanceof TFile)) {
      const hit = this.index.get(this.resolveIndexKey(word));
      if (hit && hit.file instanceof TFile) existing = hit.file;
    }
    const injectAlias = (data: string): string => {
      const re = /^---\r?\n([\s\S]*?)\r?\n---/;
      const fm = re.exec(data);
      const line = `  - ${alias}\n`;
      if (!fm) return `---\naliases:\n${line}---\n` + data;
      const body = fm[1];
      if (body.includes(alias)) return data; // 已有,不重复加
      if (/^aliases:/m.test(body)) {
        // 已有 aliases 键 → 追加到末尾
        return data.slice(0, fm.index) + `---\n` + body.replace(/^(aliases:.*)$/m, `$1\n${line}`) + `\n---` + data.slice(fm.index + fm[0].length);
      }
      // 没有 aliases 键 → 新增
      return data.slice(0, fm.index) + `---\n${body}\naliases:\n${line}---` + data.slice(fm.index + fm[0].length);
    };
    try {
      if (existing instanceof TFile) {
        if (alias) {
          if (this.app.vault.process) await this.app.vault.process(existing, injectAlias);
          else await this.app.vault.modify(existing, injectAlias(await this.app.vault.cachedRead(existing)));
          await this.rebuildIndex(false);
          if (alias) { const ak = alias.toLowerCase(); if (!this.index.has(ak)) this.index.set(ak, { display: alias, file: existing, isAlias: true, tags: this.getTags(existing) }); }
        }
        if (occurrence) {
          const cur = await this.app.vault.cachedRead(existing);
          if (dupKey && cur.includes(dupKey)) return { ok: true, created: false, dup: true, word, file: existing.path };
          const apply = (data: string) => this.insertOccurrence(data, occurrence);
          if (this.app.vault.process) await this.app.vault.process(existing, apply);
          else await this.app.vault.modify(existing, apply(cur));
          this.recordEncounter(existing, "add");
        }
        if (!alias) this.scheduleRebuild();
        return { ok: true, created: false, word: existing.basename, alias: alias || undefined, file: existing.path };
      }
      await this.ensureFolder(folder);
      const tpl = await this.templateForFolder(folder);
      const content = this.renderTemplate(tpl != null ? tpl : this.minimalSkeleton(), { word, date: todayStr() });
      const file = await this.createEntryFile(targetPath, folder, content, (templateContent) => {
        let next = templateContent;
        if (occurrence) next = this.insertOccurrence(next, occurrence);
        // 别名注入到 frontmatter 再建文件,保证 metadataCache 第一时间就包含别名
        if (alias) next = injectAlias(next);
        return next;
      });
      this.recordEncounter(file, "add");
      await this.rebuildIndex(false);
      // 保险:metadataCache 偶尔延迟,手动确保别名进索引
      if (alias) { const ak = alias.toLowerCase(); if (!this.index.has(ak)) this.index.set(ak, { display: alias, file, isAlias: true, tags: new Set() }); }
      return { ok: true, created: true, word, alias: alias || undefined, file: file.path };
    } catch (err) { return { ok: false, error: errorMessage(err) }; }
  }
  async bridgeDeleteWord(key: unknown) {
    const k = this.resolveIndexKey(textValue(key));
    const e = this.index.get(k);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    if (e.inline) return { ok: false, error: "inline-readonly" };
    try {
      await this.app.fileManager.trashFile(e.file);
      await this.rebuildIndex(false);
      return { ok: true, deleted: e.display, file: e.file.path };
    } catch (err) { return { ok: false, error: errorMessage(err) }; }
  }
  async bridgeTagWord(payload: BridgePayload) {
    const key = this.resolveIndexKey(textValue(payload.key));
    const tag = textValue(payload.tag).toLowerCase().replace(/^#/, "");
    const action = textValue(payload.action) || "add";
    if (!tag) return { ok: false, error: "empty-tag" };
    const e = this.index.get(key);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    if (e.inline) return { ok: false, error: "inline-readonly" };
    try {
      let resultTags: string[] = [];
      // 用 Obsidian 官方 API 改 frontmatter:正确处理 null/字符串/数组/各种缩进,自动规范序列化
      await this.app.fileManager.processFrontMatter(e.file, (fm: Record<string, unknown>) => {
        const rawTags = fm.tags ?? fm.tag ?? [];
        const values: unknown[] = typeof rawTags === "string" ? rawTags.split(/[,，;；\s]+/) : Array.isArray(rawTags) ? rawTags : [rawTags];
        let tags = values.map((value) => textValue(value).trim().replace(/^#/, "").toLowerCase()).filter((value) => value && value !== "null");
        if (action === "remove") tags = tags.filter((value) => value !== tag);
        else if (!tags.includes(tag)) tags.push(tag);
        tags = [...new Set(tags)];
        if (tags.length) fm.tags = tags; else delete fm.tags;
        // 用过 tag(单数)的笔记顺手清掉,避免两个键并存
        if (fm.tag != null) delete fm.tag;
        resultTags = tags;
      });
      await this.rebuildIndex(false);
      // metadataCache 延迟兜底:手动更新索引中此词(及同文件别名)的 tags,让 /words 高亮配色即时刷新
      const tagSet = new Set(resultTags);
      for (const entry of this.index.values()) { if (entry.file === e.file) entry.tags = tagSet; }
      return { ok: true, key, tag, action: action === "remove" ? "removed" : "added", tags: resultTags };
    } catch (err) { return { ok: false, error: errorMessage(err) }; }
  }
  // 把 line 追加到指定标题小节末尾(在子标题/代码块之前);没这个标题就在文末新建。
  // headingLine:完整标题行(级别 + 文字,比如 "#### 出处",可以是用户在设置里自定义的任意级别/文字);
  // legacyNames:识别时额外认的旧标题文字(不认级别,只认文字,比如"例句"改名"出处"前的老笔记),但新建小节永远用 headingLine。
  insertUnderHeading(data: string, headingLine: string, line: string, legacyNames: string[] = []): string {
    const headingText = headingLine.replace(/^#{1,6}[ \t]*/, "").trim() || headingLine;
    const names = [headingText, ...(legacyNames || [])].map(escapeRe).join("|");
    const re = new RegExp("(^|\\n)#{1,6}[ \\t]*(?:" + names + ")[^\\n]*\\n");
    const m = re.exec(data);
    if (!m) return this.appendBeforeLexisBlock(data, `${headingLine}\n${line}`);
    const headEnd = m.index + m[0].length;
    const after = data.slice(headEnd);
    let stop = after.search(/\n#{1,6}[ \t]|\n```/);
    if (stop < 0) stop = after.length;
    let section = after.slice(0, stop).replace(/[ \t]*\n+$/, "");
    const tail = after.slice(stop);
    const sep = section ? "\n" : "";
    const newSection = section + sep + line + "\n";
    const tailFixed = /^\n*```/.test(tail) ? "\n" + tail.replace(/^\n+/, "") : tail;
    return data.slice(0, headEnd) + newSection + tailFixed;
  }
  appendBeforeLexisBlock(data: string, blockText: string): string {
    const content = String(data || "");
    const match = /(^|\n)```(?:lexis|rel)\b/.exec(content);
    const at = match ? match.index + match[1].length : -1;
    if (at >= 0) {
      const before = content.slice(0, at).replace(/\s*$/, "");
      const after = content.slice(at).replace(/^\n+/, "");
      return before + (before ? "\n\n" : "") + blockText.trim() + "\n\n" + after;
    }
    const before = content.replace(/\s*$/, "");
    return before + (before ? "\n\n" : "") + blockText.trim() + "\n";
  }
  renderTemplate(template: string, vars: TemplateVars): string {
    let out = String(template || "");
    for (const [key, value] of Object.entries(vars || {})) {
      out = out.replace(new RegExp(`\\{\\{${escapeRe(key)}\\}\\}`, "g"), textValue(value));
    }
    return out;
  }
  occurrenceTemplateDefinition() {
    const raw = String(this.settings.occurrenceTemplate ?? DEFAULT_SETTINGS.occurrenceTemplate).trim();
    if (!raw) return null;
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    const first = (lines[0] || "").trim();
    if (/^#{1,6}[ \t]+/.test(first)) return { heading: first, item: lines.slice(1).join("\n").trim() };
    return { heading: "", item: raw };
  }
  occurrenceHeadingText() {
    const heading = this.occurrenceTemplateDefinition()?.heading || "";
    return heading.replace(/^#{1,6}[ \t]*/, "").trim();
  }
  occurrenceSentenceFromSection(section: string): string {
    const item = this.occurrenceTemplateDefinition()?.item || "";
    const templateLine = item.split("\n").find((line) => line.includes("{{sentence}}"));
    if (templateLine) {
      const tokenRe = /\{\{(word|sentence|source|sourceSuffix|date)\}\}/g;
      const source = "(?:\\[\\[[^\\]]+\\]\\]|\\[[^\\]]+\\]\\([^\\n]+\\)|[^\\n]*?)";
      const sourceSuffix = `(?:\\s*——\\s*${source})?`;
      let pattern = "^\\s*", last = 0;
      const literal = (text: string) => escapeRe(text).replace(/\s+/g, "\\s+");
      let match = tokenRe.exec(templateLine);
      while (match) {
        pattern += literal(templateLine.slice(last, match.index));
        if (match[1] === "sentence") pattern += "(.+?)";
        else if (match[1] === "source") pattern += source;
        else if (match[1] === "sourceSuffix") pattern += sourceSuffix;
        else pattern += "[^\\n]*?";
        last = match.index + match[0].length;
        match = tokenRe.exec(templateLine);
      }
      pattern += literal(templateLine.slice(last)) + "\\s*$";
      const re = new RegExp(pattern);
      for (const line of String(section || "").split("\n")) {
        const found = re.exec(line);
        if (found?.[1]) return found[1].trim();
      }
    }
    // 旧笔记兼容：固定引用行 + 行尾来源链接。
    const line = String(section || "").split("\n").map((s) => s.trim()).find((s) => s.startsWith(">"));
    if (!line) return "";
    return line.replace(/^>\s*/, "")
      .replace(/\s*——\s*(?:\[\[[^\]]*\]\]|\[[^\]]*\]\([^\n]+\))\s*$/, "")
      .trim();
  }
  insertOccurrence(data: string, vars: OccurrenceVars): string {
    const definition = this.occurrenceTemplateDefinition();
    if (!definition) return data;
    const source = textValue(vars.source);
    const values = { ...vars, source, sourceSuffix: source ? ` —— ${source}` : "" };
    const item = this.renderTemplate(definition.item, values).trim();
    if (!item) return data;
    if (definition.heading) {
      const heading = this.renderTemplate(definition.heading, values).trim();
      return this.insertUnderHeading(data, heading, item, ["例句", "出处"]);
    }
    return this.appendBeforeLexisBlock(data, item);
  }
  // 批注小节标题行:设置里可以填完整一行(级别+文字,比如 "## 引用"),也可以只填文字(默认按 #### 级别);留空用默认 "#### 批注"
  annotationHeadingLine() {
    const v = (this.settings.annotationHeading || "").trim();
    if (!v) return "#### 批注";
    return /^#{1,6}[ \t]/.test(v) ? v : `#### ${v}`;
  }
  annotationHeadingText() { return this.annotationHeadingLine().replace(/^#{1,6}[ \t]*/, "").trim() || "批注"; }
  // 批注写进词条笔记；Obsidian 卡片还可同时把图片保存为仓库附件并插入引用。
  async bridgeAnnotate(payload: BridgePayload) {
    const text = textValue(payload.note ?? payload.text).trim().replace(/\r?\n+/g, " ");
    const image = typeof File !== "undefined" && payload.image instanceof File && payload.image.type.startsWith("image/") ? payload.image : null;
    if (!text && !image) return { ok: false, error: "empty-note" };
    const key = this.resolveIndexKey(textValue(payload.key ?? payload.word).trim());
    const e = this.index.get(key);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    if (e.inline) return { ok: false, error: "inline-readonly" };
    try {
      const imageFile = image ? await saveAnnotationImage(this.app, this.settings, e.file, image) : null;
      const content = [text ? `> ${text}` : "", imageFile ? `![[${imageFile.path}]]` : ""].filter(Boolean).join("\n\n");
      const apply = (data: string) => this.insertUnderHeading(data, this.annotationHeadingLine(), content, ["批注"]);
      if (this.app.vault.process) await this.app.vault.process(e.file, apply);
      else await this.app.vault.modify(e.file, apply(await this.app.vault.cachedRead(e.file)));
      this._occCache.clear();
      return { ok: true, key, file: e.file.path };
    } catch (err) { return { ok: false, error: errorMessage(err) }; }
  }
  // 切掉开头的 frontmatter,返回 { fm, body }
  splitFrontmatter(content: string): { fm: string; body: string } {
    const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content || "");
    if (m && m.index === 0) return { fm: m[0], body: (content || "").slice(m[0].length) };
    return { fm: "", body: content || "" };
  }
  // 判断一篇词笔记是不是"只有模板骨架"(去掉 frontmatter / 代码块 / 批注小节 / 所有标题后没有任何文字)
  // 用于:移动到别的词典时,空骨架可以安全地重套新词典模板,有正文则只挪文件不动内容。
  isScaffoldOnly(content: string): boolean {
    let s = this.splitFrontmatter(content).body;
    s = s.replace(/```[\s\S]*?```/g, "");                                    // 围栏代码块(lexis/heatmap 等)
    const annotNames = [this.annotationHeadingText(), "批注"].map(escapeRe).join("|");
    s = s.replace(new RegExp("(^|\\n)#{1,6}[ \\t][^\\n]*(?:" + annotNames + ")[\\s\\S]*?(?=\\n#{1,6}[ \\t]|$)", "g"), "\n"); // 批注小节(另行保留)
    s = s.replace(/^#{1,6}[ \t].*$/gm, "");                                  // 所有标题(模板骨架)
    return !/[A-Za-z0-9一-鿿]/.test(s);                      // 没有任何字母/数字/汉字 = 只是骨架
  }
  // 把已有词移动到另一个词典文件夹。默认只移动文件(正文/批注/出处全保留);
  // 但若该词笔记是空骨架且目标词典有自己的模板,则顺手重套模板——并把批注小节内容迁移过去。
  async bridgeMoveWord(payload: BridgePayload) {
    const key = this.resolveIndexKey(textValue(payload.key ?? payload.word).trim());
    const folder = this.normalizeFolder(textValue(payload.folder));
    const e = this.index.get(key);
    if (!e || !e.file) return { ok: false, error: "not-found" };
    if (e.inline) return { ok: false, error: "inline-readonly" };
    if (folder && !this.dictFolders().includes(folder)) return { ok: false, error: "bad-folder" };
    const target = (folder ? folder + "/" : "") + e.file.name;
    if (target === e.file.path) return { ok: true, key, file: e.file.path, moved: false };
    if (this.app.vault.getAbstractFileByPath(target)) return { ok: false, error: "exists" };
    try {
      let oldContent = "";
      try { oldContent = await this.app.vault.cachedRead(e.file); } catch { /* A missing source is treated as an empty scaffold. */ }
      const tplRaw = await this.templateForFolder(folder);
      const retemplate = tplRaw != null && tplRaw.trim() !== "" && this.isScaffoldOnly(oldContent);
      await this.ensureFolder(folder);
      await this.app.fileManager.renameFile(e.file, target);
      let reTemplated = false;
      if (retemplate) {
        const annot = this.extractSection(oldContent, [this.annotationHeadingText(), "批注"]).replace(/```[\s\S]*?```/g, "").trim(); // 迁移批注(去掉尾随的 lexis 代码块)
        const oldFm = this.splitFrontmatter(oldContent).fm;             // 保留原 frontmatter(标签/别名/复习数据)
        const filled = tplRaw.replace(/\{\{word\}\}/g, e.display).replace(/\{\{date\}\}/g, todayStr());
        const tplBody = this.splitFrontmatter(filled).body.replace(/^\s+/, "");
        let nc = (oldFm ? oldFm.replace(/\s*$/, "\n") : "") + (oldFm ? "\n" : "") + tplBody;
        if (annot) nc = this.insertUnderHeading(nc, this.annotationHeadingLine(), annot, ["批注"]);
        const fileNow = this.app.vault.getAbstractFileByPath(target);
        if (fileNow instanceof TFile) {
          if (this.app.vault.process) await this.app.vault.process(fileNow, () => nc);
          else await this.app.vault.modify(fileNow, nc);
          reTemplated = true;
        }
      }
      await this.rebuildIndex(false);
      return { ok: true, key, file: target, folder, moved: true, reTemplated };
    } catch (err) { return { ok: false, error: errorMessage(err) }; }
  }
  // 旧扩展仍会上报高亮扫描结果；保留端点兼容，但扫描不再算主动相遇。
  async bridgeEncounter(payload: BridgePayload) {
    return { ok: true, recorded: 0, ignored: Array.isArray(payload.keys) ? payload.keys.length : 0 };
  }
  bridgeWordList() {
    const words = [];
    // 已归档/已淘汰的词不发给浏览器扩展——扩展自己没有这套生命周期概念,最简单的处理是压根不让它高亮
    for (const [key, e] of this.index) { if (e.archived || e.retired) continue; words.push({ key, word: e.display, alias: !!e.isAlias, inline: !!e.inline, tags: [...(e.tags || [])], file: e.file && e.file.path, color: this.colorForEntry(e), opacity: this.highlightAlphaForEntry(e), visible: this.highlightVisibleForEntry(e, false), wstyle: this.styleKindForEntry(e) }); }
    return {
      ok: true, version: this.manifest.version, count: words.length, words,
      styleConfig: {
        tagRules: this.settings.tagRules || [],
        highlightColor: this.effectiveHighlightColor(),
        highlightOpacity: this.settings.highlightOpacity,
        highlightStyle: this.settings.highlightStyle,
        excludeTags: this.parseTags(this.settings.excludeTags),
        dicts: this.dictFolders(),
        dictColors: this.dictColorMap(),
        popoverWidth: this.settings.popoverWidth,
        popoverMaxHeight: this.settings.popoverMaxHeight,
        popoverFontSize: this.settings.popoverFontSize,
        hoverDelayMs: this.settings.hoverDelayMs,
      },
    };
  }
  // name 可以是单个标题文字,也可以是一个数组(比如当前自定义名字 + 旧的默认名字,任一命中都算)


  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(BridgeApi.prototype);
  return {
    ...createBridgeRenderApi({ TFile, Component, recentReviewDates, escapeRe, renderLexisMarkdown, finishRenderMath, escHtml, vaultImageDataUrl }),
    ...descriptors,
  };
}

export { createBridgeApi };
