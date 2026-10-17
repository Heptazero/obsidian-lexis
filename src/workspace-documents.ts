import type { EventRef, Plugin, WorkspaceLeaf } from "obsidian";

interface WorkspaceDocumentCallbacks {
  mousemove(event: MouseEvent): void;
  mouseover(event: MouseEvent): void;
  mouseout(event: MouseEvent): void;
  click(event: MouseEvent): void;
  pointerdown(event: PointerEvent): void;
  pointermove(event: PointerEvent): void;
  pointerup(event: PointerEvent): void;
  pointercancel(): void;
  mouseup(event: MouseEvent): void;
  escape(): void;
  scroll(event: Event): void;
  activate(document: Document, documentChanged: boolean): void;
  close(document: Document): void;
}

export type WorkspaceDocumentHost = Pick<Plugin, "app" | "register">;

export class WorkspaceDocuments {
  private readonly documents = new Map<Document, () => void>();
  private readonly events: EventRef[] = [];
  private running = false;
  private active: Document;

  constructor(
    private readonly plugin: WorkspaceDocumentHost,
    private readonly callbacks: WorkspaceDocumentCallbacks,
  ) {
    this.active = plugin.app.workspace.containerEl.ownerDocument;
    plugin.register(() => this.dispose());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.activateLeaf(this.plugin.app.workspace.getMostRecentLeaf());
    this.events.push(
      this.plugin.app.workspace.on("active-leaf-change", (leaf) => this.activateLeaf(leaf)),
      this.plugin.app.workspace.on("window-open", (_workspaceWindow, window) => this.activate(window.document)),
      this.plugin.app.workspace.on("window-close", (_workspaceWindow, window) => this.remove(window.document)),
    );
  }

  current(): Document {
    return this.active;
  }

  forEach(callback: (document: Document) => void): void {
    for (const document of this.documents.keys()) callback(document);
  }

  activateLeaf(leaf: WorkspaceLeaf | null): void {
    this.activate(leaf?.view?.containerEl?.ownerDocument || this.plugin.app.workspace.containerEl.ownerDocument);
  }

  private activate(document: Document): void {
    if (!this.running) return;
    const documentChanged = this.active !== document || !this.documents.has(document);
    this.bind(document);
    this.active = document;
    this.callbacks.activate(document, documentChanged);
  }

  private bind(document: Document): void {
    if (this.documents.has(document)) return;
    const cleanups: (() => void)[] = [];
    const listen = (target: EventTarget, event: string, callback: EventListener, options?: AddEventListenerOptions) => {
      target.addEventListener(event, callback, options);
      cleanups.push(() => target.removeEventListener(event, callback, options));
    };
    this.documents.set(document, () => { for (const cleanup of cleanups) cleanup(); });
    listen(document, "mousemove", (event) => this.callbacks.mousemove(event as MouseEvent));
    listen(document, "mouseover", (event) => this.callbacks.mouseover(event as MouseEvent));
    listen(document, "mouseout", (event) => this.callbacks.mouseout(event as MouseEvent));
    listen(document, "click", (event) => this.callbacks.click(event as MouseEvent));
    listen(document, "pointerdown", (event) => this.callbacks.pointerdown(event as PointerEvent), { capture: true });
    listen(document, "pointermove", (event) => this.callbacks.pointermove(event as PointerEvent), { capture: true });
    listen(document, "pointerup", (event) => this.callbacks.pointerup(event as PointerEvent), { capture: true });
    listen(document, "pointercancel", () => this.callbacks.pointercancel(), { capture: true });
    listen(document, "mouseup", (event) => this.callbacks.mouseup(event as MouseEvent));
    listen(document, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") this.callbacks.escape();
    });
    const window = document.defaultView;
    if (window) listen(window, "scroll", (event) => this.callbacks.scroll(event), { capture: true });
  }

  private remove(document: Document): void {
    const cleanup = this.documents.get(document);
    if (!cleanup) return;
    cleanup();
    this.documents.delete(document);
    this.callbacks.close(document);
    if (this.active === document) {
      this.active = this.plugin.app.workspace.containerEl.ownerDocument;
      this.activate(this.active);
    }
  }

  dispose(): void {
    this.running = false;
    for (const cleanup of this.documents.values()) cleanup();
    this.documents.clear();
    for (const event of this.events) this.plugin.app.workspace.offref(event);
    this.events.length = 0;
  }
}
