// Lexis Web —— 内容脚本:在网页上高亮词库里的词,悬停显示释义
(() => {
  const HL = "lexis-web-hl";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE", "SELECT", "OPTION", "KBD", "SAMP"]);
  const DEFAULT_CFG = { highlight: true, color: "#7c5cff", style: "wavy" };

  let cfg = null;
  let keySet = null;
  let regex = null;
  let observer = null;
  let scanTimer = null;
  const detailCache = new Map();
  let pop = null, hideTimer = null;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty("--lexis-web-color", cfg.color || "#7c5cff");
    root.setAttribute("data-lexis-style", cfg.style || "wavy");
  }

  function build(words) {
    keySet = new Set();
    const keys = [];
    for (const x of words || []) {
      const k = (x.k || "").toLowerCase();
      if (k.length >= 2) { keySet.add(k); keys.push(k); }
    }
    keys.sort((a, b) => b.length - a.length);
    regex = keys.length ? new RegExp("\\b(?:" + keys.map(esc).join("|") + ")\\b", "gi") : null;
  }

  function skip(node) {
    let p = node.parentElement;
    while (p) {
      if (SKIP_TAGS.has(p.tagName)) return true;
      if (p.isContentEditable) return true;
      if (p.classList && (p.classList.contains(HL) || p.classList.contains("lexis-web-pop"))) return true;
      p = p.parentElement;
    }
    return false;
  }

  function wrap(textNode) {
    const text = textNode.nodeValue;
    regex.lastIndex = 0;
    let m, last = 0, found = false;
    const frag = document.createDocumentFragment();
    while ((m = regex.exec(text))) {
      const key = m[0].toLowerCase();
      if (!keySet.has(key)) continue;
      found = true;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement("span");
      span.className = HL;
      span.dataset.k = key;
      span.textContent = m[0];
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (!found) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  }

  function scan(root) {
    if (!regex || !(cfg && cfg.highlight)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || n.nodeValue.length < 2) return NodeFilter.FILTER_REJECT;
        if (skip(n)) return NodeFilter.FILTER_REJECT;
        regex.lastIndex = 0;
        if (!regex.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    for (const t of targets) wrap(t);
  }

  function unwrapAll() {
    for (const span of document.querySelectorAll("." + HL)) {
      const tn = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(tn, span);
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scan(document.body), 400);
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((muts) => {
      for (const mu of muts) if (mu.addedNodes && mu.addedNodes.length) { scheduleScan(); break; }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---- 悬停卡 ----
  function removePop() { if (pop) { pop.remove(); pop = null; } }
  function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(removePop, 220); }

  async function showPop(span) {
    const key = span.dataset.k;
    if (pop && pop.dataset.k === key) { clearTimeout(hideTimer); return; }
    removePop();
    pop = document.createElement("div");
    pop.className = "lexis-web-pop";
    pop.dataset.k = key;
    pop.innerHTML = `<div class="lexis-web-pop-title">${span.textContent}</div><div class="lexis-web-pop-body">加载中…</div>`;
    pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    pop.addEventListener("mouseleave", scheduleHide);
    document.body.appendChild(pop);
    position(pop, span);

    let data = detailCache.get(key);
    if (!data) {
      try { data = await chrome.runtime.sendMessage({ type: "detail", key }); }
      catch (e) { data = { ok: false, error: "扩展未连接" }; }
      if (data && data.ok) detailCache.set(key, data);
    }
    if (!pop || pop.dataset.k !== key) return;
    renderDetail(pop, data);
    position(pop, span);
  }

  function obsidianUri(data) {
    if (!data.vault || !data.file) return null;
    return `obsidian://open?vault=${encodeURIComponent(data.vault)}&file=${encodeURIComponent(data.file)}`;
  }

  function renderDetail(box, data) {
    const titleEl = box.querySelector(".lexis-web-pop-title");
    const body = box.querySelector(".lexis-web-pop-body");
    body.innerHTML = "";
    if (!data || !data.ok) {
      body.textContent = data && data.offline ? "Obsidian 未连接(开着且桥接已启用?)" : "未找到这个词";
      return;
    }
    // 标题:点击在 Obsidian 中打开该笔记
    const uri = obsidianUri(data);
    titleEl.textContent = "";
    const label = data.word + (data.base && data.base !== data.word ? "  → " + data.base : "");
    if (uri) {
      const a = document.createElement("a");
      a.className = "lexis-web-open";
      a.href = uri;
      a.textContent = label;
      a.title = "在 Obsidian 中打开";
      const pen = document.createElement("span"); pen.className = "lexis-web-pen"; pen.textContent = " ✎";
      a.appendChild(pen);
      titleEl.appendChild(a);
    } else {
      titleEl.textContent = label;
    }
    if (data.tags && data.tags.length) {
      const tagWrap = document.createElement("div");
      tagWrap.className = "lexis-web-pop-tags";
      for (const t of data.tags) { const s = document.createElement("span"); s.className = "lexis-web-tag"; s.textContent = "#" + t; tagWrap.appendChild(s); }
      body.appendChild(tagWrap);
    }
    const content = document.createElement("div");
    content.className = "lexis-web-pop-content";
    if (data.html && data.html.trim()) content.innerHTML = data.html;
    else content.textContent = (data.meaning || data.markdown || "").trim() || "(这个词笔记里还没写内容)";
    body.appendChild(content);
  }

  function position(box, span) {
    const r = span.getBoundingClientRect();
    const bw = box.offsetWidth || 320, bh = box.offsetHeight || 80;
    let left = r.left + window.scrollX;
    let top = r.bottom + window.scrollY + 6;
    if (left + bw > window.scrollX + document.documentElement.clientWidth - 8) left = window.scrollX + document.documentElement.clientWidth - bw - 8;
    if (r.bottom + bh + 12 > document.documentElement.clientHeight) top = r.top + window.scrollY - bh - 6;
    box.style.left = Math.max(8, left) + "px";
    box.style.top = Math.max(8, top) + "px";
  }

  document.addEventListener("mouseover", (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains(HL)) showPop(t);
  });
  document.addEventListener("mouseout", (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains(HL)) scheduleHide();
  });

  // ---- 启动 / 配置变化 ----
  async function init() {
    const { cfg: c, words } = await chrome.storage.local.get(["cfg", "words"]);
    cfg = Object.assign({}, DEFAULT_CFG, c || {});
    applyTheme();
    build(words || []);
    if (cfg.highlight) { scan(document.body); startObserver(); }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    (async () => {
      if (changes.cfg) {
        cfg = Object.assign({}, DEFAULT_CFG, changes.cfg.newValue || {});
        applyTheme();
        if (!cfg.highlight) { unwrapAll(); removePop(); }
      }
      if (changes.words) build(changes.words.newValue || []);
      if (cfg && cfg.highlight) {
        if (changes.words || (changes.cfg && changes.cfg.newValue && changes.cfg.newValue.highlight && !(changes.cfg.oldValue || {}).highlight)) {
          unwrapAll();
          scan(document.body);
          startObserver();
        }
      }
    })();
  });

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
