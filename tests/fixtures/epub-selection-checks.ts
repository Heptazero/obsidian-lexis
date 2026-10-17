import { EpubHighlights } from "../../src/epub-highlights";
import { ReaderHover } from "../../src/reader-hover";
import { createHighlightEngine } from "../../src/highlight-engine";
import { createReaderInteractions } from "../../src/reader-interactions";
import { Platform } from "obsidian";
import { overlayAnchorFor, overlayDocumentFor, readerRectInDocument } from "../../src/reader-frame-geometry";
import { createReaderUi } from "../../src/reader-ui";
import { annotatorProxyChecks } from "./annotator-proxy-checks";

// Only the host has Obsidian DOM extensions. EPUB documents remain unmodified.
const checks: string[] = [];
const errors: string[] = [];
window.addEventListener("error", (event) => { errors.push(event.message); event.preventDefault(); });
const tick = () => new Promise((resolve) => setTimeout(resolve, 25));
function check(value: unknown, message: string): void { if (!value) throw new Error(message); checks.push(message); }
function installHostDom(): void {
  const prototype = HTMLElement.prototype as any;
  prototype.createEl = function(tag: string, options: any = {}) {
    const element = this.ownerDocument.createElement(tag);
    element.className = options.cls || "";
    element.textContent = options.text || "";
    this.appendChild(element);
    return element;
  };
  prototype.createDiv = function(options: any) { return this.createEl("div", options); };
  prototype.createSpan = function(options: any) { return this.createEl("span", options); };
  prototype.setCssStyles = function(value: any) { Object.assign(this.style, value); };
}

function plugin(): any {
  const engine = createHighlightEngine({ Notice: class {} as any, FSRS: {}, boundedSource: (x) => x,
    compactMixedScriptSpacing: (x) => x, todayStr: () => "" });
  const host: any = {
    app: { workspace: { containerEl: document.body, getActiveFile: () => ({ path: "book.epub" }) } },
    settings: { enableHighlight: true, highlightMode: "automatic", selectionPill: true },
    index: new Map([["known", { file: { path: "known.md", basename: "known" } }]]),
    _pattern: "known", _selPill: null, _aliasSearch: null,
    resolveMatchKey: (text: string) => text.toLowerCase(), resolveIndexKey: (text: string) => text.toLowerCase(),
    inlineStyleForEntry: () => "background: rgba(128, 90, 220, 0.2)",
    extractSentence: (text: string) => text, dictFolders: () => ["dictionary"],
    normalizeFolder: (text: string) => text.trim(), t: (key: string) => key,
    wrapMatchesInElement: engine.wrapMatchesInElement.value,
    selectionCalls: 0, hoverCalls: 0, clickCalls: 0,
  };
  Object.defineProperties(host, createReaderInteractions());
  host.epubHighlights = new EpubHighlights(host);
  host.readerHover = new ReaderHover(host);
  const selection = host.maybeShowSelPill;
  host.maybeShowSelPill = (event: MouseEvent, fromEpub: boolean) => {
    host.selectionCalls++;
    selection.call(host, event, fromEpub);
  };
  host.onMouseOver = () => host.hoverCalls++;
  host.onClick = () => host.clickCalls++;
  host.onMouseOut = () => {};
  return host;
}

async function chapter(parent: Element, text: string, annotated = true): Promise<HTMLIFrameElement> {
  const frame = parent.ownerDocument!.createElement("iframe");
  if (annotated) frame.setAttribute("enable-annotation", "true");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.cssText = "width: 300px; height: 100px";
  const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  frame.srcdoc = `<p>${text}</p>`;
  parent.appendChild(frame);
  await loaded;
  await tick();
  return frame;
}

function select(host: any, frame: HTMLIFrameElement): string {
  const doc = frame.contentDocument!;
  const paragraph = doc.querySelector("p")!;
  const range = doc.createRange();
  range.selectNodeContents(paragraph);
  const selection = frame.contentWindow!.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const before = host.selectionCalls;
  paragraph.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === before + 1, "one selection handler per chapter document");
  check(host._selPill?.isConnected && host._selPill.ownerDocument === document, "real selection pill appears in host document");
  check(range.getBoundingClientRect().width > 0, "EPUB selection has visible geometry");
  return selection.toString();
}

async function run(): Promise<void> {
  installHostDom();
  const book = document.createElement("div");
  document.body.appendChild(book);
  const host = plugin();
  host.epubHighlights.start(document);
  let frame = await chapter(book, "plain text");
  check(typeof (frame.contentDocument!.body as any).createSpan === "undefined", "EPUB has no Obsidian DOM extensions");
  check(select(host, frame) === "plain text", "first plain chapter is selectable");
  const firstDocument = frame.contentDocument!;
  const firstSelectionCalls = host.selectionCalls;
  frame.remove();
  await tick();
  firstDocument.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === firstSelectionCalls, "removed chapter is released");

  for (let chapterIndex = 0; chapterIndex < 5; chapterIndex++) {
    frame = await chapter(book, "known");
    const doc = frame.contentDocument!;
    const highlight = doc.querySelector(".lexis-hl") as HTMLElement;
    check(highlight?.textContent === "known" && highlight.ownerDocument === doc, "dictionary matches highlight in independent EPUB document");
    check(select(host, frame) === "known", "new matching chapter stays selectable");
    highlight.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    highlight.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    check(host.hoverCalls === chapterIndex + 1 && host.clickCalls === chapterIndex + 1, "hover and click remain bound after chapter changes");
    host.epubHighlights.rescan();
    check(doc.querySelectorAll(".lexis-hl").length === 1,
      "rescan neither duplicates hooks nor nests highlights");
    select(host, frame);
    const selectionCalls = host.selectionCalls;
    frame.remove();
    await tick();
    doc.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    check(host.selectionCalls === selectionCalls, "detached chapter documents lose their listeners");
  }

  frame = await chapter(book, "known");
  const oldDocument = frame.contentDocument!;
  const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  frame.srcdoc = "<p>known</p>";
  await loaded;
  await tick();
  check(frame.contentDocument !== oldDocument && frame.contentDocument!.querySelector(".lexis-hl"),
    "reused iframe rebinds to its new chapter document");
  const beforeOldSelection = host.selectionCalls;
  oldDocument.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === beforeOldSelection, "navigated-away document loses its listeners");
  select(host, frame);

  const rewrittenDocument = frame.contentDocument!;
  rewrittenDocument.open();
  rewrittenDocument.write("<p>known</p>");
  rewrittenDocument.close();
  await tick();
  host.epubHighlights.rescan();
  check(frame.contentDocument!.querySelectorAll(".lexis-hl").length === 1,
    "document.write chapter replacement tracks the current document");
  select(host, frame);

  host.settings.highlightMode = "manual";
  host.epubHighlights.rescan();
  check(!frame.contentDocument!.querySelector(".lexis-hl"), "manual mode removes automatic highlights");
  select(host, frame);
  check(host._selPill.textContent.includes("selection.lookupExisting"), "manual mode still offers lookup in the pill");
  frame.remove();
  await tick();
  frame = await chapter(book, "known");
  check(!frame.contentDocument!.querySelector(".lexis-hl"), "new chapter stays unhighlighted in manual mode");
  select(host, frame);

  host.settings.enableHighlight = false;
  host.epubHighlights.rescan();
  select(host, frame);
  check(!frame.contentDocument!.querySelector(".lexis-hl"), "selection pill is independent of the highlight master switch");
  host.settings.selectionPill = false;
  host.removeSelPill();
  frame.contentDocument!.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(!host._selPill, "selection pill's own switch remains respected");
  host.settings.selectionPill = true;
  host.settings.enableHighlight = true;
  host.settings.highlightMode = "automatic";

  const normalRenderer = host.wrapMatchesInElement;
  const failedChapter = document.createElement("iframe");
  failedChapter.setAttribute("enable-annotation", "true");
  book.appendChild(failedChapter);
  failedChapter.contentDocument!.body.innerHTML = "<p>known</p>";
  host.wrapMatchesInElement = (root: HTMLElement, ...args: any[]) => {
    if (root.ownerDocument === failedChapter.contentDocument) throw new Error("simulated renderer failure");
    normalRenderer.call(host, root, ...args);
  };
  try { host.epubHighlights.rescan(); } catch (error) {
    check((error as Error).message === "simulated renderer failure", "render failure is observable");
  }
  select(host, failedChapter);
  host.wrapMatchesInElement = normalRenderer;

  const tracked = Array.from(book.querySelectorAll("iframe"));
  host.epubHighlights.dispose();
  const beforeTeardownSelection = host.selectionCalls;
  for (const trackedFrame of tracked) {
    trackedFrame.dispatchEvent(new Event("load"));
    trackedFrame.contentDocument!.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }
  check(host.selectionCalls === beforeTeardownSelection,
    "teardown removes both load and document listeners");
  await tick();
  check(errors.length === 0, `no asynchronous errors: ${errors.join(", ")}`);
  host.removeSelPill();
  failedChapter.remove();

  host.epubHighlights.start(document);
  select(host, frame);
  check(frame.contentDocument!.querySelectorAll(".lexis-hl").length === 1, "restart binds already-open chapters without duplicate highlights");
  const moved = document.createElement("div");
  document.body.appendChild(moved);
  moved.appendChild(frame);
  await tick();
  check(frame.contentDocument!.querySelectorAll(".lexis-hl").length === 1, "moving a connected chapter does not discard its binding");
  select(host, frame);
  host.epubHighlights.dispose();
  host.removeSelPill();
  book.remove(); moved.remove();

  await nestedReaders(host);
  await annotatorProxyChecks(host, { check, tick, chapter, select });

  const markdown = document.createElement("div");
  markdown.innerHTML = "<p>known</p><code>known</code>";
  document.body.appendChild(markdown);
  normalRenderer.call(host, markdown, "code,pre,.lexis-hl");
  check(markdown.querySelectorAll(".lexis-hl").length === 1 && markdown.querySelector("code")!.textContent === "known",
    "shared DOM fix preserves ordinary Markdown matching and exclusions");
  markdown.innerHTML = "<p>known</p>";
  normalRenderer.call(host, markdown, "code,pre,.lexis-hl", {}, new Set(["known"]));
  check(!markdown.querySelector(".lexis-hl") && markdown.textContent === "known", "shared DOM fix preserves self-entry exclusions");
  markdown.remove();
  document.body.textContent = JSON.stringify({ ok: true, checks });
}

async function nestedReaders(host: any): Promise<void> {
  const pane = document.createElement("div");
  pane.className = "workspace-leaf-content";
  pane.dataset.type = "pdf-annotator";
  document.body.appendChild(pane);
  host.epubHighlights.start(document);
  const shell = document.createElement("iframe");
  shell.style.cssText = "position:absolute;left:80px;top:70px;width:500px;height:400px;border:7px solid blue";
  const loaded = new Promise((resolve) => shell.addEventListener("load", resolve, { once: true }));
  shell.srcdoc = '<div id="viewer" style="margin:30px"></div><iframe title="sidebar"></iframe>';
  pane.appendChild(shell);
  await loaded;
  await tick();
  const shellDoc = shell.contentDocument!;
  check(typeof (shellDoc.body as any).createDiv === "undefined", "Annotator shell has no host helpers either");
  let inner = await chapter(shellDoc.querySelector("#viewer")!, "known");
  check(inner.contentDocument!.querySelectorAll(".lexis-hl").length === 1, "Annotator's delayed nested chapter is highlighted");
  select(host, inner);
  check(overlayDocumentFor(inner.contentDocument!.body) === document
    && overlayAnchorFor(inner.contentDocument!.body) === shell, "nested overlays and source lookup reach the actual Obsidian pane");
  const range = inner.contentDocument!.createRange();
  range.selectNodeContents(inner.contentDocument!.querySelector("p")!);
  const local = range.getBoundingClientRect();
  const rect = readerRectInDocument(local, inner.contentDocument!, document);
  const innerBounds = inner.getBoundingClientRect(), shellBounds = shell.getBoundingClientRect();
  check(Math.abs(rect.left - (local.left + innerBounds.left + inner.clientLeft + shellBounds.left + shell.clientLeft)) < 0.1,
    "nested selection coordinates include both frame offsets and borders");
  const position = createReaderUi({} as any).positionPopover.value;
  const pop = document.body.createDiv();
  pop.style.cssText = "position:fixed;width:100px;height:40px";
  position.call(host, pop, inner.contentDocument!.querySelector(".lexis-hl"));
  check(Math.abs(parseFloat(pop.style.left) - rect.left) < 0.1
    && Math.abs(parseFloat(pop.style.top) - (rect.bottom + 6)) < 0.1, "actual popover positioning uses the same nested coordinates");
  pop.remove();
  shell.style.transformOrigin = "top left";
  shell.style.transform = "scale(0.8)";
  const scaled = readerRectInDocument(local, inner.contentDocument!, document);
  check(Math.abs(scaled.width - local.width * 0.8) < 0.1, "CSS-scaled reader geometry remains aligned");
  shell.style.transform = "";

  const sidebar = shellDoc.querySelector('iframe[title="sidebar"]') as HTMLIFrameElement;
  sidebar.contentDocument!.body.innerHTML = "<p>known</p>";
  check(!sidebar.contentDocument!.querySelector(".lexis-hl"),
    "annotation sidebar is not treated as book text");
  const plainFrame = await chapter(document.body, "known", false);
  check(!plainFrame.contentDocument!.querySelector(".lexis-hl"),
    "ordinary non-reader iframe content is not touched");
  plainFrame.remove();
  await tick();

  Platform.isMobile = true;
  host.removeSelPill();
  const selectedDoc = inner.contentDocument!;
  const paragraph = selectedDoc.querySelector("p")!;
  const selection = selectedDoc.defaultView!.getSelection()!;
  paragraph.dispatchEvent(new Event("touchstart", { bubbles: true }));
  selection.removeAllRanges();
  const mobileRange = selectedDoc.createRange();
  mobileRange.selectNodeContents(paragraph);
  selection.addRange(mobileRange);
  selectedDoc.dispatchEvent(new Event("selectionchange"));
  paragraph.dispatchEvent(new Event("touchend", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 240));
  check(host._selPill?.ownerDocument === document, "mobile long-press selection shows a pill without mouseup");
  const beforeStable = host.selectionCalls;
  selectedDoc.dispatchEvent(new Event("selectionchange"));
  await new Promise((resolve) => setTimeout(resolve, 240));
  check(host.selectionCalls === beforeStable, "unchanged native selection does not repeatedly rebuild the pill");
  const shown: Element[] = [];
  host.showPopover = (target: Element) => { shown.push(target); return Promise.resolve(); };
  const highlight = selectedDoc.querySelector(".lexis-hl")!;
  selection.removeAllRanges();
  highlight.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", pointerId: 1, isPrimary: true }));
  highlight.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", pointerId: 1, isPrimary: true }));
  check(shown.length === 1, "mobile highlight tap invokes the existing mobile popover action");
  highlight.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", pointerId: 2, isPrimary: true }));
  highlight.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "touch", pointerId: 2, isPrimary: true, clientX: 50 }));
  highlight.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", pointerId: 2, isPrimary: true, clientX: 50 }));
  check(shown.length === 1, "mobile scrolling over a highlight does not open a card");
  Platform.isMobile = false;
  const oldDoc = inner.contentDocument!;
  const reloaded = new Promise((resolve) => shell.addEventListener("load", resolve, { once: true }));
  shell.srcdoc = '<div id="viewer"></div>';
  await reloaded; await tick();
  const beforeStale = host.selectionCalls;
  oldDoc.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === beforeStale, "Annotator shell navigation prunes stale nested chapter listeners");
  inner = await chapter(shell.contentDocument!.querySelector("#viewer")!, "known", false);
  check(inner.contentDocument!.querySelector(".lexis-hl"), "Annotator viewer chapters work without modern epub.js attributes");
  select(host, inner);
  const rewrittenShell = shell.contentDocument!;
  rewrittenShell.open(); rewrittenShell.write('<div id="viewer"></div>'); rewrittenShell.close();
  await tick(); host.epubHighlights.rescan();
  inner = await chapter(shell.contentDocument!.querySelector("#viewer")!, "known", false);
  select(host, inner);
  check(inner.contentDocument!.querySelector(".lexis-hl"), "rewritten Annotator shells still observe later chapter insertion");
  const closingCalls = host.selectionCalls;
  const closingDoc = inner.contentDocument!;
  pane.remove(); await tick();
  closingDoc.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === closingCalls, "closing an Annotator pane releases the whole reader tree");
  host.removeSelPill();

  const weave = document.createElement("foliate-view") as any;
  document.body.appendChild(weave);
  const shadow = weave.attachShadow({ mode: "closed" });
  const holder = document.createElement("div");
  shadow.appendChild(holder);
  const foliateFrame = await chapter(holder, "known");
  foliateFrame.removeAttribute("enable-annotation");
  weave.renderer = { getContents: () => [{ doc: foliateFrame.contentDocument }] };
  weave.dispatchEvent(new Event("load"));
  await tick();
  check(weave.shadowRoot === null && foliateFrame.contentDocument!.querySelector(".lexis-hl"), "Foliate's public document API works through a closed shadow root");
  check(foliateFrame.contentDocument!.querySelectorAll(".lexis-hl").length === 1, "Weave/Foliate chapters share the actual highlighter");
  select(host, foliateFrame);
  const sameHighlight = foliateFrame.contentDocument!.querySelector(".lexis-hl");
  for (let i = 0; i < 5; i++) weave.dispatchEvent(new Event("relocate"));
  check(foliateFrame.contentDocument!.querySelector(".lexis-hl") === sameHighlight,
    "Foliate relocation does not rewrite selected text or nest highlights");
  host.settings.highlightMode = "manual"; host.epubHighlights.rescan();
  check(!foliateFrame.contentDocument!.querySelector(".lexis-hl"), "explicit refresh updates Foliate highlight settings");
  host.settings.highlightMode = "automatic";
  const cachedCalls = host.selectionCalls;
  weave.renderer.getContents = () => [];
  weave.dispatchEvent(new Event("relocate"));
  foliateFrame.contentDocument!.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === cachedCalls, "Foliate's discarded but connected cached chapters lose their event listeners");
  weave.remove(); await tick();
  host.epubHighlights.dispose(); host.readerHover.dispose(); host.removeSelPill();
  check(errors.length === 0, `no errors in nested readers: ${errors.join(", ")}`);
}

run().catch((error) => { document.body.textContent = JSON.stringify({ ok: false, error: error.stack, checks }); });
