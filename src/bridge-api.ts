"use strict";

import type { App, Component as ObsidianComponent, TFile as ObsidianTFile } from "obsidian";
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
  passiveEncounter(file: ObsidianTFile): void;
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
  declare passiveEncounter: BridgeApiHost["passiveEncounter"];
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
    const match = /(^|\n)```lexis\b/.exec(content);
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
  // 网页被动相遇:扩展按「词+当天」去重后批量报过来的 key 列表,这边再按同样的 (文件+当天) 去重记一次
  // (两边都去重不是多余——扩展端只挡"同一页反复扫描",挡不住"今天换个 tab 又开了同一个页面")。
  async bridgeEncounter(payload: BridgePayload) {
    const keys: unknown[] = Array.isArray(payload.keys) ? payload.keys : [];
    let recorded = 0;
    for (const k of keys) {
      const e = this.index.get(this.resolveIndexKey(textValue(k)));
      if (e && !e.inline && e.file instanceof TFile) { this.passiveEncounter(e.file); recorded++; }
    }
    return { ok: true, recorded };
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
  extractSection(md: string, name: string | string[]): string {
    const names = (Array.isArray(name) ? name : [name]).map(escapeRe).join("|");
    const re = new RegExp("^#{1,6}[ \\t].*(?:" + names + ").*$", "m");
    const m = re.exec(md || "");
    if (!m) return "";
    const rest = md.slice(m.index + m[0].length);
    const next = /^#{1,6}[ \t]/m.exec(rest);
    return (next ? rest.slice(0, next.index) : rest).trim();
  }
  cardHeading(entry: LexisEntry): { title: string; subtitle: string } {
    if (entry.inline) return { title: entry.display, subtitle: entry.category || "" };
    const title = entry.file?.basename || entry.display;
    const subtitle = entry.isAlias && entry.display.toLowerCase() !== title.toLowerCase() ? entry.display : "";
    return { title, subtitle };
  }
  bridgeMathCss() {
    const style = this.app.workspace.containerEl.ownerDocument.getElementById("MJX-CHTML-styles") as HTMLStyleElement | null;
    return style?.sheet ? Array.from(style.sheet.cssRules, (rule: CSSRule) => rule.cssText).join("\n") : "";
  }
  async bridgeWordDetail(key: unknown) {
    const k = this.resolveIndexKey(textValue(key));
    const e = this.index.get(k);
    if (!e) return { ok: false, error: "not-found" };
    if (e.inline) {
      const heading = this.cardHeading(e);
      return {
        ok: true, word: e.display, base: e.display, file: e.file.path,
        vault: this.app.vault.getName(), inline: true, category: e.category, markdown: e.annotation || "*(无批注)*",
        title: heading.title, subtitle: heading.subtitle,
        html: await this.renderInlineEntryHtml(e),
      };
    }
    this.recordEncounter(e.file, "hover");
    void this.hoverFeedback(e.file);
    let body = "";
    try {
      const raw = await this.app.vault.cachedRead(e.file);
      body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```lexis[\s\S]*?```/g, "");
      body = this.compactSections(body.trim());
    } catch { /* The card can still render its metadata when the note cannot be read. */ }
    const html = await this.bridgeFullHtml(e.file, e.display);
    const heading = this.cardHeading(e);
    return {
      ok: true, word: e.display, base: e.file && e.file.basename, file: e.file && e.file.path,
      vault: this.app.vault.getName(),
      title: heading.title, subtitle: heading.subtitle,
      alias: !!e.isAlias, tags: [...(e.tags || [])],
      meaning: this.extractSection(body, ["意思", "意义"]),
      markdown: body, html, mathCss: html.includes("<mjx-container") ? this.bridgeMathCss() : "",
    };
  }
  bridgeOlink(path: string, base: string) {
    const vault = encodeURIComponent(this.app.vault.getName());
    return `<a class="lexis-web-ilink" href="obsidian://open?vault=${vault}&file=${encodeURIComponent(path)}">${escHtml(base)}</a>`;
  }
  occurrenceLabel(occurrence: Occurrence): string {
    if (!occurrence?.file) return "";
    return occurrence.page ? `${occurrence.file.basename} p.${occurrence.page}` : occurrence.file.basename;
  }
  occurrenceLinkPath(occurrence: Occurrence): string {
    if (!occurrence?.file) return "";
    return occurrence.file.path + (occurrence.page ? `#page=${occurrence.page}` : "");
  }
  async renderInlineEntryHtml(entry: LexisEntry): Promise<string> {
    const div = createDiv();
    const comp = new Component(); comp.load();
    try {
      await this.renderInlineEntryInto(div, entry, comp);
      await this.bridgePostProcess(div, entry.file.path);
      return div.innerHTML;
    } finally { comp.unload(); }
  }
  async bridgePostProcess(div: HTMLElement, sourcePath: string): Promise<void> {
    const vault = encodeURIComponent(this.app.vault.getName());
    div.querySelectorAll("a.internal-link").forEach((a) => {
      const lp = a.getAttribute("data-href") || a.getAttribute("href") || a.textContent || "";
      a.setAttribute("href", `obsidian://open?vault=${vault}&file=${encodeURIComponent(lp)}`);
      a.removeAttribute("data-href");
      a.classList.add("lexis-web-ilink");
    });
    for (const img of div.querySelectorAll<HTMLImageElement>("img")) {
      const src = img.getAttribute("src") || "";
      if (/^(?:https?:|data:)/i.test(src)) continue;
      const embed = img.closest<HTMLElement>(".internal-embed");
      const linkPath = embed?.getAttribute("src") || embed?.getAttribute("data-href") || img.getAttribute("alt") || "";
      try {
        const dataUrl = await vaultImageDataUrl(this.app, linkPath, sourcePath);
        if (dataUrl) img.setAttribute("src", dataUrl);
        else img.remove();
      } catch { img.remove(); }
    }
    div.querySelectorAll<HTMLElement>(".internal-embed").forEach((embed) => {
      if (embed.querySelector("img")) embed.replaceWith(...Array.from(embed.childNodes));
      else embed.remove();
    });
    div.querySelectorAll("iframe").forEach((frame) => frame.remove());
  }
  // 整篇笔记渲成 HTML,且 ```lexis 块在原位渲染(保持文档顺序),供浏览器扩展悬浮卡用
  async bridgeFullHtml(file: ObsidianTFile, display: string): Promise<string> {
    let raw = "";
    try { raw = await this.app.vault.cachedRead(file); } catch { return ""; }
    raw = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "");
    // 把每个 lexis 块换成占位符,先整体渲染(保留标题与顺序),再回填各块算好的 HTML
    const blocks: string[] = [];
    raw = raw.replace(/```lexis\s*([\s\S]*?)```/g, (_whole: string, inner: string) => { const i = blocks.length; blocks.push((inner || "").trim()); return `\n\n@@LEXIS${i}@@\n\n`; });
    const div = createDiv();
    const comp = new Component(); comp.load();
    try {
      // 超时保护:render/finishRenderMath 若因 MathJax 队列卡死而永不 resolve,try/catch 救不了,
      // 会让整个 /word 挂死。race 一个定时器,卡死时用已渲染的部分继续。
      await Promise.race([renderLexisMarkdown(this.app, raw, div, file.path || "", comp), new Promise((resolve) => setTimeout(resolve, 5000))]);
    } catch { /* Keep any partial renderer output. */ }
    for (let i = 0; i < blocks.length; i++) {
      const marker = `@@LEXIS${i}@@`;
      const host = Array.from(div.querySelectorAll<HTMLElement>("p, div, li")).find((element) => element.textContent.trim() === marker);
      const html = await this.lexisBlockHtml(file, display, blocks[i]);
      if (!host) continue;
      if (!html || !html.trim()) {
        // 块为空 → 连同它紧挨着的空标题一起去掉(等价于 compactSections 丢空段)
        const prev = host.previousElementSibling;
        host.remove();
        if (prev && /^H[1-6]$/.test(prev.tagName)) { const nx = prev.nextElementSibling; if (!nx || /^H[1-6]$/.test(nx.tagName)) prev.remove(); }
      } else {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const nodes = Array.from(parsed.body.childNodes, (node) => div.ownerDocument.importNode(node, true));
        host.replaceWith(...nodes);
      }
    }
    // 压缩空段标题:遍历 h1~h6,到下一个标题之间无内容且无 .lexis-web-* 块则删除
    (function compact(container: HTMLElement) {
      const hs = container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      const rm: HTMLElement[] = [];
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i], next = hs[i + 1] || null;
        let sib = h.nextElementSibling, ok = false;
        while (sib && sib !== next) {
          const nextSib = sib.nextElementSibling;
          if ((sib.textContent || "").trim()) { ok = true; break; }
          if (sib.querySelector(".lexis-web-sec,.lexis-web-rel,.lexis-web-occ,.lexis-web-curve,.lexis-web-dim")) { ok = true; break; }
          sib = nextSib;
        }
        if (!ok) rm.push(h);
      }
      for (const h of rm) h.remove();
    })(div);
    // MarkdownRenderer.render() resolve 时,LaTeX 的 MathJax 排版还在异步队列里没跑完;
    // 这里要把渲染好的 HTML 序列化发给浏览器扩展(扩展自己没有 MathJax),必须先等排版队列清空,
    // 不然抓到的还是没转换的公式源码,发过去以后就永远定格在那个状态了。
    // 只有笔记里真的有数学符号才需要等排版;无公式的笔记直接跳过,避免白等卡住的 MathJax 队列拖慢卡片。
    // race 定时器兜底:即使有公式,MathJax 队列卡死也不会让 /word 永久挂起。
    if (raw.includes("$$") || raw.includes("\\(") || raw.includes("\\[") || /\$[^\s$]/.test(raw)) {
      try { await Promise.race([finishRenderMath(), new Promise((resolve) => setTimeout(resolve, 3000))]); } catch { /* Math rendering is optional for plain-text cards. */ }
    }
    await this.bridgePostProcess(div, file.path);
    const out = div.innerHTML;
    comp.unload();
    return out;
  }
  // 单个 ```lexis 块 → HTML(对应 renderLexisBlock 的各模式,带 obsidian:// 链接)
  async lexisBlockHtml(file: ObsidianTFile, display: string, src: string): Promise<string> {
    const parts = (src || "").trim().split(/\s+/).filter(Boolean);
    const m = (parts[0] || "").toLowerCase();
    const typeArg = parts.slice(1).join(" ");
    const olink = (path: string, basename: string) => this.bridgeOlink(path, basename);
    const relMap = (bags: RelationBag, types: string[]) => { const map = new Map<string, string>(); for (const type of types) for (const relation of (bags[type] || [])) map.set(relation.path, relation.basename); return map; };
    // 派生词
    if (m === "derived" || m === "派生") {
      const resolved = this.app.metadataCache.resolvedLinks || {};
      const map = new Map<string, string>();
      for (const s in resolved) if (this.inVocabFolder(s) && resolved[s] && resolved[s][file.path]) { const sf = this.app.vault.getAbstractFileByPath(s); if (sf instanceof TFile) map.set(s, sf.basename); }
      let h = `<div class="lexis-web-sec">🌱 派生词 (${map.size})</div>`;
      if (!map.size) return h + `<div class="lexis-web-occ lexis-web-dim">(还没有单词链到这个词根)</div>`;
      return h + `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
    }
    const showCurve = m === "" || m === "curve" || m === "all";
    const showRelated = m === "" || m === "refs" || m === "ref" || m === "rel" || m === "related" || m === "all";
    const showOcc = (m === "" || m === "refs" || m === "ref" || m === "occ" || m === "all") && this.settings.showOccurrences;
    let html = "";
    if (showCurve) {
      const card = this.readCard(file);
      const svg = this.buildCurveSVG(card);
      if (svg) {
        const due = card.due ? ` · 下次复习 ${String(card.due).slice(0, 10)}` : "";
        const dates = recentReviewDates(card);
        const history = dates.length ? `<div class="lexis-curve-history">${escHtml(this.t("curve.recentReviews", { dates: dates.map((date) => date.slice(5)).join(" · ") }))}</div>` : "";
        html += `<div class="lexis-web-sec">🧠 记忆曲线（复习日期 × 保留率${due}）</div><div class="lexis-web-curve">${history}${svg}</div>`;
      }
    }
    if (showRelated && this.settings.showRelated) {
      try {
        const { out, inc } = await this.findTypedRelations(file);
        if ((m === "rel" || m === "related") && typeArg) {
          // 某标题下的块:只显示「反向未回链」的(正向手写链接已在正文里渲染了)
          const types = typeArg === "辨析" ? ["辨析", "相关"] : [typeArg];
          const outPaths = new Set<string>(); for (const t of types) for (const r of (out[t] || [])) outPaths.add(r.path);
          const map = new Map<string, string>(); for (const t of types) for (const r of (inc[t] || [])) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
          if (map.size) html += `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
        } else {
          // 不带类型(如悬浮卡空块):全部分类,各自带标题
          for (const t of ["近义词", "同根词", "形近词", "辨析", "相关"]) {
            const map = relMap(out, [t]); for (const [p, b] of relMap(inc, [t])) map.set(p, b);
            if (!map.size) continue;
            html += `<div class="lexis-web-sec">🔗 ${escHtml(t)}</div><div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
          }
        }
      } catch { /* Related links are supplemental card content. */ }
    }
    if (showOcc) {
      try {
        const list = await this.findOccurrences(display);
        const curated = await this.getCuratedSourcePaths(file);
        const fresh = list.filter((o) => !curated.has(o.file.basename.toLowerCase()));
        html += `<div class="lexis-web-sec">📍 出现过的地方 (${fresh.length})</div>`;
        if (!fresh.length) html += `<div class="lexis-web-occ lexis-web-dim">(没有未收藏的新出处)</div>`;
        else {
          // 出处走 Markdown 渲染(不然 LaTeX 只会是原始 $...$ 文本),同批渲染完再统一 flush 一次数学排版队列
          const comp = new Component(); comp.load();
          const rendered: { d: HTMLElement; o: Occurrence }[] = [];
          for (const o of fresh) {
            const d = createDiv();
            await renderLexisMarkdown(this.app, o.sentence, d, file.path, comp);
            rendered.push({ d, o });
          }
          try { await finishRenderMath(); } catch { /* Occurrence text can render without MathJax. */ }
          for (const { d, o } of rendered) {
            this.boldMatchesInPlace(d, display);
            html += `<div class="lexis-web-occ">${d.innerHTML} <span class="lexis-web-occ-src">— ${olink(this.occurrenceLinkPath(o), this.occurrenceLabel(o))}</span></div>`;
          }
          comp.unload();
        }
      } catch { /* Occurrence lookup is supplemental card content. */ }
    }
    return html;
  }

  }
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(BridgeApi.prototype);
  return descriptors;
}

export { createBridgeApi };
