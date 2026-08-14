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
  'const { buildCurveSVG } = require("./curve");',
  'const { createReviewView } = require("./review-view");',
].join("\n");

let main = src("main.js");
if (!main.includes(imports)) throw new Error("找不到待合并的 Lexis 模块入口");

main = main.replace(imports, [
  "// ---------- 生成自 src/curve.js ----------",
  moduleBody("curve.js").trim(),
  "",
  "// ---------- 生成自 src/review-view.js ----------",
  moduleBody("review-view.js").trim(),
].join("\n"));

fs.writeFileSync(path.join(root, "main.js"), main.endsWith("\n") ? main : main + "\n");
console.log("已生成移动端兼容的 main.js");
