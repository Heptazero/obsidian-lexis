import { openAliasCombobox } from "../../src/alias-combobox";
import type { AliasTarget } from "../../src/alias-search";

const checks: string[] = [];
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); checks.push(message); };
const tick = () => new Promise((resolve) => setTimeout(resolve, 25));
const browser = (globalThis as any).aliasFixture;
const targets = Array.from({ length: 8 }, (_, index) => ({ id: `Words/Novel ${index}.md`, title: `Novel ${index}`, terms: [`Novel ${index}`], file: {} })) as AliasTarget[];

function hostDom(): void {
  const prototype = HTMLElement.prototype as any;
  prototype.createEl = function(tag: string, options: any = {}) {
    const node = document.createElement(tag); node.className = options.cls || ""; node.textContent = options.text || "";
    for (const [key, value] of Object.entries(options.attr || {})) node.setAttribute(key, String(value));
    this.appendChild(node); return node;
  };
  prototype.createDiv = function(options: any) { return this.createEl("div", options); };
  prototype.createSpan = function(options: any) { return this.createEl("span", options); };
}

function assertList(list: HTMLElement, input: HTMLInputElement, label: string): void {
  const rows = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  const active = rows.filter((row) => row.classList.contains("is-active"));
  check(active.length === 1, `${label}: one current row`);
  check(input.getAttribute("aria-activedescendant") === active[0].id, `${label}: accessible current row matches`);
  for (const row of rows) {
    const css = getComputedStyle(row), selected = row === active[0];
    check(css.borderRadius === (selected ? "5px" : "0px") && css.boxShadow === "none", `${label}: only current frame is rounded`);
    const hover = matchMedia("(prefers-color-scheme: dark)").matches ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)";
    check(css.backgroundColor === (selected ? hover : "rgba(0, 0, 0, 0)"), `${label}: current row uses subtle hover fill`);
    check(css.color === getComputedStyle(list).color, `${label}: selection keeps normal text color`);
    check(css.borderTopWidth === "1px" && (css.borderTopColor === "rgba(0, 0, 0, 0)") === !selected, `${label}: only current row has visible frame`);
    check(row.getAttribute("aria-selected") === String(selected), `${label}: selection state matches`);
    if (selected && row.querySelector("small")) check(getComputedStyle(row.querySelector("small")!).color === css.color, `${label}: hint keeps selection contrast`);
  }
  check(list.scrollWidth <= list.clientWidth + 1, `${label}: no horizontal overflow`);
}

async function run(): Promise<void> {
  hostDom(); await tick();
  const anchor = document.getElementById("anchor")!;
  const picked: string[] = [], created: string[] = [];
  let controller: ReturnType<typeof openAliasCombobox>;
  const open = (initialValue = "novel") => {
    controller = openAliasCombobox({ document, anchor, targets, initialValue, placeholder: "Search", createLabel: "Create new",
      existingLabel: (target) => `Link ${target.title}`, emptyText: "Empty", onCreate: (value) => created.push(value),
      onPick: (target) => picked.push(target.title), onClose() {} });
    return { list: document.querySelector<HTMLElement>(".lexis-alias-search-results")!, input: document.querySelector<HTMLInputElement>(".lexis-alias-search-input")! };
  };
  const key = (input: HTMLInputElement, value: string) => input.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
  const filter = (input: HTMLInputElement, value: string) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); };
  let ob = open(); assertList(ob.list, ob.input, "Obsidian");
  const row = ob.list.children[2] as HTMLElement, before = row.getBoundingClientRect();
  row.dispatchEvent(new MouseEvent("mouseenter")); assertList(ob.list, ob.input, "Obsidian hover");
  key(ob.input, "ArrowDown"); check(ob.list.children[2] === row && row.getBoundingClientRect().height === before.height, "Obsidian navigation keeps DOM and layout");
  key(ob.input, "Enter"); check(picked[0] === "Novel 2", "Obsidian Enter follows hover then keyboard");
  ob = open(); key(ob.input, "Enter"); check(created[0] === "novel", "Obsidian unknown primary creates");
  ob = open("Novel 0"); key(ob.input, "Enter"); check(picked[1] === "Novel 0" && created.length === 1, "Obsidian exact primary links existing");
  ob = open(); filter(ob.input, "unmatched"); key(ob.input, "ArrowUp"); check(ob.list.querySelectorAll('[role="option"]').length === 1, "Obsidian always offers new term");
  filter(ob.input, ""); key(ob.input, "Escape"); check(!document.querySelector(".lexis-alias-search"), "Obsidian Escape closes");
  ob = open(); document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); check(!document.querySelector(".lexis-alias-search"), "Obsidian outside click closes");

  const webOpen = () => {
    browser.open();
    return { list: document.querySelector<HTMLElement>(".lexis-web-alias-results")!, input: document.querySelector<HTMLInputElement>(".lexis-web-selinput")! };
  };
  let web = webOpen(); assertList(web.list, web.input, "Browser");
  web.list.scrollTop = 40;
  web.list.dispatchEvent(new Event("scroll"));
  check(web.list.isConnected && web.input.isConnected, "Browser scrolling results keeps alias picker open");
  web.list.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  check(web.list.isConnected && web.input.isConnected, "Browser scrollbar interaction keeps alias picker open");
  document.dispatchEvent(new Event("scroll"));
  check(!web.list.isConnected, "Browser page scrolling still closes alias picker");
  web = webOpen();
  const webRow = web.list.children[2] as HTMLElement;
  webRow.dispatchEvent(new MouseEvent("mouseenter")); key(web.input, "ArrowDown");
  check(web.list.children[2] === webRow, "Browser navigation keeps DOM");
  key(web.input, "Enter"); await tick(); check(browser.adds[0][0] === "Novel 2" && browser.adds[0][2] === "novel", "Browser Enter attaches selection as alias");
  web = webOpen(); key(web.input, "Enter"); await tick(); check(browser.adds[1][0] === "novel" && browser.adds[1][2] === undefined, "Browser unknown primary creates");
  web = webOpen(); filter(web.input, "Novel 0"); key(web.input, "Enter"); await tick(); check(browser.adds[2][0] === "Novel 0", "Browser exact primary links");
  web = webOpen(); const clicked = web.list.children[1] as HTMLElement;
  clicked.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  check(clicked.isConnected, "Browser result survives document mousedown handler");
  clicked.click(); await tick(); check(browser.adds[3][0] === "Novel 0", "Browser mouse click selects actual row");
  web = webOpen(); browser.color("#00ff00"); key(web.input, "ArrowDown");
  assertList(web.list, web.input, "Browser custom accent stays separate from option selection");
  filter(web.input, "novel" + " long".repeat(20)); check(web.list.scrollWidth <= web.list.clientWidth + 1, "Browser long primary does not overflow");
  key(web.input, "Escape"); check(!document.querySelector(".lexis-web-alias-results"), "Browser Escape closes");
  ob = open("novel" + " long".repeat(20)); check(ob.list.scrollWidth <= ob.list.clientWidth + 1, "Obsidian long primary does not overflow");
  controller!.close(); browser.color("#7c5cff"); open(); webOpen();
}

run().then(() => report(true)).catch((error) => report(false, error.message));
function report(ok: boolean, error?: string): void {
  const node = document.createElement("script"); node.id = "alias-result"; node.type = "application/json";
  node.textContent = JSON.stringify({ ok, error, width: window.innerWidth, mode: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", checks }); document.body.appendChild(node);
}
