export class Menu {
  items = [];
  setUseNativeMenu() { return this; }
  addItem(build) {
    const item = { setTitle(value) { this.title = value; return this; }, setIcon() { return this; }, setChecked() { return this; }, setDisabled(value) { this.disabled = value; return this; }, onClick(callback) { this.click = callback; return this; } };
    build(item); this.items.push(item); return this;
  }
  showAtPosition() { (globalThis.__lexisMenus ||= []).push(this); }
  showAtMouseEvent() { this.showAtPosition(); }
}
export function setIcon() {}
export function parseLinktext(value) {
  const at = value.indexOf("#");
  return { path: at < 0 ? value : value.slice(0, at), subpath: at < 0 ? "" : value.slice(at) };
}
export const prepareFuzzySearch = (query) => (text) => text.toLowerCase().includes(query.toLowerCase()) ? { score: 1, matches: [] } : null;
export class Component {
  cleanups = [];
  children = [];
  load() {}
  addChild(child) { this.children.push(child); child.load(); return child; }
  register(cleanup) { this.cleanups.push(cleanup); }
  registerDomEvent(element, event, callback, options) { element.addEventListener(event, callback, options); this.register(() => element.removeEventListener(event, callback, options)); }
  unload() { for (const child of this.children) child.unload(); for (const cleanup of this.cleanups.splice(0)) cleanup(); this.children = []; }
}
export class MarkdownRenderChild extends Component {}
export class Plugin extends Component {}
export class ItemView extends Component {
  constructor(leaf) { super(); this.leaf = leaf; this.app = leaf.app; this.contentEl = leaf.contentEl; }
  async setState() {}
}
export const Platform = { isMobileApp: false };
export const requireApiVersion = () => true;
export const requestUrl = (request) => {
  if (!globalThis.__lexisMaintenanceRequest) throw new Error("Unexpected fixture network request");
  return globalThis.__lexisMaintenanceRequest(request);
};
export class Modal {
  constructor(app) { this.app = app; this.contentEl = document.createElement("div"); this.contentEl.className = "lexis-fixture-modal"; }
  setTitle(title) { this.contentEl.createEl("h2", { text: title }); }
  open() { document.body.appendChild(this.contentEl); this.onOpen?.(); }
  close() { this.onClose?.(); this.contentEl.remove(); }
}
export class AbstractInputSuggest {
  constructor(_app, input) { this.input = input; (globalThis.__lexisSuggests ||= []).push(this); }
  setValue(value) { this.input.value = value; }
  close() {}
}
export class Notice { constructor(message) { (globalThis.__lexisFixtureNotices ||= []).push(message); } }
export class TextComponent {
  constructor(container) { this.inputEl = container.createEl("input"); }
  setValue(value) { this.inputEl.value = value; return this; }
  setDisabled(value) { this.inputEl.disabled = value; return this; }
  onChange(callback) { this.inputEl.addEventListener("input", () => callback(this.inputEl.value)); return this; }
}
export class ExtraButtonComponent {
  constructor(container) { this.extraSettingsEl = container.createEl("button", { cls: "clickable-icon" }); }
  setIcon(icon) { this.extraSettingsEl.dataset.icon = icon; return this; }
  setTooltip(label) { this.extraSettingsEl.setAttribute("aria-label", label); return this; }
  onClick(callback) { this.extraSettingsEl.addEventListener("click", callback); return this; }
}
// Match the native runtime's constructor contract, not only the SDK declaration.
export class TFile {
  constructor(vault, path) {
    this.vault = vault;
    this.path = path;
    this.name = path.slice(path.lastIndexOf("/") + 1);
    const dot = this.name.lastIndexOf(".");
    this.basename = dot > 0 ? this.name.slice(0, dot) : this.name;
    this.extension = dot > 0 ? this.name.slice(dot + 1).toLowerCase() : "";
  }
}
export class MarkdownRenderer {
  static async render(app, markdown, element) {
    if (app?.fixtureMarkdownRender) { await app.fixtureMarkdownRender(markdown, element); return; }
    element.createEl("p", { text: markdown });
  }
}

export class Setting {
  constructor(container) {
    this.settingEl = container.createDiv({ cls: "setting-item" });
    this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
    this.nameEl = this.infoEl.createDiv({ cls: "setting-item-name" });
    this.descEl = this.infoEl.createDiv({ cls: "setting-item-description" });
    this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
  }
  setName(name) { this.nameEl.textContent = name; return this; }
  setDesc(description) { this.descEl.textContent = description; return this; }
  addText(build) { build(new TextComponent(this.controlEl)); return this; }
  addSearch(build) { return this.addText(build); }
  addButton(build) {
    const buttonEl = this.controlEl.createEl("button");
    const button = { buttonEl, setButtonText(value) { buttonEl.textContent = value; return this; },
      setIcon(value) { buttonEl.dataset.icon=value; return this; }, setTooltip(value) { buttonEl.title=value; return this; },
      setCta() { return this; }, setDisabled(value) { buttonEl.disabled = value; return this; },
      onClick(callback) { buttonEl.addEventListener("click", callback); return this; } };
    build(button); return this;
  }
  addToggle(build) {
    const input = this.controlEl.createEl("input", { cls: "checkbox-container", type: "checkbox" });
    const toggle = {
      setValue(value) { input.checked = value; return this; },
      onChange(callback) { input.addEventListener("change", () => callback(input.checked)); return this; },
    };
    build(toggle); return this;
  }
}
