// Lexis Web —— popup:读写配置、测试连接、同步词库
const DEFAULT_CFG = { host: "127.0.0.1", port: 45945, token: "", highlight: true, color: "#7c5cff", style: "wavy" };
const $ = (id) => document.getElementById(id);

let cfg = DEFAULT_CFG;

async function load() {
  const { cfg: c, meta } = await chrome.storage.local.get(["cfg", "meta"]);
  cfg = Object.assign({}, DEFAULT_CFG, c || {});
  $("host").value = cfg.host;
  $("port").value = cfg.port;
  $("token").value = cfg.token;
  $("highlight").checked = !!cfg.highlight;
  $("style").value = cfg.style;
  $("color").value = cfg.color;
  renderMeta(meta);
}

function renderMeta(meta) {
  if (meta && meta.count != null) {
    const t = meta.syncedAt ? new Date(meta.syncedAt).toLocaleString() : "?";
    $("meta").textContent = `已缓存 ${meta.count} 个词 · 上次同步 ${t}`;
  } else {
    $("meta").textContent = "还没同步过词库";
  }
}

async function save() {
  cfg = {
    host: $("host").value.trim() || "127.0.0.1",
    port: parseInt($("port").value, 10) || 45945,
    token: $("token").value.trim(),
    highlight: $("highlight").checked,
    color: $("color").value,
    style: $("style").value,
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

load();
