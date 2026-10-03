"use strict";

import type { App, Component as ObsidianComponent, TFile as ObsidianTFile } from "obsidian";
import { containsMath, withTimeout } from "./bridge-render";
import { relationHeading, relationTypes, replaceLexisFences } from "./relation-sections";
import type { Occurrence } from "./occurrence-search";
import type { InlineCategoryOccurrence, LexisEntry, LexisSettings, LexisStats, ReviewHistoryEvent } from "./types";

type Relation = { path: string; basename: string };
type RelationBag = Record<string, Relation[]>;
type CurveCard = { s?: number | null; due?: string | null; last?: string | null; history?: ReviewHistoryEvent[] };

interface BridgeRenderDependencies {
  TFile: typeof ObsidianTFile;
  Component: typeof ObsidianComponent;
  recentReviewDates: (card: CurveCard, limit?: number) => string[];
  escapeRe: (value: string) => string;
  renderLexisMarkdown: (app: App, markdown: string, element: HTMLElement, sourcePath: string, component: ObsidianComponent) => Promise<void>;
  finishRenderMath: () => Promise<void>;
  escHtml: (value: string) => string;
  vaultImageDataUrl: (app: App, linkPath: string, sourcePath: string) => Promise<string | null>;
}

function textValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}

function createBridgeRenderApi({ TFile, Component, recentReviewDates, escapeRe, renderLexisMarkdown, finishRenderMath, escHtml, vaultImageDataUrl }: BridgeRenderDependencies): PropertyDescriptorMap {
  class BridgeRenderApi {
    declare app: App;
    declare settings: LexisSettings;
    declare index: Map<string, LexisEntry>;
    declare stats: LexisStats;
    declare inlineCategoryOccurrences: InlineCategoryOccurrence[];
    declare manifest: { version: string };
    declare t: (key: string, vars?: Record<string, string | number | boolean | null | undefined>) => string;
    declare getTags: (file: ObsidianTFile) => Set<string>;
    declare colorForEntry: (entry: LexisEntry) => string;
    declare highlightAlphaForEntry: (entry: LexisEntry) => number;
    declare highlightVisibleForEntry: (entry: LexisEntry, includeDictionary?: boolean) => boolean;
    declare styleKindForEntry: (entry: LexisEntry) => string;
    declare effectiveHighlightColor: () => string;
    declare dictColorMap: () => Record<string, string>;
    declare compactSections: (markdown: string) => string;
    declare hoverFeedback: (file: ObsidianTFile) => Promise<void>;
    declare renderInlineEntryInto: (element: HTMLElement, entry: LexisEntry, component: ObsidianComponent) => Promise<void>;
    declare inVocabFolder: (path: string) => boolean;
    declare readCard: (file: ObsidianTFile) => CurveCard;
    declare buildCurveSVG: (card: CurveCard) => string | null;
    declare findTypedRelations: (file: ObsidianTFile) => Promise<{ out: RelationBag; inc: RelationBag }>;
    declare findOccurrences: (word: string) => Promise<Occurrence[]>;
    declare getCuratedSourcePaths: (file: ObsidianTFile) => Promise<Set<string>>;
    declare boldMatchesInPlace: (element: HTMLElement, word: string) => void;
    declare resolveIndexKey: (value: string) => string;
    declare recordEncounter: (file: ObsidianTFile, type: string) => void;
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
    if (entry.inline) {
      const title = entry.canonical || entry.display;
      const alias = entry.isAlias && entry.display.toLowerCase() !== title.toLowerCase() ? entry.display : "";
      return { title, subtitle: [alias, entry.category || ""].filter(Boolean).join(" · ") };
    }
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
        ok: true, word: e.display, base: e.canonical || e.display, file: e.file.path,
        vault: this.app.vault.getName(), inline: true, category: e.category, markdown: e.annotation || "*(无批注)*",
        title: heading.title, subtitle: heading.subtitle, colorRole: e.colorToken || "",
        html: await this.renderInlineEntryHtml(e),
      };
    }
    this.recordEncounter(e.file, "hover");
    void this.hoverFeedback(e.file);
    let body = "";
    try {
      const raw = await this.app.vault.cachedRead(e.file);
      body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```dataviewjs[\s\S]*?```/g, "").replace(/```dataview[\s\S]*?```/g, "").replace(/```(?:lexis|rel)\b[\s\S]*?```/g, "");
      body = this.compactSections(body.trim());
    } catch { /* The card can still render its metadata when the note cannot be read. */ }
    const html = await this.bridgeFullHtml(e.file, e.display);
    const heading = this.cardHeading(e);
    return {
      ok: true, word: e.display, base: e.file && e.file.basename, file: e.file && e.file.path,
      vault: this.app.vault.getName(),
      title: heading.title, subtitle: heading.subtitle, colorRole: e.colorToken || "",
      alias: !!e.isAlias, tags: [...(e.tags || [])],
      meaning: this.extractSection(body, ["意思", "意义"]),
      markdown: body, html, mathCss: html.includes("<mjx-container") ? this.bridgeMathCss() : "",
    };
  }
  async bridgeWordOccurrences(key: unknown) {
    const k = this.resolveIndexKey(textValue(key));
    const entry = this.index.get(k);
    if (!entry || entry.inline) return { ok: false, error: "not-found" };
    const html = await this.lexisBlockHtml(entry.file, entry.display, "occ");
    return { ok: true, html, mathCss: html.includes("<mjx-container") ? this.bridgeMathCss() : "" };
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
    raw = replaceLexisFences(raw, (source) => { const i = blocks.length; blocks.push(source); return `\n\n@@LEXIS${i}@@\n\n`; });
    const div = createDiv();
    const comp = new Component(); comp.load();
    try {
      await withTimeout(renderLexisMarkdown(this.app, raw, div, file.path || "", comp), 5000);
    } catch { /* Keep any partial renderer output. */ }
    for (let i = 0; i < blocks.length; i++) {
      const marker = `@@LEXIS${i}@@`;
      const host = Array.from(div.querySelectorAll<HTMLElement>("p, div, li")).find((element) => element.textContent.trim() === marker);
      const html = await this.lexisBlockHtml(file, display, blocks[i], true);
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
    // 无公式时不要等待全局 MathJax 队列；有公式也不能阻塞 /word 请求。
    if (containsMath(raw)) {
      try { await withTimeout(finishRenderMath(), 3000); } catch { /* Keep the available HTML when MathJax stalls. */ }
    }
    await this.bridgePostProcess(div, file.path);
    const out = div.innerHTML;
    comp.unload();
    return out;
  }
  // 单个 ```lexis 块 → HTML(对应 renderLexisBlock 的各模式,带 obsidian:// 链接)
  async lexisBlockHtml(file: ObsidianTFile, display: string, src: string, deferOccurrences = false): Promise<string> {
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
          const type = relationHeading(typeArg);
          const types = type === "辨析" ? ["辨析", "相关"] : [type];
          const outPaths = new Set<string>(); for (const t of types) for (const r of (out[t] || [])) outPaths.add(r.path);
          const map = new Map<string, string>(); for (const t of types) for (const r of (inc[t] || [])) if (!outPaths.has(r.path)) map.set(r.path, r.basename);
          if (map.size) html += `<div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
        } else {
          // 不带类型(如悬浮卡空块):全部分类,各自带标题
          for (const t of relationTypes(out, inc)) {
            const map = relMap(out, [t]); for (const [p, b] of relMap(inc, [t])) map.set(p, b);
            if (!map.size) continue;
            html += `<div class="lexis-web-sec">🔗 ${escHtml(t)}</div><div class="lexis-web-rel">` + [...map].map(([p, b]) => olink(p, b)).join("") + `</div>`;
          }
        }
      } catch { /* Related links are supplemental card content. */ }
    }
    if (showOcc && deferOccurrences) html += `<div class="lexis-web-occ-pending">出处加载中…</div>`;
    else if (showOcc) {
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
          try { await withTimeout(finishRenderMath(), 3000); } catch { /* Occurrence text can render without MathJax. */ }
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
  const { constructor: _constructor, ...descriptors } = Object.getOwnPropertyDescriptors(BridgeRenderApi.prototype);
  return descriptors;
}

export { createBridgeRenderApi };
