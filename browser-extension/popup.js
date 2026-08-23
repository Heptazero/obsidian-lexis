// Lexis Web —— popup:读写配置、测试连接、同步词库
const DEFAULT_CFG = { host: "127.0.0.1", port: 45945, token: "", highlight: true, showMemoryCurve: true, color: "#7c5cff", style: "wavy", useObsidianStyle: true, opacity: 100 };
const $ = (id) => document.getElementById(id);

let cfg = DEFAULT_CFG;
let hasStyleConfig = false;

async function load() {
  const { cfg: c, meta, pendingAdds, styleConfig } = await chrome.storage.local.get(["cfg", "meta", "pendingAdds", "styleConfig"]);
  cfg = Object.assign({}, DEFAULT_CFG, c || {});
  hasStyleConfig = !!styleConfig;
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
    const data = await chrome.storage.local.get(["meta", "pendingAdds"]);
    renderMeta(r.meta, data.pendingAdds);
    hasStyleConfig = true;
    toggleObsidianStyle();
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
  cfg = {
    host: $("host").value.trim() || "127.0.0.1",
    port: parseInt($("port").value, 10) || 45945,
    token: $("token").value.trim(),
    highlight: $("highlight").checked,
    showMemoryCurve: $("showMemoryCurve").checked,
    color: $("color").value,
    style: $("style").value,
    opacity: parseInt($("opacity").value, 10) || 100,
    useObsidianStyle: $("useObsidianStyle").checked,
  };
  await chrome.storage.local.set({ cfg });
}

function status(text, cls) {
  const el = $("status");
  el.textContent = text;
  el.className = "status " + (cls || "");
}

$("test").addEventListener("click", async () => {
  await save();
  status("连接中…");
  const r = await chrome.runtime.sendMessage({ type: "ping" }).catch(() => null);
  if (r && r.ok) status(`已连接 · v${r.version || "?"}`, "ok");
  else status("连接失败：请检查 Obsidian、桥接和端口", "err");
});

$("sync").addEventListener("click", async () => {
  await save();
  status("同步中…");
  $("sync").disabled = true;
  const r = await chrome.runtime.sendMessage({ type: "sync" }).catch(() => null);
  $("sync").disabled = false;
  if (r && r.ok) { status(`已同步 · ${r.meta.count} 个词`, "ok"); renderMeta(r.meta); }
  else if (r && r.error === "bad-token") status("令牌错误", "err");
  else status("同步失败：请检查 Obsidian 和桥接", "err");
});

for (const id of ["highlight", "showMemoryCurve", "style", "color"]) $(id).addEventListener("change", save);
for (const id of ["host", "port", "token"]) $(id).addEventListener("input", save);
$("opacity").addEventListener("input", save);
$("opacity").addEventListener("input", () => { $("opacityVal").textContent = $("opacity").value + "%"; });
$("useObsidianStyle").addEventListener("change", () => { toggleObsidianStyle(); save(); });

load();
