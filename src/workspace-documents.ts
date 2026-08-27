import type { Plugin, WorkspaceLeaf } from "obsidian";

interface WorkspaceDocumentCallbacks {
  mouseover(event: MouseEvent): void;
  mouseout(event: MouseEvent): void;
  click(event: MouseEvent): void;
  mouseup(event: MouseEvent): void;
  escape(): void;
  scroll(event: Event): void;
  activate(document: Document, documentChanged: boolean): void;
  close(document: Document): void;
}

export class WorkspaceDocuments {
  private readonly documents = new Set<Document>();
  private active: Document;

  constructor(
    private readonly plugin: Plugin,
    private readonly callbacks: WorkspaceDocumentCallbacks,
  ) {
    this.active = plugin.app.workspace.containerEl.ownerDocument;
  }

  start(): void {
    this.activateLeaf(this.plugin.app.workspace.getMostRecentLeaf());
    this.plugin.registerEvent(this.plugin.app.workspace.on("active-leaf-change", (leaf) => this.activateLeaf(leaf)));
    this.plugin.registerEvent(this.plugin.app.workspace.on("window-open", (_workspaceWindow, window) => this.activate(window.document)));
    this.plugin.registerEvent(this.plugin.app.workspace.on("window-close", (_workspaceWindow, window) => this.remove(window.document)));
  }

  current(): Document {
    return this.active;
  }

  forEach(callback: (document: Document) => void): void {
    for (const document of this.documents) callback(document);
  }

  activateLeaf(leaf: WorkspaceLeaf | null): void {
    this.activate(leaf?.view?.containerEl?.ownerDocument || this.plugin.app.workspace.containerEl.ownerDocument);
  }

  private activate(document: Document): void {
    const documentChanged = this.active !== document || !this.documents.has(document);
    this.bind(document);
    this.active = document;
    this.callbacks.activate(document, documentChanged);
  }

  private bind(document: Document): void {
    if (this.documents.has(document)) return;
    this.documents.add(document);
    this.plugin.registerDomEvent(document, "mouseover", (event) => this.callbacks.mouseover(event));
    this.plugin.registerDomEvent(document, "mouseout", (event) => this.callbacks.mouseout(event));
    this.plugin.registerDomEvent(document, "click", (event) => this.callbacks.click(event));
    this.plugin.registerDomEvent(document, "mouseup", (event) => this.callbacks.mouseup(event));
    this.plugin.registerDomEvent(document, "keydown", (event) => {
      if (event.key === "Escape") this.callbacks.escape();
    });
    const window = document.defaultView;
    if (window) this.plugin.registerDomEvent(window, "scroll", (event) => this.callbacks.scroll(event), { capture: true });
  }

  private remove(document: Document): void {
    if (!this.documents.delete(document)) return;
    this.callbacks.close(document);
    if (this.active === document) {
      this.active = this.plugin.app.workspace.containerEl.ownerDocument;
      this.activate(this.active);
    }
  }
}
