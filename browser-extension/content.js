// Lexis Web —— 内容脚本:在网页上高亮词库里的词,悬停显示释义
(() => {
  const HL = "lexis-web-hl";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE", "SELECT", "OPTION", "KBD", "SAMP"]);
  const DEFAULT_CFG = { highlight: true, color: "#7c5cff", style: "wavy", useObsidianStyle: true, opacity: 100, maxHeight: 52 };

  let cfg = null;
  let keySet = null;
  let keyTags = null;
  let keyFolder = null;
  let keyColor = null;
  let keyStyle = null;
  let excludedKeys = null;
  let regex = null;
  let observer = null;
  let scanTimer = null;
  let selTimer = null;
  let pendingRoots = new Set();
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

  async function doAdd(word, sentence, alias, folder) {
    const payload = { word, sentence, url: location.href, title: document.title };
    if (alias) payload.alias = alias;
    if (folder) payload.folder = folder;
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
        if (r.created && alias) {
          // 本地即刻高亮别名,不等 sync 来回
          const ak = alias.toLowerCase();
          if (!keySet.has(ak)) {
            keySet.add(ak);
            const keys = [...keySet].sort((a, b) => b.length - a.length);
            regex = keys.length ? new RegExp("\\b(?:" + keys.map(esc).join("|") + ")\\b", "gi") : null;
            if (cfg && cfg.highlight) { scan(document.body); startObserver(); }
          }
        }
        if (r.created || alias) { try { await chrome.runtime.sendMessage({ type: "sync" }); } catch (e) {} }
      }
    } else {
      toast(r && r.error === "bad-token" ? "令牌不对" : "添加失败(Obsidian 开着且桥接启用?)", false);
    }
    return r;
  }

  function applyTheme() {
    const root = document.documentElement;
    const color = (styleCfg && styleCfg.highlightColor) || cfg.color || "#7c5cff";
    root.style.setProperty("--lexis-web-color", color);
    root.setAttribute("data-lexis-style", (styleCfg && styleCfg.highlightStyle) || cfg.style || "wavy");
  }

  // 根据颜色亮度返回黑/白文字色
  function textColorFor(bg) {
    let hex = bg;
    if (hex.startsWith("color-mix")) { const m = /#([0-9a-fA-F]{6})/.exec(hex); hex = m ? "#" + m[1] : "#7c5cff"; }
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#fff";
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 160 ? "#1f2328" : "#fff";
  }

  // 多标签排除集合(兼容旧的单字段 excludeTag)
  function excludeSet() {
    const arr = (styleCfg && styleCfg.excludeTags) || (styleCfg && styleCfg.excludeTag ? [styleCfg.excludeTag] : []);
    return new Set(arr.map((t) => String(t).toLowerCase()));
  }

  function build(words) {
    keySet = new Set();
    keyTags = new Map();
    keyFolder = new Map();
    keyColor = new Map();
    keyStyle = new Map();
    excludedKeys = new Set();
    const exSet = excludeSet();
    const keys = [];
    for (const x of words || []) {
      const k = (x.k || "").toLowerCase();
      if (k.length < 2) continue;
      const tags = (x.t || []).map((t) => String(t).toLowerCase());
      keyTags.set(k, tags);
      if (x.f) keyFolder.set(k, x.f);
      if (x.c) keyColor.set(k, x.c);
      if (x.s) keyStyle.set(k, x.s);
      if (exSet.size && tags.some((t) => exSet.has(t))) { excludedKeys.add(k); continue; }
      keySet.add(k);
      keys.push(k);
    }
    keys.sort((a, b) => b.length - a.length);
    regex = keys.length ? new RegExp("\\b(?:" + keys.map(esc).join("|") + ")\\b", "gi") : null;
  }

  // 某个词所属词典(文件夹)的专属高亮色;支持子文件夹归入父词典,取最长匹配
  function dictColorFor(key) {
    if (!styleCfg || !styleCfg.dictColors || !keyFolder) return null;
    const wf = keyFolder.get(key);
    if (!wf) return null;
    const map = styleCfg.dictColors;
    if (map[wf]) return map[wf];
    let best = null, bestLen = -1;
    for (const df in map) {
      if (df && (wf === df || wf.startsWith(df + "/")) && df.length > bestLen) { best = map[df]; bestLen = df.length; }
    }
    return best;
  }

  // 对标 Obsidian 的 inlineStyleForEntry:词典色/标签规则 → 颜色/线型,带透明度
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
    // 颜色/线型优先用服务端按「标签规则 > 词典色 > 全局」算好的值(与 ob 完全一致);没有则客户端兜底解析
    let color = keyColor.get(key);
    let styleKind = keyStyle.get(key);
    if (!color) {
      const tags = keyTags.get(key) || [];
      color = dictColorFor(key) || styleCfg.highlightColor || cfg.color || "#7c5cff";
      const rules = styleCfg.tagRules || [];
      if (tags.length && rules.length) {
        const rule = rules.find((r) => r.tag && tags.includes(r.tag.toLowerCase()));
        if (rule) { if (rule.color) color = rule.color; if (rule.style && !styleKind) styleKind = rule.style; }
      }
    }
    if (!styleKind) styleKind = styleCfg.highlightStyle || cfg.style || "wavy";
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
    scanTimer = setTimeout(flushScan, 120);
  }
  function flushScan() {
    if (!regex || !(cfg && cfg.highlight)) { pendingRoots.clear(); return; }
    const roots = [...pendingRoots];
    pendingRoots.clear();
    if (!roots.length) return;
    // 只扫变动的子树(而非整页),YouTube 字幕这种频繁重渲染的也能近乎即时重新高亮、且不卡
    for (const r of roots) { if (r && r.isConnected) scan(r); }
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((muts) => {
      let any = false;
      for (const mu of muts) {
        if (mu.type === "characterData") {
          const p = mu.target && mu.target.parentElement;
          if (p && !(p.classList && p.classList.contains(HL))) { pendingRoots.add(p); any = true; }
          continue;
        }
        for (const node of mu.addedNodes) {
          if (node.nodeType === 1) {
            if (node.classList && node.classList.contains(HL)) continue; // 自己插的高亮,别再触发
            pendingRoots.add(node); any = true;
          } else if (node.nodeType === 3 && node.parentElement && !(node.parentElement.classList && node.parentElement.classList.contains(HL))) {
            pendingRoots.add(node.parentElement); any = true;
          }
        }
      }
      if (any) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
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
    // 所属文件夹/词典小标;点击可把这个词移到别的词典(只移动文件,正文/批注不变)
    {
      const fp = data.file || "";
      const slash = fp.lastIndexOf("/");
      const dir = slash > 0 ? fp.slice(0, slash) : "";
      const allDicts = (styleCfg && Array.isArray(styleCfg.dicts) ? styleCfg.dicts : []).filter(Boolean);
      const dname = (f) => (String(f).split("/").pop() || f);
      const b = document.createElement("span");
      b.className = "lexis-web-dict";
      b.textContent = dir ? dname(dir) : "(根目录)";
      b.title = dir || "根目录";
      const moveKey = data.base || data.word;
      if (allDicts.length > 1) {
        b.classList.add("lexis-web-dict-click");
        b.title = (dir || "根目录") + " —— 点击移到别的词典";
        let listEl = null;
        const closeList = () => { if (listEl) { listEl.remove(); listEl = null; document.removeEventListener("mousedown", onDocDown); } };
        const onDocDown = (e) => { if (listEl && !listEl.contains(e.target) && e.target !== b) closeList(); };
        b.addEventListener("mousedown", (ev) => { ev.preventDefault(); ev.stopPropagation(); });
        b.addEventListener("click", (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          if (listEl) { closeList(); return; }
          listEl = document.createElement("div");
          listEl.className = "lexis-web-tag-list lexis-web-dict-list";
          allDicts.forEach((f) => {
            const it = document.createElement("span");
            it.className = "lexis-web-tag" + (f === dir ? " lexis-web-tag-off" : "");
            it.textContent = dname(f); it.title = f;
            it.addEventListener("mousedown", (e2) => { e2.preventDefault(); e2.stopPropagation(); });
            it.addEventListener("click", async (e2) => {
              e2.stopPropagation();
              if (f === dir) { closeList(); return; }
              closeList();
              const r = await chrome.runtime.sendMessage({ type: "move", payload: { key: moveKey, folder: f } });
              if (r && r.ok) {
                toast(r.reTemplated ? `已移到 ${dname(f)} 并套用该词典模板(批注保留)` : `已把「${data.word}」移到 ${dname(f)}`, true);
                const k = (pop && pop.dataset.k) || (data.word || "").toLowerCase();
                detailCache.delete(k);
                // 重新取最新内容(可能重套了模板),就地重渲染卡片;不调 position(),避免卡片跳走
                let fresh; try { fresh = await chrome.runtime.sendMessage({ type: "detail", key: k }); } catch (_e) {}
                const nd = (fresh && fresh.ok) ? fresh : Object.assign({}, data, { file: r.file });
                detailCache.set(k, nd);
                if (pop && pop.dataset.k === k) renderDetail(pop, nd);
              } else toast(r && r.error === "exists" ? "那个词典里已有同名词" : "移动失败", false);
            });
            listEl.appendChild(it);
          });
          // 挂到悬浮卡根节点(而不是小标 span)并手动定位,避免被卡片正文盖住/裁掉
          const host = pop || b;
          const br = b.getBoundingClientRect();
          const hr = host.getBoundingClientRect();
          listEl.style.left = Math.round(br.left - hr.left) + "px";
          listEl.style.top = Math.round(br.bottom - hr.top + 4) + "px";
          host.appendChild(listEl);
          document.addEventListener("mousedown", onDocDown);
        });
      }
      titleEl.appendChild(b);
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
    // ✎ 批注:纯文字写进笔记的 #### 批注 小节
    const noteBtn = document.createElement("button");
    noteBtn.className = "lexis-web-addbtn";
    noteBtn.textContent = "✎ 批注";
    noteBtn.title = "给这个词写一条批注(纯文字,写入笔记的 #### 批注)";
    noteBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (body.querySelector(".lexis-web-noterow")) { body.querySelector(".lexis-web-noteinput").focus(); return; }
      const row = document.createElement("div");
      row.className = "lexis-web-noterow";
      const input = document.createElement("input");
      input.className = "lexis-web-noteinput";
      input.placeholder = "写批注,回车保存,Esc 取消";
      const save = async () => {
        const text = input.value.trim();
        if (!text) { row.remove(); return; }
        input.disabled = true;
        try {
          const r = await chrome.runtime.sendMessage({ type: "note", payload: { key: targetWord, note: text } });
          if (r && r.ok) { toast(`已给「${data.word}」加批注`, true); detailCache.delete((data.word || data.base || "").toLowerCase()); }
          else toast(r && r.error === "not-found" ? "这个词不在库里" : "批注失败(Obsidian 开着且桥接启用?)", false);
        } catch (e) { toast("批注失败(连不上?)", false); }
        removePop();
      };
      input.addEventListener("mousedown", (e) => e.stopPropagation());
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } else if (e.key === "Escape") { e.preventDefault(); row.remove(); } });
      row.appendChild(input);
      body.insertBefore(row, body.firstChild);
      input.focus();
    });
    titleEl.appendChild(noteBtn);
    // ✕ 删除按钮
    const delBtn = document.createElement("button");
    delBtn.className = "lexis-web-addbtn lexis-web-addbtn-del";
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
    // ---- 标签管理 ----
    const tagWrap = document.createElement("div");
    tagWrap.className = "lexis-web-pop-tags";
    body.appendChild(tagWrap);
    const exSet = excludeSet();
    let bucketEl = null;

    const syncTags = async () => { await chrome.runtime.sendMessage({ type: "sync" }).catch(() => {}); };

    const updateBucket = () => {
      if (!bucketEl) return;
      bucketEl.querySelectorAll(".lexis-web-tag").forEach((p) => {
        const t = p.textContent.replace(/^#/, "");
        p.classList.toggle("lexis-web-tag-off", (data.tags || []).includes(t));
      });
    };

    const addTagPill = (tag) => {
      const s = document.createElement("span");
      s.className = "lexis-web-tag" + (exSet.has(tag.toLowerCase()) ? " lexis-web-tag-excl" : "");
      s.textContent = "#" + tag;
      s.dataset.tag = tag;
      const x = document.createElement("span");
      x.className = "lexis-web-tag-del"; x.textContent = " ×";
      x.addEventListener("mousedown", (ev) => { ev.preventDefault(); ev.stopPropagation(); });
      x.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: data.word || data.base, tag: tag, action: "remove" } });
        if (r && r.ok) {
          data.tags = r.tags; detailCache.delete((data.word || data.base || "").toLowerCase());
          syncTags();
          s.remove();
          updateBucket();
        }
      });
      s.appendChild(x);
      tagWrap.insertBefore(s, tagWrap.querySelector(".lexis-web-tag-pick"));
    };

    // 现有标签
    if (data.tags) for (const t of data.tags) addTagPill(t);

    // + 选择器(始终在末尾)
    const pick = document.createElement("div");
    pick.className = "lexis-web-tag-pick";
    const header = document.createElement("span");
    header.className = "lexis-web-tag lexis-web-tag-add";
    header.textContent = (data.tags && data.tags.length > 0) ? "+" : "+ 标签";
    header.addEventListener("mousedown", (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    header.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      if (bucketEl) { bucketEl.remove(); bucketEl = null; return; }
      const { words: cached } = await chrome.storage.local.get("words");
      const known = new Set(); if (cached) for (const w of cached) for (const t of (w.t || [])) known.add(t);
      bucketEl = document.createElement("div");
      bucketEl.className = "lexis-web-tag-list";
      for (const t of [...known].sort()) {
        const p = document.createElement("span");
        p.className = "lexis-web-tag" + ((data.tags || []).includes(t) ? " lexis-web-tag-off" : "");
        p.textContent = "#" + t;
        p.addEventListener("mousedown", (ev) => { ev.preventDefault(); ev.stopPropagation(); });
        p.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          if ((data.tags || []).includes(t)) {
            const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: data.word || data.base, tag: t, action: "remove" } });
            if (r && r.ok) {
              data.tags = r.tags; detailCache.delete((data.word || data.base || "").toLowerCase());
              syncTags();
              const pill = tagWrap.querySelector('[data-tag="'+t+'"]');
              if (pill) pill.remove();
              updateBucket();
            }
          } else {
            const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: data.word || data.base, tag: t, action: "add" } });
            if (r && r.ok) {
              data.tags = r.tags; detailCache.delete((data.word || data.base || "").toLowerCase());
              syncTags();
              addTagPill(t);
              updateBucket();
            }
          }
        });
        bucketEl.appendChild(p);
      }
      const closer = (e) => { if (!bucketEl.contains(e.target) && e.target !== header) { bucketEl.remove(); bucketEl = null; document.removeEventListener("mousedown", closer); } };
      document.addEventListener("mousedown", closer);
      pick.appendChild(bucketEl);
    });
    pick.appendChild(header);
    tagWrap.appendChild(pick);
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
    if (!span || !span.isConnected) return; // span 被重新高亮拆掉后别把卡片定位到角落
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
  function hideSelBtn() { if (selBtn) { selBtn.remove(); selBtn = null; } document.querySelectorAll(".lexis-web-folderlist").forEach((el) => el.remove()); }
  function onSelect() {
    // 正在用我们自己的别名输入框时别打扰(selectionchange 会因 input 聚焦误触发)
    if (selBtn && document.activeElement && selBtn.contains(document.activeElement)) return;
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    // 选区没变、且 pill 已经在了 → 别重建(否则在 pill 上点文件夹下拉会被 mouseup 触发的本函数拆掉,闪一下就没)
    if (selBtn && selBtn.dataset && selBtn.dataset.word === text && text) return;
    if (!text || text.length > 60 || text.split(/\s+/).length > 6 || !/[A-Za-z]/.test(text)) { hideSelBtn(); return; }
    // 选中词已在库中(含别名) → 不弹按钮
    if (keySet && keySet.has(text.toLowerCase())) { hideSelBtn(); return; }
    // 获取选区矩形(排除词分支和正常 pill 分支共用的定位信息)
    let rect;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
    if (!rect || (!rect.width && !rect.height)) return;
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
        // 逐个去掉该词身上命中的全部排除标签
        const exSet = excludeSet();
        const wordTags = (keyTags && keyTags.get(text.toLowerCase())) || [];
        const toRemove = [...new Set(wordTags.filter((t) => exSet.has(t)))];
        let ok = false;
        for (const tag of toRemove) {
          const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: text, tag, action: "remove" } });
          if (r && r.ok) ok = true;
        }
        if (ok) await chrome.runtime.sendMessage({ type: "sync" });
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
    hideSelBtn();
    const sentence = sentenceFromSelection(sel);
    // 目标词典(文件夹)列表;>1 个才显示选择段,默认第一个
    const dicts = (styleCfg && Array.isArray(styleCfg.dicts) ? styleCfg.dicts : []).filter(Boolean);
    let selFolder = dicts[0] || "";
    const fname = (f) => (String(f).split("/").pop() || f);

    const pill = document.createElement("div");
    pill.className = "lexis-web-selpill";

    const addBtn = document.createElement("button");
    addBtn.className = "lexis-web-selbtn-pill";
    addBtn.textContent = "+ 添加";
    addBtn.title = "直接以选中词为标题建新词";
    addBtn.addEventListener("mousedown", (e) => e.preventDefault());
    addBtn.addEventListener("click", async () => {
      addBtn.disabled = true; addBtn.textContent = "…";
      await doAdd(text, sentence, undefined, selFolder);
      hideSelBtn();
    });
    pill.appendChild(addBtn);

    // 文件夹/词典选择段(需在设置里开启,且有多个词典)
    if (styleCfg && styleCfg.pillFolderPicker && dicts.length > 1) {
      const folderBtn = document.createElement("button");
      folderBtn.className = "lexis-web-selbtn-pill lexis-web-selfolder";
      folderBtn.textContent = "📁 " + fname(selFolder);
      folderBtn.title = "选择加到哪个词典(文件夹)";
      folderBtn.addEventListener("mousedown", (e) => e.preventDefault());
      let flist = null;
      const closeFList = () => { if (flist) { flist.remove(); flist = null; document.removeEventListener("mousedown", onFDown); } };
      const onFDown = (e) => { if (flist && !flist.contains(e.target) && e.target !== folderBtn) closeFList(); };
      folderBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (flist) { closeFList(); return; }
        // 挂到 document.body(而不是 pill 内部),否则会被 .lexis-web-selpill 的 overflow:hidden 裁掉,看不见也点不动
        flist = document.createElement("div");
        flist.className = "lexis-web-folderlist";
        dicts.forEach((f) => {
          const it = document.createElement("div");
          it.className = "lexis-web-folderitem" + (f === selFolder ? " sel" : "");
          it.textContent = fname(f); it.title = f;
          it.addEventListener("mousedown", (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            selFolder = f; folderBtn.textContent = "📁 " + fname(f); closeFList();
          });
          flist.appendChild(it);
        });
        const r = folderBtn.getBoundingClientRect();
        flist.style.left = Math.round(r.left + window.scrollX) + "px";
        flist.style.top = Math.round(r.bottom + window.scrollY + 4) + "px";
        document.body.appendChild(flist);
        document.addEventListener("mousedown", onFDown);
      });
      pill.appendChild(folderBtn);
    }

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
        await doAdd(real, sentence, text, selFolder);
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
    pill.dataset.word = text;
    selBtn = pill;
  }
  // mouseup + selectionchange 双触发:YouTube 等会吞掉 player 内的 mouseup,selectionchange 兜底
  function scheduleSel() { clearTimeout(selTimer); selTimer = setTimeout(onSelect, 200); }
  document.addEventListener("mouseup", scheduleSel);
  document.addEventListener("selectionchange", scheduleSel);
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
