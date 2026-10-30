interface Size { width: number; height: number }
interface SelectionAnchor { left: number; bottom: number }
interface SelectionRect extends SelectionAnchor { top: number; width: number }
export interface PillOffset { x: number; y: number }

/** Client-local visual size; never read from the bridge's shared style config. */
export function normalizePillScale(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1.5, Math.max(0.75, Math.round(value * 100) / 100)) : 1;
}

/** Offsets are measured from the selection's bottom-left corner, with a 6px gap. */
export function positionSelectionPill(anchor: SelectionAnchor, pill: Size, viewport: Size, offset: PillOffset): { left: number; top: number } {
  const clamp = (value: number, extent: number, size: number) => Math.max(6, Math.min(value, extent - size - 6));
  return {
    left: clamp(anchor.left + offset.x, viewport.width, pill.width),
    top: clamp(anchor.bottom + 6 + offset.y, viewport.height, pill.height),
  };
}

export function normalizePillOffset(value: unknown): PillOffset {
  const record = value && typeof value === "object" ? value as Partial<PillOffset> : {};
  const number = (input: unknown) => typeof input === "number" && Number.isFinite(input) ? Math.round(input) : 0;
  return { x: number(record.x), y: number(record.y) };
}

/** Preserve browser centering and the default bottom-edge flip; offsets stay local. */
export function positionBrowserSelectionPill(rect: SelectionRect, pill: Size, viewport: Size, offset: PillOffset): { left: number; top: number } {
  const left = rect.left + (rect.width - pill.width) / 2;
  const bottom = offset.y === 0 && rect.bottom + 6 + pill.height > viewport.height - 6
    ? rect.top - pill.height - 12 : rect.bottom;
  return positionSelectionPill({ left, bottom }, pill, viewport, offset);
}
