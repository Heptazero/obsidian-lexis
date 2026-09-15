// Lexis Web —— popup:读写配置、测试连接、同步词库
const { defaultConnection, normalizePort } = globalThis.LexisWebConfig;
const DEFAULT_CFG = { ...defaultConnection, token: "", highlight: true, showMemoryCurve: true, color: "#7c5cff", style: "wavy", useObsidianStyle: true, opacity: 100 };
const $ = (id) => document.getElementById(id);

let cfg = DEFAULT_CFG;
let hasStyleConfig = false;
let saveTimer = null;
let styleCfg = null;
let currentSite = "";
let siteDictionaryVisibility = {};

const shortFolder = (folder) => String(folder || "").split("/").pop() || folder;

async function resolveCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab?.id) return null;
  const context = await chrome.tabs.sendMessage(tab.id, { type: "lexis-page-context" }).catch(() => null);
  return context?.site ? context : null;
}

function renderDictionaries() {
  const container = $("dictionaries");
  container.textContent = "";
  $("currentSite").textContent = currentSite || "当前页面不可设置";
  const dictionaries = Array.isArray(styleCfg?.dicts) ? styleCfg.dicts.filter(Boolean) : [];
  if (!currentSite || !dictionaries.length) {
    const empty = document.createElement("div");
    empty.className = "dictionary-empty";
    empty.textContent = dictionaries.length ? "当前页面不可设置" : "同步后显示词典";
    container.appendChild(empty);
    return;
  }
  for (const folder of dictionaries) {
    const row = document.createElement("label");
    row.className = "dictionary-row";
    row.title = folder;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = siteDictionaryVisibility[currentSite]?.[folder] !== false;
    const name = document.createElement("span");
    name.textContent = shortFolder(folder);
    input.addEventListener("change", async () => {
      const siteState = { ...(siteDictionaryVisibility[currentSite] || {}) };
      if (input.checked) delete siteState[folder];
      else siteState[folder] = false;
      siteDictionaryVisibility = { ...siteDictionaryVisibility };
      if (Object.keys(siteState).length) siteDictionaryVisibility[currentSite] = siteState;
      else delete siteDictionaryVisibility[currentSite];
      await chrome.storage.local.set({ siteDictionaryVisibility });
    });
    row.append(input, name);
    container.appendChild(row);
  }
}

async function load() {
  const stored = await chrome.storage.local.get(["cfg", "meta", "pendingAdds", "styleConfig", "siteDictionaryVisibility"]);
  const { cfg: c, meta, pendingAdds, styleConfig } = stored;
  cfg = Object.assign({}, DEFAULT_CFG, c || {});
  const storedPort = cfg.port;
  cfg.port = normalizePort(storedPort);
  if (cfg.port !== storedPort) await chrome.storage.local.set({ cfg });
  styleCfg = styleConfig || null;
  hasStyleConfig = !!styleCfg;
  siteDictionaryVisibility = stored.siteDictionaryVisibility || {};
  const page = await resolveCurrentSite();
  currentSite = page?.site || "";
  $("host").value = cfg.host;
  $("port").value = cfg.port;
  $("token").value = cfg.token;
  $("highlight").checked = !!cfg.highlight;
  $("showMemoryCurve").checked = cfg.showMemoryCurve !== false;
  $("style").value = cfg.style;
  $("color").value = cfg.color;
  $("opacity").value = cfg.opacity || 100;
  $("opacityVal").textContent = (cfg.opacity || 100) + "%";
  $("useObsidianStyle").checked = !!(cfg.useObsidianStyle !== false && hasStyleConfig);
  toggleObsidianStyle();
  renderDictionaries();
  renderMeta(meta, pendingAdds);
  autoSyncIfStale(meta);
}

function toggleObsidianStyle() {
  const on = $("useObsidianStyle").checked && hasStyleConfig;
  $("customStyle").style.display = on ? "none" : "";
}

async function autoSyncIfStale(meta) {
  if (!cfg.token) return;
  let ping;
  try { ping = await chrome.runtime.sendMessage({ type: "ping" }); } catch (e) { return; }
  if (!ping || !ping.ok) return;
  if (meta && meta.version === ping.version && meta.count != null) return;
  const r = await chrome.runtime.sendMessage({ type: "sync" }).catch(() => null);
  if (r && r.ok) {
    const data = await chrome.storage.local.get(["meta", "pendingAdds", "styleConfig"]);
    renderMeta(r.meta, data.pendingAdds);
    styleCfg = data.styleConfig || null;
    hasStyleConfig = !!styleCfg;
    toggleObsidianStyle();
    renderDictionaries();
  }
}

function renderMeta(meta, pendingAdds) {
  const parts = [];
  if (meta && meta.count != null) {
    const t = meta.syncedAt ? new Date(meta.syncedAt).toLocaleString() : "?";
    parts.push(`${meta.count} 个词 · ${t}`);
  } else {
    parts.push("尚未同步");
  }
  if (pendingAdds && pendingAdds.length) {
    parts.push(`${pendingAdds.length} 条待同步`);
  }
  $("meta").textContent = parts.join(" · ");
}

async function save() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  cfg = {
    host: $("host").value.trim() || "127.0.0.1",
    port: normalizePort($("port").value),
    token: $("token").value.trim(),
    highlight: $("highlight").checked,
    showMemoryCurve: $("showMemoryCurve").checked,
    color: $("color").value,
    style: $("style").value,
    opacity: parseInt($("opacity").value, 10) || 100,
    useObsidianStyle: $("useObsidianStyle").checked,
  };
  $("port").value = cfg.port;
  await chrome.storage.local.set({ cfg });
}

function scheduleSave() {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void save(); }, 250);
}

function status(text, cls) {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + (cls || "");
}

// Firefox MV3 安装时不自动授予 host 权限,后台 fetch 本地桥接前需用户点头;
// Chrome 下权限装完就有,此调用静默通过。必须在没有其他 await 的情况下最先调用,否则用户手势失效。
function ensureLocalPermission() {
  if (!chrome.permissions) return Promise.resolve(true);
  const origin = `http://${$("host").value.trim() || "127.0.0.1"}:${normalizePort($("port").value)}/`;
  return chrome.permissions.request({ origins: [origin] }).then(() => true, () => false);
}

$("test").addEventListener("click", async () => {
  if (!(await ensureLocalPermission())) { status("需要允许访问本地地址后才能连接", "err"); return; }
  await save();
  status("连接中…");
  const r = await chrome.runtime.sendMessage({ type: "ping" }).catch(() => null);
  if (r && r.ok) status(`已连接 · v${r.version || "?"}`, "ok");
  else status("连接失败：请检查 Obsidian、桥接和端口", "err");
});

$("sync").addEventListener("click", async () => {
  if (!(await ensureLocalPermission())) { status("需要允许访问本地地址后才能同步", "err"); return; }
  await save();
  status("同步中…");
  $("sync").disabled = true;
  const r = await chrome.runtime.sendMessage({ type: "sync" }).catch(() => null);
  $("sync").disabled = false;
  if (r && r.ok) {
    status(`已同步 · ${r.meta.count} 个词`, "ok");
    renderMeta(r.meta);
    const data = await chrome.storage.local.get("styleConfig");
    styleCfg = data.styleConfig || null;
    hasStyleConfig = !!styleCfg;
    toggleObsidianStyle();
    renderDictionaries();
  }
  else if (r && r.error === "bad-token") status("令牌错误", "err");
  else status("同步失败：请检查 Obsidian 和桥接", "err");
});

function bindEvents() {
  for (const id of ["highlight", "showMemoryCurve", "style", "color"]) $(id).addEventListener("change", save);
  for (const id of ["host", "token"]) $(id).addEventListener("input", scheduleSave);
  $("port").addEventListener("change", save);
  $("token").addEventListener("paste", () => setTimeout(() => { void save(); }, 0));
  $("opacity").addEventListener("input", scheduleSave);
  $("opacity").addEventListener("input", () => { $("opacityVal").textContent = $("opacity").value + "%"; });
  $("useObsidianStyle").addEventListener("change", () => { toggleObsidianStyle(); void save(); });
}

void load().then(bindEvents);
