export function setIcon(element, icon) { element.dataset.icon = icon; }
export class Notice { constructor(text) { globalThis.fixtureNotices.push(text); } }
export class Modal {
  constructor(app) {
    this.app = app;
    this.modalEl = document.createElement("div");
    this.modalEl.className = "modal";
    this.contentEl = this.modalEl.createDiv({ cls: "modal-content" });
  }
  setTitle(text) { this.modalEl.dataset.title = text; }
  open() { document.body.appendChild(this.modalEl); this.onOpen?.(); }
  close() { this.onClose?.(); this.modalEl.remove(); }
}
export class Menu {
  items = [];
  addItem(build) {
    const item = {
      setTitle(value) { this.title = value; return this; },
      setChecked(value) { this.checked = value; return this; },
      onClick(callback) { this.choose = callback; return this; },
    };
    build(item); this.items.push(item); return this;
  }
  showAtPosition(position) { this.position = position; globalThis.fixtureMenu = this; }
}
