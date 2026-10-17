import { parseLinktext, type App, type Component, type TFile, type WorkspaceLeaf } from "obsidian";
import type { ListedReviewCard } from "./review-catalog";

export interface ReviewNavigationHost {
  app: App;
  leaf: WorkspaceLeaf;
  mode(): "current" | "tab";
  sourcePath(): string;
  saveSession(): void;
  failed(error: unknown): void;
}

async function openReviewFile(host: ReviewNavigationHost, file: TFile, subpath = "", forceTab = false): Promise<WorkspaceLeaf> {
  host.saveSession();
  const leaf = forceTab || host.mode() === "tab" ? host.app.workspace.getLeaf("tab") : host.leaf;
  await leaf.openFile(file, { active: true, eState: subpath ? { subpath } : undefined });
  await host.app.workspace.revealLeaf(leaf);
  return leaf;
}

/** List arrows and detail links share native leaf selection and source-line positioning. */
export async function openReviewCardSource(host: ReviewNavigationHost, card: Pick<ListedReviewCard, "file" | "line">, forceTab = false): Promise<void> {
  const leaf = await openReviewFile(host, card.file, "", forceTab);
  const editor = (leaf.view as { editor?: { setCursor(position: { line: number; ch: number }): void; scrollIntoView(range: { from: { line: number; ch: number }; to: { line: number; ch: number } }, center: boolean): void } }).editor;
  if (editor && card.line != null) {
    const position = { line: card.line, ch: 0 };
    editor.setCursor(position);
    editor.scrollIntoView({ from: position, to: position }, true);
  }
}

/** Do not hand Markdown note links to the operating system's URL handler. */
export function internalReviewLink(element: Element): string | null {
  const link = element.closest("a.internal-link, [data-lexis-review-link]");
  if (!link) return null;
  return link.getAttribute("data-href") || link.getAttribute("data-lexis-review-link") || link.getAttribute("href") || "";
}

export class ReviewNavigation {
  constructor(private host: ReviewNavigationHost, component: Component, container: HTMLElement) {
    component.registerDomEvent(container, "click", (event) => {
      const target = event.composedPath().find((node): node is Element => (node as Node)?.nodeType === 1);
      if (!target) return;
      const link = internalReviewLink(target);
      if (link == null) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void this.openLink(link, event.metaKey || event.ctrlKey).catch((error: unknown) => host.failed(error));
    }, { capture: true });
  }

  async openFile(file: TFile, subpath = "", forceTab = false): Promise<WorkspaceLeaf> {
    return openReviewFile(this.host, file, subpath, forceTab);
  }

  async openLink(link: string, forceTab = false): Promise<void> {
    // An internal link is a vault link, never a remnote:// or other external scheme.
    if (/^[a-z][a-z\d+.-]*:/i.test(link)) throw new Error("Invalid internal note link");
    const { path, subpath } = parseLinktext(link);
    const sourcePath = this.host.sourcePath();
    const file = this.host.app.metadataCache.getFirstLinkpathDest(path || sourcePath, sourcePath);
    if (file) { await this.openFile(file, subpath, forceTab); return; }
    // Keep Obsidian's normal missing-note creation behavior, in the selected leaf.
    this.host.saveSession();
    if (!forceTab && this.host.mode() !== "tab") this.host.app.workspace.setActiveLeaf(this.host.leaf, { focus: true });
    await this.host.app.workspace.openLinkText(link, sourcePath, forceTab || this.host.mode() === "tab" ? "tab" : false);
  }
}
