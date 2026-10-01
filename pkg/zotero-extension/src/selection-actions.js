(function (ns) {
  const fileName = (path) => String(path || "").split("/").pop() || path || "";

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

  ns.SelectionActions = SelectionActions;
})(LexisZotero);
