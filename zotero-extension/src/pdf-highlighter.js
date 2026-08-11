(function (ns) {
  const OVERLAY_CLASS = "lexis-zotero-pdf-layer";
  const SENTENCE_BREAK = /[.!?。！？…\n]/;

  function plainTextItems(rawItems) {
    const items = [];
    for (let i = 0; i < Number(rawItems?.length || 0); i++) {
      const item = rawItems[i];
      const transform = item?.transform || [];
      items.push({
        str: String(item?.str || ""),
        width: Number(item?.width || 0),
        height: Number(item?.height || 0),
        hasEOL: Boolean(item?.hasEOL),
        transform: Array.prototype.slice.call(transform, 0, 6).map((value) => Number(value || 0)),
      });
    }
    return items;
  }

  function sentenceAt(text, index) {
    if (!text) return "";
    let start = 0, end = text.length;
    for (let i = Math.min(index, text.length - 1); i >= 0; i--) {
      if (SENTENCE_BREAK.test(text[i])) { start = i + 1; break; }
    }
    for (let i = index; i < text.length; i++) {
      if (SENTENCE_BREAK.test(text[i])) { end = i + 1; break; }
    }
    return text.slice(start, end).trim().replace(/\s+/g, " ");
  }

  function itemStream(items) {
    const text = [], refs = [];
    let previous = null;
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];
      const value = String(item?.str || "");
      if (!value) continue;
      const before = previous?.str?.slice(-1) || "";
      const after = value[0] || "";
      const previousX = Number(previous?.transform?.[4] || 0) + Math.abs(Number(previous?.width || 0));
      const currentX = Number(item.transform?.[4] || 0);
      const previousY = Number(previous?.transform?.[5] || 0);
      const currentY = Number(item.transform?.[5] || 0);
      const height = Math.max(1, Number(previous?.height || 0), Number(item.height || 0));
      const newLine = previous && Math.abs(currentY - previousY) > height * .45;
      const gap = currentX - previousX;
      if (previous && /[A-Za-z0-9_]$/.test(before) && /^[A-Za-z0-9_]/.test(after)
        && (previous.hasEOL || newLine || gap > Math.max(1, height * .12))) {
        text.push(" "); refs.push(null);
      }
      for (let offset = 0; offset < value.length; offset++) {
        text.push(value[offset]); refs.push({ itemIndex, offset });
      }
      previous = item;
    }
    return { text: text.join(""), refs };
  }

  function findMatches(items, index) {
    const stream = itemStream(items);
    const regex = index.regex?.();
    if (!regex || !stream.text) return { stream, matches: [] };
    const matches = [];
    let match;
    while ((match = regex.exec(stream.text))) {
      const key = match[0].toLowerCase();
      const entry = index.get(key);
      if (!entry || index.isExcluded?.(key)) continue;
      const byItem = new Map();
      for (const ref of stream.refs.slice(match.index, match.index + match[0].length)) {
        if (!ref) continue;
        const range = byItem.get(ref.itemIndex);
        if (range) { range.start = Math.min(range.start, ref.offset); range.end = Math.max(range.end, ref.offset + 1); }
        else byItem.set(ref.itemIndex, { itemIndex: ref.itemIndex, start: ref.offset, end: ref.offset + 1 });
      }
      if (!byItem.size) continue;
      matches.push({
        key,
        ranges: [...byItem.values()],
        sentence: sentenceAt(stream.text, match.index),
      });
    }
    return { stream, matches };
  }

  class PdfHighlighter {
    constructor({ win, index, readerCSS, disabledDicts, onHover, onLeave, onEncounter, onReset, onError, onStatus }) {
      this.win = win;
      this.doc = win.document;
      this.index = index;
      this.readerCSS = readerCSS;
      this.disabledDicts = disabledDicts || (() => null);
      this.onHover = onHover;
      this.onLeave = onLeave;
      this.onEncounter = onEncounter;
      this.onReset = onReset;
      this.onError = onError;
      this.onStatus = onStatus;
      this.seen = new Set();
      this.pageStatus = new Map();
      this._onPage = this.handlePageRendered.bind(this);
    }

    start() {
      this.active = true;
      this.installStyle();
      this.eventBus = this.win.PDFViewerApplication?.eventBus;
      this.eventBus?.on("pagerendered", this._onPage);
      this.eventBus?.on("textlayerrendered", this._onPage);
      const hasComponents = typeof Components !== "undefined";
      const hasWaiveXrays = hasComponents && typeof Components.utils?.waiveXrays === "function";
      const hasCloneInto = hasComponents && typeof Components.utils?.cloneInto === "function";
      this.onStatus?.(`Components=${hasComponents ? "yes" : "no"}, waiveXrays=${hasWaiveXrays ? "yes" : "no"}, cloneInto=${hasCloneInto ? "yes" : "no"}`);
      this.onStatus?.(`高亮器启动: pattern=${this.index.pattern ? "yes" : "no"}, pages=${this.viewer()?._pages?.length || 0}`);
      this.rescan();
      Promise.resolve(this.viewer()?.pagesPromise)
        .then(() => this.scheduleRescan())
        .catch((error) => this.onError?.(error, 0));
    }

    stop() {
      this.active = false;
      if (this.rescanFrame) this.win.cancelAnimationFrame(this.rescanFrame);
      this.eventBus?.off?.("pagerendered", this._onPage);
      this.eventBus?.off?.("textlayerrendered", this._onPage);
      this.clear();
      this.doc.getElementById("lexis-zotero-reader-style")?.remove();
    }

    installStyle() {
      if (this.doc.getElementById("lexis-zotero-reader-style")) return;
      const style = this.doc.createElement("style");
      style.id = "lexis-zotero-reader-style";
      style.textContent = this.readerCSS;
      this.doc.head.appendChild(style);
    }

    updateIndex(index) {
      this.index = index;
      this.scheduleRescan();
    }

    scheduleRescan() {
      if (!this.active) return;
      if (this.rescanFrame) this.win.cancelAnimationFrame(this.rescanFrame);
      this.rescanFrame = this.win.requestAnimationFrame(() => {
        this.rescanFrame = null;
        if (this.active) this.rescan();
      });
    }

    handlePageRendered(event) {
      const pageNumber = Number(event?.pageNumber || event?.source?.id || 0);
      const view = pageNumber ? this.viewer()?.getPageView(pageNumber - 1) : null;
      if (view) this.paintSafely(view);
    }

    viewer() { return this.win.PDFViewerApplication?.pdfViewer; }

    visibleViews() {
      return (this.viewer()?._pages || []).filter((view) => view?.div?.isConnected && view.div.querySelector("canvas"));
    }

    async paintSafely(view) {
      try { await this.paintView(view); }
      catch (error) { this.onError?.(error, Number(view?.id || 0)); }
    }

    async paintView(view) {
      if (!this.active || !this.index.pattern || !view?.pdfPage || !view?.div) return;
      const generation = this.generation || 0;
      let content;
      try {
        content = await view.pdfPage.getTextContent();
      } catch (error) {
        throw new Error(`[阶段:getTextContent] ${error.message || error}`);
      }
      if (!this.active || generation !== (this.generation || 0)) return;
      let rawItems, rawLength;
      try {
        rawItems = content.items;
        rawLength = Number(rawItems?.length || 0);
      } catch (error) {
        throw new Error(`[阶段:items.length] ${error.message || error}`);
      }
      let items;
      try {
        items = plainTextItems(rawItems);
      } catch (error) {
        throw new Error(`[阶段:items[i], length=${rawLength}] ${error.message || error}`);
      }
      let matches;
      try {
        ({ matches } = findMatches(items, this.index));
      } catch (error) {
        throw new Error(`[阶段:findMatches] ${error.message || error}`);
      }
      const page = view.div;
      page.querySelector(":scope > ." + OVERLAY_CLASS)?.remove();
      if (!matches.length) {
        this.reportPageStatus(view, items.length, 0, 0);
        return;
      }
      if (this.win.getComputedStyle(page).position === "static") page.style.position = "relative";
      const overlay = this.doc.createElement("div");
      overlay.className = OVERLAY_CLASS;
      page.insertBefore(overlay, page.firstChild);
      // 换算坐标依赖 view.viewport 的逻辑尺寸；如果它和 .page 实际渲染尺寸（高 DPI/缩放）不一致，
      // 直接套用会跟文字错位，这里按实际渲染尺寸反推缩放系数再乘回去（借鉴 Obsidian 端同款修复）。
      // view.viewport 是 PDF.js 自己的普通对象（不是 WebIDL），读它的 width/height 这类自定义属性
      // 会被 Xray 挡住悄悄拿到 undefined——和读 PDF.js 数组下标是同一类问题，也要 waiveXrays。
      const pageRect = page.getBoundingClientRect();
      const rawViewport = view.viewport;
      const viewportForRead = typeof Components === "undefined" ? rawViewport : Components.utils.waiveXrays(rawViewport);
      const viewportWidth = Number(viewportForRead?.width || pageRect.width || page.offsetWidth || 1);
      const viewportHeight = Number(viewportForRead?.height || pageRect.height || page.offsetHeight || 1);
      const scaleX = pageRect.width ? pageRect.width / viewportWidth : 1;
      const scaleY = pageRect.height ? pageRect.height / viewportHeight : 1;
      this.onStatus?.(`PDF 第 ${Number(view?.id || 0)} 页缩放: viewportW=${viewportWidth.toFixed(1)}, pageW=${pageRect.width.toFixed(1)}, scaleX=${scaleX.toFixed(3)}, scaleY=${scaleY.toFixed(3)}`);
      const pageIndex = Math.max(0, Number(view.id || page.dataset.pageNumber || 1) - 1);
      const pageLabel = this.viewer()?._pageLabels?.[pageIndex] || String(pageIndex + 1);
      let drawn = 0;
      for (const match of matches) {
        const entry = this.index.get(match.key);
        if (entry && this.dictDisabled(this.index.folderOf(entry.file))) continue;
        this.reportEncounter(match.key);
        for (const range of match.ranges) {
          const item = items[range.itemIndex];
          const rect = this.itemRect(view, item, range.start, range.end);
          if (!rect) continue;
          const appearance = this.index.appearance(match.key);
          if (!appearance.visible) continue;
          const mark = this.doc.createElement("div");
          mark.className = "lexis-zotero-pdf-mark";
          mark.dataset.lexisKey = match.key;
          mark.style.cssText = [
            `left:${rect.left * scaleX}px`, `top:${rect.top * scaleY}px`,
            `width:${rect.width * scaleX}px`, `height:${rect.height * scaleY}px`,
            `background:color-mix(in srgb, ${appearance.color} ${Math.round(Math.max(.08, appearance.opacity * .58) * 100)}%, transparent)`,
          ].join(";");
          const meta = { key: match.key, sentence: match.sentence, pageIndex, pageLabel };
          mark.addEventListener("mouseenter", () => {
            this.onStatus?.(`hover 触发: ${match.key}`);
            try { this.onHover(mark, meta); }
            catch (error) { this.onStatus?.(`hover 处理失败: ${error.message || error}`); }
          });
          mark.addEventListener("mouseleave", () => this.onLeave(mark));
          overlay.appendChild(mark);
          drawn++;
        }
      }
      this.reportPageStatus(view, items.length, matches.length, drawn);
    }

    dictDisabled(folder) {
      const disabled = this.disabledDicts?.();
      if (!disabled || !disabled.size) return false;
      for (const candidate of disabled) {
        if (candidate && (folder === candidate || folder.startsWith(candidate + "/"))) return true;
      }
      return false;
    }

    reportPageStatus(view, items, matches, drawn) {
      const page = Number(view?.id || 0);
      const signature = `${items}/${matches}/${drawn}`;
      if (this.pageStatus.get(page) === signature) return;
      this.pageStatus.set(page, signature);
      this.onStatus?.(`PDF 第 ${page || "?"} 页: items=${items}, matches=${matches}, marks=${drawn}`);
    }

    itemRect(view, item, start, end) {
      const text = String(item?.str || "");
      const transform = item?.transform || [];
      if (!text || transform.length < 6 || !view.viewport?.convertToViewportRectangle) return null;
      const ratioStart = start / text.length, ratioEnd = end / text.length;
      const x = Number(transform[4]) + Number(item.width || 0) * ratioStart;
      const y = Number(transform[5]);
      const width = Number(item.width || 0) * (ratioEnd - ratioStart);
      const height = Math.max(1, Number(item.height || 0), Math.abs(Number(transform[3] || 0)));
      let coords;
      let argStrategy = "raw";
      try {
        const rectArg = [x, y, x + width, y + height];
        let argForCall = rectArg;
        if (typeof Components !== "undefined") {
          try {
            argForCall = Components.utils.cloneInto(rectArg, this.win);
            argStrategy = "cloneInto";
          } catch (cloneError) {
            argForCall = Components.utils.waiveXrays(rectArg);
            argStrategy = "waiveXrays";
          }
        }
        coords = view.viewport.convertToViewportRectangle(argForCall);
      } catch (error) {
        throw new Error(`[阶段:convertToViewportRectangle,arg=${argStrategy}] ${error.message || error}`);
      }
      let left, top, right, bottom;
      try {
        const c = typeof Components === "undefined" ? coords : Components.utils.waiveXrays(coords);
        left = Math.min(c[0], c[2]); top = Math.min(c[1], c[3]);
        right = Math.max(c[0], c[2]); bottom = Math.max(c[1], c[3]);
      } catch (error) {
        throw new Error(`[阶段:coords[i]] ${error.message || error}`);
      }
      return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
    }

    reportEncounter(key) {
      const dayKey = key + "|" + new Date().toISOString().slice(0, 10);
      if (this.seen.has(dayKey)) return;
      this.seen.add(dayKey);
      this.onEncounter?.(key);
    }

    clear() {
      this.generation = (this.generation || 0) + 1;
      this.onReset?.();
      for (const overlay of this.doc.querySelectorAll("." + OVERLAY_CLASS)) overlay.remove();
    }

    rescan() {
      this.clear();
      const views = this.visibleViews();
      this.onStatus?.(`PDF 重扫: visiblePages=${views.length}, totalPages=${this.viewer()?._pages?.length || 0}`);
      for (const view of views) this.paintSafely(view);
    }
  }

  ns.PdfHighlighter = PdfHighlighter;
  ns.sentenceAt = sentenceAt;
  ns.plainTextItems = plainTextItems;
  ns.itemStream = itemStream;
  ns.findPdfMatches = findMatches;
})(LexisZotero);
