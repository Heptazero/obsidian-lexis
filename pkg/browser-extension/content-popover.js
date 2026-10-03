"use strict";

// ---- 悬停卡 ----
let hoverTimer = null, hoverTarget = null;
function removePop() {
  clearTimeout(hoverTimer); hoverTimer = null; hoverTarget = null;
  if (popHost) popHost.remove();
  popHost = null; pop = null;
}
function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (pop?.dataset.lexisResizing !== "1") removePop();
  }, 220);
}

function attachPopoverResize(box, anchor) {
  if (window.matchMedia?.("(pointer: coarse)").matches) return;
  const handle = document.createElement("div");
  handle.className = "lexis-web-resize";
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-label", "拖动调整卡片大小");
  handle.title = "拖动调整卡片大小";
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(hideTimer);
    const start = box.getBoundingClientRect();
    const startHeight = box.style.height;
    const startMaxHeight = box.style.maxHeight;
    const startX = event.clientX;
    const startY = event.clientY;
    box.dataset.lexisResizing = "1";
    try { handle.setPointerCapture(event.pointerId); } catch (_error) {}
    const resize = (move) => {
      const maxWidth = Math.max(260, window.innerWidth - start.left - 10);
      const maxHeight = Math.max(160, window.innerHeight - start.top - 10);
      const width = Math.max(260, Math.min(maxWidth, start.width + move.clientX - startX));
      const height = Math.max(160, Math.min(maxHeight, start.height + move.clientY - startY));
      box.style.width = width + "px";
      box.style.height = height + "px";
      box.style.maxHeight = height + "px";
    };
    const finish = (cancelled) => {
      handle.removeEventListener("pointermove", resize);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerCancel);
      delete box.dataset.lexisResizing;
      if (cancelled) {
        box.style.width = start.width + "px";
        box.style.height = startHeight;
        box.style.maxHeight = startMaxHeight;
      } else {
        const result = box.getBoundingClientRect();
        popoverSize = { width: Math.round(result.width), height: Math.round(result.height) };
        box.style.height = "";
        box.style.maxHeight = popoverSize.height + "px";
        void chrome.storage.local.set({ popoverSize });
      }
      position(popHost, anchor);
    };
    const onPointerUp = () => finish(false);
    const onPointerCancel = () => finish(true);
    handle.addEventListener("pointermove", resize);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerCancel);
  });
  box.appendChild(handle);
}

async function showPop(span) {
  const key = span.dataset.k;
  currentSpan = span;
  if (pop && pop.dataset.k === key) { clearTimeout(hideTimer); return; }
  const cardSheet = await popoverSheet();
  if (hoverTarget !== span || !span.isConnected) return;
  removePop();
  popHost = document.createElement("lexis-web-popover");
  popHost.style.cssText = "position:absolute;z-index:2147483647;display:block;";
  const shadow = popHost.attachShadow({ mode: "open" });
  shadow.adoptedStyleSheets = [cardSheet];
  pop = document.createElement("div");
  pop.className = "lexis-web-pop";
  pop.dataset.k = key;
  pop.innerHTML = `<div class="lexis-web-pop-scroll"><div class="lexis-web-pop-title">${span.textContent}</div><div class="lexis-web-pop-corner"></div><div class="lexis-web-pop-meta"></div><div class="lexis-web-pop-body"></div></div>`;
  pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  pop.addEventListener("mouseleave", scheduleHide);
  shadow.appendChild(pop);
  document.body.appendChild(popHost);
  const width = Math.max(260, Number(popoverSize && popoverSize.width) || Number(styleCfg && styleCfg.popoverWidth) || 460);
  const height = Math.max(160, Number(popoverSize && popoverSize.height) || Number(styleCfg && styleCfg.popoverMaxHeight) || 420);
  const fontSize = Math.max(11, Number(styleCfg && styleCfg.popoverFontSize) || 14);
  pop.style.setProperty("--lexis-popover-width", width + "px");
  pop.style.setProperty("--lexis-popover-height", height + "px");
  pop.style.setProperty("--lexis-popover-font-size", fontSize + "px");
  pop.style.width = width + "px";
  pop.style.maxHeight = height + "px";
  attachPopoverResize(pop, span);
  position(popHost, span);

  let data = detailCache.get(key);
  const loadingTimer = data ? null : setTimeout(() => {
    if (pop?.dataset.k === key) pop.querySelector(".lexis-web-pop-body").textContent = "加载中…";
  }, 180);
  if (!data) {
    try { data = await chrome.runtime.sendMessage({ type: "detail", key }); }
    catch (e) { data = { ok: false, error: "扩展未连接", offline: true }; }
    if (data && data.ok) detailCache.set(key, data);
  }
  if (loadingTimer !== null) clearTimeout(loadingTimer);
  if (!pop || pop.dataset.k !== key) return;
  renderDetail(pop, data);
  position(popHost, span);
}

function obsidianUri(data) {
  if (!data.vault || !data.file) return null;
  return `obsidian://open?vault=${encodeURIComponent(data.vault)}&file=${encodeURIComponent(data.file)}`;
}

function renderDetail(box, data) {
  const titleEl = box.querySelector(".lexis-web-pop-title");
  const cornerEl = box.querySelector(".lexis-web-pop-corner");
  const metaEl = box.querySelector(".lexis-web-pop-meta");
  const body = box.querySelector(".lexis-web-pop-body");
  cornerEl.textContent = "";
  metaEl.textContent = "";
  body.innerHTML = "";
  box.classList.toggle("has-corner-actions", !!(data && data.ok && !data.inline));
  if (!data || !data.ok) {
    if (data?.error === "request-timeout") body.textContent = "卡片加载超时，请检查 Obsidian 连接";
    else body.textContent = data?.offline ? "Obsidian 未连接(开着且桥接已启用?)" : "未找到这个词";
    return;
  }
  installMathCss(box.getRootNode(), data.mathCss);
  // 标题:点击在 Obsidian 中打开该笔记
  const uri = obsidianUri(data);
  titleEl.textContent = "";
  const primary = data.title || data.base || data.word;
  const secondary = data.subtitle || (data.alias && data.word !== primary ? data.word : data.inline && data.category ? data.category : "");
  if (uri) {
    const a = document.createElement("a");
    a.className = "lexis-web-open";
    a.href = uri;
    a.title = "在 Obsidian 中打开";
    const main = document.createElement("span");
    main.className = "lexis-web-title-main";
    main.textContent = primary;
    a.appendChild(main);
    if (secondary) {
      const sub = document.createElement("span");
      sub.className = "lexis-web-title-sub";
      sub.textContent = secondary;
      a.appendChild(sub);
    }
    const pen = document.createElement("span"); pen.className = "lexis-web-pen"; pen.textContent = " ✎";
    a.appendChild(pen);
    titleEl.appendChild(a);
  } else {
    titleEl.textContent = primary;
  }
  if (data.colorRole) {
    const role = document.createElement("span");
    const directColor = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(data.colorRole);
    role.className = "lexis-web-color-role" + (directColor ? " is-color-only" : "");
    role.textContent = directColor ? "" : data.colorRole;
    role.title = data.colorRole;
    titleEl.appendChild(role);
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
    if (!data.inline && allDicts.length > 1) {
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
    metaEl.appendChild(b);
  }
  // ➕ 给这个词加出处(抓页面上它所在的那句)
  const addBtn = document.createElement("button");
  addBtn.className = "lexis-web-addbtn";
  addBtn.textContent = "+ 出处";
  addBtn.title = "把这个词在本页所在的句子加进它的出处";
  const targetWord = data.base || data.word;
  addBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const sentence = currentSpan ? sentenceAroundSpan(currentSpan) : "";
    addBtn.disabled = true; addBtn.textContent = "…";
    await doAdd(targetWord, sentence);
    removePop();
  });
  if (!data.inline) metaEl.appendChild(addBtn);
  // ✎ 批注:纯文字写进笔记的 #### 批注 小节
  const noteBtn = document.createElement("button");
  noteBtn.className = "lexis-web-addbtn";
  noteBtn.textContent = "✎";
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
  if (!data.inline) cornerEl.appendChild(noteBtn);
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
  if (!data.inline) cornerEl.appendChild(delBtn);
  // ---- 标签管理 ----
  if (!data.inline) {
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
  }
  const content = document.createElement("div");
  content.className = "lexis-web-pop-content";
  if (data.html && data.html.trim()) content.innerHTML = data.html;
  else content.textContent = (data.meaning || data.markdown || "").trim() || "(这个词笔记里还没写内容)";
  if (cfg.showMemoryCurve === false) {
    content.querySelectorAll(".lexis-web-curve").forEach((curve) => {
      const title = curve.previousElementSibling;
      if (title?.classList.contains("lexis-web-sec") && title.textContent.includes("记忆曲线")) title.remove();
      curve.remove();
    });
  }
  body.appendChild(content);

  if (data.extraHtml && data.extraHtml.trim()) {
    const extra = document.createElement("div");
    extra.className = "lexis-web-pop-extra";
    extra.innerHTML = data.extraHtml;
    body.appendChild(extra);
  }
  loadOccurrences(box, box.dataset.k);
}

async function loadOccurrences(box, key) {
  const placeholders = [...box.querySelectorAll(".lexis-web-occ-pending")];
  if (!placeholders.length) return;
  const retry = async () => {
    for (const el of placeholders) { el.textContent = "出处加载中…"; el.removeAttribute("role"); el.removeAttribute("tabindex"); el.onclick = null; el.onkeydown = null; }
    let result;
    try { result = await chrome.runtime.sendMessage({ type: "occurrences", key }); }
    catch (_error) { result = { ok: false, error: "offline" }; }
    if (!box.isConnected || box.dataset.k !== key) return;
    if (result?.ok) {
      installMathCss(box.getRootNode(), result.mathCss);
      for (const el of placeholders) {
        if (!el.isConnected) continue;
        const fragment = document.createElement("div");
        fragment.innerHTML = result.html || "";
        el.replaceWith(...fragment.childNodes);
      }
      if (popHost && currentSpan) position(popHost, currentSpan);
    } else {
      for (const el of placeholders) {
        if (!el.isConnected) continue;
        el.textContent = "出处暂未加载 · 点击重试";
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.onclick = retry;
        el.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void retry(); } };
      }
    }
  };
  await retry();
}

async function preloadVisibleDetails() {
  void popoverSheet().catch(() => null);
  const keys = new Set();
  for (const span of document.querySelectorAll(`.${HL}`)) {
    const rect = span.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
    const key = span.dataset.k;
    if (!key || detailCache.has(key) || keys.has(key)) continue;
    keys.add(key);
    if (keys.size >= 4) break;
  }
  for (const key of keys) {
    const result = await chrome.runtime.sendMessage({ type: "detail", key }).catch(() => null);
    if (result?.ok) detailCache.set(key, result);
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
  if (!(t && t.classList && t.classList.contains(HL))) return;
  if (pointerSelecting || (e.buttons & 1) || hasExpandedSelection(window.getSelection())) return;
  clearTimeout(hideTimer);
  if (pop && pop.dataset.k === t.dataset.k) return;
  if (hoverTarget === t) return;
  clearTimeout(hoverTimer);
  hoverTarget = t;
  // 快速掠过高亮时不启动详情渲染；用户真正停住后再请求。
  const delay = Math.max(120, Number(styleCfg && styleCfg.hoverDelayMs) || 0);
  const open = () => { hoverTimer = null; if (hoverTarget === t && t.isConnected) showPop(t); };
  if (delay) hoverTimer = setTimeout(open, delay); else open();
});
document.addEventListener("mouseout", (e) => {
  const t = e.target;
  if (!(t && t.classList && t.classList.contains(HL))) return;
  if (hoverTarget === t) { clearTimeout(hoverTimer); hoverTimer = null; hoverTarget = null; }
  if (pop && pop.dataset.k === t.dataset.k) scheduleHide();
});
