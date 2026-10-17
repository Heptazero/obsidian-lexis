import { overlayDocumentFor } from "./reader-frame-geometry";

type Clock = Pick<Window, "setTimeout" | "clearTimeout">;
type Pending = { clock: Clock; id: number };

interface HoverHost {
  readonly _popover: HTMLElement | null;
  showPopover(target: HTMLElement): Promise<void>;
  removePopover(): void;
}

/** Hover timing belongs to this session, not the plugin or the rendering module. */
export class ReaderHover {
  private showing: Pending | null = null;
  private hiding: Pending | null = null;
  private target: HTMLElement | null = null;
  private surfaceTarget: HTMLElement | null = null;

  constructor(private readonly host: HoverHost, private readonly clock: Clock = window) {}

  enter(target: HTMLElement, delay: number): void {
    this.keepOpen();
    if (this.host._popover?.dataset.lexisKey === target.dataset.lexisKey || this.target === target) return;
    this.cancelOpen();
    this.target = target;
    const open = () => {
      this.showing = null;
      if (this.target === target && target.isConnected) void this.host.showPopover(target);
    };
    if (delay) {
      const clock = overlayDocumentFor(target).defaultView || this.clock;
      this.showing = { clock, id: clock.setTimeout(open, delay) };
    } else open();
  }

  leave(target: HTMLElement): void {
    if (this.target === target) this.cancelOpen();
    if (this.host._popover?.dataset.lexisKey === target.dataset.lexisKey) this.scheduleHide();
  }

  move(target: HTMLElement | null, insidePopover: boolean): boolean {
    if (target === this.surfaceTarget) return false;
    if (this.surfaceTarget) {
      this.cancelOpen();
      if (!insidePopover) this.scheduleHide();
    }
    this.surfaceTarget = target;
    return true;
  }

  keepOpen(): void {
    if (this.hiding) this.hiding.clock.clearTimeout(this.hiding.id);
    this.hiding = null;
  }

  scheduleHide(): void {
    this.keepOpen();
    const clock = this.host._popover?.ownerDocument.defaultView || this.clock;
    this.hiding = { clock, id: clock.setTimeout(() => {
      this.hiding = null;
      const popover = this.host._popover;
      if (popover?.dataset.lexisResizing !== "1" && popover?.dataset.lexisEditing !== "1") this.host.removePopover();
    }, 220) };
  }

  cancelOpen(): void {
    if (this.showing) this.showing.clock.clearTimeout(this.showing.id);
    this.showing = null;
    this.target = null;
  }

  dispose(): void {
    this.cancelOpen();
    this.keepOpen();
    this.surfaceTarget = null;
  }
}
