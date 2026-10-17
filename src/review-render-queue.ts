import { Component } from "obsidian";

interface RenderJob {
  element: HTMLElement;
  render(component: Component, current: () => boolean): Promise<void>;
  failed(error: unknown): void;
}

/** One viewport queue owns the lifetime and concurrency of native Markdown work. */
export class ReviewRenderQueue {
  private observer: IntersectionObserver | null;
  private waiting = new Map<HTMLElement, RenderJob>();
  private queue: RenderJob[] = [];
  private components = new Map<HTMLElement, Component>();
  private rendering = new Set<HTMLElement>();
  private active = true;

  constructor(private root: HTMLElement) {
    const Observer = root.ownerDocument.defaultView.IntersectionObserver;
    this.observer = Observer ? new Observer((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        const element = entry.target as HTMLElement, job = this.waiting.get(element);
        if (!job) continue;
        this.waiting.delete(element); this.observer.unobserve(element); this.queue.push(job);
      }
      this.drain();
    }, { rootMargin: "120px" }) : null;
  }

  add(element: HTMLElement, render: RenderJob["render"], failed: RenderJob["failed"]): void {
    if (!this.active) return;
    for (const [target, component] of this.components) if (!target.isConnected && !this.rendering.has(target)) {
      component.unload(); this.components.delete(target);
    }
    const job = { element, render, failed };
    if (this.observer) { this.waiting.set(element, job); this.observer.observe(element); }
    else { this.queue.push(job); this.drain(); }
  }

  remove(element: HTMLElement): void {
    this.waiting.delete(element); this.observer?.unobserve(element);
    this.queue = this.queue.filter((job) => job.element !== element);
    if (!this.rendering.has(element)) { this.components.get(element)?.unload(); this.components.delete(element); }
    // Detached in-flight work releases its component in run() when it settles.
  }

  reset(): void {
    this.observer?.disconnect(); this.waiting.clear(); this.queue = [];
    for (const [element, component] of this.components) if (!this.rendering.has(element)) {
      component.unload(); this.components.delete(element);
    }
  }

  dispose(): void { this.active = false; this.reset(); }

  private current(element: HTMLElement): boolean { return this.active && element.isConnected && this.root.contains(element); }

  private drain(): void {
    while (this.active && this.rendering.size < 2 && this.queue.length) {
      const job = this.queue.shift();
      if (!this.current(job.element)) continue;
      this.rendering.add(job.element);
      void this.run(job).finally(() => { this.rendering.delete(job.element); this.drain(); });
    }
  }

  private async run(job: RenderJob): Promise<void> {
    const component = new Component(); component.load(); this.components.set(job.element, component);
    try {
      job.element.empty();
      await job.render(component, () => this.current(job.element));
    } catch (error) {
      if (this.current(job.element)) job.failed(error);
    } finally {
      if (!this.current(job.element)) { component.unload(); this.components.delete(job.element); }
    }
  }
}
