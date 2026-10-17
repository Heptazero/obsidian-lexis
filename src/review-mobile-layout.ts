import type { Component } from "obsidian";

/** The scroll container reserves the actual area covered by the floating controls. */
export function reviewBottomClearance(viewBottom: number, viewportBottom: number, barTop: number, barHeight: number): number {
  return barHeight > 0 ? Math.max(0, Math.ceil(Math.min(viewBottom, viewportBottom) - barTop)) + 12 : 12;
}

export function isMobileReview(document: Document): boolean {
  return document.body.matches(".is-phone, .is-tablet, .is-mobile");
}

export class ReviewMobileLayout {
  private frame = 0;
  private stopped = false;
  private observedBar: HTMLElement | null = null;
  private observedNavbar: HTMLElement | null = null;
  private observer: ResizeObserver;
  private styles: MutationObserver;
  private spacer: HTMLElement;
  private readonly window: Window & { ResizeObserver: typeof ResizeObserver; MutationObserver: typeof MutationObserver };

  constructor(component: Component, private container: HTMLElement, private content: HTMLElement, private bar: () => HTMLElement | null) {
    this.window = container.ownerDocument.defaultView;
    this.spacer = content.createDiv({ cls: "lexis-rv-bottom-spacer", attr: { "aria-hidden": "true" } });
    this.observer = new this.window.ResizeObserver(() => this.schedule());
    this.styles = new this.window.MutationObserver(() => this.schedule());
    this.styles.observe(container, { attributes: true, attributeFilter: ["style"] });
    this.observer.observe(container);
    component.registerDomEvent(this.window, "resize", () => this.schedule());
    if (this.window.visualViewport) {
      const viewport = this.window.visualViewport, changed = () => this.schedule();
      viewport.addEventListener("resize", changed); viewport.addEventListener("scroll", changed);
      component.register(() => { viewport.removeEventListener("resize", changed); viewport.removeEventListener("scroll", changed); });
    }
    component.register(() => this.dispose());
  }

  schedule(): void {
    if (this.stopped || this.frame) return;
    this.frame = this.window.requestAnimationFrame(() => { this.frame = 0; this.update(); });
  }

  update(): void {
    if (this.stopped || !isMobileReview(this.container.ownerDocument)) return;
    const bar = this.bar();
    if (bar !== this.observedBar) {
      if (this.observedBar) this.observer.unobserve(this.observedBar);
      this.observedBar = bar;
      if (bar) this.observer.observe(bar);
    }
    const navbar = this.container.ownerDocument.querySelector<HTMLElement>(".mobile-navbar");
    if (navbar !== this.observedNavbar) {
      if (this.observedNavbar) this.observer.unobserve(this.observedNavbar);
      this.observedNavbar = navbar;
      if (navbar) this.observer.observe(navbar);
    }
    const viewport = this.window.visualViewport;
    const viewportBottom = viewport ? viewport.offsetTop + viewport.height : this.window.innerHeight;
    const navbarRect = navbar?.getBoundingClientRect();
    const navbarOverlap = navbarRect?.height ? Math.max(0, viewportBottom - navbarRect.top) : 0;
    const coveredViewport = Math.max(0, this.window.innerHeight - viewportBottom);
    const gap = `${Math.ceil(coveredViewport + navbarOverlap)}px`;
    if (this.container.style.getPropertyValue("--lexis-mobile-navbar-height") !== gap) this.container.style.setProperty("--lexis-mobile-navbar-height", gap);
    const rect = bar?.getBoundingClientRect();
    const clearance = reviewBottomClearance(this.content.getBoundingClientRect().bottom, viewportBottom, rect?.top || 0, rect?.height || 0);
    this.content.style.setProperty("--lexis-mobile-review-clearance", `${clearance}px`);
    // A real flex item contributes to scroll height even when end padding is not scrollable.
    if (this.content.lastElementChild !== this.spacer) this.content.appendChild(this.spacer);
    this.spacer.style.height = `${clearance}px`;
    this.content.style.scrollPaddingBottom = `${clearance}px`;
  }

  dispose(): void {
    this.stopped = true;
    this.observer.disconnect();
    this.styles.disconnect();
    this.spacer.remove();
    if (this.frame) this.window.cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
