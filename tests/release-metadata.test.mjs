import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("keeps release metadata aligned", async () => {
  const [manifest, packageJson, packageLock, versions] = await Promise.all([
    readJson("manifest.json"),
    readJson("package.json"),
    readJson("package-lock.json"),
    readJson("versions.json"),
  ]);

  assert.equal(packageJson.version, manifest.version);
  assert.equal(packageLock.version, manifest.version);
  assert.equal(packageLock.packages[""].version, manifest.version);
  assert.equal(versions[manifest.version], manifest.minAppVersion);
  assert.equal(manifest.isDesktopOnly, false);
  assert.ok(manifest.description.length <= 250);
  assert.doesNotMatch(manifest.description, /\bobsidian\b/i);
  assert.doesNotMatch(manifest.description, /^lexis\b/i);
  assert.match(manifest.description, /[.!?]$/);
});

test("avoids community review CSS blockers", async () => {
  const css = await readFile("styles.css", "utf8");
  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /\bcolumn-gap\s*:/);
  assert.doesNotMatch(css, /\bclip-path\s*:/);
  assert.doesNotMatch(css, /\bbox-decoration-break\s*:/);
});

test("keeps source compatible with the reviewer's ES2021 type library", async () => {
  const files = (await readdir("src", { recursive: true })).filter((path) => path.endsWith(".ts"));
  for (const path of files) {
    const source = await readFile(`src/${path}`, "utf8");
    assert.doesNotMatch(source, /\.at\(/, `${path} uses Array.at, which the community review types as unsafe`);
  }
});
