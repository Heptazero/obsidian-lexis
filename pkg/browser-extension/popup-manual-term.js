(function () {
  function sourceUrl(value) {
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  }

  function mount(root, { pageUrl, lastFolder, submit, onSaved }) {
    const form = root.querySelector("form");
    const term = form.elements.namedItem("term");
    const aliases = form.elements.namedItem("aliases");
    const definition = form.elements.namedItem("definition");
    const destination = form.elements.namedItem("folder");
    const include = form.elements.namedItem("includeSource");
    const save = form.querySelector("button");
    const status = form.querySelector("[role=status]");
    const url = sourceUrl(pageUrl);
    include.checked = false;
    include.disabled = !url;
    include.closest("label").title = url || "此页面无法读取网页链接";
    let saving = false;
    root.addEventListener("toggle", () => { if (root.open) term.focus(); });

    function update(config) {
      const previous = destination.value || lastFolder;
      const rows = Array.isArray(config?.collections) ? config.collections : (config?.dicts || []).map(folder => ({ name: folder, folder }));
      destination.textContent = "";
      const seen = new Set();
      for (const { folder, name } of rows) {
        if (!folder || seen.has(folder)) continue;
        seen.add(folder);
        const option = root.ownerDocument.createElement("option");
        option.value = folder;
        option.textContent = name || folder;
        destination.appendChild(option);
      }
      if (seen.has(previous)) destination.value = previous;
      destination.closest("label").hidden = seen.size < 2;
      save.disabled = saving || !destination.value;
      if (!seen.size) status.textContent = "先同步一个可保存新词的词典。";
      else if (status.textContent === "先同步一个可保存新词的词典。") status.textContent = "";
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const name = term.value.trim(), folder = destination.value;
      if (saving || !name || !folder) return;
      saving = save.disabled = true;
      status.textContent = "正在添加…";
      try {
        const result = await submit({
          term: name, aliases: aliases.value, definition: definition.value, folder,
          sourceUrl: include.checked ? url : "",
        });
        if (!result?.ok) {
          status.textContent = result?.message || ({
            "bad-token": "令牌错误，请检查连接设置。",
            "not-found": "请先更新并重载 Obsidian 端 Lexis。",
            "permission": "需要允许访问本地地址。",
            "request-timeout": "请求超时，请检查笔记是否已创建。",
          })[result?.error] || "添加失败，请检查 Obsidian 和桥接连接。";
          return;
        }
        term.value = aliases.value = definition.value = "";
        include.checked = false;
        status.textContent = "已添加到 Obsidian。";
        onSaved(folder);
      } catch {
        status.textContent = "添加失败，请检查 Obsidian 和桥接连接。";
      } finally {
        saving = false;
        save.disabled = !destination.value;
      }
    });
    return { update };
  }
  globalThis.LexisPopupManualTerm = { mount };
})();
