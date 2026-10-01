"use strict";

// ---- 划词添加:选中文本 → 浮动 pill([＋] [词典] [🔗]) ----
let selBtn = null;
function hideSelBtn() {
  if (selBtn) { selBtn.remove(); selBtn = null; }
  document.querySelectorAll(".lexis-web-folderlist,.lexis-web-alias-results").forEach((element) => element.remove());
}
function hasWordContent(text) { return /[\p{L}\p{N}]/u.test(text); }
function isSelectionCandidate(text) {
  if (!text || text.length > 60 || !hasWordContent(text)) return false;
  const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(text);
  return hasCjk || text.split(/\s+/u).length <= 6;
}
function onSelect() {
  // 正在用我们自己的别名输入框时别打扰(selectionchange 会因 input 聚焦误触发)
  if (selBtn && document.activeElement && selBtn.contains(document.activeElement)) return;
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : "";
  // 选区没变、且 pill 已经在了 → 别重建(否则在 pill 上点文件夹下拉会被 mouseup 触发的本函数拆掉,闪一下就没)
  if (selBtn && selBtn.dataset && selBtn.dataset.word === text && text) return;
  if (!isSelectionCandidate(text)) { hideSelBtn(); return; }
  // 选中词已在库中(含别名) → 不弹按钮
  const selectedKey = resolveKnownKey(text);
  if (keySet && keySet.has(selectedKey)) { hideSelBtn(); return; }
  // 获取选区矩形(排除词分支和正常 pill 分支共用的定位信息)
  let rect;
  try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
  if (!rect || (!rect.width && !rect.height)) return;
  // 选中词被排除高亮 → 弹 [取消排除]
  if (excludedKeys && excludedKeys.has(selectedKey)) {
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
      const wordTags = (keyTags && keyTags.get(selectedKey)) || [];
      const toRemove = [...new Set(wordTags.filter((t) => exSet.has(t)))];
      let ok = false;
      for (const tag of toRemove) {
        const r = await chrome.runtime.sendMessage({ type: "tag", payload: { key: selectedKey, tag, action: "remove" } });
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
  if (knownKeys && knownKeys.has(selectedKey)) { hideSelBtn(); return; }
  hideSelBtn();
  const sentence = sentenceFromSelection(sel);
  // 目标词典(文件夹)列表;优先沿用上次选择，目标已不存在时才回退到第一个。
  const dicts = (styleCfg && Array.isArray(styleCfg.dicts) ? styleCfg.dicts : []).filter(Boolean);
  let selFolder = dicts.includes(lastSelectionFolder) ? lastSelectionFolder : (dicts[0] || "");
  const fname = (f) => (String(f).split("/").pop() || f);

  const pill = document.createElement("div");
  pill.className = "lexis-web-selpill";

  const addBtn = document.createElement("button");
  addBtn.className = "lexis-web-selbtn-pill";
  addBtn.textContent = "＋";
  addBtn.title = "直接以选中词为标题建新词";
  addBtn.addEventListener("mousedown", (e) => e.preventDefault());
  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true; addBtn.textContent = "…";
    await doAdd(text, sentence, undefined, selFolder);
    hideSelBtn();
  });
  pill.appendChild(addBtn);

  // 文件夹/词典选择段(需在设置里开启,且有多个词典)
  if (dicts.length > 1) {
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
          selFolder = f;
          lastSelectionFolder = f;
          void chrome.storage.local.set({ lastSelectionFolder: f });
          folderBtn.textContent = "📁 " + fname(f); closeFList();
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
  aliasBtn.textContent = "🔗";
  aliasBtn.title = "把选中词作为别名,归入另一个词";
  aliasBtn.addEventListener("mousedown", (e) => e.preventDefault());
  aliasBtn.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "lexis-web-selinput";
    input.value = text;
    input.placeholder = "输入原形或搜索已有词条";
    input.addEventListener("mousedown", (e) => e.stopPropagation());
    const results = document.createElement("div");
    results.className = "lexis-web-alias-results";
    results.setAttribute("role", "listbox");
    document.body.appendChild(results);
    const targets = collectAliasTargets(allWords);
    let primaryValue = input.value.trim();
    let exactTarget = findExactAliasTarget(targets, primaryValue);
    let matches = [];
    let activeIndex = 0;

    const placeResults = () => {
      const rect = input.getBoundingClientRect();
      const width = Math.min(280, Math.max(220, document.documentElement.clientWidth - 16));
      results.style.width = width + "px";
      results.style.left = Math.max(8, Math.min(rect.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - width - 8)) + "px";
      const below = rect.bottom + window.scrollY + 5;
      const height = results.offsetHeight || 220;
      results.style.top = (below + height <= window.scrollY + document.documentElement.clientHeight - 8 ? below : Math.max(8, rect.top + window.scrollY - height - 5)) + "px";
    };
    const choose = async (target) => {
      input.disabled = true;
      results.remove();
      await doAdd(target.title, sentence, text, selFolder);
      hideSelBtn();
    };
    const chooseAt = async (index) => {
      const hasPrimary = hasWordContent(primaryValue);
      if (hasPrimary && index === 0) {
        if (exactTarget) return choose(exactTarget);
        input.disabled = true;
        results.remove();
        const sameAsSelection = primaryValue.normalize("NFKC").toLowerCase() === text.normalize("NFKC").toLowerCase();
        await doAdd(primaryValue, sentence, sameAsSelection ? undefined : text, selFolder);
        hideSelBtn();
        return;
      }
      const target = matches[index - (hasPrimary ? 1 : 0)];
      if (target) await choose(target);
    };
    const render = () => {
      primaryValue = input.value.trim();
      exactTarget = findExactAliasTarget(targets, primaryValue);
      const hasPrimary = hasWordContent(primaryValue);
      matches = rankAliasTargets(targets, primaryValue, 9).filter((target) => target.id !== exactTarget?.id).slice(0, 7);
      const optionCount = matches.length + (hasPrimary ? 1 : 0);
      activeIndex = Math.min(activeIndex, Math.max(0, optionCount - 1));
      results.replaceChildren();
      if (hasPrimary) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "lexis-web-alias-result is-primary" + (activeIndex === 0 ? " is-active" : "");
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", activeIndex === 0 ? "true" : "false");
        const title = document.createElement("span");
        title.textContent = primaryValue;
        row.appendChild(title);
        const action = document.createElement("small");
        action.textContent = exactTarget ? `归入「${exactTarget.title}」` : "新建词条";
        row.appendChild(action);
        row.addEventListener("mousedown", (event) => event.preventDefault());
        row.addEventListener("click", () => { void chooseAt(0); });
        results.appendChild(row);
      }
      if (!hasPrimary && !matches.length) {
        const empty = document.createElement("div");
        empty.className = "lexis-web-alias-empty";
        empty.textContent = "没有匹配词条";
        results.appendChild(empty);
      } else {
        const offset = hasPrimary ? 1 : 0;
        matches.forEach((match, index) => {
          const optionIndex = index + offset;
          const row = document.createElement("button");
          row.type = "button";
          row.className = "lexis-web-alias-result" + (optionIndex === activeIndex ? " is-active" : "");
          row.setAttribute("role", "option");
          row.setAttribute("aria-selected", optionIndex === activeIndex ? "true" : "false");
          const title = document.createElement("span");
          title.textContent = match.title;
          row.appendChild(title);
          if (String(match.matched).normalize("NFKC").toLowerCase() !== String(match.title).normalize("NFKC").toLowerCase()) {
            const alias = document.createElement("small");
            alias.textContent = match.matched;
            row.appendChild(alias);
          }
          row.addEventListener("mousedown", (event) => event.preventDefault());
          row.addEventListener("click", () => { void choose(match); });
          results.appendChild(row);
        });
      }
      placeResults();
    };
    input.addEventListener("input", () => { activeIndex = 0; render(); });
    input.addEventListener("keydown", (e) => {
      const optionCount = matches.length + (hasWordContent(primaryValue) ? 1 : 0);
      if (e.key === "ArrowDown" && optionCount) { e.preventDefault(); activeIndex = (activeIndex + 1) % optionCount; render(); }
      else if (e.key === "ArrowUp" && optionCount) { e.preventDefault(); activeIndex = (activeIndex - 1 + optionCount) % optionCount; render(); }
      else if (e.key === "Enter" && optionCount) { e.preventDefault(); void chooseAt(activeIndex); }
      else if (e.key === "Escape") { e.preventDefault(); hideSelBtn(); }
    });
    input.addEventListener("blur", () => setTimeout(() => { if (document.body.contains(input)) hideSelBtn(); }, 150));
    aliasBtn.replaceWith(input);
    input.focus();
    render();
    input.select();
  });
  pill.appendChild(aliasBtn);

  document.body.appendChild(pill);
  // 智能定位:先按实际内容测量宽度，再放在选区附近。
  const pillW = pill.offsetWidth || 90, pillH = pill.offsetHeight || 26, gap = 6;
  let left = rect.left + (rect.width - pillW) / 2 + window.scrollX;
  let top = rect.bottom + window.scrollY + gap;
  if (top + pillH > window.scrollY + document.documentElement.clientHeight - 8)
    top = rect.top + window.scrollY - pillH - gap;
  if (left < 8) left = 8;
  if (left + pillW > window.scrollX + document.documentElement.clientWidth - 8)
    left = window.scrollX + document.documentElement.clientWidth - pillW - 8;
  pill.style.left = Math.max(8, left) + "px";
  pill.style.top = Math.max(8, top) + "px";

  const tc = textColorFor(getComputedStyle(pill).backgroundColor);
  pill.style.color = tc;
  pill.dataset.word = text;
  selBtn = pill;
}
// mouseup + selectionchange 双触发:YouTube 等会吞掉 player 内的 mouseup,selectionchange 兜底
function scheduleSel() { clearTimeout(selTimer); selTimer = setTimeout(onSelect, 200); }
document.addEventListener("mouseup", () => { pointerSelecting = false; scheduleSel(); });
document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  const selectionInsidePopover = !!(pop && selection?.anchorNode && pop.contains(selection.anchorNode));
  if (hasExpandedSelection(selection) && !selectionInsidePopover) removePop();
  else if (selectionDeferredRoots.size) {
    for (const root of selectionDeferredRoots) if (root.isConnected) pendingRoots.add(root);
    selectionDeferredRoots.clear();
    scheduleScan();
  }
  scheduleSel();
});
document.addEventListener("mousedown", (e) => {
  const insidePopover = !!(popHost && e.composedPath().includes(popHost));
  if (e.button === 0 && !(selBtn && selBtn.contains(e.target))) {
    pointerSelecting = true;
    if (!insidePopover) removePop();
  }
  if (selBtn && !selBtn.contains(e.target)) hideSelBtn();
});
window.addEventListener("blur", () => { pointerSelecting = false; });
document.addEventListener("scroll", hideSelBtn, { passive: true });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "lexis-page-context") sendResponse({ site: currentSite });
  if (message?.type === "lexis-preload-visible") {
    void preloadVisibleDetails();
    sendResponse({ ok: true });
  }
});

// ---- 启动 / 配置变化 ----
async function init() {
  const { cfg: c, words, styleConfig, lastSelectionFolder: savedFolder, popoverSize: savedPopoverSize, siteDictionaryVisibility: savedVisibility } = await chrome.storage.local.get(["cfg", "words", "styleConfig", "lastSelectionFolder", "popoverSize", "siteDictionaryVisibility"]);
  cfg = Object.assign({}, DEFAULT_CFG, c || {});
  styleCfg = styleConfig || null;
  siteDictionaryVisibility = savedVisibility || {};
  lastSelectionFolder = typeof savedFolder === "string" ? savedFolder : "";
  popoverSize = savedPopoverSize && typeof savedPopoverSize === "object" ? savedPopoverSize : null;
  applyTheme();
  build(words || []);
  if ((words || []).length && !(words || []).some((word) => Object.prototype.hasOwnProperty.call(word, "p"))) {
    void chrome.runtime.sendMessage({ type: "sync" }).catch(() => null);
  }
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
    if (changes.siteDictionaryVisibility) siteDictionaryVisibility = changes.siteDictionaryVisibility.newValue || {};
    if (changes.lastSelectionFolder) lastSelectionFolder = typeof changes.lastSelectionFolder.newValue === "string" ? changes.lastSelectionFolder.newValue : "";
    if (changes.popoverSize) popoverSize = changes.popoverSize.newValue || null;
    if (changes.words) build(changes.words.newValue || []);
    else if (changes.styleConfig || changes.siteDictionaryVisibility) build(allWords);
    const styleChanged = oldCfg && cfg && (oldCfg.useObsidianStyle !== cfg.useObsidianStyle
      || oldCfg.color !== cfg.color || oldCfg.style !== cfg.style || oldCfg.opacity !== cfg.opacity);
    if (oldCfg && oldCfg.showMemoryCurve !== cfg.showMemoryCurve) removePop();
    if (cfg && cfg.highlight) {
      if (changes.words || changes.styleConfig || changes.siteDictionaryVisibility || styleChanged || (changes.cfg && changes.cfg.newValue && changes.cfg.newValue.highlight && !(changes.cfg.oldValue || {}).highlight)) {
        unwrapAll();
        scan(document.body);
        startObserver();
      }
    }
  })();
});

if (document.body) init();
else document.addEventListener("DOMContentLoaded", init);
