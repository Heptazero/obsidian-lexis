interface Size { width: number; height: number }
interface SelectionAnchor { left: number; bottom: number }
export interface PillOffset { x: number; y: number }

/** Offsets are measured from the selection's bottom-left corner, with a 6px gap. */
export function positionSelectionPill(anchor: SelectionAnchor, pill: Size, viewport: Size, offset: PillOffset): { left: number; top: number } {
  const clamp = (value: number, extent: number, size: number) => Math.max(6, Math.min(value, extent - size - 6));
  return {
    left: clamp(anchor.left + offset.x, viewport.width, pill.width),
    top: clamp(anchor.bottom + 6 + offset.y, viewport.height, pill.height),
  };
}
