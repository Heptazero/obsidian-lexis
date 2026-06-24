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
  let pop = null, hideTimer = null, currentSpan = null;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ---- 句子抽取(按标点切,跟 Obsidian 端「出现过的地方」一致) ----
  const SENT_SEP = /[.!?。!?…\n]/;
  function extractSentence(text, idx) {
    if (!text) return "";
    let start = 0, end = text.length;
    for (let i = Math.min(idx, text.length - 1); i >= 0; i--) if (SENT_SEP.test(text[i])) { start = i + 1; break; }
    for (let i = idx; i < text.length; i++) if (SENT_SEP.test(text[i])) { end = i + 1; break; }
    return text.slice(start, end).trim().replace(/\s+/g, " ");
  }
  function blockOf(node) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    while (el && el.parentElement && !/^(P|LI|TD|TH|BLOCKQUOTE|SECTION|ARTICLE|FIGCAPTION|DD|H[1-6]|DIV)$/.test(el.tagName)) el = el.parentElement;
    return el;
  }
  function sentenceAroundSpan(span) {
    const block = blockOf(span);
    const text = (block ? block.textContent : span.textContent) || "";
    const idx = text.indexOf(span.textContent);
    return extractSentence(text, idx < 0 ? 0 : idx);
  }
  function sentenceFromSelection(sel) {
    try {
      const node = sel.anchorNode;
      const block = blockOf(node);
      const text = (block ? block.textContent : (node && node.textContent)) || "";
      const probe = (sel.toString() || "").trim();
      const idx = probe ? text.indexOf(probe) : (sel.anchorOffset || 0);
      return extractSentence(text, idx < 0 ? (sel.anchorOffset || 0) : idx);
    } catch (e) { return (sel.toString() || "").trim(); }
  }

  // ---- 提示条 ----
  function toast(text, ok) {
    const t = document.createElement("div");
    t.className = "lexis-web-toast" + (ok === false ? " err" : "");
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 1600);
  }

  async function doAdd(word, sentence) {
    let r;
    try { r = await chrome.runtime.sendMessage({ type: "add", payload: { word, sentence, url: location.href, title: document.title } }); }
    catch (e) { r = null; }
    if (r && r.ok) {
      detailCache.delete((word || "").toLowerCase());
      toast(r.dup ? "这条已经在例句里了" : r.created ? `已新建单词「${r.word}」` : `已给「${r.word}」加例句`, true);
      // 新建的词:重新同步词库,让它在本页(和别的页)马上能高亮(storage.onChanged 会自动重扫)
      if (r.created) { try { await chrome.runtime.sendMessage({ type: "sync" }); } catch (e) {} }
    } else {
      toast(r && r.error === "bad-token" ? "令牌不对" : "添加失败(Obsidian 开着且桥接启用?)", false);
    }
    return r;
  }

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
    currentSpan = span;
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
      a.style.setProperty("font-size", "18px", "important");
      a.style.setProperty("font-weight", "700", "important");
      const pen = document.createElement("span"); pen.className = "lexis-web-pen"; pen.textContent = " ✎";
      a.appendChild(pen);
      titleEl.appendChild(a);
    } else {
      titleEl.textContent = label;
    }
    // ➕ 给这个词加例句(抓页面上它所在的那句)
    const addBtn = document.createElement("button");
    addBtn.className = "lexis-web-addbtn";
    addBtn.textContent = "➕ 例句";
    addBtn.title = "把这个词在本页所在的句子加进它的例句";
    const targetWord = data.base || data.word;
    addBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const sentence = currentSpan ? sentenceAroundSpan(currentSpan) : "";
      addBtn.disabled = true; addBtn.textContent = "…";
      await doAdd(targetWord, sentence);
      removePop();
    });
    titleEl.appendChild(addBtn);
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

    if (data.extraHtml && data.extraHtml.trim()) {
      const extra = document.createElement("div");
      extra.className = "lexis-web-pop-extra";
      extra.innerHTML = data.extraHtml;
      body.appendChild(extra);
    }
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

  // ---- 划词添加:选中文本 → 浮动 ➕ 按钮(词不在库→新建,在库→加例句,服务端判断) ----
  let selBtn = null;
  function hideSelBtn() { if (selBtn) { selBtn.remove(); selBtn = null; } }
  function onSelect() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (!text || text.length > 60 || text.split(/\s+/).length > 6 || !/[A-Za-z]/.test(text)) { hideSelBtn(); return; }
    let rect;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
    if (!rect || (!rect.width && !rect.height)) return;
    hideSelBtn();
    selBtn = document.createElement("button");
    selBtn.className = "lexis-web-selbtn";
    selBtn.textContent = "➕ Lexis";
    selBtn.title = "加到单词库(已有则加例句)";
    selBtn.style.left = (rect.right + window.scrollX + 6) + "px";
    selBtn.style.top = (rect.top + window.scrollY - 4) + "px";
    selBtn.addEventListener("mousedown", (e) => e.preventDefault()); // 别让按钮抢走选区
    selBtn.addEventListener("click", async () => {
      const s = window.getSelection();
      const sentence = sentenceFromSelection(s);
      selBtn.disabled = true; selBtn.textContent = "…";
      await doAdd(text, sentence);
      hideSelBtn();
    });
    document.body.appendChild(selBtn);
  }
  document.addEventListener("mouseup", () => setTimeout(onSelect, 10));
  document.addEventListener("mousedown", (e) => { if (selBtn && e.target !== selBtn) hideSelBtn(); });
  document.addEventListener("scroll", hideSelBtn, { passive: true });

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
