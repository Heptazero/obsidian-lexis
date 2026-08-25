"use strict";

function moveItem<T>(items: Iterable<T> | ArrayLike<T>, from: number, to: number): T[] {
  const next = Array.from(items || []);
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface ReorderOptions {
  container: HTMLElement;
  onMove: (from: number, to: number) => void | Promise<void>;
  setIcon?: (element: HTMLElement, icon: string) => void;
  label?: string;
  longPressMs?: number;
}

function createReorderController({ container, onMove, setIcon, label = "Reorder", longPressMs = 260 }: ReorderOptions) {
  let from = -1;
  let active = false;
  let timer = 0;
  let pointerId = null;
  let activeHandle: HTMLElement | null = null;
  let draggedRow: HTMLElement | null = null;
  let placeholder: HTMLElement | null = null;
  let savedStyle = null;
  let offsetX = 0;
  let offsetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  const rows = () => Array.from(container.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("lexis-sortable-item"));
  const candidates = () => rows().filter((row) => row !== draggedRow);
  const restoreRow = () => {
    if (!draggedRow) return;
    draggedRow.classList.remove("is-dragging", "is-floating");
    if (savedStyle == null) draggedRow.removeAttribute("style");
    else draggedRow.setAttribute("style", savedStyle);
  };
  const floatingPosition = (x, y) => {
    if (!draggedRow) return;
    draggedRow.setCssStyles({ left: `${Math.round(x - offsetX)}px`, top: `${Math.round(y - offsetY)}px` });
  };
  const targetAt = (x, y) => {
    const doc = container.ownerDocument || document;
    const direct = doc.elementFromPoint?.(x, y)?.closest?.(".lexis-sortable-item");
    if (direct?.parentElement === container && direct !== draggedRow) return direct;
    let nearest = null;
    let distance = Infinity;
    for (const row of candidates()) {
      const rect = row.getBoundingClientRect();
      const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      const score = dx * dx + dy * dy;
      if (score < distance) { nearest = row; distance = score; }
    }
    return nearest;
  };
  const movePlaceholder = (target, x, y) => {
    if (!placeholder || !target) return;
    const rect = target.getBoundingClientRect();
    const view = container.ownerDocument?.defaultView || window;
    const isGrid = view.getComputedStyle?.(container).display === "grid";
    const sameBand = y >= rect.top && y <= rect.bottom;
    const after = isGrid && sameBand ? x > rect.left + rect.width / 2 : y > rect.top + rect.height / 2;
    const reference = after ? target.nextSibling : target;
    if (reference !== placeholder) container.insertBefore(placeholder, reference);
  };
  const begin = (row, handle, index, event) => {
    const doc = container.ownerDocument || document;
    const rect = row.getBoundingClientRect();
    from = index;
    active = true;
    activeHandle = handle;
    draggedRow = row;
    savedStyle = row.getAttribute("style");
    offsetX = pointerX - rect.left;
    offsetY = pointerY - rect.top;
    placeholder = doc.createElement("div");
    placeholder.className = "lexis-sortable-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.setCssStyles({ height: `${Math.ceil(rect.height)}px` });
    container.insertBefore(placeholder, row);
    row.classList.add("is-dragging", "is-floating");
    row.setCssStyles({
      position: "fixed",
      width: `${Math.ceil(rect.width)}px`,
      left: `${Math.round(rect.left)}px`,
      top: `${Math.round(rect.top)}px`,
      margin: "0",
      zIndex: "1000",
      pointerEvents: "none",
    });
    floatingPosition(pointerX, pointerY);
    try { handle.setPointerCapture?.(event.pointerId); } catch (_e) {}
  };
  const finish = () => {
    window.clearTimeout(timer);
    timer = 0;
    const start = from;
    let target = start;
    if (active && placeholder && draggedRow) {
      const order = Array.from(container.children).filter((el) => el === placeholder || (el instanceof HTMLElement && el.classList.contains("lexis-sortable-item") && el !== draggedRow));
      target = order.indexOf(placeholder);
      container.insertBefore(draggedRow, placeholder);
      placeholder.remove();
    }
    restoreRow();
    from = -1;
    active = false;
    if (activeHandle && pointerId != null) {
      try { activeHandle.releasePointerCapture?.(pointerId); } catch (_e) {}
    }
    activeHandle = null;
    pointerId = null;
    draggedRow = null;
    placeholder = null;
    savedStyle = null;
    if (start >= 0 && target >= 0 && start !== target) onMove(start, target);
  };

  return {
    attach(item: HTMLElement, index: number, { handleParent = item }: { handleParent?: HTMLElement } = {}) {
      item.classList.add("lexis-sortable-item");
      handleParent.classList.add("lexis-sortable-row");
      item.dataset.lexisOrder = String(index);
      const handle = handleParent.createEl("button", {
        cls: "lexis-drag-handle clickable-icon",
        attr: { type: "button", "aria-label": label, title: label },
      });
      if (setIcon) setIcon(handle, "grip-vertical");
      else handle.setText("⋮⋮");
      // 拖动柄位于 details/summary 内时，点击只负责排序，不触发展开或折叠。
      handle.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); });

      handle.addEventListener("pointerdown", (event) => {
        if (event.button != null && event.button !== 0) return;
        window.clearTimeout(timer);
        from = index;
        pointerId = event.pointerId;
        pointerX = event.clientX;
        pointerY = event.clientY;
        try { handle.setPointerCapture?.(event.pointerId); } catch (_e) {}
        if (event.pointerType === "touch") timer = window.setTimeout(() => begin(item, handle, index, event), longPressMs);
        else {
          event.preventDefault();
          begin(item, handle, index, event);
        }
      });
      handle.addEventListener("pointermove", (event) => {
        if (event.pointerId !== pointerId) return;
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!active) return;
        event.preventDefault();
        floatingPosition(pointerX, pointerY);
        const target = targetAt(event.clientX, event.clientY);
        movePlaceholder(target, event.clientX, event.clientY);
      }, { passive: false });
      handle.addEventListener("pointerup", (event) => { if (event.pointerId === pointerId) finish(); });
      handle.addEventListener("pointercancel", (event) => { if (event.pointerId === pointerId) finish(); });
      handle.addEventListener("contextmenu", (event) => { if (active) event.preventDefault(); });
    },
  };
}

function addAppearanceButton({ app, obsidian, parent, title, state, onChange, onReset, labels, allowStyle = false }) {
  const button = new obsidian.ExtraButtonComponent(parent).setIcon("palette").setTooltip(title);
  const refreshButton = () => {
    const color = state().color;
    button.extraSettingsEl.setCssStyles({ color: color || "var(--text-accent)" });
  };
  button.onClick(() => {
    const modal = new obsidian.Modal(app);
    modal.onOpen = () => {
      modal.contentEl.empty();
      modal.contentEl.createEl("h3", { text: title });
      new obsidian.Setting(modal.contentEl).setName(labels.color)
        .addColorPicker((picker) => picker.setValue(state().color).onChange(async (color) => { await onChange({ color }); refreshButton(); }));
      new obsidian.Setting(modal.contentEl).setName(labels.opacity)
        .addSlider((slider) => slider.setLimits(0.1, 1, 0.05).setValue(state().opacity).setDynamicTooltip().onChange((opacity) => onChange({ opacity })));
      if (allowStyle) {
        new obsidian.Setting(modal.contentEl).setName(labels.style)
          .addDropdown((dropdown) => dropdown
            .addOption("", labels.defaultStyle)
            .addOption("wavy", labels.wavy)
            .addOption("underline", labels.underline)
            .addOption("background", labels.background)
            .setValue(state().style || "")
            .onChange((style) => onChange({ style })));
      }
      new obsidian.Setting(modal.contentEl)
        .addButton((reset) => reset.setButtonText(labels.reset).onClick(async () => { await onReset(); refreshButton(); modal.close(); }))
        .addButton((done) => done.setButtonText(labels.done).setCta().onClick(() => modal.close()));
    };
    modal.open();
  });
  refreshButton();
  return button;
}

export { addAppearanceButton, createReorderController, moveItem };
