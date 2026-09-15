import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionRoot = "pkg/browser-extension";

test("keeps Chrome and Firefox packages on one version", async () => {
  const chromeManifest = JSON.parse(await readFile(`${extensionRoot}/manifest.json`, "utf8"));
  const firefoxManifest = JSON.parse(await readFile(`${extensionRoot}/manifest.firefox.json`, "utf8"));
  assert.equal(firefoxManifest.version, chromeManifest.version);
  assert.deepEqual(firefoxManifest.optional_host_permissions, ["http://127.0.0.1/*", "http://localhost/*"]);
  assert.equal("host_permissions" in firefoxManifest, false);
  assert.deepEqual(firefoxManifest.background.scripts, ["config.js", "background.js"]);
});

test("bounds browser detail requests and delays the loading label", async () => {
  const background = await readFile(`${extensionRoot}/background.js`, "utf8");
  const content = await readFile(`${extensionRoot}/content.js`, "utf8");
  assert.match(background, /AbortController/);
  assert.match(background, /request-timeout/);
  assert.match(content, /}, 180\);/);
  assert.match(content, /加载超时，请重新悬浮/);
  assert.doesNotMatch(content, /lexis-web-pop-body">加载中/);
});
