// Lexis Web —— 内容脚本:在网页上高亮词库里的词,悬停显示释义
(() => {
  const HL = "lexis-web-hl";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE", "SELECT", "OPTION", "KBD", "SAMP"]);
  const DEFAULT_CFG = { highlight: true, color: "#7c5cff", style: "wavy", useObsidianStyle: true, opacity: 100, maxHeight: 52 };

  let cfg = null;
  let keySet = null;
  let keyTags = null;
  let excludedKeys = null;
  let regex = null;
  let observer = null;
  let scanTimer = null;
  let styleCfg = null;
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

  async function doAdd(word, sentence, alias) {
    const payload = { word, sentence, url: location.href, title: document.title };
    if (alias) payload.alias = alias;
    let r;
    try { r = await chrome.runtime.sendMessage({ type: "add", payload }); }
    catch (e) { r = null; }
    if (r && r.ok) {
      if (r.queued) {
        toast(`已加入离线队列(${r.pending}条待同步)`, true);
      } else {
        detailCache.delete((word || "").toLowerCase());
        if (alias) detailCache.delete(alias.toLowerCase());
        toast(r.dup ? "这条已经在例句里了" : r.created ? alias ? `已将「${alias}」归入「${r.word}」` : `已新建单词「${r.word}」` : `已给「${r.word}」加例句`, true);
        if (r.created || alias) { try { await chrome.runtime.sendMessage({ type: "sync" }); } catch (e) {} }
      }
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

  // 根据颜色亮度返回黑/白文字色
  function textColorFor(bg) {
    let hex = bg;
    if (hex.startsWith("color-mix")) { const m = /#([0-9a-fA-F]{6})/.exec(hex); hex = m ? "#" + m[1] : "#7c5cff"; }
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#fff";
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? "#1f2328" : "#fff";
  }

  function build(words) {
    keySet = new Set();
    keyTags = new Map();
    excludedKeys = new Set();
    const excludeTag = (styleCfg && styleCfg.excludeTag || "").toLowerCase();
    const keys = [];
    for (const x of words || []) {
      const k = (x.k || "").toLowerCase();
      if (k.length < 2) continue;
      const tags = (x.t || []).map((t) => String(t).toLowerCase());
      keyTags.set(k, tags);
      if (excludeTag && tags.includes(excludeTag)) { excludedKeys.add(k); continue; }
      keySet.add(k);
      keys.push(k);
    }
    keys.sort((a, b) => b.length - a.length);
    regex = keys.length ? new RegExp("\\b(?:" + keys.map(esc).join("|") + ")\\b", "gi") : null;
  }

  // 对标 Obsidian 的 inlineStyleForEntry:标签规则 → 颜色/线型,带透明度
  function inlineStyleFor(key) {
    // 用户关了「使用 Obsidian 标签着色」→ 只用全局色
    if (cfg.useObsidianStyle === false || !styleCfg) {
      let c = cfg.color || "#7c5cff";
      const s = cfg.style || "wavy";
      const a = (cfg.opacity != null ? cfg.opacity : 100) / 100;
      if (a < 1) c = `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
      if (s === "background") return `background-color:${c};border-radius:3px;padding:0 1px;text-decoration:none`;
      const line = s === "underline" ? "solid" : "wavy";
      return `text-decoration:underline ${line} ${c};text-underline-offset:2px`;
    }
    const tags = keyTags.get(key) || [];
    let color = styleCfg.highlightColor || cfg.color || "#7c5cff";
    let styleKind = styleCfg.highlightStyle || cfg.style || "wavy";
    const rules = styleCfg.tagRules || [];
    if (tags.length && rules.length) {
      const rule = rules.find((r) => r.tag && tags.includes(r.tag.toLowerCase()));
      if (rule) { if (rule.color) color = rule.color; if (rule.style) styleKind = rule.style; }
    }
    const alpha = styleCfg.highlightOpacity != null ? styleCfg.highlightOpacity : 1;
    if (alpha < 1) color = `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
    if (styleKind === "background") return `background-color:${color};border-radius:3px;padding:0 1px;text-decoration:none`;
    const line = styleKind === "underline" ? "solid" : "wavy";
    return `text-decoration:underline ${line} ${color};text-underline-offset:2px`;
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
      span.setAttribute("style", inlineStyleFor(key));
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
    // 应用用户自定义的卡片最大高度
    if (cfg && cfg.maxHeight) {
      const body = pop.querySelector(".lexis-web-pop-body");
      if (body) body.style.maxHeight = cfg.maxHeight + "vh";
    }
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
    addBtn.textContent = "+ 例句";
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
    // ✕ 删除按钮
    const delBtn = document.createElement("button");
    delBtn.className = "lexis-web-addbtn";
    delBtn.textContent = "🗑";
    delBtn.title = "从词库中删除这个词";
    delBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (!confirm(`删除「${data.word}」?`)) return;
      delBtn.disabled = true; delBtn.textContent = "…";
      try {
        const r = await chrome.runtime.sendMessage({ type: "delete", key: data.word || data.base });
        if (r && r.ok) {
          detailCache.delete((data.word || data.base || "").toLowerCase());
          await chrome.runtime.sendMessage({ type: "sync" });
          toast(`已删除「${r.deleted}」`, true);
        } else toast("删除失败", false);
      } catch (e) { toast("删除失败(连不上?)", false); }
      removePop();
    });
    titleEl.appendChild(delBtn);
    if (data.tags && data.tags.length) {
      const tagWrap = document.createElement("div");
      tagWrap.className = "lexis-web-pop-tags";
      const excludeTag = (styleCfg && styleCfg.excludeTag || "").toLowerCase();
      const fill = async () => {
        tagWrap.querySelectorAll(".lexis-web-tag-del").forEach((b) => b.remove());
        for (const t of data.tags) {
          const s = document.createElement("span");
          s.className = "lexis-web-tag" + (excludeTag && t.toLowerCase() === excludeTag ? " lexis-web-tag-excl" : "");
          s.textContent = "#" + t;
          if (s.classList.contains("lexis-web-tag-excl")) s.title = "排除高亮";
          const x = document.createElement("span");
          x.className = "lexis-web-tag-del"; x.textContent = " ×"; x.style.cursor = "pointer";
          x.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: data.word || data.base, tag: t, action: "remove" } });
            if (r && r.ok) {
              data.tags = r.tags;
              detailCache.delete((data.word || data.base || "").toLowerCase());
              await chrome.runtime.sendMessage({ type: "sync" });
              fill();
            }
          });
          s.appendChild(x);
          tagWrap.appendChild(s);
        }
        const addTag = document.createElement("span");
        addTag.className = "lexis-web-tag lexis-web-tag-add";
        addTag.textContent = "+";
        addTag.title = "添加标签";
        addTag.style.cursor = "pointer";
        addTag.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          const input = document.createElement("input");
          input.type = "text"; input.placeholder = "标签"; input.style.cssText = "font-size:11px;width:48px;padding:1px 4px;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:4px;background:transparent;color:inherit";
          input.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
              const v = input.value.trim().replace(/^#/, "");
              if (!v) return;
              const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: data.word || data.base, tag: v, action: "add" } });
              if (r && r.ok) {
                data.tags = r.tags;
                detailCache.delete((data.word || data.base || "").toLowerCase());
                await chrome.runtime.sendMessage({ type: "sync" });
                fill();
              }
            }
          });
          input.addEventListener("blur", () => fill());
          addTag.replaceWith(input);
          input.focus();
        });
        tagWrap.appendChild(addTag);
      };
      fill();
      body.appendChild(tagWrap);
    } else {
      // 没有标签:也显示 + 来添加
      const tagWrap = document.createElement("div");
      tagWrap.className = "lexis-web-pop-tags";
      const addTag = document.createElement("span");
      addTag.className = "lexis-web-tag lexis-web-tag-add";
      addTag.textContent = "+ 标签";
      addTag.style.cursor = "pointer";
      addTag.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const input = document.createElement("input");
        input.type = "text"; input.placeholder = "标签"; input.style.cssText = "font-size:11px;width:48px;padding:1px 4px;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:4px;background:transparent;color:inherit";
        const fill = async () => {
          // 触发 reload data
          try {
            const fresh = await chrome.runtime.sendMessage({ type: "detail", key: data.word || data.base });
            if (fresh && fresh.ok) {
              data.tags = fresh.tags;
              detailCache.set((data.word || data.base || "").toLowerCase(), fresh);
            }
          } catch (e) {}
          input.replaceWith(addTag);
        };
        input.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
            const v = input.value.trim().replace(/^#/, "");
            if (!v) { fill(); return; }
            const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: data.word || data.base, tag: v, action: "add" } });
            if (r && r.ok) { detailCache.delete((data.word || data.base || "").toLowerCase()); await chrome.runtime.sendMessage({ type: "sync" }); }
            fill();
          }
        });
        input.addEventListener("blur", fill);
        addTag.replaceWith(input);
        input.focus();
      });
      tagWrap.appendChild(addTag);
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

  // ---- 划词添加:选中文本 → 浮动 pill([➕ 添加] [aliases]) ----
  let selBtn = null;
  function hideSelBtn() { if (selBtn) { selBtn.remove(); selBtn = null; } }
  function onSelect() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (!text || text.length > 60 || text.split(/\s+/).length > 6 || !/[A-Za-z]/.test(text)) { hideSelBtn(); return; }
    // 选中词已在库中(含别名) → 不弹按钮
    if (keySet && keySet.has(text.toLowerCase())) { hideSelBtn(); return; }
    // 选中词被排除高亮 → 弹 [取消排除]
    if (excludedKeys && excludedKeys.has(text.toLowerCase())) {
      hideSelBtn();
      selBtn = document.createElement("button");
      selBtn.className = "lexis-web-selbtn";
      selBtn.textContent = "取消排除";
      selBtn.title = "去掉排除标签,恢复高亮";
      selBtn.addEventListener("mousedown", (e) => e.preventDefault());
      selBtn.addEventListener("click", async () => {
        selBtn.disabled = true; selBtn.textContent = "…";
        const excludeTag = (styleCfg && styleCfg.excludeTag) || "";
        const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: text, tag: excludeTag, action: "remove" } });
        if (r && r.ok) { await chrome.runtime.sendMessage({ type: "sync" }); }
        hideSelBtn();
      });
      const bw = 72, bh = 26, gap = 6;
      let left = rect.left + (rect.width - bw) / 2 + window.scrollX;
      let top = rect.bottom + window.scrollY + gap;
      if (top + bh > window.scrollY + document.documentElement.clientHeight - 8) top = rect.top + window.scrollY - bh - gap;
      selBtn.style.left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - bw - 8)) + "px";
      selBtn.style.top = Math.max(8, top) + "px";
      document.body.appendChild(selBtn);
      return;
    }
    let rect;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
    if (!rect || (!rect.width && !rect.height)) return;
    hideSelBtn();
    const sentence = sentenceFromSelection(sel);

    const pill = document.createElement("div");
    pill.className = "lexis-web-selpill";

    const addBtn = document.createElement("button");
    addBtn.className = "lexis-web-selbtn-pill";
    addBtn.textContent = "+ 添加";
    addBtn.title = "直接以选中词为标题建新词";
    addBtn.addEventListener("mousedown", (e) => e.preventDefault());
    addBtn.addEventListener("click", async () => {
      addBtn.disabled = true; addBtn.textContent = "…";
      await doAdd(text, sentence);
      hideSelBtn();
    });
    pill.appendChild(addBtn);

    const aliasBtn = document.createElement("button");
    aliasBtn.className = "lexis-web-selbtn-pill";
    aliasBtn.textContent = "aliases";
    aliasBtn.title = "把选中词作为别名,归入另一个词";
    aliasBtn.addEventListener("mousedown", (e) => e.preventDefault());
    aliasBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "lexis-web-selinput";
      input.value = text;
      input.placeholder = "原形单词";
      input.addEventListener("mousedown", (e) => e.stopPropagation());
      const submit = async () => {
        const real = input.value.trim();
        if (!real || !/[A-Za-z]/.test(real)) return;
        input.disabled = true;
        await doAdd(real, sentence, text);
        hideSelBtn();
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") hideSelBtn(); });
      input.addEventListener("blur", () => setTimeout(() => { if (document.body.contains(input)) hideSelBtn(); }, 150));
      aliasBtn.replaceWith(input);
      input.focus();
      input.select();
    });
    pill.appendChild(aliasBtn);

    // 智能定位:优先选区下方中间,超出视口则放上方
    const pillW = 130, pillH = 26, gap = 6;
    let left = rect.left + (rect.width - pillW) / 2 + window.scrollX;
    let top = rect.bottom + window.scrollY + gap;
    if (top + pillH > window.scrollY + document.documentElement.clientHeight - 8)
      top = rect.top + window.scrollY - pillH - gap;
    if (left < 8) left = 8;
    if (left + pillW > window.scrollX + document.documentElement.clientWidth - 8)
      left = window.scrollX + document.documentElement.clientWidth - pillW - 8;
    pill.style.left = Math.max(8, left) + "px";
    pill.style.top = Math.max(8, top) + "px";

    document.body.appendChild(pill);
    const tc = textColorFor(getComputedStyle(pill).backgroundColor);
    pill.style.color = tc;
    selBtn = pill;
  }
  document.addEventListener("mouseup", () => setTimeout(onSelect, 10));
  document.addEventListener("mousedown", (e) => { if (selBtn && !selBtn.contains(e.target)) hideSelBtn(); });
  document.addEventListener("scroll", hideSelBtn, { passive: true });

  // ---- 启动 / 配置变化 ----
  async function init() {
    const { cfg: c, words, styleConfig } = await chrome.storage.local.get(["cfg", "words", "styleConfig"]);
    cfg = Object.assign({}, DEFAULT_CFG, c || {});
    styleCfg = styleConfig || null;
    applyTheme();
    build(words || []);
    if (cfg.highlight) { scan(document.body); startObserver(); }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    (async () => {
      const oldCfg = cfg ? Object.assign({}, cfg) : null;
      if (changes.cfg) {
        cfg = Object.assign({}, DEFAULT_CFG, changes.cfg.newValue || {});
        applyTheme();
        if (!cfg.highlight) { unwrapAll(); removePop(); }
      }
      if (changes.styleConfig) styleCfg = changes.styleConfig.newValue || null;
      if (changes.words) build(changes.words.newValue || []);
      const styleChanged = oldCfg && cfg && (oldCfg.useObsidianStyle !== cfg.useObsidianStyle
        || oldCfg.color !== cfg.color || oldCfg.style !== cfg.style || oldCfg.opacity !== cfg.opacity);
      if (cfg && cfg.highlight) {
        if (changes.words || changes.styleConfig || styleChanged || (changes.cfg && changes.cfg.newValue && changes.cfg.newValue.highlight && !(changes.cfg.oldValue || {}).highlight)) {
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
