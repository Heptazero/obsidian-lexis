"use strict";

// 出处搜索只负责把不同文件类型统一成 { file, sentence, page? }。
// UI、收藏格式和跳转行为留在主插件，后续接 EPUB/Zotero 时不用改搜索核心。

function pdfItemsToText(items) {
  let out = "", prev = null;
  for (const item of items || []) {
    const text = String(item && item.str || "");
    if (!text) { if (item && item.hasEOL) out += "\n"; continue; }
    let separator = "";
    if (prev) {
      if (prev.hasEOL) separator = "\n";
      else if (!/\s$/.test(out) && !/^\s/.test(text)) {
        const pt = prev.transform || [], ct = item.transform || [];
        const sameLine = Number.isFinite(pt[5]) && Number.isFinite(ct[5])
          ? Math.abs(pt[5] - ct[5]) <= Math.max(1, Math.abs(pt[3] || ct[3] || 0) * 0.45)
          : true;
        if (!sameLine) separator = "\n";
        else if (Number.isFinite(pt[4]) && Number.isFinite(ct[4]) && Number.isFinite(prev.width)) {
          const chars = Math.max(1, String(prev.str || "").trim().length);
          const charWidth = Math.abs(Number(prev.width) || 0) / chars;
          const gap = ct[4] - (pt[4] + Number(prev.width || 0));
          if (gap > Math.max(0.5, charWidth * 0.18) || gap < -Math.max(2, charWidth * 2)) separator = " ";
        } else separator = " ";
      }
    }
    out += separator + text;
    prev = item;
  }
  return out;
}

function normalizePdfText(text) {
  return String(text || "")
    .replace(/([\p{L}\p{N}])-\s*\n\s*([\p{L}\p{N}])/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeOccurrences(markdown, pdf, limit) {
  const out = [], max = Math.max(1, Number(limit) || 1);
  for (let i = 0; out.length < max && (i < markdown.length || i < pdf.length); i++) {
    if (i < markdown.length) out.push(markdown[i]);
    if (out.length < max && i < pdf.length) out.push(pdf[i]);
  }
  return out;
}

function createOccurrenceSearch(options) {
  const { app, loadPdfJs, boundedSource, extractSentence, markdownAllowed, inScope } = options;
  const pdfCache = new Map();

  const readPdfPages = async (file) => {
    const signature = `${file.stat && file.stat.mtime || 0}:${file.stat && file.stat.size || 0}`;
    const cached = pdfCache.get(file.path);
    if (cached && cached.signature === signature) return cached.promise;
    const promise = (async () => {
      let doc = null;
      try {
        const pdfjs = await loadPdfJs();
        const buffer = await app.vault.readBinary(file);
        const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        doc = await task.promise;
        const pages = [];
        for (let page = 1; page <= doc.numPages; page++) {
          const pdfPage = await doc.getPage(page);
          const content = await pdfPage.getTextContent();
          const text = normalizePdfText(pdfItemsToText(content.items));
          if (text) pages.push({ page, text });
          if (pdfPage.cleanup) pdfPage.cleanup();
        }
        return pages;
      } catch (error) {
        console.warn(`[Lexis] PDF 出处扫描失败: ${file.path}`, error);
        return [];
      } finally {
        if (doc && doc.destroy) { try { await doc.destroy(); } catch (_e) {} }
      }
    })();
    pdfCache.set(file.path, { signature, promise });
    return promise;
  };

  const searchMarkdown = async (word, limit, scope) => {
    const re = new RegExp(boundedSource(word), "i"), results = [];
    const files = app.vault.getMarkdownFiles().filter((file) => markdownAllowed(file) && inScope(file.path, scope));
    for (const file of files) {
      if (results.length >= limit) break;
      let content;
      try { content = await app.vault.cachedRead(file); } catch (_e) { continue; }
      const index = content.search(re);
      if (index >= 0) results.push({ file, sentence: extractSentence(content, index) });
    }
    return results;
  };

  const searchPdf = async (word, limit, scope) => {
    const re = new RegExp(boundedSource(word), "i"), results = [];
    const files = app.vault.getFiles().filter((file) => file.extension === "pdf" && inScope(file.path, scope));
    for (const file of files) {
      if (results.length >= limit) break;
      const pages = await readPdfPages(file);
      for (const page of pages) {
        const index = page.text.search(re);
        if (index < 0) continue;
        results.push({ file, page: page.page, sentence: extractSentence(page.text, index) });
        break; // 与 Markdown 一致：每个文件只返回第一处。
      }
    }
    return results;
  };

  return {
    clearResults() {},
    invalidatePdf(path) { if (path) pdfCache.delete(path); else pdfCache.clear(); },
    async find(word, { limit = 6, scope = [], includePdf = true } = {}) {
      const markdownPromise = searchMarkdown(word, limit, scope);
      const pdfPromise = includePdf ? searchPdf(word, limit, scope) : Promise.resolve([]);
      const [markdown, pdf] = await Promise.all([markdownPromise, pdfPromise]);
      return mergeOccurrences(markdown, pdf, limit);
    },
  };
}

export { createOccurrenceSearch, pdfItemsToText, normalizePdfText, mergeOccurrences };
