import { Menu } from "obsidian";
import { setSettingsSectionOpen } from "./settings-section";

interface SortableOptions {
  container: HTMLElement;
  label: string;
  axis?: "x" | "y" | "auto";
  longPressMs?: number;
  onOrder(this: void, ids: string[], movedId: string): void;
  populateMenu?(this: void, menu: Menu, id: string): void;
  handleless?: boolean;
  endBoundary?: HTMLElement;
}
interface Pending {
  item: HTMLElement; handle: HTMLElement; pointerId: number; pointerType: string;
  x: number; y: number; lastX: number; lastY: number; timer: number | null;
}
interface Drag {
  item: HTMLElement; placeholder: HTMLElement; next: ChildNode | null; index: number;
  style: string; open: boolean | null; offsetX: number; offsetY: number;
}

/** Settings UI Showcase's six-dot interaction, adapted to Lexis labels and both axes. */
export function createSettingsSortable({ container, label, axis = "y", longPressMs = 320, onOrder, populateMenu, handleless = false, endBoundary }: SortableOptions) {
  let pending: Pending | null = null, active: Drag | null = null, suppressClick = false;
  const items = () => Array.from(container.children).filter((child): child is HTMLElement => child.instanceOf(HTMLElement) && child.classList.contains("lexis-settings-sortable"));
  const ids = () => items().map((item) => item.dataset.lexisSortId);
  const clearTimer = () => { if (pending?.timer != null) window.clearTimeout(pending.timer); if (pending) pending.timer = null; };
  const move = (x: number, y: number) => {
    if (!active) return;
    active.item.style.left = `${Math.round(x - active.offsetX)}px`;
    active.item.style.top = `${Math.round(y - active.offsetY)}px`;
    const target = items().find((item) => {
      if (item === active?.item) return false;
      const rect = item.getBoundingClientRect();
      if (axis === "auto" && getComputedStyle(container).display === "grid") {
        return y < rect.top || (y <= rect.bottom && x < rect.left + rect.width / 2);
      }
      return axis === "x" ? x < rect.left + rect.width / 2 : y < rect.top + rect.height / 2;
    });
    container.insertBefore(active.placeholder, target || endBoundary || null);
  };
  const start = () => {
    if (!pending || active) return;
    const { item, lastX, lastY } = pending;
    if (!item.isConnected) { finish(false); return; }
    const index = items().indexOf(item);
    if (index < 0) return;
    const open = item.tagName === "DETAILS" ? (item as HTMLDetailsElement).open : null;
    if (open) setSettingsSectionOpen(item as HTMLDetailsElement, false);
    const rect = item.getBoundingClientRect(), style = getComputedStyle(item);
    const placeholder = container.createDiv({ cls: "lexis-settings-sort-placeholder" });
    placeholder.style.height = `${Math.ceil(rect.height)}px`;
    if (axis !== "y") placeholder.style.width = `${Math.ceil(rect.width)}px`;
    placeholder.style.marginTop = style.marginTop; placeholder.style.marginBottom = style.marginBottom;
    container.insertBefore(placeholder, item);
    active = { item, placeholder, next: item.nextSibling, index, style: item.style.cssText, open,
      offsetX: lastX - rect.left, offsetY: lastY - rect.top };
    item.classList.add("is-dragging");
    Object.assign(item.style, { position: "fixed", width: `${Math.ceil(rect.width)}px`, margin: "0", pointerEvents: "none", zIndex: "9999" });
    move(lastX, lastY);
  };
  const finish = (commit: boolean) => {
    clearTimer();
    if (active) {
      const { item, placeholder, next, index, style, open } = active;
      container.insertBefore(item, commit ? placeholder : next?.parentNode === container ? next : null);
      placeholder.remove(); item.style.cssText = style; item.classList.remove("is-dragging");
      if (open != null) setSettingsSectionOpen(item as HTMLDetailsElement, open);
      if (commit && items().indexOf(item) !== index) onOrder(ids(), item.dataset.lexisSortId);
      suppressClick = true; window.setTimeout(() => { suppressClick = false; }, 0);
    }
    if (pending) { try { pending.handle.releasePointerCapture(pending.pointerId); } catch { /* Capture may already have ended. */ } }
    pending = null; active = null;
  };
  return {
    attach(item: HTMLElement, heading: HTMLElement, id: string) {
      item.classList.add("lexis-settings-sortable"); item.dataset.lexisSortId = id;
      const handle = handleless ? heading : heading.createEl("button", { cls: "lexis-six-dots", attr: { type: "button", "aria-label": label, title: label } });
      if (!handleless) for (let index = 0; index < 6; index++) handle.createSpan({ cls: "lexis-sort-dot" });
      else handle.setAttribute("title", label);
      const disabled = () => handle.instanceOf(HTMLButtonElement) && handle.disabled || container.closest(".is-searching") != null;
      if (populateMenu) handle.setAttribute("aria-haspopup", "menu");
      handle.addEventListener("click", (event) => {
        if (handleless && !suppressClick) return;
        event.preventDefault(); event.stopPropagation();
        if (handleless) event.stopImmediatePropagation();
        if (suppressClick) { suppressClick = false; return; }
        if (!populateMenu) return;
        const menu = new Menu().setUseNativeMenu(false); populateMenu(menu, id);
        const rect = handle.getBoundingClientRect(); menu.showAtPosition({ x: rect.right, y: rect.bottom }, handle.ownerDocument);
      }, { capture: handleless });
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || pending || disabled()) return;
        pending = { item, handle, pointerId: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, timer: null };
        try { handle.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
        if (event.pointerType === "touch" || handleless) pending.timer = window.setTimeout(start, longPressMs);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!pending || event.pointerId !== pending.pointerId) return;
        pending.lastX = event.clientX; pending.lastY = event.clientY;
        const distance = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
        if (!active && !handleless && pending.pointerType !== "touch" && distance > 5) start();
        if (!active && (pending.pointerType === "touch" || handleless) && distance > 8) { finish(false); return; }
        if (active) { event.preventDefault(); move(event.clientX, event.clientY); }
      }, { passive: false });
      handle.addEventListener("touchmove", (event) => { if (active && event.cancelable) event.preventDefault(); }, { passive: false });
      handle.addEventListener("pointerup", (event) => { if (event.pointerId === pending?.pointerId) finish(true); });
      handle.addEventListener("pointercancel", (event) => { if (event.pointerId === pending?.pointerId) finish(false); });
      handle.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && active) { finish(false); return; }
        const previous = axis === "x" ? "ArrowLeft" : "ArrowUp", next = axis === "x" ? "ArrowRight" : "ArrowDown";
        if (disabled() || !event.altKey || ![previous, next].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const siblings = items(), index = siblings.indexOf(item), target = siblings[index + (event.key === previous ? -1 : 1)];
        if (!target) return;
        container.insertBefore(item, event.key === previous ? target : target.nextSibling);
        onOrder(ids(), id); handle.focus();
      });
      handle.addEventListener("contextmenu", (event) => { if (active) event.preventDefault(); });
    },
  };
}
