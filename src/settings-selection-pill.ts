import type { LexisSettings } from "./types";
import { positionSelectionPill, type PillOffset } from "./selection-pill-position";

interface Dependencies {
  Setting: typeof import("obsidian").Setting;
  settings: LexisSettings;
  t: (key: string) => string;
  save: () => Promise<void>;
}

export function addSelectionPillPosition(container: HTMLElement, { Setting, settings, t, save }: Dependencies): void {
  let offset: PillOffset = { x: settings.selectionPillOffsetX ?? 0, y: settings.selectionPillOffsetY ?? 0 };
  new Setting(container).setName(t("settings.pillPosition")).setDesc(t("settings.pillPositionDesc"))
    .addExtraButton(button => button.setIcon("reset").setTooltip(t("settings.pillReset")).onClick(() => {
      offset = { x: 0, y: 0 };
      render();
      void persist();
    }));

  const preview = container.createDiv({ cls: "lexis-pill-position-preview" });
  const selection = preview.createSpan({ cls: "lexis-pill-position-selection", text: t("settings.pillPreviewText") });
  const handle = preview.createEl("button", { cls: "lexis-pill-position-handle", text: t("settings.pillDrag") });
  handle.type = "button";
  handle.setAttribute("aria-label", t("settings.pillDragLabel"));
  handle.title = t("settings.pillDragLabel");
  const controls = container.createDiv({ cls: "lexis-pill-position-inputs" });
  const inputs = {} as Record<keyof PillOffset, HTMLInputElement>;
  for (const axis of ["x", "y"] as const) {
    const label = controls.createEl("label");
    label.createSpan({ text: t(axis === "x" ? "settings.pillOffsetX" : "settings.pillOffsetY") });
    const input = label.createEl("input", { type: "number" });
    input.step = "1";
    inputs[axis] = input;
    input.addEventListener("change", () => {
      if (Number.isFinite(input.valueAsNumber)) {
        offset[axis] = Math.round(input.valueAsNumber);
        void persist();
      }
      render();
    });
  }
  function render() {
    preview.style.setProperty("--lexis-pill-x", `${offset.x}px`);
    preview.style.setProperty("--lexis-pill-y", `${offset.y}px`);
    inputs.x.value = String(offset.x);
    inputs.y.value = String(offset.y);
  }
  async function persist() {
    settings.selectionPillOffsetX = offset.x;
    settings.selectionPillOffsetY = offset.y;
    await save();
  }

  let drag: { id: number; x: number; y: number; left: number; top: number; initial: PillOffset } | null = null;
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: handle.offsetLeft, top: handle.offsetTop, initial: { ...offset } };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    const anchor = { left: selection.offsetLeft, bottom: selection.offsetTop + selection.offsetHeight };
    const position = positionSelectionPill(anchor,
      { width: handle.offsetWidth, height: handle.offsetHeight },
      { width: preview.clientWidth, height: preview.clientHeight },
      { x: drag.left + event.clientX - drag.x - anchor.left, y: drag.top + event.clientY - drag.y - anchor.bottom - 6 });
    offset = { x: Math.round(position.left - anchor.left), y: Math.round(position.top - anchor.bottom - 6) };
    render();
  });
  handle.addEventListener("pointerup", event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    handle.releasePointerCapture(event.pointerId);
    void persist();
  });
  const cancelDrag = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    offset = drag.initial;
    drag = null;
    render();
  };
  handle.addEventListener("pointercancel", cancelDrag);
  handle.addEventListener("lostpointercapture", cancelDrag);
  handle.addEventListener("keydown", event => {
    if (drag) return;
    const directions: Record<string, PillOffset> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    const delta = directions[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    offset = { x: offset.x + delta.x * step, y: offset.y + delta.y * step };
    render();
    void persist();
  });
  render();
}
