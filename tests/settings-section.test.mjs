import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { build, transform } from "esbuild";

const result = await build({ entryPoints: ["src/settings-section.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { createSettingsSection, setSettingsSectionOpen } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

class Element extends EventTarget {
  children = [];
  dataset = {};
  constructor(tag = "div", options = {}) { super(); this.tag = tag; this.className = options.cls || ""; this.text = options.text || ""; }
  createEl(tag, options) { const child = new Element(tag, options); child.parentElement = this; this.children.push(child); return child; }
  createDiv(options) { return this.createEl("div", options); }
  createSpan(options) { return this.createEl("span", options); }
}

test("static and collapsible groups have the same hierarchy and class contract", () => {
  const root = new Element();
  const fixed = createSettingsSection(root, "Style", { collapsible: false });
  const folded = createSettingsSection(root, "Scope", { open: false });
  assert.equal(fixed.element.tag, "div"); assert.equal(folded.element.tag, "details");
  assert.equal(fixed.element.className, folded.element.className);
  assert.equal(fixed.heading.className, folded.heading.className);
  assert.equal(fixed.body.className, folded.body.className);
  assert.equal(folded.heading.tag, "summary");
  assert.equal(folded.element.open, false);
  assert.equal(fixed.body.parentElement, fixed.element);
});

test("initial open state does not write settings, and genuine toggle changes do", () => {
  const changed = [];
  const { element } = createSettingsSection(new Element(), "Colors", { collapsible: true, open: true, onToggle: (open) => changed.push(open) });
  element.dispatchEvent(new Event("toggle"));
  assert.deepEqual(changed, []);
  element.open = false; element.dispatchEvent(new Event("toggle"));
  element.dispatchEvent(new Event("toggle"));
  element.open = true; element.dispatchEvent(new Event("toggle"));
  assert.deepEqual(changed, [false, true]);
});

test("top-level sections retain their existing sortable DOM contract", () => {
  const section = createSettingsSection(new Element(), "Highlight", { level: "section", collapsible: true, description: "Preview and PDF" });
  assert.equal(section.element.className, "lexis-settings-section");
  assert.equal(section.heading.tag, "summary");
  assert.equal(section.body.className, "lexis-settings-section-body");
  assert.equal(section.heading.children[0].children[1].className, "lexis-settings-section-hint");
  assert.equal(section.body.parentElement, section.element);
});

test("all sections default to folded, and temporary expansion does not write fold preferences", () => {
  const changes = [];
  const { element } = createSettingsSection(new Element(), "Searchable", { key: "scope", onToggle: (open) => changes.push(open) });
  assert.equal(element.open, false);
  assert.equal(element.dataset.lexisGroupKey, "scope");
  setSettingsSectionOpen(element, true); element.dispatchEvent(new Event("toggle"));
  setSettingsSectionOpen(element, false); element.dispatchEvent(new Event("toggle"));
  assert.deepEqual(changes, []);
  element.open = true; element.dispatchEvent(new Event("toggle"));
  assert.deepEqual(changes, [true]);
});

test("plugin CSS parses without syntax warnings", async () => {
  const css = await readFile("styles.css", "utf8");
  const transformed = await transform(css, { loader: "css" });
  assert.deepEqual(transformed.warnings, []);
});
