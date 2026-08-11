(function (ns) {
  class ReaderController {
    constructor({ reader, index, bridge, cardCSS, readerCSS, disabledDicts, onEncounter, onDispose, logger }) {
      this.reader = reader;
      this.index = index;
      this.bridge = bridge;
      this.cardCSS = cardCSS;
      this.readerCSS = readerCSS;
      this.disabledDicts = disabledDicts;
      this.onEncounter = onEncounter;
      this.onDispose = onDispose;
      this.logger = logger;
      this.views = new Map();
      this.selection = new ns.SelectionActions({
        index,
        bridge,
        sourceFor: (annotation) => this.source(annotation),
      });
    }

    async start() {
      if (this.started) return;
      this.started = true;
      this.logger(`Reader 开始接入: type=${this.reader.type || this.reader._type || "?"}`);
      await this.reader._initPromise;
      await this.reader._waitForReader?.();
      if (!this.started || !this.isPdf()) return;
      this._onReaderUnload = () => this.onDispose?.(this.reader);
      this.reader._iframeWindow.addEventListener("unload", this._onReaderUnload, { once: true });
      await this.refreshViews({ wait: true });
    }

    isPdf() {
      return this.reader.type === "pdf" || this.reader._type === "pdf";
    }

    pdfViews() {
      const reader = this.reader._internalReader;
      if (!reader || (typeof Components !== "undefined" && Components.utils.isDeadWrapper(reader))) return [];
      return [reader._primaryView, reader._secondaryView].filter(Boolean);
    }

    async waitForPdfViews() {
      for (let attempt = 0; attempt < 100 && this.started; attempt++) {
        const views = this.pdfViews().filter((view) => view?._iframeWindow);
        if (views.length) return views;
        await Zotero.Promise.delay(50);
      }
      throw new Error("PDF 内部视图未就绪");
    }

    async refreshViews({ wait = false } = {}) {
      const views = this.pdfViews().filter((view) => view?._iframeWindow);
      const readyViews = views.length || !wait ? views : await this.waitForPdfViews();
      this.logger(`PDF 内部视图: ${readyViews.length}`);
      for (const view of readyViews) {
        await view.initializedPromise;
        const rawWin = view._iframeWindow;
        const hasWrapped = !!rawWin?.wrappedJSObject;
        const win = rawWin?.wrappedJSObject || rawWin;
        this.logger(`win 解包: wrappedJSObject=${hasWrapped ? "yes" : "no"}, sameRef=${win === rawWin ? "yes" : "no"}`);
        if (!win || this.views.has(win)) continue;
        await win.PDFViewerApplication?.initializedPromise;
        if (this.started) this.attachView(win);
      }
    }

    attachView(win) {
      if (!win?.PDFViewerApplication || this.views.has(win)) return;
      const card = new ns.CardView({
        win,
        index: this.index,
        bridge: this.bridge,
        cardCSS: this.cardCSS,
        sourceFor: (meta) => this.source(meta),
        logger: (message) => this.logger(message),
      });
      const highlighter = new ns.PdfHighlighter({
        win,
        index: this.index,
        readerCSS: this.readerCSS,
        disabledDicts: this.disabledDicts,
        onHover: (span, meta) => card.hover(span, meta),
        onLeave: (span) => card.leave(span),
        onEncounter: this.onEncounter,
        onReset: () => card.remove(),
        onError: (error, pageNumber) => this.logger(`PDF 第 ${pageNumber || "?"} 页高亮失败: ${error.message || error}`),
        onStatus: (message) => this.logger(message),
      });
      this.views.set(win, { card, highlighter });
      win.addEventListener("unload", () => this.detachView(win), { once: true });
      highlighter.start();
      this.logger(`已接入 PDF 视图: ${this.source({}).title}`);
    }

    detachView(win) {
      const view = this.views.get(win);
      if (!view) return;
      view.card.destroy();
      view.highlighter.stop();
      this.views.delete(win);
    }

    renderSelection(event) {
      if (this.isPdf()) this.selection.render(event);
      this.refreshViews().catch((error) => this.logger(`PDF 视图刷新失败: ${error.message || error}`));
    }

    rescan() {
      for (const { highlighter } of this.views.values()) highlighter.scheduleRescan();
    }

    updateIndex(index) {
      this.index = index;
      this.selection.updateIndex(index);
      for (const { card, highlighter } of this.views.values()) {
        card.updateIndex(index);
        highlighter.updateIndex(index);
      }
    }

    source(value) {
      const attachment = Zotero.Items.get(this.reader.itemID);
      const parent = attachment?.parentItemID ? Zotero.Items.get(attachment.parentItemID) : null;
      const paperTitle = parent?.getField("title") || attachment?.getField("title") || "Zotero PDF";
      const pageIndex = Math.max(0, Number(value?.pageIndex ?? value?.position?.pageIndex ?? 0));
      const pageLabel = String(value?.pageLabel || pageIndex + 1);
      let libraryPath = "library";
      const library = attachment ? Zotero.Libraries.get(attachment.libraryID) : null;
      if (library?.libraryType === "group" && library.groupID) libraryPath = `groups/${library.groupID}`;
      const url = attachment?.key ? `zotero://open-pdf/${libraryPath}/items/${attachment.key}?page=${pageIndex + 1}` : "";
      return {
        sentence: String(value?.sentence || value?.text || "").trim().replace(/\s+/g, " "),
        title: `${paperTitle} · p.${pageLabel}`,
        url,
        pageIndex,
        pageLabel,
      };
    }

    stop() {
      this.started = false;
      this.reader._iframeWindow?.removeEventListener("unload", this._onReaderUnload);
      for (const { card, highlighter } of this.views.values()) {
        card.destroy(); highlighter.stop();
      }
      this.views.clear();
    }
  }

  ns.ReaderController = ReaderController;
})(LexisZotero);
