import { createSettingsSection, setSettingsSectionOpen } from "../../src/settings-section";
import { renderMarginNoteScope } from "../../src/settings-marginnote-scope";
import { Setting } from "obsidian";
import { checkSettingsNavigation } from "./settings-navigation-checks";
import { checkSettingsManual } from "./settings-manual-checks";
import { checkReviewMobileLayout } from "./review-mobile-checks";
import { checkReviewLibrary } from "./review-library-checks";
import { checkReviewLogLayout } from "./review-log-layout-checks";
import { checkSettingsMaintenance } from "./settings-maintenance-checks";
import { checkReviewCardRows } from "./review-card-row-checks";
import { checkDictionaryCollections } from "./dictionary-collections-checks";
import { annotateSettingControlLayouts } from "../../src/settings-control-layout";
import { checkStorageSettings } from "./storage-settings-checks";

const checks: string[] = [];
function check(value: unknown, message: string): void { if (!value) throw new Error(message); checks.push(message); }
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

function installHostDom(): void {
  const prototype = HTMLElement.prototype as any;
  prototype.createEl = function(tag: string, options: any = {}) {
    const element = this.ownerDocument.createElement(tag);
    element.className = options.cls || "";
    element.textContent = options.text || "";
    if (options.type) element.type = options.type;
    for (const [key, value] of Object.entries(options.attr || {})) element.setAttribute(key, String(value));
    this.appendChild(element); return element;
  };
  prototype.createDiv = function(options: any) { return this.createEl("div", options); };
  prototype.createSpan = function(options: any) { return this.createEl("span", options); };
  prototype.empty = function() { this.replaceChildren(); };
  prototype.setText = function(value: string) { this.textContent = value; };
  prototype.addClass = function(...names: string[]) { this.classList.add(...names); };
  prototype.instanceOf = function(constructor: typeof HTMLElement) { return this instanceof constructor; };
}

async function run(): Promise<void> {
  installHostDom();
  const root = document.body.createDiv({ cls: "lexis-settings-root" });
  const main = createSettingsSection(root, "MarginNote", { level: "section", open: true });
  new Setting(main.body).setName("词库导出文件夹").setDesc("确认后更新导出位置。");
  const scopeGroup = createSettingsSection(main.body, "测试分组", { key: "export-scope" });
  let saved = 0;
  const labels: Record<string, string> = {
    "mn.scope": "导出范围", "mn.scopeAll": "全部词典和内联词条",
    "mn.followVisibility": "跟随词典与内联高亮开关",
    "mn.followVisibilityDescription": "关闭时独立选择范围。忽略标签、已归档和已掌握的词条始终不导出。",
  };
  renderMarginNoteScope(scopeGroup.body, {
    settings: { dicts: [{ folder: "Words/" + "VeryLongDictionaryName".repeat(5) }], marginNoteSources: [], marginNoteFollowVisibility: false },
    index: new Map(), t: (key: string) => labels[key] || key,
    saveSettings: async () => { saved++; }, marginNoteExport: { schedule() {} },
  } as any);
  const scope = main.body.querySelector<HTMLDetailsElement>("details.lexis-settings-group")!;
  const summary = scope.querySelector<HTMLElement>(".lexis-settings-group-heading")!;
  const before = summary.getBoundingClientRect();
  const fixed = createSettingsSection(main.body, "自动更新", { key: "auto", open: true });
  new Setting(fixed.body).setName("自动更新导出词库").setDesc("词库变化时更新文件。").addToggle((toggle) => toggle.setValue(false));
  const inputSetting = new Setting(fixed.body).setName("导出路径").addText((input) => input.setValue("99_assets/export"));
  annotateSettingControlLayouts(root);
  check(fixed.body.querySelector(".setting-item.lexis-setting-has-toggle") !== null, "toggle settings receive an explicit mobile layout class");
  check(inputSetting.settingEl.classList.contains("lexis-setting-has-wide-control"), "wide controls receive an explicit mobile layout class");
  const changes: boolean[] = [];
  const inline = createSettingsSection(main.body, "词条颜色", { key: "colors", open: true, onToggle: (value) => changes.push(value) });
  new Setting(inline.body).setName("颜色名称 / 别名");
  await tick();
  check(saved === 0 && changes.length === 0, "opening the settings page does not write configuration");
  check(!scope.open && !scope.querySelector<HTMLElement>(".setting-item")!.checkVisibility(),
    "export scope options are hidden together while collapsed");
  scope.open = true;
  await tick();
  const after = summary.getBoundingClientRect();
  check(Math.abs(before.left - after.left) < 1 && Math.abs(before.width - after.width) < 1,
    "expanding does not shift the export scope heading");
  const fixedStyle = getComputedStyle(fixed.heading), scopeStyle = getComputedStyle(summary);
  check(fixedStyle.fontSize === scopeStyle.fontSize && fixedStyle.fontWeight === scopeStyle.fontWeight,
    "static and collapsible titles have the same typography");
  check(scopeStyle.borderBottomWidth === "0px" && scopeStyle.listStyleType === "none",
    "native theme summary decoration is replaced by the shared header");
  check(getComputedStyle(scope).backgroundColor === "rgba(0, 0, 0, 0)", "subgroups do not add grey backgrounds");
  for (const element of [scope, fixed.element, inline.element]) {
    const title = element.querySelector<HTMLElement>(":scope > .lexis-settings-group-heading .lexis-settings-group-title")!;
    const name = element.querySelector<HTMLElement>(".setting-item-name")!;
    check(Math.abs(title.getBoundingClientRect().left - name.getBoundingClientRect().left) <= 12,
      "child controls align with title text using one shared indentation");
  }
  const names = [...scope.querySelectorAll<HTMLElement>(".setting-item-name")];
  check(!names.some((node) => node.textContent === labels["mn.followVisibility"]), "export selection no longer exposes a follow-highlight option");
  const indent = getComputedStyle(scope.querySelector<HTMLElement>(".lexis-settings-group-body")!).paddingLeft;
  check(indent === (window.innerWidth <= 700 ? "12px" : "22px"), "indentation follows the showcase hierarchy");
  check(document.documentElement.scrollWidth <= window.innerWidth && root.scrollWidth <= root.clientWidth + 1,
    "long source paths and controls do not create horizontal overflow");
  if (window.innerWidth <= 700) check(parseFloat(scopeStyle.minHeight) >= 44, "mobile fold headings have a touch-sized target");
  inline.element.setAttribute("open", "");
  await tick();
  check(changes.length === 0, "unchanged initial collapse state does not save");
  inline.element.removeAttribute("open"); await tick();
  inline.element.setAttribute("open", ""); await tick();
  check(changes.length === 2 && changes[0] === false && changes[1] === true, "real fold changes keep the existing save callback");
  setSettingsSectionOpen(main.element as HTMLDetailsElement, false);
  await checkSettingsNavigation(root, main.element, check, () => changes.length);
  await tick();
  await checkSettingsManual(root, check);
  await checkReviewMobileLayout(check);
  await checkSettingsMaintenance(check);
  await checkReviewLibrary(check);
  await checkReviewCardRows(check);
  await checkReviewLogLayout(check);
  await checkDictionaryCollections(check);
  await checkStorageSettings(check);
}

run().then(() => {
  const report = document.createElement("script");
  report.id = "layout-result"; report.type = "application/json";
  report.textContent = JSON.stringify({ ok: true, width: window.innerWidth, mode: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", checks }); document.body.appendChild(report);
}).catch((error) => {
  const report = document.createElement("script");
  report.id = "layout-result"; report.type = "application/json";
  report.textContent = JSON.stringify({ ok: false, width: window.innerWidth, mode: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", error: error.message, checks }); document.body.appendChild(report);
});
