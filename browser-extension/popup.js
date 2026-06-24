// Lexis Web —— popup:读写配置、测试连接、同步词库
const DEFAULT_CFG = { host: "127.0.0.1", port: 45945, token: "", highlight: true, color: "#7c5cff", style: "wavy", useObsidianStyle: true };
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
  $("style").value = cfg.style;
  $("color").value = cfg.color;
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
    parts.push(`已缓存 ${meta.count} 个词 · 上次 ${t}`);
  } else {
    parts.push("还没同步过词库");
  }
  if (pendingAdds && pendingAdds.length) {
    parts.push(`⏳ ${pendingAdds.length} 条待同步`);
  }
  $("meta").textContent = parts.join(" · ");
}

async function save() {
  cfg = {
    host: $("host").value.trim() || "127.0.0.1",
    port: parseInt($("port").value, 10) || 45945,
    token: $("token").value.trim(),
    highlight: $("highlight").checked,
    color: $("color").value,
    style: $("style").value,
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
  if (r && r.ok) status(`✅ 已连上 Lexis v${r.version || "?"}`, "ok");
  else status("❌ 连不上。Obsidian 开着吗?桥接启用了吗?端口对吗?", "err");
});

$("sync").addEventListener("click", async () => {
  await save();
  status("同步中…");
  $("sync").disabled = true;
  const r = await chrome.runtime.sendMessage({ type: "sync" }).catch(() => null);
  $("sync").disabled = false;
  if (r && r.ok) { status(`✅ 同步了 ${r.meta.count} 个词`, "ok"); renderMeta(r.meta); }
  else if (r && r.error === "bad-token") status("❌ 令牌不对,去 Lexis 设置里复制", "err");
  else status("❌ 同步失败。Obsidian 开着且桥接启用?", "err");
});

for (const id of ["highlight", "style", "color"]) $(id).addEventListener("change", save);
for (const id of ["host", "port", "token"]) $(id).addEventListener("input", save);
$("useObsidianStyle").addEventListener("change", () => { toggleObsidianStyle(); save(); });

load();
