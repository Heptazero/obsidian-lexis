import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("distinct hover requests do not cancel each other and duplicate requests share work", async () => {
  const source = await readFile("pkg/browser-extension/background.js", "utf8");
  let listener;
  const calls = [];
  const context = {
    LexisWebConfig: { defaultConnection: { host: "127.0.0.1", port: 12345 }, normalizePort: Number },
    chrome: {
      storage: { local: { get: async () => ({ cfg: { token: "test" } }) } },
      runtime: { onMessage: { addListener: (callback) => { listener = callback; } } },
    },
    fetch: async (url, { signal }) => {
      calls.push(url);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 20);
        signal.addEventListener("abort", () => { clearTimeout(timer); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
      });
      return { json: async () => ({ ok: true, key: new URL(url).searchParams.get("key") }) };
    },
    AbortController, URL, setTimeout, clearTimeout,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  const request = (key) => new Promise((resolve) => listener({ type: "detail", key }, null, resolve));

  const [first, second, duplicate] = await Promise.all([request("alpha"), request("beta"), request("alpha")]);
  assert.equal(first.key, "alpha");
  assert.equal(second.key, "beta");
  assert.equal(duplicate.key, "alpha");
  assert.equal(calls.length, 2);
});
