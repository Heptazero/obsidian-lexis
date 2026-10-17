import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Only connects to a fresh headless process and temporary profile created here. */
export async function withChromeFixture(html, run) {
  const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  await access(chrome);
  const directory = await mkdtemp(join(tmpdir(), "lexis-ui-fixture-"));
  let browser, socket;
  try {
    const file = join(directory, "index.html");
    await writeFile(file, html);
    browser = spawn(chrome, ["--headless", "--disable-gpu", "--disable-background-networking", "--disable-component-update", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${join(directory, "profile")}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
    let port;
    for (let attempt = 0; attempt < 150 && !port; attempt++) {
      try { port = (await readFile(join(directory, "profile", "DevToolsActivePort"), "utf8")).split("\n")[0]; } catch { await delay(100); }
    }
    assert.ok(port, "isolated Chrome did not start");
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const response = JSON.parse(event.data);
      const request = pending.get(response.id);
      if (!request) return;
      pending.delete(response.id); clearTimeout(request.timer);
      if (response.error) request.reject(new Error(response.error.message)); else request.resolve(response.result);
    });
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 10000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    return await run(cdp, pathToFileURL(file).href);
  } finally {
    socket?.close();
    if (browser && browser.exitCode === null) {
      const exited = new Promise((resolve) => browser.once("exit", resolve));
      browser.kill("SIGTERM"); await Promise.race([exited, delay(500)]);
      if (browser.exitCode === null) { browser.kill("SIGKILL"); await exited; }
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

export async function fixtureReport(cdp, url, { width, mode, id = "layout-result" }) {
  // A desktop Chrome window cannot be narrower than 500px; emulate its viewport.
  await cdp("Emulation.setDeviceMetricsOverride", { width, height: 1200, deviceScaleFactor: 1, mobile: false });
  if (mode) await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: mode }] });
  await cdp("Page.navigate", { url });
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await cdp("Runtime.evaluate", { expression: `document.getElementById(${JSON.stringify(id)})?.textContent || ""`, returnByValue: true });
    if (value.result.value) {
      const report = JSON.parse(value.result.value);
      if (report.width === width && (!mode || report.mode === mode)) return report;
    }
    await delay(50);
  }
  throw new Error("Browser fixture did not report a result");
}
