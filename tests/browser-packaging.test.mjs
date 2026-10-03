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
  assert.deepEqual(chromeManifest.content_scripts[0].js, ["config.js", "alias-search.js", "content-core.js", "content-popover.js", "content.js"]);
  assert.deepEqual(firefoxManifest.content_scripts[0].js, chromeManifest.content_scripts[0].js);
});

test("bounds browser detail requests and delays the loading label", async () => {
  const background = await readFile(`${extensionRoot}/background.js`, "utf8");
  const content = await Promise.all(["content-core.js", "content-popover.js", "content.js"]
    .map((name) => readFile(`${extensionRoot}/${name}`, "utf8")))
    .then((parts) => parts.join("\n"));
  assert.match(background, /AbortController/);
  assert.match(background, /request-timeout/);
  assert.match(background, /request-cancelled/);
  assert.doesNotMatch(background, /activeDetailController/);
  assert.match(background, /sharedRequest\("detail"/);
  assert.match(background, /sharedRequest\("occurrences"/);
  assert.match(content, /Math\.max\(120,/);
  assert.match(content, /}, 180\);/);
  assert.match(content, /出处暂未加载 · 点击重试/);
  assert.match(content, /lexis-preload-visible/);
  assert.doesNotMatch(content, /lexis-web-pop-body">加载中/);
});

test("highlights static code blocks without touching code editors", async () => {
  const source = await readFile(`${extensionRoot}/content-core.js`, "utf8");
  const tags = JSON.parse(/SKIP_TAGS = new Set\((\[[^;]+\])\)/.exec(source)?.[1] || "[]");
  assert.equal(tags.includes("CODE"), false);
  assert.equal(tags.includes("PRE"), false);
  assert.match(source, /CODE_EDITOR_SELECTOR/);
  assert.match(source, /p\.matches\(CODE_EDITOR_SELECTOR\)/);
});
