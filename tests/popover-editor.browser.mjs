import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { build } from "esbuild";

const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await access(chrome);
const directory = await mkdtemp(join(tmpdir(), "lexis-popover-editor-"));
try {
  const bundle = await build({ entryPoints: ["tests/fixtures/popover-editor-checks.ts"], bundle: true, write: false, format: "iife",
    plugins: [{ name: "obsidian-fixture", setup(api) {
      api.onResolve({ filter: /^obsidian$/ }, () => ({ path: resolve("tests/fixtures/popover-editor-obsidian.js") }));
    } }],
  });
  const css = await readFile("styles.css", "utf8");
  const fixture = join(directory, "index.html");
  await writeFile(fixture, `<html><style>${css}</style><body><script>${bundle.outputFiles[0].text}</script></body></html>`);
  const output = await new Promise((resolve, reject) => {
    const child = spawn(chrome, ["--headless", "--disable-gpu", "--disable-background-networking", "--disable-component-update", "--no-first-run", "--no-default-browser-check", "--window-size=400,800",
      `--user-data-dir=${join(directory, "profile")}`, "--virtual-time-budget=4000", "--dump-dom", `file://${fixture}`], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Editor fixture timed out")); }, 30000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; if (output.includes("</html>")) { clearTimeout(timer); child.kill("SIGKILL"); child.stdout.destroy(); resolve(output); } });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => { clearTimeout(timer); if (!output.includes("</html>")) reject(new Error(`Chrome returned no results (${code})`)); });
  });
  const result = JSON.parse(output.match(/<body[^>]*>(.*?)<\/body>/s)?.[1] || "{}");
  assert.equal(result.ok, true, `${result.error}\nPassed: ${result.checks?.join(", ")}`);
  console.log(JSON.stringify(result, null, 2));
} finally { await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
