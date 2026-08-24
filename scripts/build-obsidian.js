"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = (name) => fs.readFileSync(path.join(root, "src", name), "utf8");

function moduleBody(name) {
  return src(name)
    .replace(/^"use strict";\s*/, "")
    .replace(/^const \{ ItemView, Component, Notice \} = require\("obsidian"\);\s*/m, "")
    .replace(/\nmodule\.exports = \{[^\n]+\};\s*$/, "\n");
}

const imports = [
  'const { createI18n } = require("./i18n");',
  'const { buildCurveSVG } = require("./curve");',
  'const { createReviewView } = require("./review-view");',
  'const { createOccurrenceSearch } = require("./occurrence-search");',
  'const { createBridgeServer } = require("./bridge-server");',
  'const { createBridgeApi } = require("./bridge-api");',
  'const { createHighlightEngine } = require("./highlight-engine");',
  'const { createReaderUi } = require("./reader-ui");',
  'const { addAppearanceButton, createReorderController, moveItem } = require("./settings-controls");',
  'const { createTemplateProvider } = require("./template-provider");',
  'const { createSettingsTab } = require("./settings-tab");',
].join("\n");

let main = src("main.js");
if (!main.includes(imports)) throw new Error("找不到待合并的 Lexis 模块入口");

main = main.replace(imports, [
  "// ---------- 生成自 src/i18n.js ----------",
  moduleBody("i18n.js").trim(),
  "",
  "// ---------- 生成自 src/curve.js ----------",
  moduleBody("curve.js").trim(),
  "",
  "// ---------- 生成自 src/review-view.js ----------",
  moduleBody("review-view.js").trim(),
  "",
  "// ---------- 生成自 src/occurrence-search.js ----------",
  moduleBody("occurrence-search.js").trim(),
  "",
  "// ---------- 生成自 src/bridge-server.js ----------",
  moduleBody("bridge-server.js").trim(),
  "",
  "// ---------- 生成自 src/bridge-api.js ----------",
  moduleBody("bridge-api.js").trim(),
  "",
  "// ---------- 生成自 src/highlight-engine.js ----------",
  moduleBody("highlight-engine.js").trim(),
  "",
  "// ---------- 生成自 src/reader-ui.js ----------",
  moduleBody("reader-ui.js").trim(),
  "",
  "// ---------- 生成自 src/settings-controls.js ----------",
  moduleBody("settings-controls.js").trim(),
  "",
  "// ---------- 生成自 src/template-provider.js ----------",
  moduleBody("template-provider.js").trim(),
  "",
  "// ---------- 生成自 src/settings-tab.js ----------",
  moduleBody("settings-tab.js").trim(),
].join("\n"));

fs.writeFileSync(path.join(root, "main.js"), main.endsWith("\n") ? main : main + "\n");
console.log("已生成移动端兼容的 main.js");
