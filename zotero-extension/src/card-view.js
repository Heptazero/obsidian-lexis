(function (ns) {
  const fileName = (path) => String(path || "").split("/").pop() || path || "";

  class CardView {
    constructor({ win, index, bridge, cardCSS, sourceFor, logger }) {
      this.win = win;
      this.doc = win.document;
      this.index = index;
      this.bridge = bridge;
      this.cardCSS = cardCSS;
      this.sourceFor = sourceFor;
      this.logger = logger || (() => {});
      this.detailCache = new Map();
      this.scrollContainer = this.doc.getElementById("viewerContainer");
      // PDF 页面滚动时，命中词的锚点 span 还在（PDF.js 没把这一页卸载），只是位置变了；
      // 之前一滚动就直接关卡片，用户想边滚 PDF 边看卡片内容时体验很差——改成跟着重新定位，
      // 只有锚点真的从 DOM 上消失（翻页远到被虚拟化掉）才关闭。
      this._onViewportChange = () => {
        if (this.host && this.currentSpan?.isConnected) this.position(this.currentSpan);
        else this.remove();
      };
      this.scrollContainer?.addEventListener("scroll", this._onViewportChange, { passive: true });
      this.win.addEventListener("resize", this._onViewportChange);
    }

    updateIndex(index) { this.index = index; this.detailCache.clear(); }

    hover(span, meta) {
      clearTimeout(this.hideTimer);
      if (this.currentSpan === span && this.host) return;
      clearTimeout(this.showTimer);
      this.currentSpan = span;
      this.currentMeta = meta;
      const delay = Math.max(0, Number(this.index.styleConfig.hoverDelayMs || 0));
      this.showTimer = this.win.setTimeout(() => this.show(span, meta), delay);
    }

    leave(span) {
      if (span !== this.currentSpan) return;
      this.logger(`leave 触发: ${this.currentMeta?.key}，220ms 后关闭（若鼠标进入卡片会取消）`);
      clearTimeout(this.showTimer);
      this.hideTimer = this.win.setTimeout(() => {
        this.logger(`卡片关闭(超时): ${this.currentMeta?.key}`);
        this.remove();
      }, 220);
    }

    remove() {
      clearTimeout(this.showTimer);
      clearTimeout(this.hideTimer);
      if (this.host) this.logger(`卡片移除: ${this.currentMeta?.key}`);
      this.host?.remove();
      this.host = null;
      this.card = null;
      this.currentSpan = null;
      this.currentMeta = null;
    }

    destroy() {
      this.remove();
      this.scrollContainer?.removeEventListener("scroll", this._onViewportChange);
      this.win.removeEventListener("resize", this._onViewportChange);
    }

    async show(span, meta) {
      try {
        await this.showUnsafe(span, meta);
      } catch (error) {
        this.logger(`卡片渲染失败: ${error.message || error}`);
      }
    }

    async showUnsafe(span, meta) {
      this.logger(`卡片开始渲染: ${meta?.key}`);
      if (!span?.isConnected || this.currentSpan !== span) return;
      this.host?.remove();
      const host = this.doc.createElement("lexis-zotero-popover");
      // attachShadow 的字典参数和 convertToViewportRectangle 是同一类问题：
      // chrome 侧现造的 {mode:"open"} 传进内容域方法，对方读不到里面的字段，需要 cloneInto。
      const shadowInit = typeof Components === "undefined"
        ? { mode: "open" }
        : Components.utils.cloneInto({ mode: "open" }, this.win);
      const shadow = host.attachShadow(shadowInit);
      const style = this.doc.createElement("style");
      style.textContent = this.cardCSS;
      shadow.appendChild(style);
      const card = this.doc.createElement("div");
      card.className = "lexis-web-pop";
      card.dataset.k = meta.key;
      card.style.setProperty("--lexis-web-color", this.index.accent());
      card.style.setProperty("--lexis-popover-width", Math.max(260, Number(this.index.styleConfig.popoverWidth || 460)) + "px");
      card.style.setProperty("--lexis-popover-height", Math.max(160, Number(this.index.styleConfig.popoverMaxHeight || 420)) + "px");
      card.style.setProperty("--lexis-popover-font-size", Math.max(11, Number(this.index.styleConfig.popoverFontSize || 14)) + "px");
      card.innerHTML = `<div class="lexis-web-pop-title">${this.escape(meta.key)}</div><div class="lexis-web-pop-corner"></div><div class="lexis-web-pop-meta"></div><div class="lexis-web-pop-body">加载中…</div>`;
      card.addEventListener("mouseenter", () => {
        this.logger(`卡片被 hover: ${this.currentMeta?.key}`);
        clearTimeout(this.hideTimer);
      });
      card.addEventListener("mouseleave", () => {
        this.logger(`鼠标离开卡片: ${this.currentMeta?.key}`);
        this.hideTimer = this.win.setTimeout(() => {
          this.logger(`卡片关闭(超时,来自卡片): ${this.currentMeta?.key}`);
          this.remove();
        }, 220);
      });
      // 卡片内容长了会自己滚动；滚到底后按住不放会有滚动链，穿透到 PDF 页面上触发上面那个
      // viewport 监听。CSS 已经有 overscroll-behavior:contain，这里再挡一层 wheel 冒泡保险。
      card.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
      card.addEventListener("click", (event) => {
        const anchor = event.target.closest?.("a[href]");
        if (!anchor) return;
        event.preventDefault();
        this.openURL(anchor.href || anchor.getAttribute("href"));
      });
      shadow.appendChild(card);
      this.doc.body.appendChild(host);
      this.host = host;
      this.card = card;
      this.position(span);

      let data = this.detailCache.get(meta.key);
      if (!data) {
        data = await this.bridge.detail(meta.key);
        if (data?.ok) this.detailCache.set(meta.key, data);
      }
      if (this.card !== card || this.currentSpan !== span) return;
      this.render(data, meta);
      this.position(span);
    }

    render(data, meta) {
      const card = this.card;
      const title = card.querySelector(".lexis-web-pop-title");
      const corner = card.querySelector(".lexis-web-pop-corner");
      const metaRow = card.querySelector(".lexis-web-pop-meta");
      const body = card.querySelector(".lexis-web-pop-body");
      corner.replaceChildren(); metaRow.replaceChildren(); body.replaceChildren();
      if (!data?.ok) {
        body.textContent = data?.offline ? "Obsidian 未连接；高亮继续使用离线词库。" : "未找到这个词";
        return;
      }
      if (data.mathCss) {
        let math = card.getRootNode().querySelector("style[data-lexis-math]");
        if (!math) { math = this.doc.createElement("style"); math.dataset.lexisMath = ""; card.getRootNode().appendChild(math); }
        math.textContent = data.mathCss;
      }

      const primary = data.title || data.base || data.word;
      const secondary = data.subtitle || (data.alias && data.word !== primary ? data.word : data.inline ? data.category : "");
      title.replaceChildren();
      const open = this.doc.createElement("a");
      open.className = "lexis-web-open";
      open.href = this.obsidianURI(data) || "#";
      open.title = "在 Obsidian 中打开";
      const main = this.doc.createElement("span"); main.className = "lexis-web-title-main"; main.textContent = primary;
      open.appendChild(main);
      if (secondary) { const sub = this.doc.createElement("span"); sub.className = "lexis-web-title-sub"; sub.textContent = secondary; open.appendChild(sub); }
      const pen = this.doc.createElement("span"); pen.className = "lexis-web-pen"; pen.textContent = " ✎"; open.appendChild(pen);
      title.appendChild(open);
      card.classList.toggle("has-corner-actions", !data.inline);

      if (!data.inline) {
        corner.appendChild(this.button("✎", "给这个词写批注", () => this.showNoteInput(data, body)));
        corner.appendChild(this.button("🗑", "从词库中删除", async (button) => {
          if (!this.win.confirm(`删除「${data.word}」？`)) return;
          button.disabled = true; button.textContent = "…";
          const result = await this.bridge.delete(data.word || data.base);
          if (result?.ok) this.toast(result.queued ? "删除已加入离线队列" : `已删除「${result.deleted}」`);
          else this.toast("删除失败", false);
          this.remove();
        }, "lexis-web-addbtn-del"));
      }

      this.renderDictionary(data, metaRow);
      if (!data.inline) {
        metaRow.appendChild(this.button("+ 出处", "记录这个词在当前 PDF 的出处", async (button) => {
          button.disabled = true; button.textContent = "…";
          const result = await this.addOccurrence(data.base || data.word, meta);
          this.toast(this.addMessage(result, data.word));
          this.remove();
        }));
        this.renderTags(data, body);
      }

      const content = this.doc.createElement("div");
      content.className = "lexis-web-pop-content";
      if (data.html?.trim()) content.innerHTML = data.html;
      else content.textContent = (data.meaning || data.markdown || "").trim() || "（这个词笔记里还没有正文）";
      body.appendChild(content);
      if (data.extraHtml?.trim()) {
        const extra = this.doc.createElement("div"); extra.className = "lexis-web-pop-extra"; extra.innerHTML = data.extraHtml; body.appendChild(extra);
      }
    }

    renderDictionary(data, metaRow) {
      const folder = this.index.folderOf(data.file);
      const dictionaries = this.index.dictionaries();
      const badge = this.doc.createElement("span");
      badge.className = "lexis-web-dict";
      badge.textContent = folder ? fileName(folder) : "（根目录）";
      badge.title = folder || "根目录";
      metaRow.appendChild(badge);
      if (data.inline || dictionaries.length < 2) return;
      badge.classList.add("lexis-web-dict-click");
      badge.title += " · 点击移动";
      badge.addEventListener("mousedown", (event) => { event.preventDefault(); event.stopPropagation(); });
      badge.addEventListener("click", (event) => {
        event.stopPropagation();
        const existing = this.card.querySelector(".lexis-web-dict-list");
        if (existing) { existing.remove(); return; }
        const list = this.doc.createElement("div");
        list.className = "lexis-web-tag-list lexis-web-dict-list";
        for (const dictionary of dictionaries) {
          const item = this.doc.createElement("span");
          item.className = "lexis-web-tag" + (dictionary === folder ? " lexis-web-tag-off" : "");
          item.textContent = fileName(dictionary); item.title = dictionary;
          item.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
          item.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (dictionary === folder) return list.remove();
            const result = await this.bridge.move({ key: data.base || data.word, folder: dictionary });
            if (result?.ok) this.toast(result.queued ? "移动已加入离线队列" : `已移到 ${fileName(dictionary)}`);
            else this.toast(result?.error === "exists" ? "目标词典已有同名词" : "移动失败", false);
            this.remove();
          });
          list.appendChild(item);
        }
        const badgeRect = badge.getBoundingClientRect(), cardRect = this.card.getBoundingClientRect();
        list.style.left = Math.round(badgeRect.left - cardRect.left) + "px";
        list.style.top = Math.round(badgeRect.bottom - cardRect.top + 4) + "px";
        this.card.appendChild(list);
      });
    }

    renderTags(data, body) {
      const wrap = this.doc.createElement("div"); wrap.className = "lexis-web-pop-tags";
      const excluded = new Set((this.index.styleConfig.excludeTags || []).map((tag) => String(tag).toLowerCase()));
      const draw = () => {
        wrap.replaceChildren();
        for (const tag of data.tags || []) {
          const pill = this.doc.createElement("span");
          pill.className = "lexis-web-tag" + (excluded.has(tag.toLowerCase()) ? " lexis-web-tag-excl" : "");
          pill.textContent = "#" + tag;
          const close = this.doc.createElement("span"); close.className = "lexis-web-tag-del"; close.textContent = " ×";
          close.addEventListener("click", async (event) => {
            event.stopPropagation();
            const result = await this.bridge.tag({ key: data.base || data.word, tag, action: "remove" });
            if (result?.ok && !result.queued) { data.tags = result.tags; draw(); }
            else if (result?.queued) this.toast("标签修改已加入离线队列");
          });
          pill.appendChild(close); wrap.appendChild(pill);
        }
        const picker = this.doc.createElement("span"); picker.className = "lexis-web-tag lexis-web-tag-add"; picker.textContent = (data.tags || []).length ? "+" : "+ 标签";
        picker.addEventListener("click", (event) => { event.stopPropagation(); this.openTagPicker(picker, wrap, data, draw); });
        wrap.appendChild(picker);
      };
      draw(); body.appendChild(wrap);
    }

    openTagPicker(picker, wrap, data, redraw) {
      wrap.querySelector(".lexis-web-tag-list")?.remove();
      const list = this.doc.createElement("div"); list.className = "lexis-web-tag-list";
      for (const tag of this.index.knownTags()) {
        const active = (data.tags || []).includes(tag);
        const item = this.doc.createElement("span"); item.className = "lexis-web-tag" + (active ? " lexis-web-tag-off" : ""); item.textContent = "#" + tag;
        item.addEventListener("mousedown", (event) => { event.preventDefault(); event.stopPropagation(); });
        item.addEventListener("click", async (event) => {
          event.stopPropagation();
          const result = await this.bridge.tag({ key: data.base || data.word, tag, action: active ? "remove" : "add" });
          if (result?.ok && !result.queued) { data.tags = result.tags; redraw(); }
          else if (result?.queued) this.toast("标签修改已加入离线队列");
        });
        list.appendChild(item);
      }
      picker.parentElement.appendChild(list);
    }

    showNoteInput(data, body) {
      const old = body.querySelector(".lexis-web-noterow");
      if (old) return old.querySelector("input")?.focus();
      const row = this.doc.createElement("div"); row.className = "lexis-web-noterow";
      const input = this.doc.createElement("input"); input.className = "lexis-web-noteinput"; input.placeholder = "写批注，回车保存，Esc 取消";
      input.addEventListener("keydown", async (event) => {
        if (event.key === "Escape") return row.remove();
        if (event.key !== "Enter") return;
        event.preventDefault();
        const note = input.value.trim();
        if (!note) return row.remove();
        input.disabled = true;
        const result = await this.bridge.note({ key: data.base || data.word, note });
        this.toast(result?.ok ? result.queued ? "批注已加入离线队列" : "批注已保存" : "批注失败", result?.ok !== false);
        this.remove();
      });
      row.appendChild(input); body.prepend(row); input.focus();
    }

    async addOccurrence(word, meta, alias, folder) {
      const source = this.sourceFor(meta);
      const payload = { word, sentence: source.sentence || meta.sentence || "", url: source.url, title: source.title };
      if (alias) payload.alias = alias;
      if (folder) payload.folder = folder;
      return this.bridge.add(payload);
    }

    addMessage(result, word) {
      if (!result?.ok) return "添加失败（请检查 Obsidian 桥接）";
      if (result.queued) return `已加入离线队列（${result.pending} 条待同步）`;
      if (result.dup) return "这条出处已经记录过了";
      if (result.created) return `已新建「${result.word || word}」`;
      return `已给「${result.word || word}」添加出处`;
    }

    button(text, title, action, extraClass = "") {
      const button = this.doc.createElement("button");
      button.className = "lexis-web-addbtn " + extraClass;
      button.textContent = text; button.title = title;
      button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); action(button); });
      return button;
    }

    obsidianURI(data) {
      return data.vault && data.file ? `obsidian://open?vault=${encodeURIComponent(data.vault)}&file=${encodeURIComponent(data.file)}` : "";
    }

    openURL(url) {
      if (!url || url === "#") return;
      try { Zotero.launchURL(url); } catch (_error) { this.win.open(url); }
    }

    position(span) {
      if (!this.host || !span?.isConnected) return;
      const rect = span.getBoundingClientRect();
      const width = this.host.offsetWidth || 340, height = this.host.offsetHeight || 120;
      let left = rect.left + this.win.scrollX;
      let top = rect.bottom + this.win.scrollY + 6;
      if (left + width > this.win.scrollX + this.doc.documentElement.clientWidth - 8) left = this.win.scrollX + this.doc.documentElement.clientWidth - width - 8;
      if (rect.bottom + height + 12 > this.doc.documentElement.clientHeight) top = rect.top + this.win.scrollY - height - 6;
      this.host.style.left = Math.max(8, left) + "px";
      this.host.style.top = Math.max(8, top) + "px";
    }

    toast(message, ok = true) {
      const toast = this.doc.createElement("div"); toast.className = "lexis-zotero-toast" + (ok ? "" : " error"); toast.textContent = message;
      this.doc.body.appendChild(toast);
      this.win.setTimeout(() => { toast.style.opacity = "0"; this.win.setTimeout(() => toast.remove(), 220); }, 1700);
    }

    escape(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
    }
  }

  class SelectionActions {
    constructor({ index, bridge, sourceFor }) {
      this.index = index;
      this.bridge = bridge;
      this.sourceFor = sourceFor;
    }

    updateIndex(index) { this.index = index; }

    render(event) {
      const { doc, params, append } = event;
      const text = String(params?.annotation?.text || "").trim();
      if (!text || text.length > 80 || text.split(/\s+/).length > 10) return;
      this.installStyle(doc);
      const host = doc.createElement("span"); host.className = "lexis-zotero-selection-host";
      const pill = doc.createElement("span"); pill.className = "lexis-zotero-selection-pill"; host.appendChild(pill);
      const status = doc.createElement("span"); status.className = "lexis-zotero-selection-status"; host.appendChild(status);
      const dictionaries = this.index.dictionaries();
      let folder = dictionaries[0] || "";

      const source = () => this.sourceFor(params?.annotation || {});
      const payload = (word, alias) => {
        const item = source();
        const value = { word, sentence: item.sentence || text, url: item.url, title: item.title };
        if (alias) value.alias = alias;
        if (folder) value.folder = folder;
        return value;
      };
      const report = (result, success) => {
        status.textContent = result?.queued ? `已排队 ${result.pending}` : result?.ok ? success : "失败";
      };

      if (this.index.isExcluded(text)) {
        const button = doc.createElement("button"); button.textContent = "取消排除";
        button.addEventListener("click", async () => {
          const entry = this.index.get(text);
          const excluded = new Set((this.index.styleConfig.excludeTags || []).map((tag) => String(tag).toLowerCase()));
          for (const tag of entry?.tags || []) if (excluded.has(tag)) await this.bridge.tag({ key: text, tag, action: "remove" });
          status.textContent = "已恢复";
        });
        pill.appendChild(button); append(host); return;
      }

      const add = doc.createElement("button"); add.textContent = this.index.has(text) ? "+ 出处" : "＋"; add.title = "添加到 Lexis";
      add.addEventListener("click", async () => { add.disabled = true; report(await this.bridge.add(payload(text)), "已添加"); });
      pill.appendChild(add);
      if (dictionaries.length > 1) {
        const select = doc.createElement("select"); select.title = "选择词典";
        for (const dictionary of dictionaries) { const option = doc.createElement("option"); option.value = dictionary; option.textContent = fileName(dictionary); select.appendChild(option); }
        select.addEventListener("change", () => { folder = select.value; });
        pill.appendChild(select);
      }
      const alias = doc.createElement("button"); alias.textContent = "🔗"; alias.title = "把选中文字作为别名归入另一个词";
      alias.addEventListener("click", () => {
        const input = doc.createElement("input"); input.placeholder = "原形单词";
        input.addEventListener("keydown", async (keyEvent) => {
          if (keyEvent.key !== "Enter") return;
          const target = input.value.trim();
          if (!target) return;
          input.disabled = true; report(await this.bridge.add(payload(target, text)), "已归入");
        });
        alias.replaceWith(input); input.focus();
      });
      pill.appendChild(alias);
      append(host);
    }

    installStyle(doc) {
      let style = doc.getElementById("lexis-zotero-selection-style");
      if (!style) {
        style = doc.createElement("style");
        style.id = "lexis-zotero-selection-style";
        doc.head.appendChild(style);
      }
      style.textContent = `
        .lexis-zotero-selection-host{display:inline-flex;align-items:center;font:12px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .lexis-zotero-selection-pill{display:flex;align-items:center;overflow:hidden;border-radius:7px;background:${this.index.accent()};color:${this.index.accentText()}}
        .lexis-zotero-selection-pill button,.lexis-zotero-selection-pill select,.lexis-zotero-selection-pill input{box-sizing:border-box;min-height:25px;margin:0;padding:4px 8px;border:0;border-left:1px solid color-mix(in srgb,currentColor 28%,transparent);outline:0;background:transparent;color:inherit;font:inherit}
        .lexis-zotero-selection-pill>*:first-child{border-left:0}
        .lexis-zotero-selection-pill button{cursor:pointer}
        .lexis-zotero-selection-pill button:hover,.lexis-zotero-selection-pill select:hover{background:color-mix(in srgb,currentColor 15%,transparent)}
        .lexis-zotero-selection-pill input{width:112px;background:color-mix(in srgb,#fff 17%,transparent)}
        .lexis-zotero-selection-status{align-self:center;margin-left:6px;color:var(--fill-secondary,#666);font:11px/1.2 sans-serif}
      `;
    }
  }

  ns.CardView = CardView;
  ns.SelectionActions = SelectionActions;
})(LexisZotero);
