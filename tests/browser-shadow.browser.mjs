import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await access(chrome);
const root = "pkg/browser-extension";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const dir = await mkdtemp(join(tmpdir(), "lexis-shadow-dom-"));
try {
  const css = {};
  for (const name of new Set([...manifest.content_scripts[0].css, "popover.css"])) css[name] = await readFile(`${root}/${name}`, "utf8");
  const scripts = [
    `const fixtureCss = ${JSON.stringify(css)};`,
    await readFile("tests/fixtures/browser-shadow-setup.js", "utf8"),
    ...await Promise.all(manifest.content_scripts[0].js.map((name) => readFile(`${root}/${name}`, "utf8"))),
    await readFile("tests/fixtures/browser-shadow-checks.js", "utf8"),
  ];
  const fixture = join(dir, "index.html");
  const pageCss = manifest.content_scripts[0].css.map(name=>css[name]).join('\n');
  await writeFile(fixture, `<html><head><style>${pageCss}</style></head><body>${scripts.map((source) => `<script>${source.replaceAll("</script", "<\\/script")}</script>`).join("\n")}</body></html>`);
  const output = await new Promise((resolve, reject) => {
    const child = spawn(chrome, ["--headless", "--disable-gpu", "--disable-background-networking", "--disable-component-update", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(dir, "profile")}`, "--virtual-time-budget=10000", "--dump-dom", `file://${fixture}`], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Shadow DOM fixture timed out")); }, 30000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes("</html>")) {
        clearTimeout(timer);
        child.kill("SIGKILL");
        child.stdout.destroy();
      }
    });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (!output.includes("</html>")) reject(new Error(`Chrome returned no fixture result (${code})`));
      else resolve(output);
    });
  });
  const body = output.match(/<body[^>]*>(.*?)<\/body>/s)?.[1];
  assert.ok(body, "headless browser returned no body");
  const result = JSON.parse(body);
  assert.equal(result.ok, true, `${result.error}\nPassed: ${result.checks.join(", ")}`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
