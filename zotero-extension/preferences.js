var LexisZoteroPreferences = {
  keys: {
    enabled: "extensions.lexis-zotero.enabled",
    host: "extensions.lexis-zotero.host",
    port: "extensions.lexis-zotero.port",
    token: "extensions.lexis-zotero.token",
    syncMinutes: "extensions.lexis-zotero.syncMinutes",
    disabledDicts: "extensions.lexis-zotero.disabledDicts",
  },

  init(root) {
    if (root.dataset.lexisReady === "true") return;
    const view = this.view(root);
    if (!view) return;
    root.dataset.lexisReady = "true";

    view.enabled.checked = this.get(this.keys.enabled, true);
    view.host.value = this.get(this.keys.host, "127.0.0.1");
    view.port.value = String(this.get(this.keys.port, 12345));
    view.token.value = this.get(this.keys.token, "");
    view.sync.value = String(this.get(this.keys.syncMinutes, 3));

    view.enabled.addEventListener("change", () => this.save(view));
    for (const input of [view.host, view.port, view.token, view.sync]) {
      input.addEventListener("change", () => this.save(view));
    }
    view.test.addEventListener("click", () => this.run(view, view.test, "正在测试连接…", async (plugin) => {
      const result = await plugin.testConnection();
      if (!result?.ok) throw new Error(this.errorText(result));
      this.renderDicts(root);
      return `连接正常 · ${result.vault || "Lexis"} · ${result.count ?? 0} 个词`;
    }));
    view.syncNow.addEventListener("click", () => this.run(view, view.syncNow, "正在同步…", async (plugin) => {
      const result = await plugin.syncNow();
      if (!result?.ok) throw new Error(this.errorText(result));
      this.renderDicts(root);
      return `同步完成 · ${result.count ?? 0} 个词`;
    }));

    this.renderDicts(root);
  },

  renderDicts(root) {
    const container = root.querySelector("#lexis-zotero-dicts");
    if (!container) return;
    const dicts = Zotero.LexisZotero?.listDictionaries?.() || [];
    let disabled = new Set();
    try { disabled = new Set(JSON.parse(Zotero.Prefs.get(this.keys.disabledDicts, true) || "[]")); } catch (_error) {}
    container.replaceChildren();
    if (!dicts.length) {
      const empty = document.createElement("p");
      empty.className = "lexis-pref-files-empty";
      empty.textContent = "词典文件夹列表为空，先「测试连接」或「立即同步」拉取一次";
      container.appendChild(empty);
      return;
    }
    for (const dict of dicts) {
      if (!dict) continue;
      const row = document.createElement("label");
      row.className = "lexis-pref-file-row";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !disabled.has(dict);
      checkbox.addEventListener("change", () => {
        const next = new Set(disabled);
        if (checkbox.checked) next.delete(dict);
        else next.add(dict);
        Zotero.Prefs.set(this.keys.disabledDicts, JSON.stringify([...next]), true);
        disabled = next;
      });
      const label = document.createElement("span");
      label.textContent = dict.split("/").filter(Boolean).pop() || dict;
      label.title = dict;
      row.appendChild(checkbox);
      row.appendChild(label);
      container.appendChild(row);
    }
  },

  view(root) {
    const get = (id) => root.querySelector(`#${id}`);
    const view = {
      enabled: get("lexis-zotero-enabled"),
      host: get("lexis-zotero-host"),
      port: get("lexis-zotero-port"),
      token: get("lexis-zotero-token"),
      sync: get("lexis-zotero-sync"),
      status: get("lexis-zotero-status"),
      test: get("lexis-zotero-test"),
      syncNow: get("lexis-zotero-sync-now"),
    };
    return Object.values(view).every(Boolean) ? view : null;
  },

  save(view) {
    Zotero.Prefs.set(this.keys.enabled, Boolean(view.enabled.checked), true);
    Zotero.Prefs.set(this.keys.host, view.host.value.trim() || "127.0.0.1", true);
    Zotero.Prefs.set(this.keys.port, this.number(view.port.value, 1, 65535, 12345), true);
    Zotero.Prefs.set(this.keys.token, view.token.value.trim(), true);
    Zotero.Prefs.set(this.keys.syncMinutes, this.number(view.sync.value, 1, 60, 3), true);
  },

  async run(view, button, busyText, action) {
    this.save(view);
    button.disabled = true;
    this.status(view, busyText);
    try {
      const plugin = Zotero.LexisZotero;
      if (!plugin) throw new Error("Lexis 主程序尚未启动，请重启 Zotero");
      this.status(view, await action(plugin), "ok");
    } catch (error) {
      this.status(view, error.message || String(error), "error");
      Zotero.logError(error);
    } finally {
      button.disabled = false;
    }
  },

  status(view, text, state = "working") {
    view.status.textContent = text;
    view.status.dataset.state = state;
  },

  get(key, fallback) {
    const value = Zotero.Prefs.get(key, true);
    return typeof value === typeof fallback ? value : fallback;
  },

  number(value, min, max, fallback) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  },

  errorText(result) {
    if (result?.error === "bad-token") return "令牌不正确";
    if (result?.offline) return "未连接：请打开 Obsidian，并启用 Lexis 本机桥接";
    return result?.error ? `同步失败：${result.error}` : "同步失败";
  },
};

document.addEventListener("load", (event) => {
  const root = event.target;
  if (root?.classList?.contains("lexis-pref-root")) LexisZoteroPreferences.init(root);
}, true);
