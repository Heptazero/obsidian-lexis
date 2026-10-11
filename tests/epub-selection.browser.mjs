import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { build } from "esbuild";

const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await access(chrome);
const directory = await mkdtemp(join(tmpdir(), "lexis-epub-selection-"));
const bundle = await build({
  entryPoints: ["tests/fixtures/epub-selection-checks.ts"], bundle: true, write: false, format: "iife",
  plugins: [{ name: "isolated-obsidian-imports", setup(api) {
    api.onResolve({ filter: /^(obsidian|@codemirror\/state|@codemirror\/view)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
    api.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
      contents: "export const Platform={isMobile:false},StateEffect={},RangeSetBuilder={},Decoration={},ViewPlugin={},editorInfoField=undefined; export class Menu {} export class MarkdownView {} export class Modal {} export class Notice {} export class MarkdownRenderChild {} export class AbstractInputSuggest {} export class Setting {} export function setIcon() {} export function prepareFuzzySearch() {}",
      loader: "js",
    }));
  } }],
});
const server = createServer((_request, response) => {
  response.setHeader("Content-Type", "text/html");
  response.end(`<html><body><script>${bundle.outputFiles[0].text}</script></body></html>`);
});
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const output = await new Promise((resolve, reject) => {
    const child = spawn(chrome, ["--headless", "--disable-gpu", "--disable-background-networking", "--disable-component-update", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${join(directory, "profile")}`, "--virtual-time-budget=8000", "--dump-dom", `http://127.0.0.1:${server.address().port}`], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("EPUB fixture timed out")); }, 30000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes("</html>")) { clearTimeout(timer); child.kill("SIGKILL"); child.stdout.destroy(); resolve(output); }
    });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => { clearTimeout(timer); if (!output.includes("</html>")) reject(new Error(`Chrome returned no results (${code})`)); });
  });
  const result = JSON.parse(output.match(/<body[^>]*>(.*?)<\/body>/s)?.[1] || "{}");
  assert.equal(result.ok, true, `${result.error}\nPassed: ${result.checks?.join(", ")}`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  server.close();
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
