// Lexis Web —— 后台服务工作者:唯一与本机 Lexis 桥接通信的地方(有 host 权限,绕过页面 CORS/混合内容限制)
const DEFAULT_CFG = { host: "127.0.0.1", port: 45945, token: "", highlight: true, color: "#7c5cff", style: "wavy" };

async function getCfg() {
  const { cfg } = await chrome.storage.local.get("cfg");
  return Object.assign({}, DEFAULT_CFG, cfg || {});
}
function base(cfg) { return `http://${cfg.host}:${cfg.port}`; }

async function api(cfg, path, params) {
  const u = new URL(base(cfg) + path);
  if (params) for (const k in params) u.searchParams.set(k, params[k]);
  if (cfg.token) u.searchParams.set("token", cfg.token);
  const r = await fetch(u.toString(), { method: "GET", cache: "no-store" });
  return r.json();
}

async function flushPending(cfg) {
  const { pendingAdds } = await chrome.storage.local.get("pendingAdds");
  if (!pendingAdds || !pendingAdds.length) return 0;
  const remaining = [];
  for (const p of pendingAdds) {
    try {
      const u = new URL(base(cfg) + "/add");
      if (cfg.token) u.searchParams.set("token", cfg.token);
      await fetch(u.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    } catch (e) { remaining.push(p); }
  }
  await chrome.storage.local.set({ pendingAdds: remaining });
  return remaining.length;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    let cfg;
    try { cfg = await getCfg(); } catch (e) { sendResponse({ ok: false, error: "no-config" }); return; }
    try {
      if (msg.type === "ping") {
        const r = await fetch(`${base(cfg)}/ping`, { cache: "no-store" });
        sendResponse(await r.json());
        return;
      }
      if (msg.type === "sync") {
        const data = await api(cfg, "/words");
        if (data && data.ok) {
          const words = (data.words || []).map((x) => ({ k: x.key, w: x.word, t: x.tags || [] }));
          const meta = { count: words.length, syncedAt: Date.now(), version: data.version };
          const styleConfig = data.styleConfig || null;
          await chrome.storage.local.set({ words, meta, styleConfig });
          // 同步成功后重放离线队列
          meta.pending = await flushPending(cfg);
          sendResponse({ ok: true, meta });
        } else sendResponse(data || { ok: false, error: "no-data" });
        return;
      }
      if (msg.type === "detail") {
        sendResponse(await api(cfg, "/word", { key: msg.key }));
        return;
      }
      if (msg.type === "add") {
        const u = new URL(base(cfg) + "/add");
        if (cfg.token) u.searchParams.set("token", cfg.token);
        try {
          const r = await fetch(u.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg.payload || {}) });
          sendResponse(await r.json());
        } catch (e) {
          // 网络不通(Obsidian 没开):排队,下次同步时自动重放
          const { pendingAdds } = await chrome.storage.local.get("pendingAdds");
          const queue = pendingAdds || [];
          queue.push(msg.payload || {});
          await chrome.storage.local.set({ pendingAdds: queue });
          sendResponse({ ok: true, queued: true, pending: queue.length });
        }
        return;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e), offline: true });
    }
  })();
  return true; // 异步响应
});
