import { attachPopoverEditor } from "../../src/popover-editor";
import { finishPopoverEdit } from "../../src/popover-edit-lifecycle";
import { addCurrentChoice } from "../../src/settings-choice";

// Isolated DOM fixture, not the user's Obsidian window or vault.
const state = globalThis as any;
state.fixtureNotices = [];
const checks: string[] = [];
function check(condition: unknown, message: string): void { if (!condition) throw new Error(message); checks.push(message); }
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const t = (key: string) => key;

function installObsidianDom(): void {
  const proto = HTMLElement.prototype as any;
  proto.createEl = function(tag: string, options: any = {}) {
    const node = this.ownerDocument.createElement(tag);
    node.className = options.cls || "";
    if (options.text) node.textContent = options.text;
    for (const [key, value] of Object.entries(options.attr || {})) node.setAttribute(key, value);
    this.appendChild(node); return node;
  };
  proto.createDiv = function(options: any) { return this.createEl("div", options); };
  proto.createSpan = function(options: any) { return this.createEl("span", options); };
  proto.empty = function() { this.replaceChildren(); };
  proto.setText = function(value: string) { this.textContent = value; };
  proto.addClass = function(value: string) { this.classList.add(value); };
  proto.setCssStyles = function(value: any) { Object.assign(this.style, value); };
}

function mount(initial = "---\nlexis-s: 1\n---\nold", mode = "inline", read?: () => Promise<string>) {
  let current = initial;
  let writes = 0;
  const popover = document.body.createDiv({ cls: "lexis-popover" });
  const corner = popover.createDiv({ cls: "lexis-popover-corner" });
  const content = popover.createDiv();
  const cleanup: (() => void)[] = [];
  const app = { vault: {
    read: read || (async () => current),
    process: async (_file: unknown, transform: (value: string) => string) => { current = transform(current); writes++; },
  } };
  attachPopoverEditor({ app, file: { basename: "Test" }, popover, corner, content,
    component: { register: (callback: () => void) => cleanup.push(callback) },
    mode: () => mode, t, render: async () => { content.setText(current); },
  } as any);
  return { popover, content, button: corner.querySelector("button")!, current: () => current, writes: () => writes,
    external: (text: string) => { current = text; }, cleanup };
}

async function run(): Promise<void> {
  installObsidianDom();
  const nameEl = document.body.createDiv({ text: "Mode" });
  const controlEl = document.body.createDiv();
  let chosen = "a";
  addCurrentChoice({ nameEl, controlEl } as any, [{ value: "a", label: "First" }, { value: "b", label: "Second" }], chosen, (value) => { chosen = value; });
  const toggle = controlEl.querySelector("button")!;
  check(toggle.textContent === "First" && toggle.querySelector("[data-icon='arrow-left-right']"), "two choices show one value and double arrow");
  toggle.click(); await tick();
  check(chosen === "b" && toggle.textContent === "Second" && !state.fixtureMenu, "two choices switch without a menu");
  controlEl.empty();
  addCurrentChoice({ nameEl, controlEl } as any, ["a", "b", "c"].map((value) => ({ value, label: value })), "b", (value) => { chosen = value; });
  controlEl.querySelector("button")!.click();
  check(state.fixtureMenu.items.length === 3 && state.fixtureMenu.items[1].checked, "multiple choices open a checked menu");
  await state.fixtureMenu.items[2].choose();
  check(chosen === "c" && controlEl.textContent === "c", "menu choice updates current label");

  const card = mount();
  card.button.click(); await tick();
  const editor = card.content.querySelector("textarea")!;
  check(!!editor && !document.querySelector(".modal") && editor.value === "old", "pencil edits inside the original card without properties");
  editor.value = "changed";
  editor.dispatchEvent(new Event("input"));
  card.external("---\nlexis-s: 2\n---\nold");
  await new Promise((resolve) => setTimeout(resolve, 650));
  check(card.current() === "---\nlexis-s: 2\n---\nchanged", "debounced automatic save preserves concurrent property changes");
  editor.dispatchEvent(new CompositionEvent("compositionstart"));
  editor.value = "中文输入"; editor.dispatchEvent(new Event("input"));
  check(!await finishPopoverEdit(card.popover) && card.writes() === 1, "composition is not saved or closed midway");
  editor.dispatchEvent(new CompositionEvent("compositionend"));
  check(await finishPopoverEdit(card.popover) && card.current().endsWith("中文输入") && !card.popover.dataset.lexisEditing,
    "finishing flushes final input and restores preview");

  const conflict = mount(); conflict.button.click(); await tick();
  const draft = conflict.content.querySelector("textarea")!;
  draft.value = "my draft"; draft.dispatchEvent(new Event("input"));
  conflict.external("---\nlexis-s: 1\n---\nexternal body");
  check(!await finishPopoverEdit(conflict.popover) && draft.value === "my draft" && conflict.popover.dataset.lexisEditing === "1",
    "a conflicting body remains open with its copyable draft");
  check(conflict.current().endsWith("external body"), "a conflicting body is never overwritten");

  let release!: (value: string) => void;
  const loading = mount("old", "inline", () => new Promise((resolve) => { release = resolve; }));
  loading.button.click();
  const closing = finishPopoverEdit(loading.popover);
  release("old");
  check(await closing && !loading.popover.dataset.lexisEditing, "closing while the editor loads settles without a recursive close loop");

  const separate = mount("old", "window"); separate.button.click(); await tick();
  const modal = document.querySelector<HTMLElement>(".lexis-quick-edit-modal")!;
  check(!!modal && !separate.content.querySelector("textarea"), "separate window is an explicit optional mode");
  check(modal.getBoundingClientRect().width <= window.innerWidth - 30, "optional editor window stays inside a narrow viewport");
}

run().then(() => { document.body.textContent = JSON.stringify({ ok: true, checks }); })
  .catch((error) => { document.body.textContent = JSON.stringify({ ok: false, checks, error: error.message }); });
