// Lexis Web —— 内容脚本:在网页上高亮词库里的词,悬停显示释义
"use strict";

const { isDictionaryVisible, hasExpandedSelection, selectionIntersectsNode } = globalThis.LexisWebConfig;
const { collectAliasTargets, findExactAliasTarget, rankAliasTargets } = globalThis.LexisAliasSearch;
const HL = "lexis-web-hl";
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE", "SELECT", "OPTION", "KBD", "SAMP"]);
const DEFAULT_CFG = { highlight: true, showMemoryCurve: true, color: "#7c5cff", style: "wavy", useObsidianStyle: true, opacity: 100 };

let cfg = null;
let allWords = [];
let siteDictionaryVisibility = {};
const currentSite = location.origin && location.origin !== "null" ? location.origin : `${location.protocol}//${location.host}`;
let keySet = null;
let knownKeys = null;
let keyTags = null;
let keyFolder = null;
let keyColor = null;
let keyOpacity = null;
let keyVisible = null;
let keyStyle = null;
let excludedKeys = null;
let knownKeyByCompact = null;
let matchKeyByCompact = null;
let regex = null;
let observer = null;
let scanTimer = null;
let selTimer = null;
let lastSelectionFolder = "";
let popoverSize = null;
let pendingRoots = new Set();
const selectionDeferredRoots = new Set();
let pointerSelecting = false;
let styleCfg = null;
const detailCache = new Map();
let pop = null, popHost = null, hideTimer = null, currentSpan = null;
let popoverSheetPromise = null;
let mathCssInstalled = "", mathSheet = null;

function popoverSheet() {
  if (!popoverSheetPromise) popoverSheetPromise = fetch(chrome.runtime.getURL("popover.css"))
    .then((response) => response.text())
    .then((css) => { const sheet = new CSSStyleSheet(); sheet.replaceSync(css); return sheet; });
  return popoverSheetPromise;
}

function installMathCss(root, css) {
  if (!css) return;
  if (!mathSheet) {
    mathSheet = new CSSStyleSheet();
  }
  if (css !== mathCssInstalled) {
    mathSheet.replaceSync(css);
    mathCssInstalled = css;
  }
  if (!root.adoptedStyleSheets.includes(mathSheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, mathSheet];
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ASCII_WORD = /[A-Za-z0-9_]/;
const EAST_ASIAN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const HSPACE = /[ \t\u00a0\u3000]/;
const isMixedBoundary = (left, right) => (ASCII_WORD.test(left) && EAST_ASIAN.test(right)) || (EAST_ASIAN.test(left) && ASCII_WORD.test(right));
function compactMixedSpacing(value) {
  const chars = [...String(value || "")];
  let result = "", previous = "";
  for (let i = 0; i < chars.length;) {
    if (!HSPACE.test(chars[i])) { result += chars[i]; previous = chars[i]; i++; continue; }
    let end = i + 1;
    while (end < chars.length && HSPACE.test(chars[end])) end++;
    if (!isMixedBoundary(previous, chars[end] || "")) result += chars.slice(i, end).join("");
    i = end;
  }
  return result;
}
function flexibleMixedSource(value) {
  const chars = [...String(value || "")];
  let source = "", previous = "", boundaryAdded = false;
  for (let i = 0; i < chars.length;) {
    if (HSPACE.test(chars[i])) {
      let end = i + 1;
      while (end < chars.length && HSPACE.test(chars[end])) end++;
      boundaryAdded = isMixedBoundary(previous, chars[end] || "");
      source += boundaryAdded ? "[ \\t\\u00a0\\u3000]*" : esc(chars.slice(i, end).join(""));
      i = end;
      continue;
    }
    if (!boundaryAdded && previous && isMixedBoundary(previous, chars[i])) source += "[ \\t\\u00a0\\u3000]*";
    source += esc(chars[i]);
    previous = chars[i]; boundaryAdded = false; i++;
  }
  return source;
}
// 词边界(支持中文):仅当词以英文字母/数字/下划线开头或结尾时加 ASCII 边界;中文不加,否则 \b 永不命中
const boundedSrc = (w) => (/^[A-Za-z0-9_]/.test(w) ? "(?<![A-Za-z0-9_])" : "") + flexibleMixedSource(w) + (/[A-Za-z0-9_]$/.test(w) ? "(?![A-Za-z0-9_])" : "");
const buildRe = (keys) => (keys.length ? new RegExp(keys.map(boundedSrc).join("|"), "gi") : null);
const resolveFrom = (map, value) => {
  const key = String(value || "").toLowerCase();
  return (map && (map.get(key) || map.get(compactMixedSpacing(key)))) || key;
};
const resolveKnownKey = (value) => resolveFrom(knownKeyByCompact, value);
const resolveMatchKey = (value) => resolveFrom(matchKeyByCompact, value);

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
      toast(r.dup ? "这条已经在出处里了" : r.created ? alias ? `已将「${alias}」归入「${r.word}」` : `已新建单词「${r.word}」` : `已给「${r.word}」加出处`, true);
      if (r.created || alias) {
        // 先在当前页重建一次，不等同步；旧短词高亮必须先解包并合并文本节点，新长词才能跨原高亮位置命中。
        const immediateKey = String(alias || r.word || word).toLowerCase();
        knownKeys.add(immediateKey);
        const responseFile = String(r.file || "");
        const slash = responseFile.lastIndexOf("/");
        const responseFolder = slash > 0 ? responseFile.slice(0, slash) : folder;
        if (isDictionaryVisible(currentSite, responseFolder, styleCfg?.dicts || [], siteDictionaryVisibility) && !keySet.has(immediateKey)) {
          keySet.add(immediateKey);
          knownKeyByCompact.set(immediateKey, immediateKey);
          matchKeyByCompact.set(immediateKey, immediateKey);
          const compact = compactMixedSpacing(immediateKey);
          if (!knownKeyByCompact.has(compact)) knownKeyByCompact.set(compact, immediateKey);
          if (!matchKeyByCompact.has(compact)) matchKeyByCompact.set(compact, immediateKey);
          regex = buildRe([...keySet].sort((a, b) => b.length - a.length));
        }
        if (cfg && cfg.highlight) { unwrapAll(); scan(document.body); startObserver(); }
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
  allWords = Array.isArray(words) ? words : [];
  keySet = new Set();
  knownKeys = new Set();
  keyTags = new Map();
  keyFolder = new Map();
  keyColor = new Map();
  keyOpacity = new Map();
  keyVisible = new Map();
  keyStyle = new Map();
  excludedKeys = new Set();
  knownKeyByCompact = new Map();
  matchKeyByCompact = new Map();
  const exSet = excludeSet();
  const keys = [];
  for (const x of allWords) {
    const k = (x.k || "").toLowerCase();
    if (k.length < 2 && !/[^\x00-\x7f]/.test(k)) continue; // 英文单字母跳过,单个汉字保留
    knownKeys.add(k);
    knownKeyByCompact.set(k, k);
    const compact = compactMixedSpacing(k);
    if (!knownKeyByCompact.has(compact)) knownKeyByCompact.set(compact, k);
    const tags = (x.t || []).map((t) => String(t).toLowerCase());
    keyTags.set(k, tags);
    if (x.f) keyFolder.set(k, x.f);
    if (x.c) keyColor.set(k, x.c);
    if (Number.isFinite(Number(x.o))) keyOpacity.set(k, Number(x.o));
    keyVisible.set(k, x.v !== false);
    if (x.s) keyStyle.set(k, x.s);
    if (exSet.size && tags.some((t) => exSet.has(t))) { excludedKeys.add(k); continue; }
    if (!isDictionaryVisible(currentSite, x.f, styleCfg?.dicts || [], siteDictionaryVisibility)) continue;
    keySet.add(k);
    matchKeyByCompact.set(k, k);
    if (!matchKeyByCompact.has(compact)) matchKeyByCompact.set(compact, k);
    keys.push(k);
  }
  keys.sort((a, b) => b.length - a.length);
  regex = buildRe(keys);
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
  if (keyVisible && keyVisible.get(key) === false) return "text-decoration-line:none;background:none";
  // 用户关了「使用 Obsidian 标签着色」→ 只用全局色
  if (cfg.useObsidianStyle === false || !styleCfg) {
    let c = cfg.color || "#7c5cff";
    const s = cfg.style || "wavy";
    const a = (cfg.opacity != null ? cfg.opacity : 100) / 100;
    if (a < 1) c = `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
    if (s === "background") return `background-color:${c};border-radius:3px;text-decoration-line:none`;
    const line = s === "underline" ? "solid" : "wavy";
    return `text-decoration-line:underline;text-decoration-style:${line};text-decoration-color:${c};text-underline-offset:2px`;
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
  const alpha = keyOpacity.has(key) ? keyOpacity.get(key) : (styleCfg.highlightOpacity != null ? styleCfg.highlightOpacity : 1);
  if (alpha < 1) color = `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
  if (styleKind === "background") return `background-color:${color};border-radius:3px;text-decoration-line:none`;
  const line = styleKind === "underline" ? "solid" : "wavy";
  return `text-decoration-line:underline;text-decoration-style:${line};text-decoration-color:${color};text-underline-offset:2px`;
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
    const key = resolveMatchKey(m[0]);
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
  const selection = window.getSelection();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || (n.nodeValue.length < 2 && !/[^\x00-\x7f]/.test(n.nodeValue))) return NodeFilter.FILTER_REJECT;
      if (skip(n)) return NodeFilter.FILTER_REJECT;
      if (selectionIntersectsNode(selection, n)) {
        if (n.parentElement) selectionDeferredRoots.add(n.parentElement);
        return NodeFilter.FILTER_REJECT;
      }
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
  const parents = new Set();
  for (const span of document.querySelectorAll("." + HL)) {
    if (span.parentNode) parents.add(span.parentNode);
    const tn = document.createTextNode(span.textContent);
    span.parentNode.replaceChild(tn, span);
  }
  for (const parent of parents) if (parent.isConnected) parent.normalize();
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
