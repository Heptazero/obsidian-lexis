type Checks = {
  check(value: unknown, message: string): void;
  tick(): Promise<unknown>;
  chapter(parent: Element, text: string, annotated?: boolean): Promise<HTMLIFrameElement>;
  select(host: any, frame: HTMLIFrameElement): string;
};

/** Annotator 0.2.11 uses react-offline-iframe: wrapper -> proxy -> EPUB chapter. */
export async function annotatorProxyChecks(host: any, { check, tick, chapter, select }: Checks): Promise<void> {
  const pane = document.createElement("div");
  pane.className = "workspace-leaf-content";
  pane.dataset.type = "pdf-annotator";
  document.body.appendChild(pane);
  host.epubHighlights.start(document);
  const outer = document.createElement("iframe");
  const loaded = new Promise((resolve) => outer.addEventListener("load", resolve, { once: true }));
  outer.srcdoc = '<iframe patched-src="https://cdn.hypothes.is/demos/epub/epub.js/index.html"></iframe>';
  pane.appendChild(outer);
  await loaded; await tick();
  const proxy = outer.contentDocument!.querySelector("iframe")!;
  const proxyDocument = proxy.contentDocument!;
  proxyDocument.open();
  proxyDocument.write('<div id="viewer"></div><iframe patched-src="https://hypothes.is/app.html"></iframe>');
  proxyDocument.close();
  await tick();
  const frame = await chapter(proxyDocument.querySelector("#viewer")!, "known");
  const doc = frame.contentDocument!;
  check(doc.querySelector(".lexis-hl"), "real Annotator three-layer offline structure discovers chapter text");
  const selected = select(host, frame);
  check(selected === "known", "Annotator proxy selection still reaches the actual host pill");
  const sidebar = proxyDocument.querySelector('iframe[patched-src="https://hypothes.is/app.html"]') as HTMLIFrameElement;
  sidebar.contentDocument!.body.innerHTML = "<p>known</p>";
  const sidebarCalls = host.selectionCalls;
  sidebar.contentDocument!.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === sidebarCalls, "the offline annotation sidebar is not treated as an EPUB proxy");

  let ownAnnotationCalls = 0;
  const ownAnnotation = (event: MouseEvent) => {
    ownAnnotationCalls++;
    event.stopPropagation();
    const annotation = doc.createElement("aside");
    annotation.className = "hypothesis-adder";
    doc.body.appendChild(annotation);
  };
  doc.querySelector("p")!.addEventListener("mouseup", ownAnnotation);
  host.removeSelPill();
  select(host, frame);
  check(ownAnnotationCalls === 1 && doc.querySelector(".hypothesis-adder") && host._selPill?.isConnected,
    "Lexis capture listener and the reader's own annotation menu can coexist");
  check(doc.defaultView!.getSelection()!.toString() === "known", "Lexis leaves the reader's annotation selection intact");
  const oldDoc = doc;
  frame.remove(); await tick();
  const nextFrame = await chapter(proxyDocument.querySelector("#viewer")!, "known");
  select(host, nextFrame);
  const before = host.selectionCalls;
  oldDoc.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === before, "three-layer Annotator chapter changes release old Lexis listeners");

  const proxyLoaded = new Promise((resolve) => proxy.addEventListener("load", resolve, { once: true }));
  proxy.srcdoc = '<div id="viewer"></div>';
  await proxyLoaded; await tick();
  const reloadedFrame = await chapter(proxy.contentDocument!.querySelector("#viewer")!, "known");
  select(host, reloadedFrame);
  const reloadedDoc = reloadedFrame.contentDocument!;
  const closeCalls = host.selectionCalls;
  pane.remove(); await tick();
  reloadedDoc.querySelector("p")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  check(host.selectionCalls === closeCalls, "closing a three-layer Annotator reader releases its chapters");
  host.epubHighlights.dispose(); host.removeSelPill();
}
