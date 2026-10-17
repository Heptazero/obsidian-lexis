// Isolated fixture: all persistence and network operations stay in memory.
const fixtureAdds = [];
const fixtureWords = Array.from({ length: 8 }, (_, index) => ({ k: `novel${index}`, w: `Novel ${index}`, p: `Words/Novel ${index}.md` }));
let cfg, styleCfg, allWords = fixtureWords, siteDictionaryVisibility, lastSelectionFolder, popoverSize;
let selectionPillOffset = { x: 0, y: 0 };
let selTimer, pointerSelecting = false, pop = null, popHost = null;
const DEFAULT_CFG = { color: "#7c5cff" };
const keySet = new Set(), knownKeys = new Set(), excludedKeys = new Set();
const selectionDeferredRoots = new Set(), pendingRoots = new Set();
const { collectAliasTargets, findExactAliasTarget, rankAliasTargets } = LexisAliasSearch;
const LexisWebDom = { ignored: () => false, activeElement: () => document.activeElement };
const LexisWebSource = { capture: () => ({ url: "https://example.com", title: "fixture" }) };
const chrome = {
  runtime: { onMessage: { addListener() {} }, async sendMessage() { return { ok: true }; } },
  storage: { local: { async get() { return { words: fixtureWords, styleConfig: { dicts: ["Words", "Other"], selectionPillOrder: "add-dictionary-alias" } }; }, async set() {} }, onChanged: { addListener() {} } },
};
function applyTheme() { document.documentElement.style.setProperty("--lexis-web-color", cfg.color); }
function build(words) { allWords = words; }
function startObserver() {}
function scan() {}
function scheduleScan() {}
function removePop() {}
function unwrapAll() {}
function pageSelection() { return window.getSelection(); }
function hasExpandedSelection(selection) { return selection && !selection.isCollapsed; }
function resolveKnownKey(text) { return text.toLowerCase(); }
function sentenceFromSelection(selection) { return selection.toString(); }
function textColorFor() { return "#fff"; }
async function doAdd(...args) { fixtureAdds.push(args); }
globalThis.aliasFixture = {
  showPill() {
    const range = document.createRange(); range.selectNodeContents(document.getElementById("source"));
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    onSelect();
  },
  open() {
    this.showPill(); document.querySelector(".lexis-web-selalias").click();
  },
  close() { hideSelBtn(); },
  adds: fixtureAdds,
  color(value) { cfg.color = value; applyTheme(); },
  order(value) { styleCfg.selectionPillOrder = value; },
  dictionaries(value) { styleCfg.dicts = value; },
  pillOrder() {
    return [...document.querySelectorAll(".lexis-web-selpill > button")].map((button) =>
      button.classList.contains("lexis-web-selfolder") ? "dictionary"
        : button.classList.contains("lexis-web-selalias") ? "alias" : "add");
  },
};
